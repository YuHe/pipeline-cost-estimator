import api from './api';
import type { ResourceSpec } from '@/types';

export async function listResourceSpecs(query?: string): Promise<ResourceSpec[]> {
  const params = query ? { q: query } : {};
  const res = await api.get<ResourceSpec[]>('/resource-specs/', { params });
  return res.data;
}

export async function createResourceSpec(data: Partial<ResourceSpec>): Promise<ResourceSpec> {
  const res = await api.post<ResourceSpec>('/resource-specs/', data);
  return res.data;
}

export async function deleteResourceSpec(id: number): Promise<void> {
  await api.delete(`/resource-specs/${id}`);
}
