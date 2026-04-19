import { useEffect, useState } from 'react';
import { Drawer, List, Button, Modal, Tag, Spin, message, Empty } from 'antd';
import { EyeOutlined, RollbackOutlined } from '@ant-design/icons';
import * as pipelinesService from '@/services/pipelines';
import { rollbackToVersion } from '@/services/versions';
import type { PipelineVersion } from '@/types';

interface VersionHistoryDrawerProps {
  pipelineId: number | null;
  open: boolean;
  onClose: () => void;
  onRollback: (version: PipelineVersion) => void;
}

function VersionHistoryDrawer({ pipelineId, open, onClose, onRollback }: VersionHistoryDrawerProps) {
  const [versions, setVersions] = useState<PipelineVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewConfig, setViewConfig] = useState<object | null>(null);
  const [rollbackLoading, setRollbackLoading] = useState<number | null>(null);

  useEffect(() => {
    if (open && pipelineId) {
      setLoading(true);
      pipelinesService
        .listVersions(pipelineId)
        .then((data) => {
          setVersions(data.sort((a, b) => b.version_number - a.version_number));
        })
        .catch(() => {
          message.error('加载版本历史失败');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [open, pipelineId]);

  const handleView = (version: PipelineVersion) => {
    setViewConfig(version.config);
    setViewModalOpen(true);
  };

  const handleRollback = async (version: PipelineVersion) => {
    if (!pipelineId) return;
    setRollbackLoading(version.id);
    try {
      const newVersion = await rollbackToVersion(pipelineId, version.id);
      message.success(`已回溯到版本 ${version.version_number}`);
      onRollback(newVersion);
      onClose();
    } catch {
      message.error('回溯失败');
    } finally {
      setRollbackLoading(null);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('zh-CN');
    } catch {
      return dateStr;
    }
  };

  return (
    <>
      <Drawer
        title="版本历史"
        placement="right"
        width={420}
        open={open}
        onClose={onClose}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Spin />
          </div>
        ) : versions.length === 0 ? (
          <Empty description="暂无版本记录" />
        ) : (
          <List
            dataSource={versions}
            renderItem={(version) => (
              <List.Item
                actions={[
                  <Button
                    key="view"
                    type="link"
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={() => handleView(version)}
                  >
                    查看
                  </Button>,
                  <Button
                    key="rollback"
                    type="link"
                    size="small"
                    icon={<RollbackOutlined />}
                    loading={rollbackLoading === version.id}
                    onClick={() => handleRollback(version)}
                  >
                    回溯
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <span>
                      <Tag color="blue">v{version.version_number}</Tag>
                      {version.description || `版本 ${version.version_number}`}
                    </span>
                  }
                  description={formatDate(version.created_at)}
                />
              </List.Item>
            )}
          />
        )}
      </Drawer>

      <Modal
        title="版本配置详情"
        open={viewModalOpen}
        onCancel={() => setViewModalOpen(false)}
        footer={null}
        width={600}
      >
        <pre
          style={{
            background: '#f5f5f5',
            padding: 16,
            borderRadius: 8,
            maxHeight: 480,
            overflow: 'auto',
            fontSize: 12,
            lineHeight: 1.6,
          }}
        >
          {viewConfig ? JSON.stringify(viewConfig, null, 2) : ''}
        </pre>
      </Modal>
    </>
  );
}

export default VersionHistoryDrawer;
