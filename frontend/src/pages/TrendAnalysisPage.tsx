import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout, Typography, Button, Space, Select, Table, Card, Spin, Empty, message } from 'antd';
import { ArrowLeftOutlined, LineChartOutlined } from '@ant-design/icons';
import * as pipelinesService from '@/services/pipelines';
import { getTrend } from '@/services/compare';
import type { Pipeline } from '@/types';
import type { TrendPoint, TrendResponse } from '@/services/compare';
import type { ColumnsType } from 'antd/es/table';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

/* Simple SVG line chart for cost trend visualization */
function TrendChart({ points }: { points: TrendPoint[] }) {
  if (points.length === 0) return null;

  const width = 700;
  const height = 320;
  const paddingLeft = 80;
  const paddingRight = 30;
  const paddingTop = 30;
  const paddingBottom = 50;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const costs = points.map((p) => p.e2e_total_cost);
  const minCost = Math.min(...costs);
  const maxCost = Math.max(...costs);
  const costRange = maxCost - minCost || 1;

  const getX = (index: number) =>
    paddingLeft + (points.length === 1 ? chartWidth / 2 : (index / (points.length - 1)) * chartWidth);

  const getY = (cost: number) =>
    paddingTop + chartHeight - ((cost - minCost) / costRange) * chartHeight;

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(p.e2e_total_cost).toFixed(1)}`)
    .join(' ');

  // Generate Y axis ticks
  const yTickCount = 5;
  const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => {
    const value = minCost + (costRange * i) / yTickCount;
    return { value, y: getY(value) };
  });

  return (
    <svg width={width} height={height} style={{ display: 'block', margin: '0 auto' }}>
      {/* Background */}
      <rect x={paddingLeft} y={paddingTop} width={chartWidth} height={chartHeight} fill="#fafafa" stroke="#f0f0f0" />

      {/* Y axis grid and labels */}
      {yTicks.map((tick, i) => (
        <g key={i}>
          <line
            x1={paddingLeft}
            y1={tick.y}
            x2={paddingLeft + chartWidth}
            y2={tick.y}
            stroke="#f0f0f0"
            strokeDasharray="4"
          />
          <text
            x={paddingLeft - 8}
            y={tick.y + 4}
            textAnchor="end"
            fontSize={11}
            fill="#8c8c8c"
          >
            {tick.value.toFixed(1)}
          </text>
        </g>
      ))}

      {/* X axis labels */}
      {points.map((p, i) => (
        <text
          key={i}
          x={getX(i)}
          y={height - paddingBottom + 20}
          textAnchor="middle"
          fontSize={11}
          fill="#8c8c8c"
        >
          v{p.version_number}
        </text>
      ))}

      {/* Line path */}
      <path d={pathD} fill="none" stroke="#1677ff" strokeWidth={2.5} strokeLinejoin="round" />

      {/* Data points */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={getX(i)} cy={getY(p.e2e_total_cost)} r={4} fill="#fff" stroke="#1677ff" strokeWidth={2} />
          <title>v{p.version_number}: {p.e2e_total_cost.toFixed(2)} 元</title>
        </g>
      ))}

      {/* Axis labels */}
      <text x={paddingLeft + chartWidth / 2} y={height - 5} textAnchor="middle" fontSize={12} fill="#595959">
        版本号
      </text>
      <text
        x={15}
        y={paddingTop + chartHeight / 2}
        textAnchor="middle"
        fontSize={12}
        fill="#595959"
        transform={`rotate(-90, 15, ${paddingTop + chartHeight / 2})`}
      >
        E2E 总成本 (元)
      </text>
    </svg>
  );
}

function TrendAnalysisPage() {
  const navigate = useNavigate();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loadingPipelines, setLoadingPipelines] = useState(true);
  const [selectedPipelineId, setSelectedPipelineId] = useState<number | null>(null);
  const [trendData, setTrendData] = useState<TrendResponse | null>(null);
  const [loadingTrend, setLoadingTrend] = useState(false);

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

  const handlePipelineSelect = async (pipelineId: number) => {
    setSelectedPipelineId(pipelineId);
    setLoadingTrend(true);
    try {
      const data = await getTrend(pipelineId);
      setTrendData(data);
    } catch {
      message.error('加载趋势数据失败');
      setTrendData(null);
    } finally {
      setLoadingTrend(false);
    }
  };

  const sortedPoints = useMemo(() => {
    if (!trendData?.points) return [];
    return [...trendData.points].sort((a, b) => a.version_number - b.version_number);
  }, [trendData]);

  const trendColumns: ColumnsType<TrendPoint> = [
    {
      title: '版本号',
      dataIndex: 'version_number',
      key: 'version_number',
      width: 100,
      render: (val: number) => `v${val}`,
      sorter: (a, b) => a.version_number - b.version_number,
      defaultSortOrder: 'descend',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text: string) => {
        try {
          return new Date(text).toLocaleString('zh-CN');
        } catch {
          return text;
        }
      },
    },
    {
      title: '目标 QPS',
      dataIndex: 'target_qps',
      key: 'target_qps',
      width: 120,
    },
    {
      title: 'E2E 总成本',
      dataIndex: 'e2e_total_cost',
      key: 'e2e_total_cost',
      width: 140,
      render: (val: number) => `${val.toFixed(2)} 元`,
      sorter: (a, b) => a.e2e_total_cost - b.e2e_total_cost,
    },
    {
      title: '单位成本',
      dataIndex: 'unit_cost',
      key: 'unit_cost',
      width: 140,
      render: (val: number) => `${val.toFixed(4)} 元`,
      sorter: (a, b) => a.unit_cost - b.unit_cost,
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
            <LineChartOutlined style={{ marginRight: 8 }} />
            成本趋势分析
          </Title>
        </Space>
      </Header>

      <Content style={{ padding: 24 }}>
        {/* Pipeline selector */}
        <Card style={{ marginBottom: 24 }}>
          <Space>
            <Text strong>选择 Pipeline：</Text>
            <Select
              style={{ width: 320 }}
              placeholder="请选择一个 Pipeline"
              loading={loadingPipelines}
              value={selectedPipelineId}
              onChange={handlePipelineSelect}
              showSearch
              optionFilterProp="label"
              options={pipelines.map((p) => ({
                label: p.name,
                value: p.id,
              }))}
            />
          </Space>
        </Card>

        {/* Trend display */}
        {loadingTrend ? (
          <Card>
            <div style={{ textAlign: 'center', padding: 48 }}>
              <Spin tip="加载趋势数据..." />
            </div>
          </Card>
        ) : trendData ? (
          <>
            {/* Chart */}
            <Card
              title={`${trendData.pipeline_name} - 成本趋势图`}
              style={{ marginBottom: 24 }}
            >
              {sortedPoints.length === 0 ? (
                <Empty description="暂无版本数据" />
              ) : (
                <TrendChart points={sortedPoints} />
              )}
            </Card>

            {/* Data table */}
            <Card title="版本数据明细">
              <Table<TrendPoint>
                dataSource={trendData.points}
                columns={trendColumns}
                rowKey="version_number"
                pagination={false}
              />
            </Card>
          </>
        ) : selectedPipelineId ? (
          <Card>
            <Empty description="暂无趋势数据" />
          </Card>
        ) : null}
      </Content>
    </Layout>
  );
}

export default TrendAnalysisPage;
