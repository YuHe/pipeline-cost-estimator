import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';
import usePipelineStore from '@/store/pipelineStore';

function CustomEdge({
  id,
  source,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style,
  markerEnd,
}: EdgeProps) {
  const costResult = usePipelineStore((s) => s.costResult);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const splitRatio = Number(data?.split_ratio ?? 1.0);
  const percentage = Math.round(splitRatio * 100);

  // Particle animation: compute QPS flowing through this edge
  const sourceNodeCost = costResult?.nodes.find((n) => n.node_id === source);
  const edgeQps = sourceNodeCost ? sourceNodeCost.allocated_qps * splitRatio : 0;
  const showParticles = !!costResult && edgeQps > 0;

  // 1–5 particles based on QPS magnitude
  const particleCount = showParticles ? Math.max(1, Math.min(5, Math.ceil(edgeQps / 50))) : 0;
  // Duration: higher QPS → faster particles (shorter duration)
  const duration = showParticles ? Math.max(0.8, Math.min(4, 200 / edgeQps)) : 2;

  const labelStyle: React.CSSProperties = {
    position: 'absolute',
    transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
    fontSize: 11,
    fontWeight: 600,
    background: '#fff',
    border: '1px solid #d9d9d9',
    borderRadius: 4,
    padding: '1px 6px',
    color: '#595959',
    pointerEvents: 'all',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
      {showParticles &&
        Array.from({ length: particleCount }).map((_, i) => (
          <circle
            key={`${id}-p-${i}`}
            r="3"
            fill="#1677ff"
            opacity="0.8"
          >
            <animateMotion
              dur={`${duration}s`}
              repeatCount="indefinite"
              begin={`${(i / particleCount) * duration}s`}
              path={edgePath}
            />
          </circle>
        ))}
      <EdgeLabelRenderer>
        <div style={labelStyle} className="nodrag nopan">
          {showParticles ? (
            <>分流: {percentage}% | {edgeQps.toFixed(0)} QPS</>
          ) : (
            <>分流: {percentage}%</>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export default CustomEdge;
