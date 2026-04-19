import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import usePipelineStore from '@/store/pipelineStore';

const ModuleNode = memo(({ id, data, selected }: NodeProps) => {
  const costResult = usePipelineStore((s) => s.costResult);
  const setSelectedNodeId = usePipelineStore((s) => s.setSelectedNodeId);

  const nodeCost = costResult?.nodes.find((n) => n.node_id === id);
  const hasResult = !!nodeCost;

  const containerStyle: React.CSSProperties = {
    padding: '12px 16px',
    borderRadius: 8,
    border: selected ? '2px solid #1677ff' : '2px solid #d9d9d9',
    background: hasResult ? '#f6ffed' : '#fff',
    minWidth: 180,
    boxShadow: selected
      ? '0 0 0 2px rgba(22, 119, 255, 0.2)'
      : '0 2px 8px rgba(0,0,0,0.08)',
    cursor: 'pointer',
    transition: 'all 0.2s',
  };

  const titleStyle: React.CSSProperties = {
    fontWeight: 600,
    fontSize: 14,
    marginBottom: 8,
    color: '#262626',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };

  const statRowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 12,
    color: '#8c8c8c',
    marginBottom: 2,
  };

  const costBadgeStyle: React.CSSProperties = {
    marginTop: 8,
    padding: '2px 8px',
    borderRadius: 4,
    background: '#52c41a',
    color: '#fff',
    fontSize: 11,
    fontWeight: 600,
    textAlign: 'center',
  };

  const costTypeLabel = data.cost_type === 'per_gpu' ? '按卡计费' : '按机计费';

  return (
    <div style={containerStyle} onClick={() => setSelectedNodeId(id)}>
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: '#1677ff', width: 8, height: 8 }}
      />
      <div style={titleStyle}>{data.module_name || data.label || '模块'}</div>
      <div style={statRowStyle}>
        <span>QPS/实例</span>
        <span style={{ color: '#262626' }}>{data.qps_per_instance ?? '-'}</span>
      </div>
      <div style={statRowStyle}>
        <span>单价</span>
        <span style={{ color: '#262626' }}>{data.cost_per_unit ?? '-'}</span>
      </div>
      <div style={statRowStyle}>
        <span>计费方式</span>
        <span style={{ color: '#262626' }}>{costTypeLabel}</span>
      </div>
      {hasResult && (
        <div style={costBadgeStyle}>
          {nodeCost.final_instances} 实例 | {nodeCost.node_cost.toFixed(2)} 元
        </div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: '#1677ff', width: 8, height: 8 }}
      />
    </div>
  );
});

ModuleNode.displayName = 'ModuleNode';

export default ModuleNode;
