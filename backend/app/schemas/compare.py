from typing import Optional

from pydantic import BaseModel


class CompareRequest(BaseModel):
    pipeline_ids: list[int]


class CompareItem(BaseModel):
    pipeline_id: int
    pipeline_name: str
    e2e_total_cost: Optional[float] = None
    unit_cost: Optional[float] = None
    unit_label: Optional[str] = None
    target_qps: Optional[float] = None
    node_count: Optional[int] = None
    total_gpu_cost: Optional[float] = None


class CompareResponse(BaseModel):
    items: list[CompareItem]
    best_pipeline_id: Optional[int] = None
