import api from './api';
import type { CalculateRequest, CostResult } from '@/types';

export async function calculateCost(data: CalculateRequest): Promise<CostResult> {
  const res = await api.post<CostResult>('/calculate', data);
  return res.data;
}
