from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ResourceSpecCreate(BaseModel):
    name: str
    gpu_type: str
    gpu_count: int = 1
    cost_per_unit: float
    gpus_per_instance: Optional[int] = None
    gpus_per_machine: Optional[int] = None
    qps_per_instance: Optional[float] = None
    avg_response_time_ms: Optional[float] = None


class ResourceSpecOut(BaseModel):
    id: int
    name: str
    gpu_type: str
    gpu_count: int
    cost_per_unit: float
    gpus_per_instance: Optional[int] = None
    gpus_per_machine: Optional[int] = None
    qps_per_instance: Optional[float] = None
    avg_response_time_ms: Optional[float] = None
    is_system: bool
    created_by: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}
