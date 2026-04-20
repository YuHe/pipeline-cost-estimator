import { useEffect, useState } from 'react';
import { Drawer, Input, InputNumber, Button, Divider, message } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import useTemplateStore from '@/store/templateStore';

function TemplateConfigDrawer() {
  const editingTemplateId = useTemplateStore((s) => s.editingTemplateId);
  const setEditingTemplateId = useTemplateStore((s) => s.setEditingTemplateId);
  const globalTemplates = useTemplateStore((s) => s.globalTemplates);
  const myTemplates = useTemplateStore((s) => s.myTemplates);
  const updateTemplate = useTemplateStore((s) => s.updateTemplate);

  const allTemplates = [...globalTemplates, ...myTemplates];
  const template = allTemplates.find((t) => t.id === editingTemplateId);

  const [name, setName] = useState('');
  const [config, setConfig] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (template) {
      setName(template.name);
      setConfig({ ...template.config });
    }
  }, [template]);

  const handleSave = async () => {
    if (!editingTemplateId) return;
    try {
      await updateTemplate(editingTemplateId, { name: name.trim() || template!.name, config });
      message.success('模板已保存');
    } catch {
      message.error('保存失败');
    }
  };

  const updateConfig = (field: string, value: unknown) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  if (!template) return null;

  return (
    <Drawer
      title="编辑模板"
      placement="right"
      width={360}
      open={!!editingTemplateId}
      onClose={() => setEditingTemplateId(null)}
      mask={false}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div style={labelStyle}>模板名称</div>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div>
          <div style={labelStyle}>模块名称</div>
          <Input
            value={String(config.module_name || '')}
            onChange={(e) => updateConfig('module_name', e.target.value)}
          />
        </div>

        <div>
          <div style={labelStyle}>QPS/实例</div>
          <InputNumber
            style={{ width: '100%' }}
            min={0.01}
            step={1}
            value={config.qps_per_instance as number}
            onChange={(v: number | null) => updateConfig('qps_per_instance', v ?? 1)}
          />
        </div>

        <div>
          <div style={labelStyle}>平均响应时间 (ms)</div>
          <InputNumber
            style={{ width: '100%' }}
            min={1}
            step={10}
            value={config.avg_response_time_ms as number}
            onChange={(v: number | null) => updateConfig('avg_response_time_ms', v ?? 100)}
          />
        </div>

        <div>
          <div style={labelStyle}>单卡日成本 (元/天)</div>
          <InputNumber
            style={{ width: '100%' }}
            min={0}
            step={1}
            precision={2}
            value={config.cost_per_unit as number}
            onChange={(v: number | null) => updateConfig('cost_per_unit', v ?? 0)}
          />
        </div>

        <div>
          <div style={labelStyle}>每实例 GPU 数</div>
          <InputNumber
            style={{ width: '100%' }}
            min={1}
            step={1}
            value={(config.gpus_per_instance as number) ?? 1}
            onChange={(v: number | null) => updateConfig('gpus_per_instance', v ?? 1)}
          />
        </div>

        <div>
          <div style={labelStyle}>每机 GPU 数（容灾用）</div>
          <InputNumber
            style={{ width: '100%' }}
            min={1}
            step={1}
            value={(config.gpus_per_machine as number) ?? 1}
            onChange={(v: number | null) => updateConfig('gpus_per_machine', v ?? 1)}
          />
        </div>

        <Divider style={{ margin: '8px 0' }} />

        <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} block>
          保存模板
        </Button>
      </div>
    </Drawer>
  );
}

const labelStyle: React.CSSProperties = {
  marginBottom: 4,
  fontSize: 13,
  color: '#595959',
};

export default TemplateConfigDrawer;
