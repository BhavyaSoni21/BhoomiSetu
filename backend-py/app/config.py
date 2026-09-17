from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    db_host: str = "localhost"
    db_port: int = 5432
    db_username: str = "postgres"
    db_password: str = "postgres"
    db_name: str = "bhoomisetu"
    db_ssl: bool = False

    port: int = 8000
    cors_origin: str = ""
    environment: str = ""
    # Canonical citizen-facing site URL - used to build real deep links (the
    # official document PDF's QR code) rather than an opaque parcel id.
    # Defaults to the Vite dev server's own default port.
    frontend_url: str = "http://localhost:5173"

    jwt_secret: str = "change_this_in_production"

    groq_api_key: str = ""
    groq_model: str = "openai/gpt-oss-20b"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.8-flash"

    textbee_api_key: str = ""
    textbee_device_id: str = ""
    textbee_sim_subscription_id: str = "2"

    mail_host: str = ""
    mail_port: int = 465
    mail_secure: bool = True
    mail_user: str = ""
    mail_password: str = ""
    mail_from: str = "BhoomiSetu <no-reply@bhoomisetu.gov.in>"

    supabase_url: str = ""
    supabase_secret_key: str = ""

    # historical-imagery comparison's narrative step (app/services/narrative_service.py).
    openrouter_api_key: str = ""
    openrouter_model: str = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free"

    # Google Earth Engine - real Sentinel-2 imagery for Change Detection's
    # satellite-sourced analysis path (app/services/earth_engine_service.py).
    # Service-account auth (no user in the loop) - the JSON key file itself
    # is never committed (see .gitignore), only its path lives here.
    gee_service_account_email: str = ""
    gee_service_account_key_path: str = ""

    # Bhashini Multilingual API Configuration (Government of India)
    ulca_user_id: str = ""
    ulca_api_key: str = ""
    bhashini_pipeline_id: str = "64392f96daac500b55c543cd"
    default_source_lang: str = "en"
    default_target_lang: str = "hi"
    bhashini_auth_url: str = "https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline"
    bhashini_inference_url: str = "https://dhruva-api.bhashini.gov.in/services/inference/pipeline"
    bhashini_translation_timeout: int = 30
    bhashini_transliteration_timeout: int = 10
    bhashini_tts_timeout: int = 30
    bhashini_asr_timeout: int = 30
    bhashini_cache_ttl: int = 3600
    bhashini_max_retries: int = 2
    bhashini_retry_backoff_ms: int = 500

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def cors_origins(self) -> list[str] | str:
        # Wide open (any origin) when unset, matching backend/'s main.ts
        # default exactly - no regression for local dev or Docker Compose's
        # own internal traffic. See that file's own comment for why this
        # isn't a hard-refuse in production (KNOWN_RISKS.md MED-1) - same
        # reasoning applies here, reproduced faithfully rather than
        # reinvented per PYTHON_MIGRATION_PLAN.md §2.
        if not self.cors_origin:
            return "*"
        return [origin.strip() for origin in self.cors_origin.split(",")]

    @property
    def sqlalchemy_database_uri(self) -> str:
        ssl_suffix = "?sslmode=require" if self.db_ssl else ""
        return (
            f"postgresql+psycopg2://{self.db_username}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}{ssl_suffix}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
