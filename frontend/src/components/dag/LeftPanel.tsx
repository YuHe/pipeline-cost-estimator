import { useEffect, useState, type DragEvent } from 'react';
import { Spin, Popconfirm, Input, message } from 'antd';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import useTemplateStore from '@/store/templateStore';

const DEFAULT_BLANK_CONFIG = {
  module_name: '新模块',
  qps_per_instance: 50,
  avg_response_time_ms: 100,
  cost_per_unit: 25,
  gpus_per_instance: 1,
  gpus_per_machine: 1,
};

function LeftPanel() {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  const {
    globalTemplates,
    myTemplates,
    loading,
    fetchTemplates,
    updateTemplate,
    removeTemplate,
    setEditingTemplateId,
  } = useTemplateStore();

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

  const handleTemplateClick = (id: number, isOwn: boolean) => {
    if (isOwn) {
      setEditingTemplateId(id);
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
      onClick={() => actions && handleTemplateClick(actions.id, actions.isOwn)}
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
            onClick={(e) => e.stopPropagation()}
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

  return (
    <div style={panelStyle}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#262626' }}>
        模板库
      </div>

      <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 12 }}>
        拖拽模块到画布 · 点击我的模板可编辑
      </div>

      {renderCard('新建空白模块', DEFAULT_BLANK_CONFIG, 'blank-default')}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 24 }}><Spin size="small" /></div>
      ) : (
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
