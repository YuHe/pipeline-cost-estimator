from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class TrendRequest(BaseModel):
    pipeline_id: int


class TrendPoint(BaseModel):
    version_number: int
    created_at: datetime
    e2e_total_cost: Optional[float] = None
    unit_cost: Optional[float] = None
    target_qps: Optional[float] = None


class TrendResponse(BaseModel):
    pipeline_name: str
    points: list[TrendPoint]
