"""
TrustLens Configuration Settings
"""
from functools import lru_cache
from typing import List, Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Environment
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    LOG_LEVEL: str = "INFO"
    
    # API Configuration
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    API_PREFIX: str = "/api/v1"
    SECRET_KEY: str = "change-me-in-production"
    
    # CORS
    CORS_ORIGINS: List[str] = Field(default_factory=lambda: ["http://localhost:3000"])
    
    # Database
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/postgres"
    SUPABASE_URL: Optional[str] = None
    SUPABASE_ANON_KEY: Optional[str] = None
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # LLM Providers - Using Groq (FREE API)
    GROQ_API_KEY: Optional[str] = None
    LLM_MODEL: str = "openai/gpt-oss-120b"  # Available on this Groq account (replaces llama-3.3-70b)
    LLM_MODEL_FAST: str = "openai/gpt-oss-20b"  # Faster model (replaces llama-3.1-8b-instant)
    
    # Decision models (Jev / Laya) via Vercel AI Gateway.
    # Off by default; with SHADOW_MODE on, results are logged but never used.
    AI_GATEWAY_API_KEY: Optional[str] = None  # Vercel only
    JEV_API_KEY: Optional[str] = None  # other providers; OpenCode Zen free tier needs none
    AI_GATEWAY_BASE_URL: str = "https://ai-gateway.vercel.sh/typesafe"
    JEV_MODEL: str = "typesafe-ai/jev"
    JEV_ENABLED: bool = False
    JEV_SHADOW_MODE: bool = True
    JEV_CONFIDENCE: float = 0.8  # live mode: Jev decides when P >= this or <= 1 - this
    JEV_TIMEOUT_SECONDS: float = 10.0
    JEV_SHADOW_LOG_PATH: str = "logs/jev_shadow.jsonl"  # one JSON line per compared claim

    # Search APIs - DuckDuckGo is free, no API key needed
    # Optional: Tavily (preferred when set), SerpAPI or Google CSE for better results
    TAVILY_API_KEY: Optional[str] = None
    SERPAPI_API_KEY: Optional[str] = None
    GOOGLE_API_KEY: Optional[str] = None
    GOOGLE_CSE_ID: Optional[str] = None
    USE_FREE_SEARCH: bool = True
    
    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 10
    RATE_LIMIT_PER_HOUR: int = 100
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW: int = 60
    
    # JWT Settings
    JWT_SECRET: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    CHALLENGE_THRESHOLD: int = 1
    SEED_MODERATOR_EMAIL: str = "moderator@verique.local"
    SEED_MODERATOR_PASSWORD: str = "Moderator123!"
    
    # Caching
    CACHE_TTL_SECONDS: int = 3600
    CONTENT_HASH_CACHE_TTL: int = 86400
    
    # Agent Configuration
    MAX_CLAIMS_PER_ARTICLE: int = 50
    MAX_EVIDENCE_PER_CLAIM: int = 10
    VERIFICATION_TIMEOUT_SECONDS: int = 60
    ENABLE_CLAIM_CLASSIFIER: bool = True
    ENABLE_CROSS_VERIFICATION: bool = False
    CROSS_VERIFICATION_THRESHOLD: float = 0.3

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_debug_flag(cls, value):
        """Accept common non-boolean environment values gracefully."""
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"1", "true", "yes", "on", "debug", "development", "dev"}:
                return True
            if normalized in {"0", "false", "no", "off", "release", "production", "prod"}:
                return False
        return value
    
    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
