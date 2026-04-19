import type { DragEvent } from 'react';

interface ModuleTemplate {
  label: string;
  config: {
    module_name: string;
    qps_per_instance: number;
    avg_response_time_ms: number;
    cost_per_unit: number;
    cost_type: 'per_gpu' | 'per_machine';
    gpus_per_machine: number;
  };
}

const MODULE_TEMPLATES: ModuleTemplate[] = [
  {
    label: 'LLM 推理',
    config: {
      module_name: 'LLM 推理',
      qps_per_instance: 10,
      avg_response_time_ms: 500,
      cost_per_unit: 50,
      cost_type: 'per_gpu',
      gpus_per_machine: 1,
    },
  },
  {
    label: '向量检索',
    config: {
      module_name: '向量检索',
      qps_per_instance: 200,
      avg_response_time_ms: 20,
      cost_per_unit: 15,
      cost_type: 'per_gpu',
      gpus_per_machine: 1,
    },
  },
  {
    label: '数据预处理',
    config: {
      module_name: '数据预处理',
      qps_per_instance: 100,
      avg_response_time_ms: 50,
      cost_per_unit: 10,
      cost_type: 'per_gpu',
      gpus_per_machine: 1,
    },
  },
  {
    label: '数据后处理',
    config: {
      module_name: '数据后处理',
      qps_per_instance: 100,
      avg_response_time_ms: 50,
      cost_per_unit: 10,
      cost_type: 'per_gpu',
      gpus_per_machine: 1,
    },
  },
  {
    label: '网关/路由',
    config: {
      module_name: '网关/路由',
      qps_per_instance: 500,
      avg_response_time_ms: 5,
      cost_per_unit: 5,
      cost_type: 'per_gpu',
      gpus_per_machine: 1,
    },
  },
  {
    label: '自定义模块',
    config: {
      module_name: '自定义模块',
      qps_per_instance: 50,
      avg_response_time_ms: 100,
      cost_per_unit: 25,
      cost_type: 'per_gpu',
      gpus_per_machine: 1,
    },
  },
];

const panelStyle: React.CSSProperties = {
  width: 250,
  background: '#fafafa',
  borderRight: '1px solid #f0f0f0',
  padding: 16,
  overflowY: 'auto',
  flexShrink: 0,
};

const titleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  marginBottom: 12,
  color: '#262626',
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

function LeftPanel() {
  const onDragStart = (event: DragEvent<HTMLDivElement>, template: ModuleTemplate) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify(template.config));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div style={panelStyle}>
      <div style={titleStyle}>模块类型</div>
      <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 12 }}>
        拖拽模块到画布中
      </div>
      {MODULE_TEMPLATES.map((template) => (
        <div
          key={template.label}
          style={cardStyle}
          draggable
          onDragStart={(e) => onDragStart(e, template)}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.borderColor = '#1677ff';
            (e.currentTarget as HTMLDivElement).style.background = '#e6f4ff';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.borderColor = '#d9d9d9';
            (e.currentTarget as HTMLDivElement).style.background = '#fff';
          }}
        >
          {template.label}
        </div>
      ))}
    </div>
  );
}

export default LeftPanel;
