from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ShareLinkCreate(BaseModel):
    pipeline_id: int
    version_id: Optional[int] = None
    expires_in_hours: int = 72


class ShareLinkOut(BaseModel):
    id: int
    pipeline_id: int
    version_id: Optional[int] = None
    token: str
    created_by: int
    expires_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


class ShareViewOut(BaseModel):
    pipeline_name: str
    config: dict
    cost_snapshot: Optional[dict] = None
    is_expired: bool
