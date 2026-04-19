import { useEffect, useState } from 'react';
import { Drawer, Input, InputNumber, Select, Button, Divider, Modal, message } from 'antd';
import { DeleteOutlined, SaveOutlined } from '@ant-design/icons';
import usePipelineStore from '@/store/pipelineStore';
import useTemplateStore from '@/store/templateStore';
import { listResourceSpecs } from '@/services/resourceSpecs';
import type { ResourceSpec, ModuleNodeData } from '@/types';

function ModuleConfigDrawer() {
  const selectedNodeId = usePipelineStore((s) => s.selectedNodeId);
  const nodes = usePipelineStore((s) => s.nodes);
  const updateNodeConfig = usePipelineStore((s) => s.updateNodeConfig);
  const removeNode = usePipelineStore((s) => s.removeNode);
  const setSelectedNodeId = usePipelineStore((s) => s.setSelectedNodeId);

  const addTemplate = useTemplateStore((s) => s.addTemplate);

  const [resourceSpecs, setResourceSpecs] = useState<ResourceSpec[]>([]);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const nodeData = selectedNode?.data as ModuleNodeData | undefined;
  const open = !!selectedNodeId && !!selectedNode;

  useEffect(() => {
    if (open) {
      listResourceSpecs()
        .then(setResourceSpecs)
        .catch(() => {
          // silently fail, user can still manually configure
        });
    }
  }, [open]);

  const handleSearch = async (query: string) => {
    try {
      const specs = await listResourceSpecs(query);
      setResourceSpecs(specs);
    } catch {
      // ignore search errors
    }
  };

  const handleResourceSelect = (specId: number) => {
    if (!selectedNodeId) return;
    const spec = resourceSpecs.find((s) => s.id === specId);
    if (!spec) return;
    updateNodeConfig(selectedNodeId, {
      resource_spec_id: spec.id,
      resource_spec_name: spec.name,
      qps_per_instance: spec.qps_per_instance ?? (nodeData?.qps_per_instance as number) ?? 50,
      avg_response_time_ms: spec.avg_response_time_ms ?? (nodeData?.avg_response_time_ms as number) ?? 100,
      cost_per_unit: spec.cost_per_unit,
      gpus_per_instance: spec.gpus_per_instance ?? 1,
      gpus_per_machine: spec.gpus_per_machine ?? 1,
    });
  };

  const handleDelete = () => {
    if (!selectedNodeId) return;
    removeNode(selectedNodeId);
    message.success('模块已删除');
  };

  const update = (field: string, value: unknown) => {
    if (!selectedNodeId) return;
    updateNodeConfig(selectedNodeId, { [field]: value });
  };

  const handleSaveAsTemplate = async () => {
    const name = templateName.trim();
    if (!name) {
      message.warning('请输入模板名称');
      return;
    }
    try {
      const config: Record<string, unknown> = {
        module_name: nodeData!.module_name || nodeData!.label || '新模块',
        qps_per_instance: nodeData!.qps_per_instance,
        avg_response_time_ms: nodeData!.avg_response_time_ms,
        cost_per_unit: nodeData!.cost_per_unit,
        gpus_per_instance: nodeData!.gpus_per_instance ?? 1,
        gpus_per_machine: nodeData!.gpus_per_machine ?? 1,
      };
      await addTemplate({ name, config });
      message.success('已保存为模板');
      setSaveModalOpen(false);
      setTemplateName('');
    } catch {
      message.error('保存模板失败');
    }
  };

  if (!nodeData) return null;

  return (
    <Drawer
      title="模块配置"
      placement="right"
      width={360}
      open={open}
      onClose={() => setSelectedNodeId(null)}
      mask={false}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div style={{ marginBottom: 4, fontSize: 13, color: '#595959' }}>模块名称</div>
          <Input
            value={String(nodeData.module_name || nodeData.label || '')}
            onChange={(e) => update('module_name', e.target.value)}
          />
        </div>

        <div>
          <div style={{ marginBottom: 4, fontSize: 13, color: '#595959' }}>资源规格</div>
          <Select
            style={{ width: '100%' }}
            placeholder="选择资源规格"
            value={nodeData.resource_spec_id as number | undefined}
            onChange={handleResourceSelect}
            showSearch
            filterOption={false}
            onSearch={handleSearch}
            allowClear
            onClear={() => {
              if (selectedNodeId) {
                updateNodeConfig(selectedNodeId, {
                  resource_spec_id: undefined,
                  resource_spec_name: undefined,
                });
              }
            }}
            options={resourceSpecs.map((s) => ({
              label: `${s.name} (${s.gpu_type} x${s.gpu_count})`,
              value: s.id,
            }))}
          />
        </div>

        <div>
          <div style={{ marginBottom: 4, fontSize: 13, color: '#595959' }}>QPS/实例</div>
          <InputNumber
            style={{ width: '100%' }}
            min={0.01}
            step={1}
            value={nodeData.qps_per_instance as number}
            onChange={(v: number | null) => update('qps_per_instance', v ?? 1)}
          />
        </div>

        <div>
          <div style={{ marginBottom: 4, fontSize: 13, color: '#595959' }}>平均响应时间 (ms)</div>
          <InputNumber
            style={{ width: '100%' }}
            min={1}
            step={10}
            value={nodeData.avg_response_time_ms as number}
            onChange={(v: number | null) => update('avg_response_time_ms', v ?? 100)}
          />
        </div>

        <div>
          <div style={{ marginBottom: 4, fontSize: 13, color: '#595959' }}>单卡日成本 (元/天)</div>
          <InputNumber
            style={{ width: '100%' }}
            min={0}
            step={1}
            precision={2}
            value={nodeData.cost_per_unit as number}
            onChange={(v: number | null) => update('cost_per_unit', v ?? 0)}
          />
        </div>

        <div>
          <div style={{ marginBottom: 4, fontSize: 13, color: '#595959' }}>每实例 GPU 数</div>
          <InputNumber
            style={{ width: '100%' }}
            min={1}
            step={1}
            value={(nodeData.gpus_per_instance as number) ?? 1}
            onChange={(v: number | null) => update('gpus_per_instance', v ?? 1)}
          />
        </div>

        <div>
          <div style={{ marginBottom: 4, fontSize: 13, color: '#595959' }}>每机 GPU 数（容灾用）</div>
          <InputNumber
            style={{ width: '100%' }}
            min={1}
            step={1}
            value={(nodeData.gpus_per_machine as number) ?? 1}
            onChange={(v: number | null) => update('gpus_per_machine', v ?? 1)}
          />
        </div>

        <Divider style={{ margin: '8px 0' }} />

        <Button
          icon={<SaveOutlined />}
          onClick={() => {
            setTemplateName(String(nodeData.module_name || nodeData.label || ''));
            setSaveModalOpen(true);
          }}
          block
        >
          保存为模板
        </Button>

        <Button
          danger
          icon={<DeleteOutlined />}
          onClick={handleDelete}
          block
        >
          删除模块
        </Button>
      </div>

      <Modal
        title="保存为模板"
        open={saveModalOpen}
        onOk={handleSaveAsTemplate}
        onCancel={() => { setSaveModalOpen(false); setTemplateName(''); }}
        okText="保存"
        cancelText="取消"
      >
        <div style={{ marginBottom: 8, fontSize: 13, color: '#595959' }}>模板名称</div>
        <Input
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          onPressEnter={handleSaveAsTemplate}
          placeholder="输入模板名称"
          autoFocus
        />
      </Modal>
    </Drawer>
  );
}

export default ModuleConfigDrawer;
