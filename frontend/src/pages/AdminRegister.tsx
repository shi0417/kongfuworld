/**
 * 编辑注册页面
 * 用于 admin（编辑）自助注册，包含邮箱验证码验证
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const AdminRegister: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [realName, setRealName] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // 发送验证码
  const handleSendCode = async () => {
    setMsg('');
    
    // 验证邮箱
    if (!email) {
      setMsg('请先输入邮箱地址');
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setMsg('请输入有效的邮箱地址');
      return;
    }

    setSendingCode(true);
    try {
      const response = await fetch('http://localhost:5000/api/admin/email-verification/send-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim() }),
      });

      const result = await response.json();

      if (result.success || result.message === 'Verification code sent') {
        setMsg('验证码已发送，请查收邮件');
        // 开始倒计时
        setCountdown(60);
        const timer = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        setMsg(result.message || '发送验证码失败');
      }
    } catch (error: any) {
      console.error('发送验证码失败:', error);
      setMsg('发送验证码失败，请稍后重试');
    } finally {
      setSendingCode(false);
    }
  };

  // 处理注册提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    
    // 表单校验
    if (!name || !email || !password || !confirmPassword || !verificationCode) {
      setMsg('请填写所有必填项');
      return;
    }
    
    if (password !== confirmPassword) {
      setMsg('两次输入的密码不一致');
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setMsg('邮箱格式不正确');
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/admin/register-editor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          confirmPassword,
          phone: phone.trim() || null,
          real_name: realName.trim() || null,
          verificationCode: verificationCode.trim(),
        }),
      });

      const result = await response.json();

      if (result.success) {
        setMsg('注册成功！请使用该账号登录后台');
        // 2秒后跳转到登录页面
        setTimeout(() => {
          navigate('/admin');
        }, 2000);
      } else {
        setMsg(result.message || '注册失败');
      }
    } catch (error: any) {
      console.error('注册失败:', error);
      setMsg('注册失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#fafbfc',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        width: 400,
        background: '#fff',
        borderRadius: 12,
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        padding: 36
      }}>
        <h2 style={{ fontWeight: 700, fontSize: 28, marginBottom: 24, textAlign: 'center' }}>
          编辑注册
        </h2>
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontWeight: 500, marginBottom: 6, display: 'block' }}>用户名 *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d0d7de',
                borderRadius: 6,
                fontSize: 16,
                boxSizing: 'border-box'
              }}
              placeholder="请输入用户名"
            />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={{ fontWeight: 500, marginBottom: 6, display: 'block' }}>邮箱 *</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  border: '1px solid #d0d7de',
                  borderRadius: 6,
                  fontSize: 16,
                  boxSizing: 'border-box'
                }}
                placeholder="请输入邮箱"
              />
              <button
                type="button"
                onClick={handleSendCode}
                disabled={sendingCode || countdown > 0}
                style={{
                  padding: '10px 16px',
                  background: countdown > 0 ? '#ccc' : '#1976d2',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 14,
                  cursor: (sendingCode || countdown > 0) ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {countdown > 0 ? `${countdown}秒` : sendingCode ? '发送中...' : '发送验证码'}
              </button>
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={{ fontWeight: 500, marginBottom: 6, display: 'block' }}>验证码 *</label>
            <input
              type="text"
              value={verificationCode}
              onChange={e => setVerificationCode(e.target.value)}
              required
              maxLength={6}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d0d7de',
                borderRadius: 6,
                fontSize: 16,
                boxSizing: 'border-box'
              }}
              placeholder="请输入6位验证码"
            />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={{ fontWeight: 500, marginBottom: 6, display: 'block' }}>密码 *</label>
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
                fontSize: 16,
                boxSizing: 'border-box'
              }}
              placeholder="请输入密码"
            />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={{ fontWeight: 500, marginBottom: 6, display: 'block' }}>确认密码 *</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d0d7de',
                borderRadius: 6,
                fontSize: 16,
                boxSizing: 'border-box'
              }}
              placeholder="请再次输入密码"
            />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={{ fontWeight: 500, marginBottom: 6, display: 'block' }}>手机号（可选）</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d0d7de',
                borderRadius: 6,
                fontSize: 16,
                boxSizing: 'border-box'
              }}
              placeholder="请输入手机号"
            />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={{ fontWeight: 500, marginBottom: 6, display: 'block' }}>真实姓名（可选）</label>
            <input
              type="text"
              value={realName}
              onChange={e => setRealName(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d0d7de',
                borderRadius: 6,
                fontSize: 16,
                boxSizing: 'border-box'
              }}
              placeholder="请输入真实姓名（用于结算实名）"
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
            {loading ? '注册中...' : '注册'}
          </button>
          
          {msg && (
            <div style={{
              marginTop: 18,
              color: msg.includes('成功') ? 'green' : 'red',
              textAlign: 'center',
              fontWeight: 500
            }}>
              {msg}
            </div>
          )}
        </form>
        
        <div style={{ marginTop: 24, textAlign: 'center', color: '#888' }}>
          已有账号？{' '}
          <a href="/admin" style={{ color: '#1976d2', textDecoration: 'none' }}>
            去登录
          </a>
        </div>
      </div>
    </div>
  );
};

export default AdminRegister;

