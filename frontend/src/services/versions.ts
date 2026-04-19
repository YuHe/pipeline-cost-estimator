import api from './api';
import type { PipelineVersion } from '@/types';

export async function rollbackToVersion(pipelineId: number, versionId: number): Promise<PipelineVersion> {
  const res = await api.post<PipelineVersion>(`/pipelines/${pipelineId}/versions/rollback`, { version_id: versionId });
  return res.data;
}
