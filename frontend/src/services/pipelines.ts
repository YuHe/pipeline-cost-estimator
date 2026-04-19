import api from './api';
import type { Pipeline, PipelineVersion } from '@/types';

export async function listPipelines(): Promise<Pipeline[]> {
  const res = await api.get<Pipeline[]>('/pipelines/');
  return res.data;
}

export async function createPipeline(data: { name: string; description?: string }): Promise<Pipeline> {
  const res = await api.post<Pipeline>('/pipelines/', data);
  return res.data;
}

export async function getPipeline(id: number): Promise<Pipeline> {
  const res = await api.get<Pipeline>(`/pipelines/${id}`);
  return res.data;
}

export async function updatePipeline(id: number, data: { name?: string; description?: string }): Promise<Pipeline> {
  const res = await api.put<Pipeline>(`/pipelines/${id}`, data);
  return res.data;
}

export async function deletePipeline(id: number): Promise<void> {
  await api.delete(`/pipelines/${id}`);
}

export async function saveVersion(id: number, config: object, costSnapshot?: object, description?: string): Promise<PipelineVersion> {
  const res = await api.post<PipelineVersion>(`/pipelines/${id}/versions`, { config, cost_snapshot: costSnapshot, description });
  return res.data;
}

export async function listVersions(id: number): Promise<PipelineVersion[]> {
  const res = await api.get<PipelineVersion[]>(`/pipelines/${id}/versions`);
  return res.data;
}

export async function getVersion(pipelineId: number, versionId: number): Promise<PipelineVersion> {
  const res = await api.get<PipelineVersion>(`/pipelines/${pipelineId}/versions/${versionId}`);
  return res.data;
}

export async function copyPipeline(id: number, name: string): Promise<Pipeline> {
  const res = await api.post<Pipeline>(`/pipelines/${id}/copy`, { name });
  return res.data;
}
