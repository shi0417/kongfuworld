import React, { useState } from 'react';
import styles from './PaymentModal.module.css';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  currency?: string;
  onPaymentSuccess?: (paymentId: string) => void;
}

const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  amount,
  currency = 'USD',
  onPaymentSuccess
}) => {
  const [selectedMethod, setSelectedMethod] = useState<'paypal' | 'stripe'>('paypal');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePayPalPayment = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/payment/paypal/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: 1, // 从用户上下文获取
          amount: amount,
          currency: currency,
          description: 'kongfuworld Credits Purchase'
        })
      });

      const data = await response.json();

      if (data.success) {
        // 重定向到PayPal支付页面
        window.location.href = data.approvalUrl;
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Payment initialization failed');
    } finally {
      setLoading(false);
    }
  };

  const handleStripePayment = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/payment/stripe/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: 1, // 从用户上下文获取
          amount: amount,
          currency: currency.toLowerCase()
        })
      });

      const data = await response.json();

      if (data.success) {
        // 这里需要集成Stripe Elements
        // 实际实现中需要使用@stripe/stripe-js
        console.log('Stripe payment intent created:', data.clientSecret);
        onPaymentSuccess?.(data.paymentIntentId);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Stripe payment initialization failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = () => {
    if (selectedMethod === 'paypal') {
      handlePayPalPayment();
    } else {
      handleStripePayment();
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>Payment</h2>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>

        <div className={styles.content}>
          <div className={styles.amount}>
            <span className={styles.label}>Amount:</span>
            <span className={styles.value}>${amount} {currency}</span>
          </div>

          <div className={styles.paymentMethods}>
            <h3>Select Payment Method</h3>
            
            <div className={styles.methodOptions}>
              <label className={styles.methodOption}>
                <input
                  type="radio"
                  name="paymentMethod"
                  value="paypal"
                  checked={selectedMethod === 'paypal'}
                  onChange={(e) => setSelectedMethod(e.target.value as 'paypal' | 'stripe')}
                />
                <span className={styles.methodLabel}>
                  <img src="/images/paypal-logo.png" alt="PayPal" className={styles.methodLogo} />
                  PayPal
                </span>
              </label>

              <label className={styles.methodOption}>
                <input
                  type="radio"
                  name="paymentMethod"
                  value="stripe"
                  checked={selectedMethod === 'stripe'}
                  onChange={(e) => setSelectedMethod(e.target.value as 'paypal' | 'stripe')}
                />
                <span className={styles.methodLabel}>
                  <img src="/images/stripe-logo.png" alt="Stripe" className={styles.methodLogo} />
                  Credit Card (Stripe)
                </span>
              </label>
            </div>
          </div>

          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}

          <div className={styles.actions}>
            <button
              className={styles.payButton}
              onClick={handlePayment}
              disabled={loading}
            >
              {loading ? 'Processing...' : `Pay $${amount}`}
            </button>
            <button className={styles.cancelButton} onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
