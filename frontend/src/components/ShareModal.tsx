import { useState } from 'react';
import { Modal, Radio, Button, Input, Space, message, Typography } from 'antd';
import { LinkOutlined, CopyOutlined, CheckOutlined } from '@ant-design/icons';
import { createShareLink } from '@/services/shares';

const { Text } = Typography;

interface ShareModalProps {
  pipelineId: number | null;
  versionId?: number | null;
  open: boolean;
  onClose: () => void;
}

const EXPIRY_OPTIONS = [
  { label: '24小时', value: 24 },
  { label: '72小时', value: 72 },
  { label: '7天', value: 168 },
  { label: '30天', value: 720 },
];

function ShareModal({ pipelineId, versionId, open, onClose }: ShareModalProps) {
  const [expiryHours, setExpiryHours] = useState(72);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!pipelineId) {
      message.warning('请先保存 Pipeline');
      return;
    }
    setGenerating(true);
    try {
      const data: { pipeline_id: number; version_id?: number; expires_in_hours: number } = {
        pipeline_id: pipelineId,
        expires_in_hours: expiryHours,
      };
      if (versionId) {
        data.version_id = versionId;
      }
      const link = await createShareLink(data);
      const url = `${window.location.origin}/share/${link.token}`;
      setShareUrl(url);
    } catch {
      message.error('生成分享链接失败');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      message.success('链接已复制');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      message.error('复制失败，请手动复制');
    }
  };

  const handleClose = () => {
    setShareUrl(null);
    setCopied(false);
    onClose();
  };

  return (
    <Modal
      title="分享 Pipeline"
      open={open}
      onCancel={handleClose}
      footer={null}
      width={480}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <div style={{ marginBottom: 8, fontSize: 13, color: '#595959' }}>链接有效期</div>
          <Radio.Group
            value={expiryHours}
            onChange={(e) => setExpiryHours(e.target.value)}
            optionType="button"
            buttonStyle="solid"
          >
            {EXPIRY_OPTIONS.map((opt) => (
              <Radio.Button key={opt.value} value={opt.value}>
                {opt.label}
              </Radio.Button>
            ))}
          </Radio.Group>
        </div>

        <Button
          type="primary"
          icon={<LinkOutlined />}
          onClick={handleGenerate}
          loading={generating}
          block
        >
          生成分享链接
        </Button>

        {shareUrl && (
          <div>
            <div style={{ marginBottom: 8, fontSize: 13, color: '#595959' }}>分享链接</div>
            <Space.Compact style={{ width: '100%' }}>
              <Input value={shareUrl} readOnly />
              <Button
                icon={copied ? <CheckOutlined /> : <CopyOutlined />}
                onClick={handleCopy}
                type={copied ? 'primary' : 'default'}
              >
                {copied ? '已复制' : '复制'}
              </Button>
            </Space.Compact>
            <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
              任何拥有此链接的人都可以查看 Pipeline（无需登录）
            </Text>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default ShareModal;
