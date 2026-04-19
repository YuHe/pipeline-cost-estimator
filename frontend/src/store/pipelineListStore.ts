import { create } from 'zustand';
import type { Pipeline } from '@/types';
import * as pipelinesService from '@/services/pipelines';

interface PipelineListState {
  pipelines: Pipeline[];
  loading: boolean;
  fetchPipelines: () => Promise<void>;
  removePipeline: (id: number) => Promise<void>;
}

const usePipelineListStore = create<PipelineListState>((set) => ({
  pipelines: [],
  loading: false,

  fetchPipelines: async () => {
    set({ loading: true });
    try {
      const pipelines = await pipelinesService.listPipelines();
      set({ pipelines });
    } finally {
      set({ loading: false });
    }
  },

  removePipeline: async (id: number) => {
    await pipelinesService.deletePipeline(id);
    set((state) => ({
      pipelines: state.pipelines.filter((p) => p.id !== id),
    }));
  },
}));

export default usePipelineListStore;
