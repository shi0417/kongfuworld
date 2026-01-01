import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import ApiService, { ApiError } from '../services/ApiService';
import SocialLogin from '../components/SocialLogin/SocialLogin';
import BotDetection from '../components/BotDetection/BotDetection';
import Toast from '../components/Toast/Toast';

const Register: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [referrerId, setReferrerId] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [botDetectionPassed, setBotDetectionPassed] = useState(false);
  const [showBotDetection, setShowBotDetection] = useState(true); // 页面加载时自动显示
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);

  // 从URL参数中获取推荐人ID
  useEffect(() => {
    const referrerIdParam = searchParams.get('referrer_id') || searchParams.get('ref');
    if (referrerIdParam) {
      setReferrerId(referrerIdParam);
    } else {
      // 如果URL中没有推荐人ID参数，清除状态
      setReferrerId('');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    
    if (password !== confirmPassword) {
      setMsg('Passwords do not match');
      return;
    }
    
    if (!botDetectionPassed) {
      setMsg('Please complete bot detection first');
      return;
    }
    
    setLoading(true);
    try {
      const registerData: any = { username, email, password };
      if (referrerId) {
        registerData.referrer_id = referrerId;
      }
      const result = await ApiService.post('/register', registerData);
      if (result.success) {
        setMsg('Registration successful!');
        // Auto login after successful registration
        if (result.data && result.data.user && result.data.token) {
          login(result.data.user, result.data.token);
          navigate('/');
        }
      } else {
        setMsg(result.message || 'Registration failed');
      }
    } catch (err) {
      // 检查是否是推荐人ID错误
      if (err instanceof ApiError && err.message === 'Invalid referrer ID') {
        // 显示toast提示
        setToast({
          message: '推荐人ID错误，已跳转到注册页面',
          type: 'error'
        });
        // 清除推荐人ID
        setReferrerId('');
        // 跳转到无参数的注册页面
        navigate('/register', { replace: true });
        setMsg('');
      } else {
        setMsg(err instanceof ApiError ? err.message : 'Network error');
      }
    }
    setLoading(false);
  };

  // Handle social login success
  const handleSocialLoginSuccess = async (provider: string, userData: any) => {
    try {
      setLoading(true);
      setMsg('');
      
      console.log(`${provider} login response:`, userData);
      
      // Call backend API for social login
      const result = await ApiService.post('/auth/social-login', {
        provider,
        userData
      });
      
      if (result.success) {
        setMsg(`${provider} registration successful!`);
        console.log(`${provider} registration successful, user data:`, result.data);
        
        // Set authentication state
        login(result.data.user, result.data.token);
        
        // Navigate to home page
        navigate('/');
      } else {
        setMsg(result.message || `${provider} registration failed`);
      }
    } catch (error: any) {
      setMsg(error.response?.data?.message || `${provider} registration failed`);
      console.error(`${provider} registration error:`, error);
    } finally {
      setLoading(false);
    }
  };

  // Handle social login error
  const handleSocialLoginError = (provider: string, error: any) => {
    setMsg(`${provider} registration failed`);
    console.error(`${provider} registration error:`, error);
  };

  // Handle bot detection
  const handleBotDetectionSuccess = () => {
    setBotDetectionPassed(true);
    setShowBotDetection(false);
    setMsg('');
  };

  const handleBotDetectionError = () => {
    setBotDetectionPassed(false);
    setMsg('Bot detection failed. Please try again.');
  };

  const handleBotDetectionComplete = (isHuman: boolean) => {
    if (isHuman) {
      setBotDetectionPassed(true);
      setShowBotDetection(false);
      setMsg('');
    } else {
      setBotDetectionPassed(false);
      setMsg('Bot detection failed. Please try again.');
    }
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
        <h2 style={{ fontWeight: 700, fontSize: 28, marginBottom: 24, textAlign: 'center' }}>Create a New Account</h2>
        
        {/* Bot Detection */}
        {showBotDetection && (
          <BotDetection
            onSuccess={handleBotDetectionSuccess}
            onError={handleBotDetectionError}
            onComplete={handleBotDetectionComplete}
          />
        )}
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontWeight: 500, marginBottom: 6, display: 'block' }}>Username</label>
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
              placeholder="Username"
            />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontWeight: 500, marginBottom: 6, display: 'block' }}>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d0d7de',
                borderRadius: 6,
                fontSize: 16
              }}
              placeholder="Email"
            />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontWeight: 500, marginBottom: 6, display: 'block' }}>Password</label>
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
              placeholder="Password"
            />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontWeight: 500, marginBottom: 6, display: 'block' }}>Confirm password</label>
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
                fontSize: 16
              }}
              placeholder="Confirm Password"
            />
          </div>
          {referrerId && (
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontWeight: 500, marginBottom: 6, display: 'block' }}>推荐人ID (Referrer ID)</label>
              <input
                type="text"
                value={referrerId}
                readOnly
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d0d7de',
                  borderRadius: 6,
                  fontSize: 16,
                  backgroundColor: '#f5f5f5',
                  cursor: 'not-allowed'
                }}
                placeholder="推荐人ID"
              />
            </div>
          )}
          
          {/* Terms and Privacy Policy */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'flex', alignItems: 'center', fontSize: 14, color: '#666' }}>
              <input
                type="checkbox"
                required
                style={{ marginRight: 8 }}
              />
              I have read and agree to{' '}
              <a href="/privacy" style={{ color: '#1976d2', textDecoration: 'none', margin: '0 4px' }}>
                Privacy Policy
              </a>
              {' '}and{' '}
              <a href="/terms" style={{ color: '#1976d2', textDecoration: 'none', margin: '0 4px' }}>
                Terms of Use
              </a>
            </label>
          </div>
          
          {/* Marketing Communications */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'flex', alignItems: 'center', fontSize: 14, color: '#666' }}>
              <input
                type="checkbox"
                style={{ marginRight: 8 }}
              />
              By ticking this box, you agree to receive marketing related electronic communications from KongFuWorld.
            </label>
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
            {loading ? 'Signing up...' : 'Sign up'}
          </button>
          {msg && (
            <div style={{
              marginTop: 18,
              color: msg === 'Registration successful!' ? 'green' : 'red',
              textAlign: 'center',
              fontWeight: 500
            }}>
              {msg}
            </div>
          )}
        </form>
        
        {/* Social Login */}
        <SocialLogin
          onGoogleSuccess={(response) => handleSocialLoginSuccess('Google', response)}
          onGoogleError={(error) => handleSocialLoginError('Google', error)}
          onAppleSuccess={(response) => handleSocialLoginSuccess('Apple', response)}
          onAppleError={(error) => handleSocialLoginError('Apple', error)}
        />
        
        <div style={{ marginTop: 24, textAlign: 'center', color: '#888' }}>
          Already have an account?{' '}
          <a href="/login" style={{ color: '#1976d2', textDecoration: 'none' }}>
            Log in
          </a>
        </div>
      </div>
      
      {/* Toast提示 */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
          duration={3000}
        />
      )}
    </div>
  );
};

export default Register; 