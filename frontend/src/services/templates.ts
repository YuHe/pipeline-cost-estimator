import api from './api';

export interface ModuleTemplate {
  id: number;
  name: string;
  description: string | null;
  config: Record<string, unknown>;
  is_global: boolean;
  created_by: number;
  created_at: string;
}

export async function listTemplates(query?: string): Promise<ModuleTemplate[]> {
  const params = query ? { q: query } : {};
  const res = await api.get<ModuleTemplate[]>('/module-templates/', { params });
  return res.data;
}

export async function createTemplate(data: { name: string; description?: string; config: Record<string, unknown> }): Promise<ModuleTemplate> {
  const res = await api.post<ModuleTemplate>('/module-templates/', data);
  return res.data;
}

export async function deleteTemplate(id: number): Promise<void> {
  await api.delete(`/module-templates/${id}`);
}

export async function updateTemplate(
  id: number,
  data: { name?: string; description?: string; config?: Record<string, unknown> }
): Promise<ModuleTemplate> {
  const res = await api.put<ModuleTemplate>(`/module-templates/${id}`, data);
  return res.data;
}
