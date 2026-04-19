import { create } from 'zustand';
import { addEdge, Connection, applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import type { ModuleConfig, ModuleNodeData, SplitEdgeData, GlobalInput, CostResult, PipelineConfig } from '@/types';

type AppNode = Node<ModuleNodeData>;
type AppEdge = Edge<SplitEdgeData>;

const DEFAULT_MODULE_CONFIG: ModuleConfig = {
  module_name: '新模块',
  qps_per_instance: 50,
  avg_response_time_ms: 100,
  cost_per_unit: 25,
  gpus_per_instance: 1,
  gpus_per_machine: 1,
};

const DEFAULT_GLOBAL_INPUT: GlobalInput = {
  input_type: 'qps',
  value: 100,
  avg_response_time_ms: 100,
};

interface PipelineEditorState {
  // Pipeline metadata
  pipelineId: number | null;
  pipelineName: string;

  // React Flow state
  nodes: AppNode[];
  edges: AppEdge[];

  // Global input
  globalInput: GlobalInput;

  // E2E coefficient
  e2eCoefficient: number;

  // HA config
  haEnabled: boolean;
  haMode: string;

  // Calculation result
  costResult: CostResult | null;
  isCalculating: boolean;

  // Selected node for config drawer
  selectedNodeId: string | null;

  // Actions
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (position: { x: number; y: number }, config?: Partial<ModuleConfig>) => void;
  removeNode: (nodeId: string) => void;
  updateNodeConfig: (nodeId: string, config: Partial<ModuleConfig>) => void;
  updateEdgeSplitRatio: (edgeId: string, ratio: number) => void;
  setGlobalInput: (input: Partial<GlobalInput>) => void;
  setE2eCoefficient: (value: number) => void;
  setHaEnabled: (enabled: boolean) => void;
  setHaMode: (mode: string) => void;
  setCostResult: (result: CostResult | null) => void;
  setIsCalculating: (calculating: boolean) => void;
  setSelectedNodeId: (nodeId: string | null) => void;
  setPipelineId: (id: number | null) => void;
  setPipelineName: (name: string) => void;

  // Load/save
  getConfig: () => PipelineConfig;
  loadConfig: (config: PipelineConfig) => void;
  reset: () => void;
}

let nodeIdCounter = 0;

const usePipelineStore = create<PipelineEditorState>((set, get) => ({
  pipelineId: null,
  pipelineName: '未命名 Pipeline',
  nodes: [],
  edges: [],
  globalInput: { ...DEFAULT_GLOBAL_INPUT },
  e2eCoefficient: 1.0,
  haEnabled: false,
  haMode: '2_gpu',
  costResult: null,
  isCalculating: false,
  selectedNodeId: null,

  onNodesChange: (changes) => set((state) => ({
    nodes: applyNodeChanges(changes, state.nodes) as AppNode[],
  })),

  onEdgesChange: (changes) => set((state) => ({
    edges: applyEdgeChanges(changes, state.edges) as AppEdge[],
  })),

  onConnect: (connection) => set((state) => ({
    edges: addEdge({ ...connection, data: { split_ratio: 1.0 } }, state.edges),
  })),

  addNode: (position, config) => {
    const id = `node_${++nodeIdCounter}_${Date.now()}`;
    // Backward compat: migrate old cost_type to gpus_per_instance
    const migrated = { ...config };
    if ('cost_type' in migrated && !('gpus_per_instance' in migrated)) {
      migrated.gpus_per_instance = (migrated as Record<string, unknown>).cost_type === 'per_machine'
        ? ((migrated as Record<string, unknown>).gpus_per_machine as number || 1) : 1;
      delete (migrated as Record<string, unknown>).cost_type;
    }
    const moduleConfig = { ...DEFAULT_MODULE_CONFIG, ...migrated };
    const newNode: AppNode = {
      id,
      type: 'moduleNode',
      position,
      data: { ...moduleConfig, label: moduleConfig.module_name },
    };
    set((state) => ({ nodes: [...state.nodes, newNode] }));
  },

  removeNode: (nodeId) => set((state) => ({
    nodes: state.nodes.filter((n) => n.id !== nodeId),
    edges: state.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
    selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
  })),

  updateNodeConfig: (nodeId, config) => set((state) => ({
    nodes: state.nodes.map((n) =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, ...config, label: config.module_name ?? n.data.module_name ?? n.data.label } }
        : n
    ),
  })),

  updateEdgeSplitRatio: (edgeId, ratio) => set((state) => ({
    edges: state.edges.map((e) =>
      e.id === edgeId ? { ...e, data: { ...e.data, split_ratio: ratio } } : e
    ),
  })),

  setGlobalInput: (input) => set((state) => ({
    globalInput: { ...state.globalInput, ...input },
  })),
  setE2eCoefficient: (value) => set({ e2eCoefficient: value }),
  setHaEnabled: (enabled) => set({ haEnabled: enabled }),
  setHaMode: (mode) => set({ haMode: mode }),
  setCostResult: (result) => set({ costResult: result }),
  setIsCalculating: (calculating) => set({ isCalculating: calculating }),
  setSelectedNodeId: (nodeId) => set({ selectedNodeId: nodeId }),
  setPipelineId: (id) => set({ pipelineId: id }),
  setPipelineName: (name) => set({ pipelineName: name }),

  getConfig: () => {
    const state = get();
    return {
      nodes: state.nodes.map((n) => ({
        id: n.id,
        type: n.type || 'moduleNode',
        label: String(n.data.module_name || n.data.label || '模块'),
        position: n.position,
        data: {
          module_name: String(n.data.module_name || n.data.label || '模块'),
          resource_spec_id: n.data.resource_spec_id as number | undefined,
          resource_spec_name: n.data.resource_spec_name as string | undefined,
          qps_per_instance: Number(n.data.qps_per_instance ?? 50),
          avg_response_time_ms: Number(n.data.avg_response_time_ms ?? 100),
          cost_per_unit: Number(n.data.cost_per_unit ?? 25),
          gpus_per_instance: Number(n.data.gpus_per_instance ?? 1),
          gpus_per_machine: Number(n.data.gpus_per_machine ?? 1),
        },
      })),
      edges: state.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        split_ratio: Number(e.data?.split_ratio ?? 1.0),
      })),
      global_input: state.globalInput,
    };
  },

  loadConfig: (config) => {
    const nodes: AppNode[] = config.nodes.map((n) => ({
      id: n.id,
      type: 'moduleNode',
      position: n.position,
      data: { ...n.data, label: n.data.module_name || n.label } as ModuleNodeData,
    }));
    const edges: AppEdge[] = config.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      data: { split_ratio: e.split_ratio ?? 1.0 },
    }));
    set({
      nodes,
      edges,
      globalInput: config.global_input ?? { ...DEFAULT_GLOBAL_INPUT },
      costResult: null,
    });
  },

  reset: () => set({
    pipelineId: null,
    pipelineName: '未命名 Pipeline',
    nodes: [],
    edges: [],
    globalInput: { ...DEFAULT_GLOBAL_INPUT },
    e2eCoefficient: 1.0,
    haEnabled: false,
    haMode: '2_gpu',
    costResult: null,
    isCalculating: false,
    selectedNodeId: null,
  }),
}));

export default usePipelineStore;
