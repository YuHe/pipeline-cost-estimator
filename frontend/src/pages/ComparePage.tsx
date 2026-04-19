import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout, Typography, Button, Space, Table, Checkbox, message, Card, Empty, Spin } from 'antd';
import { ArrowLeftOutlined, SwapOutlined } from '@ant-design/icons';
import * as pipelinesService from '@/services/pipelines';
import { comparePipelines } from '@/services/compare';
import type { Pipeline } from '@/types';
import type { CompareItem, CompareResponse } from '@/services/compare';
import type { ColumnsType } from 'antd/es/table';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

function ComparePage() {
  const navigate = useNavigate();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loadingPipelines, setLoadingPipelines] = useState(true);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [compareResult, setCompareResult] = useState<CompareResponse | null>(null);
  const [comparing, setComparing] = useState(false);

  useEffect(() => {
    pipelinesService
      .listPipelines()
      .then(setPipelines)
      .catch(() => {
        message.error('加载 Pipeline 列表失败');
      })
      .finally(() => {
        setLoadingPipelines(false);
      });
  }, []);

  const handleToggle = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  };

  const handleCompare = async () => {
    if (selectedIds.length < 2) {
      message.warning('请至少选择 2 个 Pipeline 进行对比');
      return;
    }
    setComparing(true);
    try {
      const result = await comparePipelines(selectedIds);
      setCompareResult(result);
    } catch {
      message.error('对比失败');
    } finally {
      setComparing(false);
    }
  };

  const resultColumns: ColumnsType<CompareItem> = [
    {
      title: 'Pipeline 名称',
      dataIndex: 'pipeline_name',
      key: 'pipeline_name',
      width: 200,
    },
    {
      title: '目标 QPS',
      dataIndex: 'target_qps',
      key: 'target_qps',
      width: 120,
      sorter: (a, b) => a.target_qps - b.target_qps,
    },
    {
      title: '节点数',
      dataIndex: 'node_count',
      key: 'node_count',
      width: 100,
      sorter: (a, b) => a.node_count - b.node_count,
    },
    {
      title: 'GPU 总成本',
      dataIndex: 'total_gpu_cost',
      key: 'total_gpu_cost',
      width: 140,
      sorter: (a, b) => a.total_gpu_cost - b.total_gpu_cost,
      render: (val: number) => `${val.toFixed(2)} 元`,
    },
    {
      title: 'E2E 总成本',
      dataIndex: 'e2e_total_cost',
      key: 'e2e_total_cost',
      width: 140,
      sorter: (a, b) => a.e2e_total_cost - b.e2e_total_cost,
      render: (val: number) => `${val.toFixed(2)} 元`,
    },
    {
      title: '单位成本',
      key: 'unit_cost',
      width: 160,
      sorter: (a, b) => a.unit_cost - b.unit_cost,
      render: (_: unknown, record: CompareItem) =>
        `${record.unit_cost.toFixed(4)} 元/${record.unit_label}`,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#fff',
          padding: '0 24px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        }}
      >
        <Space>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/')}
          >
            返回
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            Pipeline 对比
          </Title>
        </Space>
      </Header>

      <Content style={{ padding: 24 }}>
        {/* Pipeline selection */}
        <Card title="选择要对比的 Pipeline" style={{ marginBottom: 24 }}>
          {loadingPipelines ? (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <Spin />
            </div>
          ) : pipelines.length === 0 ? (
            <Empty description="暂无 Pipeline" />
          ) : (
            <>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                {pipelines.map((p) => (
                  <Checkbox
                    key={p.id}
                    checked={selectedIds.includes(p.id)}
                    onChange={() => handleToggle(p.id)}
                  >
                    {p.name}
                  </Checkbox>
                ))}
              </div>
              <Space>
                <Button
                  type="primary"
                  icon={<SwapOutlined />}
                  onClick={handleCompare}
                  loading={comparing}
                  disabled={selectedIds.length < 2}
                >
                  对比 ({selectedIds.length} 个已选)
                </Button>
                <Button onClick={() => setSelectedIds([])}>
                  清除选择
                </Button>
              </Space>
            </>
          )}
        </Card>

        {/* Compare results */}
        {compareResult && (
          <Card title="对比结果">
            {compareResult.items.length === 0 ? (
              <Empty description="无可用的对比数据（所选 Pipeline 可能尚未计算成本）" />
            ) : (
              <>
                {compareResult.best_pipeline_id && (
                  <div style={{ marginBottom: 16 }}>
                    <Text type="success" strong>
                      最优 Pipeline：
                      {compareResult.items.find(
                        (item) => item.pipeline_id === compareResult.best_pipeline_id
                      )?.pipeline_name ?? ''}
                      （E2E 总成本最低）
                    </Text>
                  </div>
                )}
                <Table<CompareItem>
                  dataSource={compareResult.items}
                  columns={resultColumns}
                  rowKey="pipeline_id"
                  pagination={false}
                  scroll={{ x: 800 }}
                  rowClassName={(record) =>
                    record.pipeline_id === compareResult.best_pipeline_id
                      ? 'compare-best-row'
                      : ''
                  }
                />
                <style>{`
                  .compare-best-row td {
                    background-color: #f6ffed !important;
                  }
                  .compare-best-row:hover td {
                    background-color: #d9f7be !important;
                  }
                `}</style>
              </>
            )}
          </Card>
        )}
      </Content>
    </Layout>
  );
}

export default ComparePage;
