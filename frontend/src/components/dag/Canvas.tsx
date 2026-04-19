import { useCallback, useRef, type DragEvent } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import ModuleNode from './ModuleNode';
import CustomEdge from './CustomEdge';
import usePipelineStore from '@/store/pipelineStore';

const nodeTypes = { moduleNode: ModuleNode };
const edgeTypes = { default: CustomEdge };

function CanvasInner({ onEdgeDoubleClick }: { onEdgeDoubleClick: (edgeId: string) => void }) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const nodes = usePipelineStore((s) => s.nodes);
  const edges = usePipelineStore((s) => s.edges);
  const onNodesChange = usePipelineStore((s) => s.onNodesChange);
  const onEdgesChange = usePipelineStore((s) => s.onEdgesChange);
  const onConnect = usePipelineStore((s) => s.onConnect);
  const addNode = usePipelineStore((s) => s.addNode);
  const setSelectedNodeId = usePipelineStore((s) => s.setSelectedNodeId);

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const dataStr = event.dataTransfer.getData('application/reactflow');
      if (!dataStr) return;

      try {
        const config = JSON.parse(dataStr);
        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });
        addNode(position, config);
      } catch {
        // ignore invalid data
      }
    },
    [screenToFlowPosition, addNode],
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: { id: string }) => {
      setSelectedNodeId(node.id);
    },
    [setSelectedNodeId],
  );

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, [setSelectedNodeId]);

  const handleEdgeDoubleClick = useCallback(
    (_: React.MouseEvent, edge: { id: string }) => {
      onEdgeDoubleClick(edge.id);
    },
    [onEdgeDoubleClick],
  );

  return (
    <div ref={reactFlowWrapper} style={{ flex: 1, height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onEdgeDoubleClick={handleEdgeDoubleClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        deleteKeyCode={['Backspace', 'Delete']}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} size={1} />
        <Controls />
        <MiniMap
          nodeStrokeWidth={3}
          style={{ height: 100, width: 150 }}
        />
      </ReactFlow>
    </div>
  );
}

function Canvas({ onEdgeDoubleClick }: { onEdgeDoubleClick: (edgeId: string) => void }) {
  return (
    <ReactFlowProvider>
      <CanvasInner onEdgeDoubleClick={onEdgeDoubleClick} />
    </ReactFlowProvider>
  );
}

export default Canvas;
