from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class PipelineCreate(BaseModel):
    name: str
    description: Optional[str] = None


class PipelineUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class PipelineOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    owner_id: int
    created_at: datetime
    updated_at: datetime
    current_version_id: Optional[int] = None

    model_config = {"from_attributes": True}


class PipelineListOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    owner_id: int
    created_at: datetime
    updated_at: datetime
    current_version_id: Optional[int] = None
    latest_cost_snapshot: Optional[dict] = None

    model_config = {"from_attributes": True}


class PipelineVersionOut(BaseModel):
    id: int
    pipeline_id: int
    version_number: int
    config: dict
    cost_snapshot: Optional[dict] = None
    description: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PipelineVersionCreate(BaseModel):
    config: dict
    description: Optional[str] = None


class PipelineCopyRequest(BaseModel):
    name: str
