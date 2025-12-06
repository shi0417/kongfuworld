import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import NavBar from '../components/NavBar/NavBar';
import Footer from '../components/Footer/Footer';

const PaymentSuccess: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [orderId, setOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const orderIdParam = searchParams.get('orderId');
    setOrderId(orderIdParam);
    setLoading(false);
  }, [searchParams]);

  const handleReturnToNovel = () => {
    // 从localStorage或其他地方获取小说ID
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
            <div>Processing payment result...</div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div style={{ background: '#18191A', minHeight: '100vh', color: '#fff', fontFamily: 'inherit' }}>
      <NavBar />
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <div style={{ textAlign: 'center', maxWidth: '600px', padding: '20px' }}>
          <div style={{ fontSize: '64px', marginBottom: '24px' }}>✅</div>
          <h1 style={{ fontSize: '32px', marginBottom: '16px', color: '#28a745' }}>
            Payment Successful!
          </h1>
          <p style={{ fontSize: '18px', marginBottom: '24px', color: '#ccc' }}>
            Thank you for choosing KongFuWorld Champion subscription service
          </p>
          
          {orderId && (
            <div style={{ 
              background: '#2a2a2a', 
              padding: '16px', 
              borderRadius: '8px', 
              marginBottom: '24px',
              border: '1px solid #444'
            }}>
              <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#aaa' }}>Order Number</p>
              <p style={{ margin: '0', fontSize: '16px', fontFamily: 'monospace' }}>{orderId}</p>
            </div>
          )}

          <div style={{ 
            background: '#1a4d1a', 
            padding: '16px', 
            borderRadius: '8px', 
            marginBottom: '32px',
            border: '1px solid #28a745'
          }}>
            <h3 style={{ margin: '0 0 12px 0', color: '#28a745' }}>🎉 Subscription Activated</h3>
            <p style={{ margin: '0', fontSize: '14px', color: '#90ee90' }}>
              You can now enjoy all the privileges of a Champion member, including early access to chapters and other exclusive features.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button 
              onClick={handleReturnToNovel}
              style={{
                padding: '12px 24px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: '600'
              }}
            >
              Return to Novel Details
            </button>
            <button 
              onClick={handleReturnToHome}
              style={{
                padding: '12px 24px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: '600'
              }}
            >
              Return to Homepage
            </button>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default PaymentSuccess;
