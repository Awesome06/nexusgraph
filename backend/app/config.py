"""Configuration settings for NexusGraph backend."""

import os
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    # FalkorDB connection
    falkordb_host: str = Field(default_factory=lambda: os.getenv("FALKORDB_HOST", "localhost"))
    falkordb_port: int = Field(default_factory=lambda: int(os.getenv("FALKORDB_PORT", "6379")))
    falkordb_password: str | None = Field(default_factory=lambda: os.getenv("FALKORDB_PASSWORD") or None)
    falkordb_username: str | None = Field(default_factory=lambda: os.getenv("FALKORDB_USERNAME") or None)
    falkordb_ssl: bool = Field(default_factory=lambda: os.getenv("FALKORDB_SSL", "false").lower() in ("true", "1", "yes"))

    # Server configuration
    backend_host: str = Field(default_factory=lambda: os.getenv("BACKEND_HOST", "0.0.0.0"))
    backend_port: int = Field(default_factory=lambda: int(os.getenv("BACKEND_PORT", "8000")))
    environment: str = Field(default_factory=lambda: os.getenv("ENVIRONMENT", "development"))
    log_level: str = Field(default_factory=lambda: os.getenv("LOG_LEVEL", "info"))
    seed_on_startup: bool = Field(default_factory=lambda: os.getenv("SEED_ON_STARTUP", "true").lower() in ("true", "1", "yes"))

    # Graph Namespaces (Multigraph isolation)
    graph_org_brain: str = "org_brain"
    graph_procedural_memory: str = "procedural_memory"
    graph_blackboard_prefix: str = "blackboard_"

    # LLM Keys (optional)
    openai_api_key: str | None = Field(default_factory=lambda: os.getenv("OPENAI_API_KEY") or None)
    anthropic_api_key: str | None = Field(default_factory=lambda: os.getenv("ANTHROPIC_API_KEY") or None)

    model_config = {
        "env_file": ".env",
        "extra": "ignore"
    }


settings = Settings()
