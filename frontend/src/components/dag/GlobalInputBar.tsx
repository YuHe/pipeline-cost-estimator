import { Radio, InputNumber, Switch, Button, Space } from 'antd';
import { ThunderboltOutlined, SaveOutlined } from '@ant-design/icons';
import usePipelineStore from '@/store/pipelineStore';

interface GlobalInputBarProps {
  onCalculate: () => void;
  onSave: () => void;
}

function GlobalInputBar({ onCalculate, onSave }: GlobalInputBarProps) {
  const globalInput = usePipelineStore((s) => s.globalInput);
  const setGlobalInput = usePipelineStore((s) => s.setGlobalInput);
  const e2eCoefficient = usePipelineStore((s) => s.e2eCoefficient);
  const setE2eCoefficient = usePipelineStore((s) => s.setE2eCoefficient);
  const haEnabled = usePipelineStore((s) => s.haEnabled);
  const setHaEnabled = usePipelineStore((s) => s.setHaEnabled);
  const haMode = usePipelineStore((s) => s.haMode);
  const setHaMode = usePipelineStore((s) => s.setHaMode);
  const isCalculating = usePipelineStore((s) => s.isCalculating);
  const nodes = usePipelineStore((s) => s.nodes);

  const barStyle: React.CSSProperties = {
    height: 60,
    background: '#fff',
    borderTop: '1px solid #f0f0f0',
    display: 'flex',
    alignItems: 'center',
    padding: '0 20px',
    gap: 20,
    flexShrink: 0,
    overflowX: 'auto',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    color: '#8c8c8c',
    marginRight: 4,
    whiteSpace: 'nowrap',
  };

  return (
    <div style={barStyle}>
      <Space size={4} align="center">
        <span style={labelStyle}>输入类型</span>
        <Radio.Group
          size="small"
          value={globalInput.input_type}
          onChange={(e) => setGlobalInput({ input_type: e.target.value })}
        >
          <Radio.Button value="qps">QPS</Radio.Button>
          <Radio.Button value="concurrency">并发量</Radio.Button>
        </Radio.Group>
      </Space>

      <Space size={4} align="center">
        <span style={labelStyle}>目标值</span>
        <InputNumber
          size="small"
          min={1}
          step={10}
          value={globalInput.value}
          onChange={(v) => setGlobalInput({ value: v ?? 100 })}
          style={{ width: 100 }}
        />
      </Space>

      {globalInput.input_type === 'concurrency' && (
        <Space size={4} align="center">
          <span style={labelStyle}>平均响应时间 (ms)</span>
          <InputNumber
            size="small"
            min={1}
            step={10}
            value={globalInput.avg_response_time_ms}
            onChange={(v) => setGlobalInput({ avg_response_time_ms: v ?? 100 })}
            style={{ width: 100 }}
          />
        </Space>
      )}

      <Space size={4} align="center">
        <span style={labelStyle}>E2E 系数</span>
        <InputNumber
          size="small"
          min={0.01}
          max={10}
          step={0.01}
          value={e2eCoefficient}
          onChange={(v) => setE2eCoefficient(v ?? 1.0)}
          style={{ width: 80 }}
        />
      </Space>

      <Space size={4} align="center">
        <span style={labelStyle}>容灾</span>
        <Switch
          size="small"
          checked={haEnabled}
          onChange={setHaEnabled}
        />
      </Space>

      {haEnabled && (
        <Space size={4} align="center">
          <Radio.Group
            size="small"
            value={haMode}
            onChange={(e) => setHaMode(e.target.value)}
          >
            <Radio.Button value="2_gpu">2卡容灾</Radio.Button>
            <Radio.Button value="2_machine">2机容灾</Radio.Button>
          </Radio.Group>
        </Space>
      )}

      <div style={{ flex: 1 }} />

      <Space>
        <Button
          type="primary"
          icon={<ThunderboltOutlined />}
          onClick={onCalculate}
          loading={isCalculating}
          disabled={nodes.length === 0}
        >
          计算成本
        </Button>
        <Button
          icon={<SaveOutlined />}
          onClick={onSave}
        >
          保存版本
        </Button>
      </Space>
    </div>
  );
}

export default GlobalInputBar;
