import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Spin, Result, Typography, Card, Descriptions } from 'antd';
import { ReactFlow, Background, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { viewShareLink } from '@/services/shares';
import type { ShareView } from '@/services/shares';
import type { PipelineConfig, CostResult, NodeCost } from '@/types';
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';

const { Title, Text } = Typography;

/* Readonly version of ModuleNode for share view */
const ReadonlyModuleNode = memo(({ data }: NodeProps) => {
  const nodeCost = data._nodeCost as NodeCost | undefined;
  const hasResult = !!nodeCost;

  const containerStyle: React.CSSProperties = {
    padding: '12px 16px',
    borderRadius: 8,
    border: '2px solid #d9d9d9',
    background: hasResult ? '#f6ffed' : '#fff',
    minWidth: 180,
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    cursor: 'default',
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

  return (
    <div style={containerStyle}>
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#1677ff', width: 8, height: 8 }}
      />
      <div style={titleStyle}>{String(data.module_name || data.label || '模块')}</div>
      <div style={statRowStyle}>
        <span>QPS/实例</span>
        <span style={{ color: '#262626' }}>{String(data.qps_per_instance ?? '-')}</span>
      </div>
      <div style={statRowStyle}>
        <span>单卡日成本</span>
        <span style={{ color: '#262626' }}>{String(data.cost_per_unit ?? '-')}</span>
      </div>
      <div style={statRowStyle}>
        <span>GPU/实例</span>
        <span style={{ color: '#262626' }}>{String(data.gpus_per_instance ?? 1)}</span>
      </div>
      {hasResult && nodeCost && (
        <div style={costBadgeStyle}>
          {nodeCost.total_gpus} GPU | {nodeCost.final_instances} 实例 | {nodeCost.node_cost.toFixed(2)} 元
        </div>
      )}
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: '#1677ff', width: 8, height: 8 }}
      />
    </div>
  );
});

ReadonlyModuleNode.displayName = 'ReadonlyModuleNode';

const nodeTypes = { moduleNode: ReadonlyModuleNode };

function ShareViewPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ShareView | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    viewShareLink(token)
      .then((res) => {
        setData(res);
      })
      .catch(() => {
        setError(true);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Result
          status="error"
          title="链接无效"
          subTitle="该分享链接不存在或已失效"
        />
      </div>
    );
  }

  if (data?.is_expired) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Result
          status="warning"
          title="链接已过期"
          subTitle="该分享链接已超过有效期"
        />
      </div>
    );
  }

  const config = data?.config as unknown as PipelineConfig | undefined;
  const costSnapshot = data?.cost_snapshot as unknown as CostResult | undefined;

  const flowNodes = useMemo(() => {
    if (!config?.nodes) return [];
    return config.nodes.map((n) => {
      const nodeCost = costSnapshot?.nodes?.find((nc) => nc.node_id === n.id);
      return {
        id: n.id,
        type: 'moduleNode',
        position: n.position,
        data: { ...n.data, label: n.data.module_name || n.label, _nodeCost: nodeCost },
      };
    });
  }, [config, costSnapshot]);

  const flowEdges = useMemo(() => {
    if (!config?.edges) return [];
    return config.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      data: { split_ratio: e.split_ratio ?? 1.0 },
    }));
  }, [config]);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>
      {/* Header */}
      <div
        style={{
          height: 56,
          background: '#fff',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          flexShrink: 0,
        }}
      >
        <Title level={4} style={{ margin: 0 }}>
          {data?.pipeline_name || 'Pipeline'}
        </Title>
        <Text type="secondary" style={{ marginLeft: 16 }}>
          （只读分享视图）
        </Text>
      </div>

      {/* Main content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Canvas area */}
        <div style={{ flex: 1 }}>
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={nodeTypes}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            fitView
          >
            <Background />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>

        {/* Cost panel */}
        {costSnapshot && (
          <div
            style={{
              width: 320,
              background: '#fff',
              borderLeft: '1px solid #f0f0f0',
              padding: 16,
              overflow: 'auto',
              flexShrink: 0,
            }}
          >
            <Title level={5}>成本概览</Title>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="目标 QPS">
                  {costSnapshot.target_qps}
                </Descriptions.Item>
                <Descriptions.Item label="GPU 总成本">
                  {costSnapshot.total_gpu_cost.toFixed(2)} 元
                </Descriptions.Item>
                <Descriptions.Item label="E2E 系数">
                  {costSnapshot.e2e_coefficient}
                </Descriptions.Item>
                <Descriptions.Item label="E2E 总成本">
                  <Text strong style={{ color: '#1677ff' }}>
                    {costSnapshot.e2e_total_cost.toFixed(2)} 元
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label={`单位成本 (${costSnapshot.unit_label})`}>
                  {costSnapshot.unit_cost.toFixed(4)} 元
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Title level={5}>模块明细</Title>
            {costSnapshot.nodes.map((node) => (
              <Card key={node.node_id} size="small" style={{ marginBottom: 8 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{node.module_name}</div>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="分配 QPS">
                    {node.allocated_qps.toFixed(2)}
                  </Descriptions.Item>
                  <Descriptions.Item label="最终实例数">
                    {node.final_instances}
                  </Descriptions.Item>
                  <Descriptions.Item label="总 GPU 数">
                    {node.total_gpus}
                  </Descriptions.Item>
                  <Descriptions.Item label="节点成本">
                    {node.node_cost.toFixed(2)} 元
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ShareViewPage;
