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
    CORS_ORIGINS: List[str] = Field(default_factory=lambda: ["*"])
    
    # Database
    DATABASE_URL: str = "sqlite:///./verique.db"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # LLM Providers - Using Groq (FREE API)
    GROQ_API_KEY: Optional[str] = None
    LLM_MODEL: str = "llama-3.3-70b-versatile"  # Free on Groq
    LLM_MODEL_FAST: str = "llama-3.1-8b-instant"  # Faster, also free
    
    # Search APIs - DuckDuckGo is free, no API key needed
    # Optional: SerpAPI or Google CSE for better results
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
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
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
