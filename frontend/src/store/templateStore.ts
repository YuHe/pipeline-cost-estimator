import { create } from 'zustand';
import * as templatesService from '@/services/templates';
import type { ModuleTemplate } from '@/services/templates';

interface TemplateStoreState {
  globalTemplates: ModuleTemplate[];
  myTemplates: ModuleTemplate[];
  loading: boolean;

  fetchTemplates: () => Promise<void>;
  addTemplate: (data: { name: string; description?: string; config: Record<string, unknown> }) => Promise<void>;
  updateTemplate: (id: number, data: { name?: string; config?: Record<string, unknown> }) => Promise<void>;
  removeTemplate: (id: number) => Promise<void>;
}

const useTemplateStore = create<TemplateStoreState>((set) => ({
  globalTemplates: [],
  myTemplates: [],
  loading: false,

  fetchTemplates: async () => {
    set({ loading: true });
    try {
      const all = await templatesService.listTemplates();
      set({
        globalTemplates: all.filter((t) => t.is_global),
        myTemplates: all.filter((t) => !t.is_global),
      });
    } catch {
      // silently fail
    } finally {
      set({ loading: false });
    }
  },

  addTemplate: async (data) => {
    const created = await templatesService.createTemplate(data);
    set((state) => ({
      myTemplates: [created, ...state.myTemplates],
    }));
  },

  updateTemplate: async (id, data) => {
    const updated = await templatesService.updateTemplate(id, data);
    set((state) => ({
      myTemplates: state.myTemplates.map((t) => (t.id === id ? updated : t)),
      globalTemplates: state.globalTemplates.map((t) => (t.id === id ? updated : t)),
    }));
  },

  removeTemplate: async (id) => {
    await templatesService.deleteTemplate(id);
    set((state) => ({
      myTemplates: state.myTemplates.filter((t) => t.id !== id),
      globalTemplates: state.globalTemplates.filter((t) => t.id !== id),
    }));
  },
}));

export default useTemplateStore;
