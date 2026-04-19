import { useEffect, useState, type DragEvent } from 'react';
import { Spin, Popconfirm, Input, message } from 'antd';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import useTemplateStore from '@/store/templateStore';
import type { ModuleTemplate } from '@/services/templates';

const DEFAULT_BLANK_CONFIG = {
  module_name: '新模块',
  qps_per_instance: 50,
  avg_response_time_ms: 100,
  cost_per_unit: 25,
  gpus_per_instance: 1,
  gpus_per_machine: 1,
};

type TabKey = 'blank' | 'templates';

function LeftPanel() {
  const [activeTab, setActiveTab] = useState<TabKey>('blank');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  const { globalTemplates, myTemplates, loading, fetchTemplates, updateTemplate, removeTemplate } =
    useTemplateStore();

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const onDragStart = (event: DragEvent<HTMLDivElement>, config: Record<string, unknown>) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify(config));
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleEditConfirm = async (id: number) => {
    const name = editName.trim();
    if (!name) {
      setEditingId(null);
      return;
    }
    try {
      await updateTemplate(id, { name });
      message.success('模板已更新');
    } catch {
      message.error('更新失败');
    }
    setEditingId(null);
  };

  const handleDelete = async (id: number) => {
    try {
      await removeTemplate(id);
      message.success('模板已删除');
    } catch {
      message.error('删除失败');
    }
  };

  const renderCard = (
    label: string,
    config: Record<string, unknown>,
    key: string,
    actions?: { id: number; isOwn: boolean },
  ) => (
    <div
      key={key}
      style={cardStyle}
      draggable
      onDragStart={(e) => onDragStart(e, config)}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = '#1677ff';
        (e.currentTarget as HTMLDivElement).style.background = '#e6f4ff';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = '#d9d9d9';
        (e.currentTarget as HTMLDivElement).style.background = '#fff';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {editingId === actions?.id ? (
          <Input
            size="small"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={() => handleEditConfirm(actions.id)}
            onPressEnter={() => handleEditConfirm(actions.id)}
            autoFocus
            style={{ flex: 1, marginRight: 4 }}
          />
        ) : (
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {label}
          </span>
        )}
        {actions?.isOwn && editingId !== actions.id && (
          <span
            style={{ display: 'flex', gap: 6, marginLeft: 8, flexShrink: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <EditOutlined
              style={{ cursor: 'pointer', color: '#8c8c8c', fontSize: 12 }}
              onClick={() => {
                setEditingId(actions.id);
                setEditName(label);
              }}
            />
            <Popconfirm
              title="确定删除该模板？"
              onConfirm={() => handleDelete(actions.id)}
              okText="确定"
              cancelText="取消"
            >
              <DeleteOutlined style={{ cursor: 'pointer', color: '#ff4d4f', fontSize: 12 }} />
            </Popconfirm>
          </span>
        )}
      </div>
    </div>
  );

  const renderTemplateTab = () => {
    if (loading) {
      return <div style={{ textAlign: 'center', padding: 24 }}><Spin size="small" /></div>;
    }
    return (
      <>
        {globalTemplates.length > 0 && (
          <>
            <div style={sectionStyle}>全局模板</div>
            {globalTemplates.map((t) =>
              renderCard(t.name, t.config as Record<string, unknown>, `global-${t.id}`)
            )}
          </>
        )}
        <div style={sectionStyle}>我的模板</div>
        {myTemplates.length === 0 ? (
          <div style={{ fontSize: 12, color: '#bfbfbf', padding: '8px 0' }}>
            暂无模板，可在模块配置中保存
          </div>
        ) : (
          myTemplates.map((t) =>
            renderCard(
              t.name,
              t.config as Record<string, unknown>,
              `my-${t.id}`,
              { id: t.id, isOwn: true },
            )
          )
        )}
      </>
    );
  };

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', marginBottom: 12, gap: 0 }}>
        <div
          style={tabStyle(activeTab === 'blank')}
          onClick={() => setActiveTab('blank')}
        >
          空白模块
        </div>
        <div
          style={tabStyle(activeTab === 'templates')}
          onClick={() => setActiveTab('templates')}
        >
          模板库
        </div>
      </div>

      {activeTab === 'blank' ? (
        <>
          <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 12 }}>
            拖拽模块到画布中
          </div>
          {renderCard('新模块', DEFAULT_BLANK_CONFIG, 'blank-default')}
        </>
      ) : (
        renderTemplateTab()
      )}
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  width: 250,
  background: '#fafafa',
  borderRight: '1px solid #f0f0f0',
  padding: 16,
  overflowY: 'auto',
  flexShrink: 0,
};

const tabStyle = (active: boolean): React.CSSProperties => ({
  flex: 1,
  textAlign: 'center',
  padding: '6px 0',
  fontSize: 13,
  fontWeight: active ? 600 : 400,
  color: active ? '#1677ff' : '#595959',
  borderBottom: active ? '2px solid #1677ff' : '2px solid transparent',
  cursor: 'pointer',
  transition: 'all 0.2s',
});

const sectionStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#8c8c8c',
  marginBottom: 8,
  marginTop: 12,
};

const cardStyle: React.CSSProperties = {
  padding: '10px 12px',
  marginBottom: 8,
  background: '#fff',
  border: '1px solid #d9d9d9',
  borderRadius: 6,
  cursor: 'grab',
  fontSize: 13,
  color: '#434343',
  transition: 'all 0.2s',
  userSelect: 'none',
};

export default LeftPanel;
