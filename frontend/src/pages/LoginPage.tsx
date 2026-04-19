import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Form, Input, Button, Tabs, message } from 'antd';
import { UserOutlined, LockOutlined, IdcardOutlined } from '@ant-design/icons';
import useAuthStore from '@/store/authStore';

function LoginPage() {
  const navigate = useNavigate();
  const { login, register } = useAuthStore();
  const [loginForm] = Form.useForm();
  const [registerForm] = Form.useForm();
  const [loginLoading, setLoginLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);

  const emailValidator = (_: unknown, value: string) => {
    if (!value) {
      return Promise.reject(new Error('请输入邮箱'));
    }
    if (!value.endsWith('@baidu.com')) {
      return Promise.reject(new Error('邮箱必须以 @baidu.com 结尾'));
    }
    return Promise.resolve();
  };

  const handleLogin = async (values: { email: string; password: string }) => {
    setLoginLoading(true);
    try {
      await login(values.email, values.password);
      message.success('登录成功');
      navigate('/');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      message.error(err.response?.data?.detail || '登录失败，请检查邮箱和密码');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (values: {
    email: string;
    password: string;
    display_name: string;
  }) => {
    setRegisterLoading(true);
    try {
      await register(values.email, values.password, values.display_name);
      message.success('注册成功');
      navigate('/');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      message.error(err.response?.data?.detail || '注册失败，请重试');
    } finally {
      setRegisterLoading(false);
    }
  };

  const tabItems = [
    {
      key: 'login',
      label: '登录',
      children: (
        <Form
          form={loginForm}
          onFinish={handleLogin}
          autoComplete="off"
          layout="vertical"
          size="large"
        >
          <Form.Item
            name="email"
            label="邮箱"
            rules={[{ validator: emailValidator }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="请输入邮箱"
            />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请输入密码"
            />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loginLoading}
              block
            >
              登录
            </Button>
          </Form.Item>
        </Form>
      ),
    },
    {
      key: 'register',
      label: '注册',
      children: (
        <Form
          form={registerForm}
          onFinish={handleRegister}
          autoComplete="off"
          layout="vertical"
          size="large"
        >
          <Form.Item
            name="email"
            label="邮箱"
            rules={[{ validator: emailValidator }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="请输入邮箱"
            />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 6, message: '密码至少6个字符' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请输入密码"
            />
          </Form.Item>
          <Form.Item
            name="display_name"
            label="显示名称"
            rules={[{ required: true, message: '请输入显示名称' }]}
          >
            <Input
              prefix={<IdcardOutlined />}
              placeholder="请输入显示名称"
            />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={registerLoading}
              block
            >
              注册
            </Button>
          </Form.Item>
        </Form>
      ),
    },
  ];

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#f0f2f5',
      }}
    >
      <Card
        style={{ width: 420, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
        title={
          <div style={{ textAlign: 'center', fontSize: 20, fontWeight: 600 }}>
            Pipeline 成本估算系统
          </div>
        }
      >
        <Tabs items={tabItems} centered />
      </Card>
    </div>
  );
}

export default LoginPage;
