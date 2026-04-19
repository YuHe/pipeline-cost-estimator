import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout, Typography, Button, Space, Table, Tabs, Popconfirm, Tag, message } from 'antd';
import { ArrowLeftOutlined, DeleteOutlined, UserSwitchOutlined } from '@ant-design/icons';
import api from '@/services/api';
import type { ColumnsType } from 'antd/es/table';

const { Header, Content } = Layout;
const { Title } = Typography;

interface AdminUser {
  id: number;
  email: string;
  display_name: string;
  is_admin: boolean;
  created_at: string;
}

interface AdminPipeline {
  id: number;
  name: string;
  description: string | null;
  owner_id: number;
  owner_email?: string;
  created_at: string;
  updated_at: string;
}

function AdminPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [adminPipelines, setAdminPipelines] = useState<AdminPipeline[]>([]);
  const [loadingPipelines, setLoadingPipelines] = useState(false);
  const [togglingUserId, setTogglingUserId] = useState<number | null>(null);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await api.get<AdminUser[]>('/admin/users');
      setUsers(res.data);
    } catch {
      message.error('加载用户列表失败');
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchPipelines = async () => {
    setLoadingPipelines(true);
    try {
      const res = await api.get<AdminPipeline[]>('/admin/pipelines');
      setAdminPipelines(res.data);
    } catch {
      message.error('加载 Pipeline 列表失败');
    } finally {
      setLoadingPipelines(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchPipelines();
  }, []);

  const handleToggleAdmin = async (userId: number, currentIsAdmin: boolean) => {
    setTogglingUserId(userId);
    try {
      await api.put(`/admin/users/${userId}`, { is_admin: !currentIsAdmin });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_admin: !currentIsAdmin } : u))
      );
      message.success(currentIsAdmin ? '已取消管理员权限' : '已设为管理员');
    } catch {
      message.error('操作失败');
    } finally {
      setTogglingUserId(null);
    }
  };

  const handleDeletePipeline = async (pipelineId: number) => {
    try {
      await api.delete(`/admin/pipelines/${pipelineId}`);
      setAdminPipelines((prev) => prev.filter((p) => p.id !== pipelineId));
      message.success('已删除');
    } catch {
      message.error('删除失败');
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('zh-CN');
    } catch {
      return dateStr;
    }
  };

  const userColumns: ColumnsType<AdminUser> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '显示名',
      dataIndex: 'display_name',
      key: 'display_name',
    },
    {
      title: '角色',
      dataIndex: 'is_admin',
      key: 'is_admin',
      width: 100,
      render: (isAdmin: boolean) =>
        isAdmin ? <Tag color="red">管理员</Tag> : <Tag>普通用户</Tag>,
    },
    {
      title: '注册时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: formatDate,
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_: unknown, record: AdminUser) => (
        <Button
          type="link"
          size="small"
          icon={<UserSwitchOutlined />}
          loading={togglingUserId === record.id}
          onClick={() => handleToggleAdmin(record.id, record.is_admin)}
        >
          {record.is_admin ? '取消管理员' : '设为管理员'}
        </Button>
      ),
    },
  ];

  const pipelineColumns: ColumnsType<AdminPipeline> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (text: string | null) => text || '-',
    },
    {
      title: '所有者 ID',
      dataIndex: 'owner_id',
      key: 'owner_id',
      width: 100,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: formatDate,
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 180,
      render: formatDate,
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_: unknown, record: AdminPipeline) => (
        <Popconfirm
          title="确认删除"
          description={`确定要删除 "${record.name}" 吗？此操作不可恢复。`}
          onConfirm={() => handleDeletePipeline(record.id)}
          okText="删除"
          cancelText="取消"
          okButtonProps={{ danger: true }}
        >
          <Button type="link" size="small" danger icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'users',
      label: '用户管理',
      children: (
        <Table<AdminUser>
          dataSource={users}
          columns={userColumns}
          rowKey="id"
          loading={loadingUsers}
          pagination={{ pageSize: 20 }}
        />
      ),
    },
    {
      key: 'pipelines',
      label: 'Pipeline 管理',
      children: (
        <Table<AdminPipeline>
          dataSource={adminPipelines}
          columns={pipelineColumns}
          rowKey="id"
          loading={loadingPipelines}
          pagination={{ pageSize: 20 }}
        />
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
        <Space>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/')}
          >
            返回
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            管理后台
          </Title>
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
          <Tabs items={tabItems} />
        </div>
      </Content>
    </Layout>
  );
}

export default AdminPage;
