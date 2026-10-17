from typing import Literal

from pydantic import BaseModel, Field


class DebugRequest(BaseModel):
    code: str = Field(min_length=1, max_length=30_000)
    language: str = Field(min_length=1, max_length=40)
    error_message: str = Field(default="", max_length=4_000)
    expected_behavior: str = Field(default="", max_length=4_000)
    context: str = Field(default="", max_length=4_000)


class Change(BaseModel):
    description: str = Field(min_length=1, max_length=500)


class DebugResult(BaseModel):
    fix_status: Literal["fix_proposed", "needs_context"]
    summary: str = Field(min_length=1, max_length=1_000)
    error_type: str | None = Field(default=None, max_length=200)
    explanation: str = Field(min_length=1, max_length=4_000)
    corrected_code: str = Field(min_length=1, max_length=40_000)
    changes: list[Change] = Field(default_factory=list, max_length=20)
    confidence: Literal["low", "medium", "high"] | None = None
    validation_status: Literal["static_pass", "static_fail", "not_checked"]
    validation_details: str = Field(max_length=1_000)
    remaining_issues: list[str] = Field(default_factory=list, max_length=10)
    follow_up_questions: list[str] = Field(default_factory=list, max_length=8)
    model: str
