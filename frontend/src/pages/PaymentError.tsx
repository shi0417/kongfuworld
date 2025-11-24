import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import NavBar from '../components/NavBar/NavBar';
import Footer from '../components/Footer/Footer';
import PaymentErrorHandler from '../components/PaymentErrorHandler/PaymentErrorHandler';

const PaymentError: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [errorMessage, setErrorMessage] = useState<string>('支付失败');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const message = searchParams.get('message');
    if (message) {
      setErrorMessage(decodeURIComponent(message));
    }
    setLoading(false);
  }, [searchParams]);

  const handleRetryPayment = () => {
    // 返回上一页或重新开始支付流程
    window.history.back();
  };

  const handleReturnToNovel = () => {
    const novelId = localStorage.getItem('currentNovelId') || '7';
    navigate(`/book/${novelId}`);
  };

  const handleReturnToHome = () => {
    navigate('/');
  };

  if (loading) {
    return (
      <div style={{ background: '#18191A', minHeight: '100vh', color: '#fff', fontFamily: 'inherit' }}>
        <NavBar />
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', marginBottom: '16px' }}>⏳</div>
            <div>处理支付结果中...</div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div style={{ background: '#18191A', minHeight: '100vh', color: '#fff', fontFamily: 'inherit' }}>
      <NavBar />
      <PaymentErrorHandler 
        error={errorMessage}
        onRetry={handleRetryPayment}
        onCancel={handleReturnToHome}
      />
      <Footer />
    </div>
  );
};

export default PaymentError;
