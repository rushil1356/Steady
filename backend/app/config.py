"""Settings read from backend/.env. Owner: Samarth."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    use_mocks: bool = True
    database_url: str = "sqlite:///./steady.db"
    public_base_url: str = "http://localhost:5173"
    caregiver_phone: str = ""

    gemini_api_key: str = ""
    gemini_model: str = ""
    opener_search: bool = False

    elevenlabs_api_key: str = ""
    elevenlabs_voice_id: str = ""
    elevenlabs_tts_model: str = ""
    elevenlabs_stt_model: str = ""
    tts_spoken_langs: str = "en,es,hi,ta,zh,ko,ar,pt"

    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_from_number: str = ""


settings = Settings()
