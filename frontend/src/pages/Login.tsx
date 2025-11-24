import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import ApiService from '../services/ApiService';
import SocialLogin from '../components/SocialLogin/SocialLogin';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // 获取重定向参数
  const params = new URLSearchParams(location.search);
  const redirect = params.get('redirect') || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    setLoading(true);
    try {
      console.log('准备调用登录API:', { username, password });
      const result = await ApiService.post('/login', { username, password });
      console.log('登录API响应:', result);
      console.log('result.success:', result.success);
      console.log('result.message:', result.message);
      console.log('result.data:', result.data);
      
      // 检查后端返回的数据格式
      if (result.message === '登录成功' || result.success) {
        setMsg('登录成功！');
        console.log('登录成功，用户数据:', (result as any).user);
        console.log('登录成功，token:', (result as any).token);
        
        // 使用统一的认证服务设置登录状态
        console.log('保存用户数据到认证服务:', (result as any).user);
        login((result as any).user, (result as any).token);
        
        // 触发自定义事件，通知NavBar组件更新头像
        window.dispatchEvent(new Event('userDataChanged'));
        
        // 等待认证状态更新后再跳转
        console.log('准备跳转到:', redirect);
        
        // 使用更可靠的跳转方法
        const performRedirect = () => {
          console.log('执行页面跳转...');
          console.log('跳转目标URL:', redirect);
          console.log('当前URL:', window.location.href);
          
          // 强制刷新页面状态
          try {
            window.location.href = redirect;
            console.log('跳转命令已执行');
          } catch (error) {
            console.error('跳转失败:', error);
          }
        };
        
        console.log('设置跳转定时器，300ms后执行');
        setTimeout(performRedirect, 300); // 减少延迟时间
        
        // 备用跳转方法
        setTimeout(() => {
          console.log('备用跳转方法执行');
          if (window.location.pathname === '/login') {
            console.log('仍在登录页面，强制跳转');
            window.location.replace(redirect);
          }
        }, 1000);
      } else {
        console.log('登录失败，进入else分支');
        console.log('result.message:', result.message);
        setMsg(result.message || '登录失败');
      }
    } catch (err) {
      console.error('登录请求发生错误:', err);
      if (err instanceof Error && err.message) {
        setMsg(`登录失败: ${err.message}`);
      } else {
        setMsg('网络错误');
      }
    }
    setLoading(false);
  };

  // 处理第三方登录成功
  const handleSocialLoginSuccess = async (provider: string, userData: any) => {
    try {
      setLoading(true);
      setMsg('');
      
      // 调用后端API处理第三方登录
      const result = await ApiService.post('/auth/social-login', {
        provider,
        userData
      });
      
      if (result.success) {
        setMsg(`${provider}登录成功！`);
        console.log(`${provider}登录成功，用户数据:`, result.data);
        
        // 使用统一的认证服务设置登录状态
        login(result.data.user, result.data.token);
        
        // 触发自定义事件，通知NavBar组件更新头像
        window.dispatchEvent(new Event('userDataChanged'));
        
        // 等待认证状态更新后再跳转
        const performRedirect = () => {
          console.log('执行第三方登录跳转...');
          // 强制刷新页面状态
          window.location.href = redirect;
        };
        
        setTimeout(performRedirect, 300); // 减少延迟时间
      } else {
        setMsg(result.message || `${provider}登录失败`);
      }
    } catch (error) {
      setMsg(`${provider}登录失败`);
      console.error(`${provider}登录错误:`, error);
    } finally {
      setLoading(false);
    }
  };

  // 处理第三方登录错误
  const handleSocialLoginError = (provider: string, error: any) => {
    setMsg(`${provider}登录失败`);
    console.error(`${provider}登录错误:`, error);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#fafbfc',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        width: 400,
        background: '#fff',
        borderRadius: 12,
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        padding: 36
      }}>
        <h2 style={{ fontWeight: 700, fontSize: 28, marginBottom: 12, textAlign: 'center' }}>
          Login / 登录账号
        </h2>
        <p style={{ textAlign: 'center', color: '#666', marginBottom: 24, fontSize: 14 }}>
          Welcome back / 欢迎回来
        </p>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontWeight: 500, marginBottom: 6, display: 'block' }}>
              Username or Email / 用户名或邮箱
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d0d7de',
                borderRadius: 6,
                fontSize: 16
              }}
              placeholder="Please enter username or email / 请输入用户名或邮箱"
            />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontWeight: 500, marginBottom: 6, display: 'block' }}>
              Password / 密码
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d0d7de',
                borderRadius: 6,
                fontSize: 16
              }}
              placeholder="Please enter your password / 请输入密码"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              background: 'linear-gradient(90deg,#1976d2,#2196f3)',
              color: '#fff',
              fontWeight: 600,
              fontSize: 18,
              padding: '12px 0',
              border: 'none',
              borderRadius: 6,
              marginTop: 8,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Logging in... / 登录中...' : 'Login / 登录'}
          </button>
          {msg && (
            <div style={{
              marginTop: 18,
              color: msg === '登录成功！' ? 'green' : 'red',
              textAlign: 'center',
              fontWeight: 500
            }}>
              {msg}
            </div>
          )}
        </form>
        
        {/* 第三方登录 */}
        <SocialLogin
          onGoogleSuccess={(response) => handleSocialLoginSuccess('Google', response)}
          onGoogleError={(error) => handleSocialLoginError('Google', error)}
          onFacebookSuccess={(response) => handleSocialLoginSuccess('Facebook', response)}
          onFacebookFailure={(error) => handleSocialLoginError('Facebook', error)}
          onAppleSuccess={(response) => handleSocialLoginSuccess('Apple', response)}
          onAppleError={(error) => handleSocialLoginError('Apple', error)}
        />
        
        <div style={{ marginTop: 24, textAlign: 'center', color: '#888' }}>
          No account? / 没有账号？{' '}
          <a href="/register" style={{ color: '#1976d2', textDecoration: 'none', marginLeft: 4 }}>
            Register / 注册
          </a>
        </div>
      </div>
    </div>
  );
};

export default Login; 