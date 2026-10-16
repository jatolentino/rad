from typing import Literal

from pydantic import BaseModel, Field

RequirementType = Literal["certificate", "email", "test"]
ResultLabel = Literal["positive", "negative", "approved", "denied", "missing"]


class ParseVerdict(BaseModel):
    is_there_one: bool
    result: ResultLabel


class RequirementRecord(BaseModel):
    name: str
    type: RequirementType
    path: str
    status: ResultLabel | None = None


class WorkerRecord(BaseModel):
    id: str
    worker: str
    role: str
    requirements: dict[str, RequirementRecord]


class WorkersPayload(BaseModel):
    workers: list[WorkerRecord] = Field(default_factory=list)
    complete: bool = False
    error: str | None = None


KIND_TO_TYPE: dict[str, RequirementType] = {
    "cert": "certificate",
    "drug_test": "test",
    "email": "email",
}
