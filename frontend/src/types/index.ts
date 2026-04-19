export interface User {
  id: number;
  email: string;
  display_name: string;
  is_admin: boolean;
  created_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  display_name: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

// Pipeline types
export interface Pipeline {
  id: number;
  name: string;
  description: string | null;
  owner_id: number;
  created_at: string;
  updated_at: string;
  current_version_id: number | null;
  latest_cost_snapshot?: CostResult | null;
}

export interface PipelineNode {
  id: string;
  type: string;
  label: string;
  position: { x: number; y: number };
  data: ModuleConfig;
}

export interface ModuleConfig {
  module_name: string;
  resource_spec_id?: number;
  resource_spec_name?: string;
  qps_per_instance: number;
  avg_response_time_ms: number;
  cost_per_unit: number;
  gpus_per_instance: number;
  gpus_per_machine: number;
  custom_params?: Record<string, unknown>;
}

export interface PipelineEdge {
  id: string;
  source: string;
  target: string;
  split_ratio?: number;
}

export interface PipelineVersion {
  id: number;
  pipeline_id: number;
  version_number: number;
  config: PipelineConfig;
  cost_snapshot: CostResult | null;
  description: string | null;
  created_at: string;
}

export interface PipelineConfig {
  nodes: PipelineNode[];
  edges: PipelineEdge[];
  global_input: GlobalInput;
}

export interface GlobalInput {
  input_type: 'qps' | 'concurrency';
  value: number;
  avg_response_time_ms: number;
}

export interface CostResult {
  nodes: NodeCost[];
  total_gpu_cost: number;
  e2e_coefficient: number;
  e2e_total_cost: number;
  unit_cost: number;
  unit_label: string;
  target_qps: number;
}

export interface NodeCost {
  node_id: string;
  module_name: string;
  allocated_qps: number;
  raw_instances: number;
  ha_instances: number | null;
  final_instances: number;
  total_gpus: number;
  node_cost: number;
  resource_spec_name: string;
}

export interface ResourceSpec {
  id: number;
  name: string;
  gpu_type: string;
  gpu_count: number;
  cost_per_unit: number;
  gpus_per_instance: number | null;
  gpus_per_machine: number | null;
  qps_per_instance: number | null;
  avg_response_time_ms: number | null;
  is_system: boolean;
  created_by: number | null;
  created_at: string;
}

// Typed React Flow node/edge data
export interface ModuleNodeData extends ModuleConfig {
  label: string;
  [key: string]: unknown;
}

export interface SplitEdgeData {
  split_ratio?: number;
  [key: string]: unknown;
}

export interface CalculateRequest {
  nodes: {
    node_id: string;
    module_name: string;
    qps_per_instance: number;
    avg_response_time_ms: number;
    cost_per_unit: number;
    gpus_per_instance: number;
    gpus_per_machine: number;
    resource_spec_name: string;
  }[];
  edges: {
    source: string;
    target: string;
    split_ratio: number;
  }[];
  global_input: GlobalInput;
  e2e_coefficient: number;
  ha_enabled: boolean;
  ha_mode: string;
}
