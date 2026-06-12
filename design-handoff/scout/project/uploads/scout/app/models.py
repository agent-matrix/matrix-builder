from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Any, Literal

Priority = Literal[
    "study_now",
    "build_now",
    "follow_weekly",
    "monitor_only",
    "local_opportunity",
    "global_opportunity",
]

class SignalBundle(BaseModel):
    github_activity: float = 0
    github_growth: float = 0
    huggingface_activity: float = 0
    news_mentions: float = 0
    job_demand: float = 0
    community_activity: float = 0
    local_relevance: float = 0
    project_potential: float = 0
    career_value: float = 0
    learning_accessibility: float = 0
    durability: float = 0
    ecosystem_fit: float = 0

class Topic(BaseModel):
    id: str
    name: str
    rank: int | None = None
    score: float = 0
    trend_score: float = 0
    actionability_score: float = 0
    matrix_value_score: float = 0
    priority: Priority = "monitor_only"
    labels: list[str] = Field(default_factory=list)
    summary: str = ""
    why_follow: str = ""
    signals: SignalBundle = Field(default_factory=SignalBundle)
    starter_actions: list[str] = Field(default_factory=list)
    project_ideas: list[str] = Field(default_factory=list)
    study_plan: list[str] = Field(default_factory=list)
    sources: list[dict[str, Any]] = Field(default_factory=list)
    trust: dict[str, Any] = Field(default_factory=dict)

class RecommendationRequest(BaseModel):
    country: str = "Worldwide"
    city: str | None = None
    goal: str = "career"
    profile: str = "developer"
    limit: int = 10

class RecommendationResponse(BaseModel):
    location: dict[str, str | None]
    goal: str
    profile: str
    recommendations: list[Topic]
    generated_at: str
    methodology: str

class DeepDive(BaseModel):
    topic: Topic
    executive_summary: str
    global_analysis: dict[str, Any]
    local_analysis: dict[str, Any]
    evidence: dict[str, Any]
    developer_visibility_plan: dict[str, Any]
    agent_matrix_opportunities: list[dict[str, Any]]
    risks: list[str]
    raw_data_links: dict[str, str]
