import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout, Typography, Button, Space, Table, Modal, Input, message, Popconfirm } from 'antd';
import { PlusOutlined, LogoutOutlined, EditOutlined, DeleteOutlined, CopyOutlined, SwapOutlined, LineChartOutlined, SettingOutlined } from '@ant-design/icons';
import useAuthStore from '@/store/authStore';
import usePipelineListStore from '@/store/pipelineListStore';
import * as pipelinesService from '@/services/pipelines';
import type { Pipeline } from '@/types';

const { Header, Content } = Layout;
const { Title } = Typography;

function PipelineListPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { pipelines, loading, fetchPipelines, removePipeline } = usePipelineListStore();

  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copyTarget, setCopyTarget] = useState<Pipeline | null>(null);
  const [copyName, setCopyName] = useState('');

  useEffect(() => {
    fetchPipelines();
  }, [fetchPipelines]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleCreate = async () => {
    try {
      const pipeline = await pipelinesService.createPipeline({
        name: '未命名 Pipeline',
      });
      navigate(`/editor/${pipeline.id}`);
    } catch {
      message.error('创建失败');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await removePipeline(id);
      message.success('已删除');
    } catch {
      message.error('删除失败');
    }
  };

  const handleCopyClick = (pipeline: Pipeline) => {
    setCopyTarget(pipeline);
    setCopyName(`${pipeline.name} (副本)`);
    setCopyModalOpen(true);
  };

  const handleCopyConfirm = async () => {
    if (!copyTarget) return;
    try {
      const newPipeline = await pipelinesService.copyPipeline(copyTarget.id, copyName);
      message.success('复制成功');
      setCopyModalOpen(false);
      setCopyTarget(null);
      navigate(`/editor/${newPipeline.id}`);
    } catch {
      message.error('复制失败');
    }
  };

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Pipeline) => (
        <a onClick={() => navigate(`/editor/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (text: string | null) => text || '-',
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
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
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: unknown, record: Pipeline) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => navigate(`/editor/${record.id}`)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            icon={<CopyOutlined />}
            onClick={() => handleCopyClick(record)}
          >
            复制
          </Button>
          <Popconfirm
            title="确认删除"
            description={`确定要删除 "${record.name}" 吗？此操作不可恢复。`}
            onConfirm={() => handleDelete(record.id)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
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
        <Title level={4} style={{ margin: 0 }}>
          我的 Pipeline
        </Title>
        <Space>
          {user && (
            <span style={{ color: '#666' }}>
              {user.display_name}
            </span>
          )}
          <Button
            icon={<SwapOutlined />}
            onClick={() => navigate('/compare')}
          >
            Pipeline 对比
          </Button>
          <Button
            icon={<LineChartOutlined />}
            onClick={() => navigate('/trend')}
          >
            成本趋势
          </Button>
          {user?.is_admin && (
            <Button
              icon={<SettingOutlined />}
              onClick={() => navigate('/admin')}
            >
              管理后台
            </Button>
          )}
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            新建 Pipeline
          </Button>
          <Button
            icon={<LogoutOutlined />}
            onClick={handleLogout}
          >
            退出登录
          </Button>
        </Space>
      </Header>
      <Content style={{ padding: 24 }}>
        <div
          style={{
            background: '#fff',
            padding: 24,
            borderRadius: 8,
            minHeight: 400,
          }}
        >
          <Table<Pipeline>
            dataSource={pipelines}
            columns={columns}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 20 }}
            locale={{
              emptyText: (
                <div style={{ padding: 48 }}>
                  <div style={{ color: '#8c8c8c', marginBottom: 16 }}>暂无 Pipeline</div>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleCreate}
                  >
                    新建 Pipeline
                  </Button>
                </div>
              ),
            }}
          />
        </div>
      </Content>

      <Modal
        title="复制 Pipeline"
        open={copyModalOpen}
        onOk={handleCopyConfirm}
        onCancel={() => {
          setCopyModalOpen(false);
          setCopyTarget(null);
        }}
        okText="复制"
        cancelText="取消"
      >
        <div style={{ marginBottom: 8, fontSize: 13, color: '#595959' }}>新 Pipeline 名称</div>
        <Input
          value={copyName}
          onChange={(e) => setCopyName(e.target.value)}
          placeholder="输入名称"
        />
      </Modal>
    </Layout>
  );
}

export default PipelineListPage;
