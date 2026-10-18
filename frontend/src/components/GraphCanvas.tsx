"use client";

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RefreshCw,
  Layers,
  Info,
  Filter,
  Sparkles,
  GitBranch,
  Target,
  Activity,
  X,
  ExternalLink,
  Shield,
  Clock,
  Compass,
  ArrowRight,
  ChevronRight,
  Database,
  Cpu,
} from "lucide-react";

export interface GraphNode {
  id: string;
  name?: string;
  label: string;
  labels?: string[];
  properties?: Record<string, any>;
  color?: string;
  val?: number;
  type?: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  targetX?: number;
  targetY?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  label?: string;
  properties?: Record<string, any>;
  highlighted?: boolean;
}

interface GraphCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  highlightIds: string[];
  activeGraphName: string;
  onRefresh?: () => void;
  isLoading?: boolean;
}

const COLOR_MAP: Record<string, { bg: string; border: string; glow: string }> = {
  Service: { bg: "#2563eb", border: "#60a5fa", glow: "rgba(59, 130, 246, 0.4)" },
  Person: { bg: "#059669", border: "#34d399", glow: "rgba(16, 185, 129, 0.4)" },
  Team: { bg: "#7c3aed", border: "#a78bfa", glow: "rgba(139, 92, 246, 0.4)" },
  Commit: { bg: "#d97706", border: "#fbbf24", glow: "rgba(245, 158, 11, 0.4)" },
  ADR: { bg: "#db2777", border: "#f472b6", glow: "rgba(236, 72, 153, 0.4)" },
  Document: { bg: "#475569", border: "#94a3b8", glow: "rgba(100, 116, 139, 0.3)" },
  Incident: { bg: "#dc2626", border: "#f87171", glow: "rgba(239, 68, 68, 0.5)" },
  Pattern: { bg: "#0891b2", border: "#22d3ee", glow: "rgba(6, 182, 212, 0.4)" },
  RunbookStep: { bg: "#16a34a", border: "#4ade80", glow: "rgba(34, 197, 94, 0.4)" },
  Task: { bg: "#9333ea", border: "#c084fc", glow: "rgba(168, 85, 247, 0.4)" },
  Finding: { bg: "#ca8a04", border: "#facc15", glow: "rgba(234, 179, 8, 0.4)" },
  ProposedAction: { bg: "#ea580c", border: "#fb923c", glow: "rgba(249, 115, 22, 0.4)" },
};

type LayoutMode = "force" | "dag" | "radial";

export default function GraphCanvas({
  nodes,
  edges,
  highlightIds = [],
  activeGraphName,
  onRefresh,
  isLoading = false,
}: GraphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const minimapRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [filterLabel, setFilterLabel] = useState<string>("ALL");
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("dag");
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragNode, setDragNode] = useState<GraphNode | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 900, height: 600 });

  // Maintain simulation positions
  const simNodesRef = useRef<Map<string, GraphNode>>(new Map());
  const animFrameRef = useRef<number | null>(null);
  const pulseRef = useRef<number>(0);

  // Available labels in current dataset
  const availableLabels = useMemo(() => {
    const s = new Set<string>();
    nodes.forEach((n) => s.add(n.label || "Entity"));
    return Array.from(s);
  }, [nodes]);

  // Compute Layout Target Positions
  const applyLayout = useCallback(
    (mode: LayoutMode, currentNodes: GraphNode[], currentEdges: GraphEdge[], width: number, height: number) => {
      const positions = new Map<string, { x: number; y: number }>();
      const cx = width / 2;
      const cy = height / 2;

      if (mode === "dag") {
        // Hierarchical DAG: Layering based on dependencies
        // Services with no incoming depends_on are top-level (e.g. api-gateway)
        // Services with outgoing are lower (e.g. ledger-db)
        const layers: Record<string, number> = {};
        
        currentNodes.forEach((n) => {
          if (n.label === "Service") {
            if (n.id.includes("gateway") || n.id.includes("gw")) layers[n.id] = 0;
            else if (n.id.includes("auth") || n.id.includes("payment")) layers[n.id] = 1;
            else if (n.id.includes("fraud") || n.id.includes("ledger") || n.id.includes("notif")) layers[n.id] = 2;
            else layers[n.id] = 1;
          } else if (n.label === "Commit") {
            layers[n.id] = 2.8;
          } else if (n.label === "Person") {
            layers[n.id] = 3.6;
          } else if (n.label === "Team") {
            layers[n.id] = -0.8;
          } else if (n.label === "ADR") {
            layers[n.id] = 0.5;
          } else if (n.label === "Incident" || n.label === "Pattern") {
            layers[n.id] = 0;
          } else if (n.label === "RunbookStep") {
            layers[n.id] = 1.5;
          } else {
            layers[n.id] = 1.8;
          }
        });

        // Group by assigned layer
        const layerGroups: Record<number, GraphNode[]> = {};
        currentNodes.forEach((n) => {
          const l = layers[n.id] ?? 1.5;
          if (!layerGroups[l]) layerGroups[l] = [];
          layerGroups[l].push(n);
        });

        const sortedLayerKeys = Object.keys(layerGroups).map(Number).sort((a, b) => a - b);
        const totalLayers = sortedLayerKeys.length;
        const layerSpacingY = Math.min(140, (height - 180) / Math.max(1, totalLayers));

        sortedLayerKeys.forEach((lKey, layerIdx) => {
          const group = layerGroups[lKey];
          const rowY = 90 + layerIdx * layerSpacingY;
          const spacingX = Math.min(160, (width - 120) / Math.max(1, group.length));
          const startX = cx - ((group.length - 1) * spacingX) / 2;

          group.forEach((node, nodeIdx) => {
            positions.set(node.id, {
              x: startX + nodeIdx * spacingX,
              y: rowY,
            });
          });
        });
      } else if (mode === "radial") {
        // Concentric Rings around central critical hub
        // Center: payment-engine / high centrality
        const hubId = currentNodes.find((n) => n.id === "payment-engine")?.id || currentNodes[0]?.id;
        positions.set(hubId, { x: cx, y: cy });

        const ring1: GraphNode[] = [];
        const ring2: GraphNode[] = [];
        const ring3: GraphNode[] = [];

        currentNodes.forEach((n) => {
          if (n.id === hubId) return;
          if (n.label === "Service") ring1.push(n);
          else if (n.label === "ADR" || n.label === "Commit" || n.label === "Incident") ring2.push(n);
          else ring3.push(n);
        });

        const placeRing = (group: GraphNode[], radius: number) => {
          group.forEach((node, idx) => {
            const angle = (idx / Math.max(1, group.length)) * 2 * Math.PI - Math.PI / 2;
            positions.set(node.id, {
              x: cx + Math.cos(angle) * radius,
              y: cy + Math.sin(angle) * radius,
            });
          });
        };

        placeRing(ring1, 140);
        placeRing(ring2, 240);
        placeRing(ring3, 330);
      }

      return positions;
    },
    []
  );

  // Synchronize internal node positions with incoming props & layout mode
  useEffect(() => {
    const width = dimensions.width;
    const height = dimensions.height;

    const existing = simNodesRef.current;
    const nextMap = new Map<string, GraphNode>();
    const targets = applyLayout(layoutMode, nodes, edges, width, height);

    nodes.forEach((n, idx) => {
      const prev = existing.get(n.id);
      const target = targets.get(n.id);

      let x = prev?.x;
      let y = prev?.y;

      if (x === undefined || y === undefined || target) {
        if (target) {
          x = target.x;
          y = target.y;
        } else {
          const angle = (idx / Math.max(1, nodes.length)) * 2 * Math.PI;
          const radius = 180 + (idx % 3) * 60;
          x = width / 2 + Math.cos(angle) * radius;
          y = height / 2 + Math.sin(angle) * radius;
        }
      }

      nextMap.set(n.id, {
        ...n,
        x,
        y,
        vx: prev?.vx || 0,
        vy: prev?.vy || 0,
        targetX: target?.x,
        targetY: target?.y,
      });
    });

    simNodesRef.current = nextMap;
  }, [nodes, edges, layoutMode, dimensions, applyLayout]);

  // Center on Highlighted Path when highlighted nodes change
  useEffect(() => {
    if (highlightIds.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = typeof window !== "undefined" ? Math.max(window.devicePixelRatio || 1, 2) : 1;
    const cssW = canvas.width / dpr;
    const cssH = canvas.height / dpr;

    const highlightNodes = highlightIds
      .map((id) => simNodesRef.current.get(id))
      .filter((n): n is GraphNode => !!n && n.x !== undefined && n.y !== undefined);

    if (highlightNodes.length > 0) {
      const minX = Math.min(...highlightNodes.map((n) => n.x!));
      const maxX = Math.max(...highlightNodes.map((n) => n.x!));
      const minY = Math.min(...highlightNodes.map((n) => n.y!));
      const maxY = Math.max(...highlightNodes.map((n) => n.y!));

      const pathCenterX = (minX + maxX) / 2;
      const pathCenterY = (minY + maxY) / 2;

      // Smooth pan to center in CSS coordinate space
      setPan({
        x: cssW / 2 - pathCenterX * zoom,
        y: cssH / 2 - pathCenterY * zoom,
      });
    }
  }, [highlightIds, zoom]);

  // Dynamic High-DPI Canvas Resizing
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const updateCanvasSize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.max(window.devicePixelRatio || 1, 2);
      const width = Math.floor(rect.width);
      const height = Math.floor(rect.height);
      if (width <= 0 || height <= 0) return;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      setDimensions((prev) => {
        if (Math.abs(prev.width - width) > 5 || Math.abs(prev.height - height) > 5) {
          return { width, height };
        }
        return prev;
      });
    };

    updateCanvasSize();
    const ro = new ResizeObserver(() => updateCanvasSize());
    ro.observe(container);

    return () => ro.disconnect();
  }, []);

  // Main Canvas Render & Animation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let running = true;

    const render = () => {
      if (!running) return;
      pulseRef.current = (pulseRef.current + 0.04) % (Math.PI * 2);

      const dpr = Math.max(window.devicePixelRatio || 1, 2);
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      const simNodes = Array.from(simNodesRef.current.values());

      // 1. Force / Interpolation Physics
      if (layoutMode === "force") {
        const kRepulse = 3800;
        const kSpring = 0.04;
        const targetDist = 140;

        // Repulsion between node pairs
        for (let i = 0; i < simNodes.length; i++) {
          for (let j = i + 1; j < simNodes.length; j++) {
            const n1 = simNodes[i];
            const n2 = simNodes[j];
            const dx = (n2.x || 0) - (n1.x || 0);
            const dy = (n2.y || 0) - (n1.y || 0);
            const distSq = dx * dx + dy * dy + 1;
            const dist = Math.sqrt(distSq);
            if (dist < 360) {
              const force = kRepulse / distSq;
              const fx = (dx / dist) * force;
              const fy = (dy / dist) * force;
              if (dragNode?.id !== n1.id) {
                n1.vx = (n1.vx || 0) - fx;
                n1.vy = (n1.vy || 0) - fy;
              }
              if (dragNode?.id !== n2.id) {
                n2.vx = (n2.vx || 0) + fx;
                n2.vy = (n2.vy || 0) + fy;
              }
            }
          }
        }

        // Spring along edges
        edges.forEach((edge) => {
          const src = simNodesRef.current.get(edge.source);
          const tgt = simNodesRef.current.get(edge.target);
          if (src && tgt) {
            const dx = (tgt.x || 0) - (src.x || 0);
            const dy = (tgt.y || 0) - (src.y || 0);
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const displacement = dist - targetDist;
            const force = displacement * kSpring;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            if (dragNode?.id !== src.id) {
              src.vx = (src.vx || 0) + fx;
              src.vy = (src.vy || 0) + fy;
            }
            if (dragNode?.id !== tgt.id) {
              tgt.vx = (tgt.vx || 0) - fx;
              tgt.vy = (tgt.vy || 0) - fy;
            }
          }
        });

        // Update positions with center gravity
        const damping = 0.86;
        simNodes.forEach((node) => {
          if (dragNode?.id === node.id) return;
          node.vx = ((node.vx || 0) + (width / 2 - (node.x || 0)) * 0.001) * damping;
          node.vy = ((node.vy || 0) + (height / 2 - (node.y || 0)) * 0.001) * damping;
          node.x = (node.x || 0) + (node.vx || 0);
          node.y = (node.y || 0) + (node.vy || 0);
        });
      } else {
        // Smoothly interpolate towards target layout positions
        simNodes.forEach((node) => {
          if (dragNode?.id === node.id) return;
          if (node.targetX !== undefined && node.targetY !== undefined) {
            node.x = (node.x || 0) + (node.targetX - (node.x || 0)) * 0.12;
            node.y = (node.y || 0) + (node.targetY - (node.y || 0)) * 0.12;
          }
        });
      }

      // 2. Clear canvas & apply pan/zoom
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);

      // Cybernetic Ambient Grid Dots
      ctx.fillStyle = "rgba(148, 163, 184, 0.06)";
      const gridSize = 40;
      const startGridX = Math.floor((-pan.x / zoom - width) / gridSize) * gridSize;
      const endGridX = Math.floor((-pan.x / zoom + width * 2) / gridSize) * gridSize;
      const startGridY = Math.floor((-pan.y / zoom - height) / gridSize) * gridSize;
      const endGridY = Math.floor((-pan.y / zoom + height * 2) / gridSize) * gridSize;

      for (let gx = startGridX; gx < endGridX; gx += gridSize) {
        for (let gy = startGridY; gy < endGridY; gy += gridSize) {
          ctx.beginPath();
          ctx.arc(gx, gy, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const hasHighlights = highlightIds.length > 0;

      // 3. Render Edges (Curved Bezier with Directional Arrows & Particle Glow)
      edges.forEach((edge, edgeIdx) => {
        const src = simNodesRef.current.get(edge.source);
        const tgt = simNodesRef.current.get(edge.target);
        if (!src || !tgt || src.x === undefined || src.y === undefined || tgt.x === undefined || tgt.y === undefined) {
          return;
        }

        const isEdgeHighlighted =
          edge.highlighted ||
          (highlightIds.includes(src.id) && highlightIds.includes(tgt.id));

        const dx = tgt.x - src.x;
        const dy = tgt.y - src.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        // Slight quadratic curve offset to prevent overlapping bidirectional edges
        const normalX = -dy / dist;
        const normalY = dx / dist;
        const curveOffset = (edgeIdx % 2 === 0 ? 1 : -1) * Math.min(25, dist * 0.12);
        const midX = (src.x + tgt.x) / 2 + normalX * curveOffset;
        const midY = (src.y + tgt.y) / 2 + normalY * curveOffset;

        // Calculate node radius to stop edge before entering target node boundary
        const tgtRadius = (tgt.val || 1.0) * 16 + 6;
        const arrowAngle = Math.atan2(tgt.y - midY, tgt.x - midX);
        const arrowTipX = tgt.x - Math.cos(arrowAngle) * tgtRadius;
        const arrowTipY = tgt.y - Math.sin(arrowAngle) * tgtRadius;

        // Draw Curved Path
        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.quadraticCurveTo(midX, midY, arrowTipX, arrowTipY);

        if (isEdgeHighlighted) {
          // Electric Cyan / Gold Neon Stroke
          ctx.strokeStyle = "#06b6d4";
          ctx.lineWidth = 3.0;
          ctx.shadowColor = "#22d3ee";
          ctx.shadowBlur = 12;
          ctx.stroke();
          ctx.shadowBlur = 0;

          // Animated Electric Pulses traveling along quadratic curve
          const t1 = ((pulseRef.current * 0.8) % (Math.PI * 2)) / (Math.PI * 2);
          const t2 = ((pulseRef.current * 0.8 + Math.PI) % (Math.PI * 2)) / (Math.PI * 2);
          const startX = src.x;
          const startY = src.y;

          [t1, t2].forEach((t) => {
            // Quadratic Bezier formula: B(t) = (1-t)^2*P0 + 2(1-t)t*P1 + t^2*P2
            const px = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * midX + t * t * arrowTipX;
            const py = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * midY + t * t * arrowTipY;

            ctx.beginPath();
            ctx.arc(px, py, 3.5, 0, Math.PI * 2);
            ctx.fillStyle = "#fef08a";
            ctx.shadowColor = "#facc15";
            ctx.shadowBlur = 10;
            ctx.fill();
            ctx.shadowBlur = 0;
          });
        } else {
          ctx.strokeStyle = hasHighlights ? "rgba(71, 85, 105, 0.25)" : "rgba(100, 116, 139, 0.4)";
          ctx.lineWidth = 1.4;
          ctx.stroke();
        }

        // Draw Directional Arrowhead
        const arrowSize = isEdgeHighlighted ? 8 : 6;
        ctx.beginPath();
        ctx.moveTo(arrowTipX, arrowTipY);
        ctx.lineTo(
          arrowTipX - arrowSize * Math.cos(arrowAngle - Math.PI / 6),
          arrowTipY - arrowSize * Math.sin(arrowAngle - Math.PI / 6)
        );
        ctx.lineTo(
          arrowTipX - arrowSize * Math.cos(arrowAngle + Math.PI / 6),
          arrowTipY - arrowSize * Math.sin(arrowAngle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fillStyle = isEdgeHighlighted ? "#22d3ee" : "rgba(148, 163, 184, 0.6)";
        ctx.fill();

        // Edge Relationship Pill Badge at curve midpoint
        if (edge.type && (isEdgeHighlighted || !hasHighlights || zoom > 0.85)) {
          const badgeText = edge.type;
          ctx.font = isEdgeHighlighted
            ? "bold 10px ui-monospace, SFMono-Regular, monospace"
            : "9px ui-monospace, SFMono-Regular, monospace";
          const textMetrics = ctx.measureText(badgeText);
          const badgeW = textMetrics.width + 10;
          const badgeH = 16;

          ctx.fillStyle = isEdgeHighlighted ? "rgba(8, 24, 38, 0.95)" : "rgba(10, 14, 23, 0.88)";
          ctx.strokeStyle = isEdgeHighlighted ? "#06b6d4" : "rgba(100, 116, 139, 0.4)";
          ctx.lineWidth = isEdgeHighlighted ? 1.5 : 1;

          ctx.beginPath();
          ctx.roundRect(midX - badgeW / 2, midY - badgeH / 2, badgeW, badgeH, 4);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = isEdgeHighlighted ? "#67e8f9" : "#94a3b8";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(badgeText, midX, midY);
        }
      });

      // 4. Render Nodes
      simNodes.forEach((node) => {
        if (filterLabel !== "ALL" && node.label !== filterLabel) {
          return;
        }

        const isHighlighted = highlightIds.includes(node.id);
        const isSelected = selectedNode?.id === node.id;
        const radius = (node.val || 1.0) * 16;
        const colorCfg = COLOR_MAP[node.label] || { bg: "#475569", border: "#94a3b8", glow: "rgba(148, 163, 184, 0.3)" };

        const isDegraded = node.properties?.status === "DEGRADED" || node.properties?.status === "UNHEALTHY";

        // Pulsing Aura Ring for Highlighted Nodes
        if (isHighlighted || isDegraded) {
          const auraRadius = radius + 8 + Math.sin(pulseRef.current * 1.5) * 4;
          ctx.beginPath();
          ctx.arc(node.x || 0, node.y || 0, auraRadius, 0, Math.PI * 2);
          ctx.fillStyle = isDegraded ? "rgba(239, 68, 68, 0.25)" : colorCfg.glow;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(node.x || 0, node.y || 0, auraRadius + 2, 0, Math.PI * 2);
          ctx.strokeStyle = isDegraded ? "#ef4444" : "#22d3ee";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // Selection Halo
        if (isSelected) {
          ctx.beginPath();
          ctx.arc(node.x || 0, node.y || 0, radius + 6, 0, Math.PI * 2);
          ctx.strokeStyle = "#fbbf24";
          ctx.lineWidth = 2.5;
          ctx.setLineDash([4, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Node Body Circle
        ctx.beginPath();
        ctx.arc(node.x || 0, node.y || 0, radius, 0, Math.PI * 2);
        ctx.fillStyle = isDegraded ? "#b91c1c" : colorCfg.bg;
        if (isHighlighted) {
          ctx.shadowColor = isDegraded ? "#ef4444" : "#22d3ee";
          ctx.shadowBlur = 18;
        } else if (hasHighlights) {
          ctx.globalAlpha = 0.45;
        }
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1.0;

        // Node Border
        ctx.lineWidth = 2.0;
        ctx.strokeStyle = isHighlighted ? "#ffffff" : isDegraded ? "#fca5a5" : colorCfg.border;
        ctx.stroke();

        // Node Glyph / Monogram inside circle
        ctx.font = `bold ${Math.round(radius * 0.85)}px ui-monospace, sans-serif`;
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const glyph = (node.label[0] || "E").toUpperCase();
        ctx.fillText(glyph, node.x || 0, (node.y || 0) + 1);

        // Node Title Tag (Below node)
        const displayName = node.name || node.id;
        ctx.font = isHighlighted
          ? "bold 12px Inter, system-ui, sans-serif"
          : isDegraded
          ? "bold 12px Inter, system-ui, sans-serif"
          : "600 11px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";

        // Label Background Tag
        const textMetrics = ctx.measureText(displayName);
        const tagW = textMetrics.width + 14;
        const tagH = 19;
        const tagY = (node.y || 0) + radius + 6;

        ctx.fillStyle = isDegraded
          ? "rgba(45, 10, 10, 0.95)"
          : isHighlighted
          ? "rgba(6, 25, 44, 0.95)"
          : "rgba(10, 14, 23, 0.92)";
        ctx.strokeStyle = isDegraded
          ? "#ef4444"
          : isHighlighted
          ? "#38bdf8"
          : "rgba(148, 163, 184, 0.3)";
        ctx.lineWidth = isHighlighted || isDegraded ? 1.5 : 1;

        ctx.beginPath();
        ctx.roundRect((node.x || 0) - tagW / 2, tagY, tagW, tagH, 5);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isDegraded ? "#fca5a5" : isHighlighted ? "#ffffff" : "#f1f5f9";
        ctx.fillText(displayName, node.x || 0, tagY + 3.5);

        // Crisp Entity Sub-Badge
        ctx.font = "bold 9px ui-monospace, monospace";
        ctx.fillStyle = isDegraded ? "#ef4444" : isHighlighted ? "#38bdf8" : colorCfg.border;
        ctx.fillText(node.label.toUpperCase(), node.x || 0, tagY + tagH + 3);
      });

      ctx.restore();

      // 5. Update Minimap
      renderMinimap(simNodes, width, height);

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      running = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [edges, filterLabel, highlightIds, layoutMode, pan, selectedNode, zoom, dragNode]);

  // Minimap Rendering Function
  const renderMinimap = (simNodes: GraphNode[], canvasW: number, canvasH: number) => {
    const mini = minimapRef.current;
    if (!mini) return;
    const miniCtx = mini.getContext("2d");
    if (!miniCtx) return;

    const mW = mini.width;
    const mH = mini.height;

    miniCtx.clearRect(0, 0, mW, mH);

    // Compute bounding box of all nodes
    let minX = 0, maxX = canvasW, minY = 0, maxY = canvasH;
    simNodes.forEach((n) => {
      if (n.x !== undefined && n.y !== undefined) {
        minX = Math.min(minX, n.x - 40);
        maxX = Math.max(maxX, n.x + 40);
        minY = Math.min(minY, n.y - 40);
        maxY = Math.max(maxY, n.y + 40);
      }
    });

    const graphW = Math.max(1, maxX - minX);
    const graphH = Math.max(1, maxY - minY);
    const scale = Math.min((mW - 12) / graphW, (mH - 12) / graphH);

    // Draw dots for each node
    simNodes.forEach((n) => {
      if (n.x === undefined || n.y === undefined) return;
      const mx = 6 + (n.x - minX) * scale;
      const my = 6 + (n.y - minY) * scale;
      const isHl = highlightIds.includes(n.id);

      miniCtx.beginPath();
      miniCtx.arc(mx, my, isHl ? 3.5 : 2, 0, Math.PI * 2);
      miniCtx.fillStyle = isHl ? "#22d3ee" : COLOR_MAP[n.label]?.border || "#94a3b8";
      miniCtx.fill();
    });

    // Draw camera viewport rectangle
    const viewLeft = 6 + (-pan.x / zoom - minX) * scale;
    const viewTop = 6 + (-pan.y / zoom - minY) * scale;
    const viewW = (canvasW / zoom) * scale;
    const viewH = (canvasH / zoom) * scale;

    miniCtx.strokeStyle = "rgba(6, 182, 212, 0.7)";
    miniCtx.lineWidth = 1.2;
    miniCtx.strokeRect(viewLeft, viewTop, viewW, viewH);
  };

  // Canvas Mouse Interactions (Dragging, Panning, Selecting)
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - pan.x) / zoom;
    const mouseY = (e.clientY - rect.top - pan.y) / zoom;

    // Check if clicked on a node
    const clicked = Array.from(simNodesRef.current.values()).find((n) => {
      if (n.x === undefined || n.y === undefined) return false;
      const dist = Math.sqrt((n.x - mouseX) ** 2 + (n.y - mouseY) ** 2);
      return dist <= (n.val || 1.0) * 16 + 6;
    });

    if (clicked) {
      setDragNode(clicked);
      setSelectedNode(clicked);
    } else {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragNode) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const nextX = (e.clientX - rect.left - pan.x) / zoom;
      const nextY = (e.clientY - rect.top - pan.y) / zoom;
      dragNode.x = nextX;
      dragNode.y = nextY;
      dragNode.targetX = nextX;
      dragNode.targetY = nextY;
    } else if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragNode(null);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = 1.1;
    const newZoom = e.deltaY < 0 ? Math.min(3.0, zoom * zoomFactor) : Math.max(0.3, zoom / zoomFactor);
    setZoom(newZoom);
  };

  const handleFitView = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const simNodes = Array.from(simNodesRef.current.values());
    if (simNodes.length === 0) {
      setZoom(1.0);
      setPan({ x: 0, y: 0 });
      return;
    }

    const dpr = typeof window !== "undefined" ? Math.max(window.devicePixelRatio || 1, 2) : 1;
    const cssW = canvas.width / dpr;
    const cssH = canvas.height / dpr;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    simNodes.forEach((n) => {
      const px = n.targetX !== undefined ? n.targetX : n.x;
      const py = n.targetY !== undefined ? n.targetY : n.y;
      if (px !== undefined && py !== undefined) {
        minX = Math.min(minX, px - 40);
        maxX = Math.max(maxX, px + 40);
        minY = Math.min(minY, py - 40);
        maxY = Math.max(maxY, py + 40);
      }
    });

    if (minX === Infinity || maxX === -Infinity) {
      setZoom(1.0);
      setPan({ x: 0, y: 0 });
      return;
    }

    const graphW = Math.max(100, maxX - minX);
    const graphH = Math.max(100, maxY - minY);
    const padding = 70;

    const fitZoom = Math.min(
      Math.max(0.5, Math.min((cssW - padding * 2) / graphW, (cssH - padding * 2) / graphH)),
      1.25
    );

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    setZoom(fitZoom);
    setPan({
      x: cssW / 2 - centerX * fitZoom,
      y: cssH / 2 - centerY * fitZoom,
    });
  }, []);

  // Auto-fit on initial render, layout switch, or dimension change
  useEffect(() => {
    const t = setTimeout(() => {
      handleFitView();
    }, 150);
    return () => clearTimeout(t);
  }, [layoutMode, dimensions, handleFitView]);

  // Connected edges and neighbors for selected node
  const selectedNodeRelationships = useMemo(() => {
    if (!selectedNode) return { inbound: [], outbound: [] };
    const inbound = edges.filter((e) => e.target === selectedNode.id);
    const outbound = edges.filter((e) => e.source === selectedNode.id);
    return { inbound, outbound };
  }, [selectedNode, edges]);

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col h-full w-full bg-[#070a12] rounded-xl border border-slate-800/90 overflow-hidden shadow-2xl select-none"
    >
      {/* Top Controls Bar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left: Active Namespace Badge & Layout Switcher */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 backdrop-blur-md text-xs font-mono text-cyan-300 shadow-lg">
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-semibold text-slate-100">{activeGraphName}</span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-400">{nodes.length} nodes</span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-400">{edges.length} edges</span>
          </div>

          {/* Layout Switcher */}
          <div className="flex items-center bg-slate-900/90 border border-slate-800 rounded-lg p-0.5 backdrop-blur-md shadow-lg text-[11px] font-mono">
            <button
              onClick={() => setLayoutMode("dag")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded transition-all ${
                layoutMode === "dag" ? "bg-cyan-950 text-cyan-300 border border-cyan-500/40 font-semibold shadow-sm" : "text-slate-400 hover:text-slate-200"
              }`}
              title="Hierarchical Directed Acyclic Graph (Best for blast radius & dependency flow)"
            >
              <GitBranch className="w-3 h-3 text-cyan-400" />
              <span>DAG Blast-Radius</span>
            </button>
            <button
              onClick={() => setLayoutMode("radial")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded transition-all ${
                layoutMode === "radial" ? "bg-purple-950 text-purple-300 border border-purple-500/40 font-semibold shadow-sm" : "text-slate-400 hover:text-slate-200"
              }`}
              title="Concentric Radial Layout (Best for Centrality & Bus Factor)"
            >
              <Target className="w-3 h-3 text-purple-400" />
              <span>Radial Centrality</span>
            </button>
            <button
              onClick={() => setLayoutMode("force")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded transition-all ${
                layoutMode === "force" ? "bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-semibold shadow-sm" : "text-slate-400 hover:text-slate-200"
              }`}
              title="Force-Directed Physics Simulation"
            >
              <Activity className="w-3 h-3 text-emerald-400" />
              <span>Force Physics</span>
            </button>
          </div>
        </div>

        {/* Right: Label Filter & Zoom HUD */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Label Filter */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-900/90 border border-slate-800 backdrop-blur-md text-xs font-mono text-slate-300">
            <Filter className="w-3 h-3 text-slate-400" />
            <select
              value={filterLabel}
              onChange={(e) => setFilterLabel(e.target.value)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900 text-slate-200">All Entities ({nodes.length})</option>
              {availableLabels.map((lbl) => (
                <option key={lbl} value={lbl} className="bg-slate-900 text-slate-200">
                  {lbl}
                </option>
              ))}
            </select>
          </div>

          {/* Zoom / Navigation Controls */}
          <div className="flex items-center bg-slate-900/90 border border-slate-800 rounded-lg p-0.5 backdrop-blur-md shadow-lg text-slate-300">
            <button
              onClick={() => setZoom((z) => Math.min(3.0, z * 1.2))}
              className="p-1.5 hover:text-white hover:bg-slate-800 rounded transition-all"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(0.3, z / 1.2))}
              className="p-1.5 hover:text-white hover:bg-slate-800 rounded transition-all"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleFitView}
              className="p-1.5 hover:text-white hover:bg-slate-800 rounded transition-all"
              title="Fit to Viewport"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="p-1.5 hover:text-cyan-400 hover:bg-slate-800 rounded transition-all"
                title="Refresh FalkorDB Graph Topology"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-cyan-400" : ""}`} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main HTML5 2D Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        className="flex-1 w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* Bottom-Left Node Color Legend */}
      <div className="absolute bottom-3 left-3 z-10 hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-xl bg-slate-950/85 border border-slate-800/90 backdrop-blur-md shadow-2xl text-[10px] font-mono">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_6px_#3b82f6]" />
          <span className="text-slate-300">Service</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]" />
          <span className="text-slate-300">Person</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_6px_#f59e0b]" />
          <span className="text-slate-300">Commit</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-pink-500 shadow-[0_0_6px_#ec4899]" />
          <span className="text-slate-300">ADR</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_6px_#ef4444]" />
          <span className="text-slate-300">Incident</span>
        </div>
      </div>

      {/* Live Minimap HUD (Bottom-Right) */}
      <div className="absolute bottom-3 right-3 z-10 p-1 rounded-xl bg-slate-950/80 border border-slate-800/90 backdrop-blur-md shadow-2xl pointer-events-none">
        <canvas ref={minimapRef} width={120} height={90} className="rounded-lg bg-[#05070d]" />
        <div className="text-[9px] font-mono text-slate-500 text-center pt-0.5">FalkorDB Radar</div>
      </div>

      {/* Interactive Node Telemetry Drawer (Slide-out on Right) */}
      {selectedNode && (
        <div className="absolute top-14 right-3 bottom-3 w-80 z-20 flex flex-col bg-slate-900/95 border border-cyan-500/40 rounded-xl shadow-2xl backdrop-blur-xl overflow-hidden animate-in fade-in slide-in-from-right-4 duration-200">
          {/* Drawer Header */}
          <div className="p-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: COLOR_MAP[selectedNode.label]?.border || "#94a3b8" }}
              />
              <span className="text-xs font-mono uppercase text-cyan-400 font-semibold tracking-wider">
                {selectedNode.label}
              </span>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Drawer Content */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 font-sans">
            <div>
              <h3 className="text-sm font-bold text-white mb-0.5">
                {selectedNode.name || selectedNode.id}
              </h3>
              <p className="text-[11px] font-mono text-slate-400 truncate">ID: {selectedNode.id}</p>
            </div>

            {/* Status Indicator */}
            {selectedNode.properties?.status && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    selectedNode.properties.status === "HEALTHY"
                      ? "bg-emerald-400 animate-pulse"
                      : "bg-red-500 animate-bounce"
                  }`}
                />
                <div className="text-xs font-mono">
                  <span className="text-slate-400">Status: </span>
                  <span
                    className={`font-semibold ${
                      selectedNode.properties.status === "HEALTHY" ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {selectedNode.properties.status}
                  </span>
                </div>
              </div>
            )}

            {/* Entity Raw Properties */}
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1.5 font-semibold">
                GraphBLAS Entity Attributes
              </span>
              <div className="space-y-1 bg-slate-950/90 rounded-lg p-2 border border-slate-800/80 text-xs font-mono">
                {Object.entries(selectedNode.properties || {}).map(([key, val]) => (
                  <div key={key} className="flex justify-between items-start gap-2 py-0.5 border-b border-slate-900/60 last:border-0">
                    <span className="text-slate-400 shrink-0">{key}:</span>
                    <span className="text-slate-200 text-right truncate max-w-[160px]" title={String(val)}>
                      {String(val)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Connected Inbound & Outbound Relationships */}
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1.5 font-semibold">
                Connected Topology ({selectedNodeRelationships.inbound.length + selectedNodeRelationships.outbound.length})
              </span>

              <div className="space-y-1.5 text-xs font-mono">
                {selectedNodeRelationships.outbound.map((edge) => (
                  <div
                    key={edge.id}
                    onClick={() => {
                      const tgtNode = simNodesRef.current.get(edge.target);
                      if (tgtNode) setSelectedNode(tgtNode);
                    }}
                    className="p-1.5 rounded bg-slate-950/70 border border-slate-800/80 hover:border-cyan-500/40 cursor-pointer transition-all flex items-center justify-between"
                  >
                    <div className="flex items-center gap-1 text-[11px] text-cyan-400">
                      <span>[{edge.type}]</span>
                      <ArrowRight className="w-3 h-3 text-slate-500" />
                    </div>
                    <span className="text-slate-200 truncate max-w-[120px]">{edge.target}</span>
                  </div>
                ))}

                {selectedNodeRelationships.inbound.map((edge) => (
                  <div
                    key={edge.id}
                    onClick={() => {
                      const srcNode = simNodesRef.current.get(edge.source);
                      if (srcNode) setSelectedNode(srcNode);
                    }}
                    className="p-1.5 rounded bg-slate-950/70 border border-slate-800/80 hover:border-purple-500/40 cursor-pointer transition-all flex items-center justify-between"
                  >
                    <span className="text-slate-200 truncate max-w-[120px]">{edge.source}</span>
                    <div className="flex items-center gap-1 text-[11px] text-purple-400">
                      <ArrowRight className="w-3 h-3 text-slate-500" />
                      <span>[{edge.type}]</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Drawer Footer Action */}
          <div className="p-2.5 bg-slate-950 border-t border-slate-800 flex gap-2">
            <button
              onClick={() => {
                if (selectedNode.x !== undefined && selectedNode.y !== undefined) {
                  const canvas = canvasRef.current;
                  if (canvas) {
                    setPan({
                      x: canvas.width / 2 - selectedNode.x * zoom,
                      y: canvas.height / 2 - selectedNode.y * zoom,
                    });
                  }
                }
              }}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 rounded-lg text-xs font-mono font-semibold transition-all"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Center Camera</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
