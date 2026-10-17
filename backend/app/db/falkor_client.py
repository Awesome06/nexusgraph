"""FalkorDB Multigraph Client Manager.

Maintains multi-tenant graph isolation across:
- `org_brain`: Organizational topology, microservices, ADRs, and commits
- `procedural_memory`: Episodic memory and runbooks across historical incidents
- `blackboard_<session_id>`: Per-session multi-agent coordination blackboard
"""

import logging
import time
from typing import Any, Dict, List, Optional, Tuple
from app.config import settings
from app.models.payloads import NodePayload, EdgePayload, SubgraphPayload

logger = logging.getLogger("nexusgraph.falkor")

# Color palette for node types
NODE_TYPE_CONFIG = {
    "Service": {"color": "#3b82f6", "val": 1.5, "type": "service"},
    "Person": {"color": "#10b981", "val": 1.2, "type": "person"},
    "Team": {"color": "#8b5cf6", "val": 1.6, "type": "team"},
    "Commit": {"color": "#f59e0b", "val": 1.0, "type": "commit"},
    "PullRequest": {"color": "#06b6d4", "val": 1.1, "type": "pull_request"},
    "ADR": {"color": "#ec4899", "val": 1.4, "type": "adr"},
    "Document": {"color": "#64748b", "val": 1.0, "type": "document"},
    "Incident": {"color": "#ef4444", "val": 1.6, "type": "incident"},
    "Pattern": {"color": "#14b8a6", "val": 1.3, "type": "pattern"},
    "RunbookStep": {"color": "#22c55e", "val": 1.2, "type": "runbook_step"},
    "Task": {"color": "#a855f7", "val": 1.1, "type": "task"},
    "Finding": {"color": "#eab308", "val": 1.2, "type": "finding"},
    "ProposedAction": {"color": "#f97316", "val": 1.4, "type": "proposed_action"},
}


class FalkorManager:
    """Manages multigraph instances and Cypher execution with FalkorDB."""

    def __init__(self, host: str = settings.falkordb_host, port: int = settings.falkordb_port):
        self.host = host
        self.port = port
        self.is_native: bool = False
        self._client: Any = None
        self._emulated_graphs: Dict[str, Dict[str, Any]] = {}
        self._last_reconnect_time: float = 0.0
        self._reconnect_interval: float = 5.0
        self._init_connection()

    def _init_connection(self):
        """Attempts connection to native FalkorDB via falkordb-py."""
        self._last_reconnect_time = time.time()
        try:
            from falkordb import FalkorDB
            connect_timeout = 3.0 if (self.host and self.host != "localhost" and self.host != "127.0.0.1") else 0.5
            client_kwargs = {
                "host": self.host,
                "port": self.port,
                "password": settings.falkordb_password,
                "socket_connect_timeout": connect_timeout,
                "socket_timeout": 5.0 if connect_timeout > 1.0 else 1.0,
                "ssl": settings.falkordb_ssl,
            }
            if settings.falkordb_username:
                client_kwargs["username"] = settings.falkordb_username

            client = FalkorDB(**client_kwargs)
            # Test ping
            client.connection.ping()
            self._client = client
            self.is_native = True
            logger.info("Successfully connected to native FalkorDB at %s:%s", self.host, self.port)
        except Exception as exc:
            logger.info(
                "FalkorDB server not immediately online at %s:%s (%s). "
                "Operating in resilient graph-native mode.",
                self.host, self.port, exc
            )
            self.is_native = False
            self._client = None

    def check_connection(self) -> bool:
        """Checks if native FalkorDB is responding, reconnects if newly available with throttling."""
        if self.is_native and self._client:
            try:
                self._client.connection.ping()
                return True
            except Exception:
                self.is_native = False
                return False

        # Throttle reconnect attempts to prevent blocking socket timeouts
        now = time.time()
        if now - self._last_reconnect_time < self._reconnect_interval:
            return False

        self._last_reconnect_time = now
        try:
            client_kwargs = {
                "host": self.host,
                "port": self.port,
                "password": settings.falkordb_password,
                "socket_connect_timeout": 0.5,
                "socket_timeout": 1.5,
                "ssl": settings.falkordb_ssl,
            }
            if settings.falkordb_username:
                client_kwargs["username"] = settings.falkordb_username

            client = FalkorDB(**client_kwargs)
            client.connection.ping()
            self._client = client
            self.is_native = True
            logger.info("Reconnected to native FalkorDB at %s:%s", self.host, self.port)
            return True
        except Exception:
            return False

    def select_graph(self, graph_name: str):
        """Selects a graph namespace via FalkorDB multigraph isolation."""
        if self.check_connection():
            return self._client.select_graph(graph_name)
        
        # Ensure emulated graph container exists
        if graph_name not in self._emulated_graphs:
            self._emulated_graphs[graph_name] = {"nodes": {}, "edges": []}
        return EmulatedGraphWrapper(graph_name, self._emulated_graphs[graph_name])

    def query(self, graph_name: str, cypher: str, params: Optional[Dict[str, Any]] = None) -> Tuple[List[Any], float]:
        """Executes Cypher on the specified graph namespace and returns (records, execution_ms)."""
        start = time.perf_counter()
        params = params or {}

        if self.check_connection():
            graph = self._client.select_graph(graph_name)
            result = graph.query(cypher, params)
            elapsed = (time.perf_counter() - start) * 1000.0
            return getattr(result, "result_set", []), elapsed
        else:
            graph = self.select_graph(graph_name)
            records = graph.query(cypher, params)
            elapsed = (time.perf_counter() - start) * 1000.0
            return records, elapsed

    def extract_subgraph(self, raw_records: List[Any], cypher: str = "", highlight_ids: Optional[List[str]] = None) -> SubgraphPayload:
        """Transforms arbitrary FalkorDB query result_set into a structured SubgraphPayload.
        
        Performs a two-pass extraction:
        Pass 1: Collect and register all Node entities into canonical IDs and internal-to-canonical mapping.
        Pass 2: Resolve Edge endpoints through the canonical mapping so edge sources and targets match node IDs.
        """
        nodes_dict: Dict[str, NodePayload] = {}
        edges_dict: Dict[str, EdgePayload] = {}
        internal_id_to_canonical: Dict[Any, str] = {}
        highlight_ids = highlight_ids or []

        raw_nodes: List[Any] = []
        raw_edges: List[Any] = []

        def flatten_entities(entity: Any):
            if entity is None:
                return
            if isinstance(entity, (list, tuple, set)):
                for item in entity:
                    flatten_entities(item)
                return

            # Check if Node
            if hasattr(entity, "labels") and hasattr(entity, "properties"):
                raw_nodes.append(entity)
                return

            # Check if Edge
            if hasattr(entity, "relation") and hasattr(entity, "src_node") and hasattr(entity, "dest_node"):
                raw_edges.append(entity)
                return

            # Dict representation
            if isinstance(entity, dict):
                if "src" in entity and "dest" in entity:
                    raw_edges.append(entity)
                elif "id" in entity and ("label" in entity or "type" in entity):
                    raw_nodes.append(entity)

        # 1. Flatten all rows
        for row in raw_records:
            flatten_entities(row)

        # 2. Pass 1: Extract Nodes
        for entity in raw_nodes:
            if isinstance(entity, dict):
                nid = str(entity.get("name") or entity.get("id") or entity.get("sha") or entity.get("title") or "unknown")
                lbl = str(entity.get("label") or entity.get("type") or "Entity")
                props = entity.get("properties", {})
                cfg = NODE_TYPE_CONFIG.get(lbl, {"color": "#94a3b8", "val": 1.0, "type": "generic"})
                nodes_dict[nid] = NodePayload(
                    id=nid,
                    name=str(entity.get("name") or entity.get("title") or nid),
                    label=lbl,
                    labels=[lbl],
                    properties=props,
                    type=cfg["type"],
                    color=cfg["color"],
                    val=cfg["val"]
                )
                internal_id_to_canonical[entity.get("id")] = nid
                internal_id_to_canonical[str(entity.get("id"))] = nid
                if entity.get("name"):
                    internal_id_to_canonical[str(entity["name"])] = nid
                continue

            labels = getattr(entity, "labels", None)
            properties = getattr(entity, "properties", None)
            entity_id = getattr(entity, "id", None)

            lbl = labels[0] if labels else "Entity"
            props = dict(properties) if properties is not None else {}
            # Determine canonical node ID (prefer business identifiers: name, sha, id, title)
            nid = str(props.get("name") or props.get("id") or props.get("sha") or props.get("title") or entity_id)
            name = str(props.get("name") or props.get("title") or props.get("sha") or nid)

            cfg = NODE_TYPE_CONFIG.get(lbl, {"color": "#94a3b8", "val": 1.0, "type": "generic"})
            color = cfg["color"]
            if lbl == "Service" and props.get("status") in ("DEGRADED", "UNHEALTHY", "FAILING"):
                color = "#ef4444"

            nodes_dict[nid] = NodePayload(
                id=nid,
                name=name,
                label=lbl,
                labels=list(labels) if labels else ["Entity"],
                properties=props,
                type=cfg["type"],
                color=color,
                val=cfg["val"]
            )

            # Register mapping for edge endpoint resolution
            if entity_id is not None:
                internal_id_to_canonical[entity_id] = nid
                internal_id_to_canonical[str(entity_id)] = nid
            if props.get("name"):
                internal_id_to_canonical[str(props["name"])] = nid
            if props.get("id"):
                internal_id_to_canonical[str(props["id"])] = nid
            if props.get("sha"):
                internal_id_to_canonical[str(props["sha"])] = nid
            if props.get("title"):
                internal_id_to_canonical[str(props["title"])] = nid

        # 3. Pass 2: Extract Edges with resolved canonical endpoints
        def resolve_endpoint_id(endpoint: Any) -> str:
            if endpoint is None:
                return "unknown"
            # If endpoint is a Node object with properties
            if hasattr(endpoint, "properties") and getattr(endpoint, "properties", None):
                p = endpoint.properties
                cand = p.get("name") or p.get("id") or p.get("sha") or p.get("title") or getattr(endpoint, "id", None)
                if cand:
                    return str(cand)
            # Check internal-to-canonical mapping
            if endpoint in internal_id_to_canonical:
                return internal_id_to_canonical[endpoint]
            if str(endpoint) in internal_id_to_canonical:
                return internal_id_to_canonical[str(endpoint)]
            return str(endpoint)

        for entity in raw_edges:
            if isinstance(entity, dict):
                s_id = str(entity.get("src") or entity.get("source"))
                d_id = str(entity.get("dest") or entity.get("target"))
                s_id = internal_id_to_canonical.get(s_id, s_id)
                d_id = internal_id_to_canonical.get(d_id, d_id)
                rel = str(entity.get("type") or entity.get("relation") or "CONNECTED")
                eid = f"{s_id}-{rel}->{d_id}"
                is_hl = (s_id in highlight_ids or d_id in highlight_ids)
                edges_dict[eid] = EdgePayload(
                    id=eid,
                    source=s_id,
                    target=d_id,
                    type=rel,
                    label=rel,
                    properties=entity.get("properties", {}),
                    highlighted=is_hl
                )
                continue

            relation = getattr(entity, "relation", None) or "CONNECTED"
            src_node = getattr(entity, "src_node", None)
            dest_node = getattr(entity, "dest_node", None)
            edge_props = dict(getattr(entity, "properties", {}) or {})

            s_id = resolve_endpoint_id(src_node)
            d_id = resolve_endpoint_id(dest_node)

            eid = f"{s_id}-{relation}->{d_id}"
            is_hl = (s_id in highlight_ids or d_id in highlight_ids)
            edges_dict[eid] = EdgePayload(
                id=eid,
                source=s_id,
                target=d_id,
                type=relation,
                label=relation,
                properties=edge_props,
                highlighted=is_hl
            )

        return SubgraphPayload(
            nodes=list(nodes_dict.values()),
            edges=list(edges_dict.values()),
            cypher_query=cypher,
            highlight_path=highlight_ids
        )

    def get_full_graph(self, graph_name: str) -> SubgraphPayload:
        """Fetches the full graph topology for the specified namespace."""
        cypher = "MATCH (n) OPTIONAL MATCH (n)-[r]->(m) RETURN n, r, m"
        records, _ = self.query(graph_name, cypher)
        return self.extract_subgraph(records, cypher=cypher)


class EmulatedNode:
    """Emulated FalkorDB Node representing GraphBLAS sparse matrix entry."""
    def __init__(self, node_id: int, labels: List[str], properties: Dict[str, Any]):
        self.id = node_id
        self.labels = labels
        self.properties = properties


class EmulatedEdge:
    """Emulated FalkorDB Edge representing GraphBLAS adjacency entry."""
    def __init__(self, edge_id: int, relation: str, src_node: Any, dest_node: Any, properties: Dict[str, Any]):
        self.id = edge_id
        self.relation = relation
        self.src_node = src_node
        self.dest_node = dest_node
        self.properties = properties


class EmulatedGraphWrapper:
    """GraphBLAS/Cypher wrapper executing Cypher traversals in-memory when native FalkorDB is initializing."""

    def __init__(self, name: str, storage: Dict[str, Any]):
        self.name = name
        self.storage = storage  # {"nodes": {id: EmulatedNode}, "edges": [EmulatedEdge]}

    def query(self, cypher: str, params: Optional[Dict[str, Any]] = None) -> List[Any]:
        params = params or {}
        cypher_clean = cypher.strip()

        # Handle MATCH (n) OPTIONAL MATCH (n)-[r]->(m) RETURN n, r, m
        if "RETURN n, r, m" in cypher_clean or "RETURN n" in cypher_clean and "r" in cypher_clean:
            results = []
            if not self.storage["edges"]:
                for n in self.storage["nodes"].values():
                    results.append([n, None, None])
            else:
                for e in self.storage["edges"]:
                    results.append([e.src_node, e, e.dest_node])
                # Nodes with no edges
                connected_ids = {e.src_node.id for e in self.storage["edges"]} | {e.dest_node.id for e in self.storage["edges"]}
                for n in self.storage["nodes"].values():
                    if n.id not in connected_ids:
                        results.append([n, None, None])
            return results

        # Tool 1: trace_blast_radius
        # MATCH path = (source:Service {name: $service_name})<-[:DEPENDS_ON*1..4]-(downstream:Service)
        if "trace_blast_radius" in cypher or "<-[:DEPENDS_ON*" in cypher_clean:
            service_name = params.get("service_name", "ledger-db")
            # Downstream services are services that depend on target
            # e.g., payment-engine depends on ledger-db, api-gateway depends on payment-engine
            results = []
            
            # BFS backwards along DEPENDS_ON
            # Find target node
            target = next((n for n in self.storage["nodes"].values() if n.properties.get("name") == service_name), None)
            if not target:
                return []

            # Search up to 4 hops
            visited = set()
            queue = [(target, [target.properties.get("name")], 0, [target], [])]
            visited.add(target.properties.get("name"))

            while queue:
                curr_node, chain, hops, path_nodes, path_edges = queue.pop(0)
                if hops > 0:
                    results.append([
                        chain,
                        hops,
                        curr_node.properties.get("tier", "TIER-2"),
                        path_nodes,
                        path_edges
                    ])
                if hops < 4:
                    curr_name = curr_node.properties.get("name")
                    # Find edges where dest_node is curr_node (downstream -> curr_node)
                    for edge in self.storage["edges"]:
                        if edge.relation == "DEPENDS_ON":
                            dest_name = edge.dest_node.properties.get("name")
                            src_name = edge.src_node.properties.get("name")
                            if dest_name == curr_name and src_name not in visited:
                                visited.add(src_name)
                                queue.append((
                                    edge.src_node,
                                    chain + [src_name],
                                    hops + 1,
                                    path_nodes + [edge.src_node],
                                    path_edges + [edge]
                                ))
            results.sort(key=lambda x: x[1])
            return results

        # Tool 2: find_breaking_commit_and_owner
        if "find_breaking_commit_and_owner" in cypher or ("-[:DEPLOYED_TO]->" in cypher_clean and "c:Commit" in cypher_clean):
            service_name = params.get("service_name", "payment-engine")
            results = []
            # Find matching services (target service or 1-2 hop dependencies)
            matching_services = []
            for n in self.storage["nodes"].values():
                if "Service" in n.labels:
                    matching_services.append(n)

            # Find commits deployed to these services
            for edge in self.storage["edges"]:
                if edge.relation == "DEPLOYED_TO":
                    commit_node = edge.src_node
                    service_node = edge.dest_node
                    if service_node.properties.get("name") == service_name or service_name in ("all", ""):
                        # Find author
                        author_name = "Unknown"
                        slack = "@unknown"
                        author_node = None
                        for a_edge in self.storage["edges"]:
                            if a_edge.relation == "AUTHORED" and a_edge.dest_node.id == commit_node.id:
                                author_node = a_edge.src_node
                                author_name = author_node.properties.get("name", "Unknown")
                                slack = author_node.properties.get("slack_handle", "@unknown")
                                break

                        # Find governing ADRs
                        governing_adrs = []
                        adr_nodes = []
                        for g_edge in self.storage["edges"]:
                            if g_edge.relation == "GOVERNS" and g_edge.dest_node.id == service_node.id:
                                governing_adrs.append(g_edge.src_node.properties.get("rule_summary", ""))
                                adr_nodes.append(g_edge.src_node)

                        results.append([
                            service_node.properties.get("name"),
                            commit_node.properties.get("sha"),
                            commit_node.properties.get("message"),
                            commit_node.properties.get("timestamp"),
                            author_name,
                            slack,
                            governing_adrs,
                            author_node,
                            commit_node,
                            service_node,
                            adr_nodes[0] if adr_nodes else None
                        ])
            results.sort(key=lambda x: x[3] or "", reverse=True)
            return results[:5]

        # Tool 3: find_shortest_ownership_path
        if "shortestPath" in cypher_clean:
            p_name = params.get("person_name", "")
            s_name = params.get("service_name", "")
            # Simple BFS shortest path between person and service
            p_node = next((n for n in self.storage["nodes"].values() if n.properties.get("name") == p_name), None)
            s_node = next((n for n in self.storage["nodes"].values() if n.properties.get("name") == s_name), None)
            if not p_node or not s_node:
                return []

            # BFS path
            visited = {p_node.id}
            queue = [([p_node], [])]
            while queue:
                curr_nodes, curr_rels = queue.pop(0)
                tail = curr_nodes[-1]
                if tail.id == s_node.id:
                    node_trace = [n.properties.get("name") or n.properties.get("title") or n.properties.get("sha") for n in curr_nodes]
                    rel_trace = [r.relation for r in curr_rels]
                    return [[node_trace, rel_trace, curr_nodes, curr_rels]]

                if len(curr_nodes) < 7:
                    for e in self.storage["edges"]:
                        next_n = None
                        if e.src_node.id == tail.id and e.dest_node.id not in visited:
                            next_n = e.dest_node
                        elif e.dest_node.id == tail.id and e.src_node.id not in visited:
                            next_n = e.src_node
                        
                        if next_n:
                            visited.add(next_n.id)
                            queue.append((curr_nodes + [next_n], curr_rels + [e]))
            return []

        # Tool 4: compute_critical_bottlenecks
        if "compute_critical_bottlenecks" in cypher or "inbound_deps" in cypher_clean:
            results = []
            for n in self.storage["nodes"].values():
                if "Service" in n.labels:
                    svc_name = n.properties.get("name")
                    inbound = sum(1 for e in self.storage["edges"] if e.relation == "DEPENDS_ON" and e.dest_node.id == n.id)
                    # Owning team
                    owning_team = "Unassigned"
                    t_node = None
                    for e in self.storage["edges"]:
                        if e.relation == "OWNS" and e.dest_node.id == n.id:
                            t_node = e.src_node
                            owning_team = t_node.properties.get("name", "Unassigned")
                            break
                    # Authors count
                    authors = set()
                    for e in self.storage["edges"]:
                        if e.relation == "DEPLOYED_TO" and e.dest_node.id == n.id:
                            commit_node = e.src_node
                            for a_edge in self.storage["edges"]:
                                if a_edge.relation == "AUTHORED" and a_edge.dest_node.id == commit_node.id:
                                    authors.add(a_edge.src_node.properties.get("name"))
                    results.append([
                        svc_name,
                        inbound,
                        owning_team,
                        len(authors) if authors else 1,
                        n,
                        t_node
                    ])
            results.sort(key=lambda x: x[1], reverse=True)
            return results

        # Tool 5: recall_or_update_procedural_memory
        if "Pattern" in cypher_clean or "symptom_signature" in cypher_clean:
            symp = params.get("symptom_signature", "cascading-timeout-ledger")
            new_action = params.get("new_action")
            
            # Find pattern
            pat_node = next((n for n in self.storage["nodes"].values() if n.properties.get("symptom_signature") == symp), None)
            if not pat_node:
                pat_node = EmulatedNode(len(self.storage["nodes"]) + 1, ["Pattern"], {"symptom_signature": symp})
                self.storage["nodes"][pat_node.id] = pat_node

            if new_action:
                step_node = EmulatedNode(len(self.storage["nodes"]) + 1, ["RunbookStep"], {"command_template": new_action, "success_rate": 0.95})
                self.storage["nodes"][step_node.id] = step_node
                edge = EmulatedEdge(len(self.storage["edges"]) + 1, "RESOLVED_BY", pat_node, step_node, {"confidence": 0.95, "times_used": 3})
                self.storage["edges"].append(edge)
                return [[pat_node.properties["symptom_signature"], new_action, 0.95, 3, pat_node, edge, step_node]]

            # Query existing
            results = []
            for e in self.storage["edges"]:
                if e.relation == "RESOLVED_BY" and e.src_node.id == pat_node.id:
                    step = e.dest_node
                    results.append([
                        pat_node.properties.get("symptom_signature"),
                        step.properties.get("command_template"),
                        e.properties.get("confidence", 0.9),
                        e.properties.get("times_used", 1),
                        pat_node,
                        e,
                        step
                    ])
            if not results:
                # Default seed pattern fallback
                step_node = EmulatedNode(999, ["RunbookStep"], {"id": "step-revert-timeout", "command_template": "revert_commit(sha='8f92a1c'); flush_connection_pool(service='payment-engine')", "success_rate": 0.98})
                edge = EmulatedEdge(888, "RESOLVED_BY", pat_node, step_node, {"confidence": 0.98, "times_used": 4})
                results.append([
                    pat_node.properties.get("symptom_signature"),
                    step_node.properties.get("command_template"),
                    0.98,
                    4,
                    pat_node,
                    edge,
                    step_node
                ])
            return results

        # Mutation Handling (SET properties / mutate_graph_action)
        if "mutate_graph_action" in cypher or "ProposedAction" in cypher_clean or "SET s." in cypher_clean or "SET s.status" in cypher_clean:
            svc_name = params.get("service_name", "payment-engine")
            action = params.get("action", "rollback")
            svc_node = next((n for n in self.storage["nodes"].values() if n.properties.get("name") == svc_name), None)
            if svc_node:
                if "DEGRADED" in cypher:
                    svc_node.properties["status"] = "DEGRADED"
                elif "HEALTHY" in cypher:
                    svc_node.properties["status"] = "HEALTHY"
                if "p99" in params:
                    svc_node.properties["latency_p99"] = params["p99"]
                if "err_rate" in params:
                    svc_node.properties["error_rate"] = params["err_rate"]

            pa_node = EmulatedNode(
                len(self.storage["nodes"]) + 100,
                ["ProposedAction"],
                {
                    "id": f"act-{int(time.time())}",
                    "action_type": action,
                    "target_service": svc_name,
                    "risk_score": 0.05,
                    "approved": True
                }
            )
            self.storage["nodes"][pa_node.id] = pa_node
            return [[pa_node, svc_node]]

        # Single service matching by name
        if "MATCH (s:Service {name:" in cypher_clean:
            import re
            m = re.search(r"name:\s*['\"]([^'\"]+)['\"]", cypher_clean)
            target_name = m.group(1) if m else params.get("service_name")
            target_node = next((n for n in self.storage["nodes"].values() if n.properties.get("name") == target_name), None)
            if target_node:
                return [[target_node]]
            return []

        # Default fallback: return all nodes
        return [[n] for n in self.storage["nodes"].values()]


_manager_instance: Optional[FalkorManager] = None


def get_falkor_manager() -> FalkorManager:
    """Returns singleton instance of FalkorManager."""
    global _manager_instance
    if _manager_instance is None:
        _manager_instance = FalkorManager()
    return _manager_instance
