import api from './api';

export interface CompareItem {
  pipeline_id: number;
  pipeline_name: string;
  e2e_total_cost: number;
  unit_cost: number;
  unit_label: string;
  target_qps: number;
  node_count: number;
  total_gpu_cost: number;
}

export interface CompareResponse {
  items: CompareItem[];
  best_pipeline_id: number | null;
}

export interface TrendPoint {
  version_number: number;
  created_at: string;
  e2e_total_cost: number;
  unit_cost: number;
  target_qps: number;
}

export interface TrendResponse {
  pipeline_name: string;
  points: TrendPoint[];
}

export async function comparePipelines(pipelineIds: number[]): Promise<CompareResponse> {
  const res = await api.post<CompareResponse>('/compare', { pipeline_ids: pipelineIds });
  return res.data;
}

export async function getTrend(pipelineId: number): Promise<TrendResponse> {
  const res = await api.post<TrendResponse>('/trend', { pipeline_id: pipelineId });
  return res.data;
}
