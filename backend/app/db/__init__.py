"""Database package for FalkorDB multi-tenant graph operations."""
from .falkor_client import FalkorManager, get_falkor_manager
from .schema import create_graph_indexes, verify_graph_schema
from .seed import seed_all_graphs

__all__ = [
    "FalkorManager",
    "get_falkor_manager",
    "create_graph_indexes",
    "verify_graph_schema",
    "seed_all_graphs",
]
