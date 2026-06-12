from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    github_token: str | None = None
    hf_token: str | None = None
    hf_dataset_repo: str = "ruslanmv/scout-data"
    scout_data_dir: str = "datasets"
    scout_default_country: str = "Italy"
    scout_default_city: str = "Rome"

    class Config:
        env_file = ".env"
        env_prefix = ""

settings = Settings()
