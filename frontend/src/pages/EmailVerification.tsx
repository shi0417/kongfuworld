import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../components/NavBar/NavBar';
import Footer from '../components/Footer/Footer';
import { useAuth } from '../hooks/useAuth';
import ApiService from '../services/ApiService';
import styles from './EmailVerification.module.css';

const EmailVerification: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [errors, setErrors] = useState<{
    email?: string;
    verificationCode?: string;
    general?: string;
  }>({});

  // 检查用户是否登录，以及是否已经是作者
  useEffect(() => {
    if (!isAuthenticated || !user) {
      navigate('/login?redirect=/email-verification');
      return;
    }

    // 检查用户是否已经是作者（避免已完成的作者重复验证）
    const checkAuthorStatus = async () => {
      try {
        const response = await ApiService.get(`/user/${user.id}`);
        // 处理不同的响应格式
        const userData = response.data || response;
        
        // 判断是否已经是作者（兼容数字1和字符串"1"）
        const isAuthor = userData.is_author === 1 || userData.is_author === '1' || userData.is_author === true;
        
        if (isAuthor) {
          console.log('✅ 用户已是作者，跳过邮箱验证，直接跳转到Writers Zone');
          navigate('/writers-zone');
          return;
        }
        
        // 如果有email，预填充
        if (user.email) {
          setEmail(user.email);
        }
      } catch (error) {
        console.error('检查用户状态失败:', error);
        // 如果检查失败，继续显示邮箱验证页面
        if (user.email) {
          setEmail(user.email);
        }
      }
    };

    checkAuthorStatus();
  }, [isAuthenticated, user, navigate]);

  // 邮箱验证正则表达式
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // 处理发送验证码
  const handleSendCode = async () => {
    setErrors({});
    
    // 验证邮箱
    if (!email) {
      setErrors({ email: 'Email cannot be empty / 邮箱不能为空' });
      return;
    }
    
    if (!validateEmail(email)) {
      setErrors({ email: 'Please enter a valid email address / 请输入有效的邮箱地址' });
      return;
    }

    setSendingCode(true);
    try {
      const response = await ApiService.post('/email-verification/send-code', {
        email: email.trim()
      });

      if (response.success || response.message === 'Verification code sent') {
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
        setErrors({ general: response.message || 'Failed to send verification code / 发送验证码失败' });
      }
    } catch (error: any) {
      console.error('发送验证码失败:', error);
      let errorMessage = 'Failed to send verification code / 发送验证码失败';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error.status && error.message) {
        errorMessage = error.message;
      }
      setErrors({ general: errorMessage });
    } finally {
      setSendingCode(false);
    }
  };

  // 处理表单提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    // 验证输入
    if (!email) {
      setErrors({ email: 'Email cannot be empty / 邮箱不能为空' });
      setLoading(false);
      return;
    }

    if (!validateEmail(email)) {
      setErrors({ email: 'Please enter a valid email address / 请输入有效的邮箱地址' });
      setLoading(false);
      return;
    }

    if (!verificationCode) {
      setErrors({ verificationCode: 'Verification code cannot be empty / 验证码不能为空' });
      setLoading(false);
      return;
    }

    if (!agreed) {
      setErrors({ general: 'Please agree to the terms / 请同意相关条款' });
      setLoading(false);
      return;
    }

    try {
      const response = await ApiService.post('/email-verification/verify', {
        email: email.trim(),
        code: verificationCode.trim()
      });

      if (response.success) {
        // 验证成功，更新用户信息并跳转
        // 刷新用户信息
        if (user) {
          try {
            const userResponse = await ApiService.get(`/user/${user.id}`);
            // 更新用户状态
            window.location.href = '/writers-zone';
          } catch (error) {
            console.error('获取用户信息失败:', error);
            navigate('/writers-zone');
          }
        } else {
          navigate('/writers-zone');
        }
      } else {
        setErrors({ 
          verificationCode: response.message || 'Verification code is incorrect / 验证码错误' 
        });
      }
    } catch (error: any) {
      console.error('验证失败:', error);
      let errorMessage = 'Verification failed / 验证失败';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error.status && error.message) {
        errorMessage = error.message;
      }
      setErrors({ verificationCode: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <NavBar />
      <div className={styles.content}>
        <div className={styles.card}>
          <h1 className={styles.title}>
            Confirm your email, become a writer and promoter
            <br />
            <span className={styles.titleCn}>确认你的邮箱，成为作家和推广人员</span>
          </h1>

          <form onSubmit={handleSubmit} className={styles.form}>
            {/* 邮箱输入 */}
            <div className={styles.formGroup}>
              <label className={styles.label}>
                Email / 邮箱 <span className={styles.required}>*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrors({ ...errors, email: undefined });
                }}
                placeholder="Please enter your valid email / 请输入你的有效邮箱"
                className={`${styles.input} ${errors.email ? styles.inputError : ''}`}
                disabled={loading || sendingCode}
              />
              {errors.email && (
                <div className={styles.errorMessage}>⚠️ {errors.email}</div>
              )}
            </div>

            {/* 验证码输入 */}
            <div className={styles.formGroup}>
              <label className={styles.label}>
                Verification Code / 验证码 <span className={styles.required}>*</span>
              </label>
              <div className={styles.codeContainer}>
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => {
                    setVerificationCode(e.target.value);
                    setErrors({ ...errors, verificationCode: undefined });
                  }}
                  placeholder="Verification code / 验证码"
                  className={`${styles.input} ${styles.codeInput} ${errors.verificationCode ? styles.inputError : ''}`}
                  disabled={loading}
                  maxLength={6}
                />
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={!email || !validateEmail(email) || sendingCode || countdown > 0}
                  className={styles.sendCodeButton}
                >
                  {sendingCode 
                    ? 'Sending... / 发送中...' 
                    : countdown > 0 
                      ? `Resend (${countdown}s) / 重新发送 (${countdown}秒)`
                      : 'Get Code / 获取验证码'}
                </button>
              </div>
              {errors.verificationCode && (
                <div className={styles.errorMessage}>⚠️ {errors.verificationCode}</div>
              )}
            </div>

            {/* 同意条款 */}
            <div className={styles.checkboxGroup}>
              <input
                type="checkbox"
                id="agree"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className={styles.checkbox}
              />
              <label htmlFor="agree" className={styles.checkboxLabel}>
                I have read and agree to / 已阅读并同意{' '}
                <a href="/terms" target="_blank" className={styles.link}>
                  User Agreement / 用户协议
                </a>
                ,{' '}
                <a href="/privacy" target="_blank" className={styles.link}>
                  Privacy Policy / 隐私政策
                </a>
                , and{' '}
                <a href="/rules" target="_blank" className={styles.link}>
                  Work Publication Rules / 作品登载规则
                </a>
              </label>
            </div>

            {/* 通用错误消息 */}
            {errors.general && (
              <div className={styles.errorMessage}>{errors.general}</div>
            )}

            {/* 提交按钮 */}
            <button
              type="submit"
              disabled={loading || !email || !verificationCode || !agreed}
              className={styles.submitButton}
            >
              {loading ? 'Verifying... / 验证中...' : 'Verify / 验证'}
            </button>
          </form>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default EmailVerification;

