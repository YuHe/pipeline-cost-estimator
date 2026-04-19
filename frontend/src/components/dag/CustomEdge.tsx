import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';

function CustomEdge({
  id,
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
      <EdgeLabelRenderer>
        <div style={labelStyle} className="nodrag nopan">
          分流: {percentage}%
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export default CustomEdge;
