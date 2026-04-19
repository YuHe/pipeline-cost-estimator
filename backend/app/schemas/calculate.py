from typing import Literal, Optional

from pydantic import BaseModel


class GlobalInput(BaseModel):
    input_type: Literal["qps", "concurrency"]
    value: float
    avg_response_time_ms: float = 100.0


class NodeConfig(BaseModel):
    node_id: str
    module_name: str
    qps_per_instance: float
    avg_response_time_ms: float = 100.0
    cost_per_unit: float
    cost_type: Literal["per_gpu", "per_machine"]
    gpus_per_machine: int = 1
    resource_spec_name: str = ""


class EdgeConfig(BaseModel):
    source: str
    target: str
    split_ratio: float = 1.0


class CalculateRequest(BaseModel):
    nodes: list[NodeConfig]
    edges: list[EdgeConfig]
    global_input: GlobalInput
    e2e_coefficient: float = 1.0
    ha_enabled: bool = False
    ha_mode: Literal["2_gpu", "2_machine"] = "2_gpu"


class NodeCostResult(BaseModel):
    node_id: str
    module_name: str
    allocated_qps: float
    raw_instances: int
    ha_instances: Optional[int] = None
    final_instances: int
    node_cost: float
    resource_spec_name: str


class CalculateResponse(BaseModel):
    nodes: list[NodeCostResult]
    total_gpu_cost: float
    e2e_coefficient: float
    e2e_total_cost: float
    unit_cost: float
    unit_label: str
    target_qps: float
