import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Input, Space, message } from 'antd';
import { ArrowLeftOutlined, HistoryOutlined, ShareAltOutlined } from '@ant-design/icons';
import LeftPanel from '@/components/dag/LeftPanel';
import Canvas from '@/components/dag/Canvas';
import ModuleConfigDrawer from '@/components/dag/ModuleConfigDrawer';
import TemplateConfigDrawer from '@/components/dag/TemplateConfigDrawer';
import SplitRatioModal from '@/components/dag/SplitRatioModal';
import GlobalInputBar from '@/components/dag/GlobalInputBar';
import ResultPanel from '@/components/dag/ResultPanel';
import VersionHistoryDrawer from '@/components/VersionHistoryDrawer';
import ShareModal from '@/components/ShareModal';
import usePipelineStore from '@/store/pipelineStore';
import * as pipelinesService from '@/services/pipelines';
import { calculateCost } from '@/services/calculate';
import type { CalculateRequest, PipelineVersion } from '@/types';

function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const pipelineId = usePipelineStore((s) => s.pipelineId);
  const pipelineName = usePipelineStore((s) => s.pipelineName);
  const setPipelineId = usePipelineStore((s) => s.setPipelineId);
  const setPipelineName = usePipelineStore((s) => s.setPipelineName);
  const loadConfig = usePipelineStore((s) => s.loadConfig);
  const getConfig = usePipelineStore((s) => s.getConfig);
  const reset = usePipelineStore((s) => s.reset);
  const nodes = usePipelineStore((s) => s.nodes);
  const edges = usePipelineStore((s) => s.edges);
  const globalInput = usePipelineStore((s) => s.globalInput);
  const e2eCoefficient = usePipelineStore((s) => s.e2eCoefficient);
  const haEnabled = usePipelineStore((s) => s.haEnabled);
  const haMode = usePipelineStore((s) => s.haMode);
  const setCostResult = usePipelineStore((s) => s.setCostResult);
  const setIsCalculating = usePipelineStore((s) => s.setIsCalculating);
  const costResult = usePipelineStore((s) => s.costResult);
  const lastSavedConfig = usePipelineStore((s) => s.lastSavedConfig);
  const setLastSavedConfig = usePipelineStore((s) => s.setLastSavedConfig);

  const [splitRatioEdgeId, setSplitRatioEdgeId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [versionDrawerOpen, setVersionDrawerOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  // Load pipeline on mount
  useEffect(() => {
    if (id) {
      const pipelineIdNum = parseInt(id, 10);
      if (!isNaN(pipelineIdNum)) {
        pipelinesService
          .getPipeline(pipelineIdNum)
          .then((pipeline) => {
            setPipelineId(pipeline.id);
            setPipelineName(pipeline.name);
            if (pipeline.current_version_id) {
              return pipelinesService.getVersion(pipeline.id, pipeline.current_version_id);
            }
            return null;
          })
          .then((version) => {
            if (version?.config) {
              loadConfig(version.config);
              if (version.cost_snapshot) {
                setCostResult(version.cost_snapshot);
              }
            }
          })
          .catch(() => {
            message.error('加载 Pipeline 失败');
          });
      }
    } else {
      reset();
    }

    return () => {
      // Don't reset on unmount so navigating back preserves state
    };
  }, [id]);

  const handleCalculate = useCallback(async () => {
    if (nodes.length === 0) {
      message.warning('请先添加模块');
      return;
    }

    setIsCalculating(true);
    try {
      const request: CalculateRequest = {
        nodes: nodes.map((n) => ({
          node_id: n.id,
          module_name: String(n.data.module_name || n.data.label || '模块'),
          qps_per_instance: Number(n.data.qps_per_instance ?? 50),
          avg_response_time_ms: Number(n.data.avg_response_time_ms ?? 100),
          cost_per_unit: Number(n.data.cost_per_unit ?? 25),
          gpus_per_instance: Number(n.data.gpus_per_instance ?? 1),
          gpus_per_machine: Number(n.data.gpus_per_machine ?? 1),
          resource_spec_name: String(n.data.resource_spec_name || n.data.module_name || '默认'),
        })),
        edges: edges.map((e) => ({
          source: e.source,
          target: e.target,
          split_ratio: Number(e.data?.split_ratio ?? 1.0),
        })),
        global_input: globalInput,
        e2e_coefficient: e2eCoefficient,
        ha_enabled: haEnabled,
        ha_mode: haMode,
      };

      const result = await calculateCost(request);
      setCostResult(result);
      message.success('计算完成');
    } catch {
      message.error('计算失败，请检查配置');
    } finally {
      setIsCalculating(false);
    }
  }, [nodes, edges, globalInput, e2eCoefficient, haEnabled, haMode, setCostResult, setIsCalculating]);

  const handleSave = useCallback(async () => {
    try {
      let currentPipelineId = pipelineId;

      // Create pipeline first if it doesn't exist
      if (!currentPipelineId) {
        const pipeline = await pipelinesService.createPipeline({
          name: pipelineName,
        });
        currentPipelineId = pipeline.id;
        setPipelineId(pipeline.id);
        // Update URL without full navigation
        window.history.replaceState(null, '', `/editor/${pipeline.id}`);
      }

      const config = getConfig();
      const configJson = JSON.stringify(config);

      // Skip save if config unchanged
      if (lastSavedConfig && configJson === lastSavedConfig) {
        message.info('配置未变更，已是最新版本');
        return;
      }

      await pipelinesService.saveVersion(
        currentPipelineId,
        config,
        costResult ?? undefined,
      );
      setLastSavedConfig(configJson);
      message.success('版本保存成功');
    } catch {
      message.error('保存失败');
    }
  }, [pipelineId, pipelineName, getConfig, costResult, setPipelineId, lastSavedConfig, setLastSavedConfig]);

  const handleNameClick = () => {
    setNameValue(pipelineName);
    setEditingName(true);
  };

  const handleNameConfirm = async () => {
    const newName = nameValue.trim() || '未命名 Pipeline';
    const oldName = pipelineName;
    setPipelineName(newName);
    setEditingName(false);
    if (pipelineId) {
      try {
        await pipelinesService.updatePipeline(pipelineId, { name: newName });
      } catch {
        setPipelineName(oldName);
        message.error('名称更新失败');
      }
    }
  };

  const handleEdgeDoubleClick = useCallback((edgeId: string) => {
    setSplitRatioEdgeId(edgeId);
  }, []);

  const handleRollback = useCallback((version: PipelineVersion) => {
    if (version.config) {
      loadConfig(version.config);
      if (version.cost_snapshot) {
        setCostResult(version.cost_snapshot);
      } else {
        setCostResult(null);
      }
      message.success('配置已加载');
    }
  }, [loadConfig, setCostResult]);

  const pageStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
  };

  const topBarStyle: React.CSSProperties = {
    height: 48,
    background: '#fff',
    borderBottom: '1px solid #f0f0f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
    flexShrink: 0,
    zIndex: 10,
  };

  const mainAreaStyle: React.CSSProperties = {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  };

  return (
    <div style={pageStyle}>
      {/* Top bar */}
      <div style={topBarStyle}>
        <Space>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/')}
          >
            返回
          </Button>
          {editingName ? (
            <Input
              size="small"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={handleNameConfirm}
              onPressEnter={handleNameConfirm}
              style={{ width: 240 }}
              autoFocus
            />
          ) : (
            <span
              style={{
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
                padding: '2px 8px',
                borderRadius: 4,
                transition: 'background 0.2s',
              }}
              onClick={handleNameClick}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLSpanElement).style.background = '#f5f5f5';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLSpanElement).style.background = 'transparent';
              }}
              title="点击编辑名称"
            >
              {pipelineName}
            </span>
          )}
        </Space>
        <Space>
          <Button
            icon={<HistoryOutlined />}
            onClick={() => setVersionDrawerOpen(true)}
            disabled={!pipelineId}
          >
            版本历史
          </Button>
          <Button
            icon={<ShareAltOutlined />}
            onClick={() => setShareModalOpen(true)}
            disabled={!pipelineId}
          >
            分享
          </Button>
        </Space>
      </div>

      {/* Main area */}
      <div style={mainAreaStyle}>
        <LeftPanel />
        <Canvas onEdgeDoubleClick={handleEdgeDoubleClick} />
        <ResultPanel />
      </div>

      {/* Bottom bar */}
      <GlobalInputBar onCalculate={handleCalculate} onSave={handleSave} />

      {/* Drawers and modals */}
      <ModuleConfigDrawer />
      <TemplateConfigDrawer />
      <SplitRatioModal
        edgeId={splitRatioEdgeId}
        open={!!splitRatioEdgeId}
        onClose={() => setSplitRatioEdgeId(null)}
      />
      <VersionHistoryDrawer
        pipelineId={pipelineId}
        open={versionDrawerOpen}
        onClose={() => setVersionDrawerOpen(false)}
        onRollback={handleRollback}
      />
      <ShareModal
        pipelineId={pipelineId}
        open={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
      />
    </div>
  );
}

export default EditorPage;
