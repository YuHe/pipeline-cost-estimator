import api from './api';

export interface ShareLink {
  id: number;
  pipeline_id: number;
  version_id: number | null;
  token: string;
  created_by: number;
  expires_at: string;
  created_at: string;
}

export interface ShareView {
  pipeline_name: string;
  config: Record<string, unknown>;
  cost_snapshot: Record<string, unknown> | null;
  is_expired: boolean;
}

export async function createShareLink(data: { pipeline_id: number; version_id?: number; expires_in_hours?: number }): Promise<ShareLink> {
  const res = await api.post<ShareLink>('/shares/', data);
  return res.data;
}

export async function viewShareLink(token: string): Promise<ShareView> {
  const res = await api.get<ShareView>(`/shares/view/${token}`);
  return res.data;
}

export async function deleteShareLink(id: number): Promise<void> {
  await api.delete(`/shares/${id}`);
}
