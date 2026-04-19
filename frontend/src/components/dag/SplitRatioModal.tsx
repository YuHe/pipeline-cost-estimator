import { useState, useEffect } from 'react';
import { Modal, InputNumber } from 'antd';
import usePipelineStore from '@/store/pipelineStore';

interface SplitRatioModalProps {
  edgeId: string | null;
  open: boolean;
  onClose: () => void;
}

function SplitRatioModal({ edgeId, open, onClose }: SplitRatioModalProps) {
  const edges = usePipelineStore((s) => s.edges);
  const nodes = usePipelineStore((s) => s.nodes);
  const updateEdgeSplitRatio = usePipelineStore((s) => s.updateEdgeSplitRatio);

  const [ratio, setRatio] = useState<number>(100);

  const edge = edges.find((e) => e.id === edgeId);
  const sourceNode = nodes.find((n) => n.id === edge?.source);
  const targetNode = nodes.find((n) => n.id === edge?.target);

  useEffect(() => {
    if (edge) {
      setRatio(Math.round((edge.data?.split_ratio ?? 1.0) * 100));
    }
  }, [edge]);

  const sourceName = sourceNode?.data?.module_name || sourceNode?.data?.label || '源模块';
  const targetName = targetNode?.data?.module_name || targetNode?.data?.label || '目标模块';

  const handleOk = () => {
    if (edgeId) {
      updateEdgeSplitRatio(edgeId, ratio / 100);
    }
    onClose();
  };

  return (
    <Modal
      title="编辑分流比例"
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      okText="保存"
      cancelText="取消"
    >
      <div style={{ marginBottom: 16, color: '#595959', fontSize: 13 }}>
        {sourceName} → {targetName}
      </div>
      <div style={{ marginBottom: 8, fontSize: 13, color: '#595959' }}>分流比例 (%)</div>
      <InputNumber
        style={{ width: '100%' }}
        min={0}
        max={100}
        step={1}
        value={ratio}
        onChange={(v) => setRatio(v ?? 100)}
        addonAfter="%"
      />
      <div style={{ marginTop: 8, fontSize: 12, color: '#8c8c8c' }}>
        100% 表示全部流量通过此路径
      </div>
    </Modal>
  );
}

export default SplitRatioModal;
