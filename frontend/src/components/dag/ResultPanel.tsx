import { useState } from 'react';
import { Descriptions, Table, Statistic, Button, Space } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import usePipelineStore from '@/store/pipelineStore';
import type { NodeCost } from '@/types';

function ResultPanel() {
  const costResult = usePipelineStore((s) => s.costResult);
  const [collapsed, setCollapsed] = useState(false);

  if (!costResult) return null;

  const toggleStyle: React.CSSProperties = {
    position: 'absolute',
    left: -24,
    top: '50%',
    transform: 'translateY(-50%)',
    zIndex: 10,
    width: 24,
    height: 48,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#fff',
    border: '1px solid #f0f0f0',
    borderRight: 'none',
    borderRadius: '4px 0 0 4px',
    cursor: 'pointer',
  };

  const panelStyle: React.CSSProperties = {
    position: 'relative',
    width: collapsed ? 0 : 350,
    background: '#fff',
    borderLeft: collapsed ? 'none' : '1px solid #f0f0f0',
    overflowY: 'auto',
    overflowX: 'hidden',
    transition: 'width 0.2s',
    flexShrink: 0,
  };

  const columns = [
    {
      title: '模块',
      dataIndex: 'module_name',
      key: 'module_name',
      ellipsis: true,
      width: 90,
    },
    {
      title: '分配 QPS',
      dataIndex: 'allocated_qps',
      key: 'allocated_qps',
      width: 75,
      render: (v: number) => v?.toFixed(1),
    },
    {
      title: '实例数',
      dataIndex: 'final_instances',
      key: 'final_instances',
      width: 60,
    },
    {
      title: '成本',
      dataIndex: 'node_cost',
      key: 'node_cost',
      width: 70,
      render: (v: number) => (
        <span style={{ color: v > 0 ? '#cf1322' : '#389e0d', fontWeight: 600 }}>
          {v?.toFixed(2)}
        </span>
      ),
    },
  ];

  return (
    <div style={panelStyle}>
      <div style={toggleStyle} onClick={() => setCollapsed(!collapsed)}>
        {collapsed ? <LeftOutlined style={{ fontSize: 12 }} /> : <RightOutlined style={{ fontSize: 12 }} />}
      </div>
      {!collapsed && (
        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>计算结果</div>

          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Statistic
                title="GPU 总成本"
                value={costResult.total_gpu_cost}
                precision={2}
                suffix="元"
                valueStyle={{ fontSize: 18, color: '#cf1322' }}
              />
              <Statistic
                title="E2E 总成本"
                value={costResult.e2e_total_cost}
                precision={2}
                suffix="元"
                valueStyle={{ fontSize: 18, color: '#cf1322' }}
              />
            </div>

            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="目标 QPS">{costResult.target_qps}</Descriptions.Item>
              <Descriptions.Item label="单位成本">
                {costResult.unit_cost?.toFixed(4)} {costResult.unit_label}
              </Descriptions.Item>
              <Descriptions.Item label="E2E 系数">{costResult.e2e_coefficient}</Descriptions.Item>
            </Descriptions>

            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>各模块明细</div>
            <Table<NodeCost>
              dataSource={costResult.nodes}
              columns={columns}
              rowKey="node_id"
              size="small"
              pagination={false}
              scroll={{ x: 295 }}
            />
          </Space>
        </div>
      )}
    </div>
  );
}

export default ResultPanel;
