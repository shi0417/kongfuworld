import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import ApiService from '../../services/ApiService';
import styles from './StripePaymentModal.module.css';

// 加载Stripe
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || 'pk_test_your_publishable_key');

interface StripePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  tier: {
    name: string;
    price: number;
    description: string;
  };
  novelId: number;
  onPaymentSuccess: (orderId: string) => void;
  onPaymentError: (error: string) => void;
}

// 支付表单组件
const PaymentForm: React.FC<{
  tier: StripePaymentModalProps['tier'];
  novelId: number;
  onPaymentSuccess: (orderId: string) => void;
  onPaymentError: (error: string) => void;
  onClose: () => void;
}> = ({ tier, novelId, onPaymentSuccess, onPaymentError, onClose }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 确认支付的辅助函数（带重试机制）
  const confirmPayment = async (paymentIntentId: string, retryCount = 0): Promise<void> => {
    const maxRetries = 3;
    const retryDelay = 1000; // 1秒

    try {
      console.log(`[支付确认] PaymentIntent ID: ${paymentIntentId}, 重试次数: ${retryCount}`);
      
      const confirmResponse = await ApiService.request('/payment/stripe/confirm', {
        method: 'POST',
        body: JSON.stringify({
          paymentIntentId: paymentIntentId
        })
      });

      if (!confirmResponse.success) {
        throw new Error(`API error: ${confirmResponse.message}`);
      }

      console.log('[支付确认] 结果:', confirmResponse.data);

      if (confirmResponse.success) {
        console.log('[支付确认] 成功');
        onPaymentSuccess(paymentIntentId);
      } else {
        throw new Error(confirmResponse.message || 'Payment confirmation failed');
      }
    } catch (error) {
      console.error(`[支付确认] 失败 (重试 ${retryCount}/${maxRetries}):`, error);
      
      if (retryCount < maxRetries) {
        console.log(`[支付确认] 等待 ${retryDelay}ms 后重试...`);
        setTimeout(() => {
          confirmPayment(paymentIntentId, retryCount + 1);
        }, retryDelay);
      } else {
        throw new Error(`Payment confirmation failed after ${maxRetries} retries: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      console.error('[支付流程] Stripe未初始化');
      return;
    }

    setIsProcessing(true);
    setError(null);

    console.log(`[支付流程] 开始 - 小说ID: ${novelId}, 金额: $${tier.price}`);

    try {
      // 创建支付意图
      const response = await ApiService.request('/payment/stripe/create', {
        method: 'POST',
        body: JSON.stringify({
          userId: 1, // 临时使用用户ID 1，实际应该从认证中获取
          amount: tier.price,
          currency: 'usd',
          novelId: novelId
        })
      });

      if (!response.success) {
        throw new Error(`API error: ${response.message}`);
      }

      const { clientSecret, paymentIntentId } = response as any;

      console.log(`[支付流程] 支付意图创建成功: ${paymentIntentId}`);

      // 确认支付
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement)!,
        }
      });

      if (stripeError) {
        console.error('[支付流程] Stripe支付错误:', stripeError);
        throw new Error(stripeError.message);
      }

      console.log(`[支付流程] Stripe支付结果: ${paymentIntent.status}`);

      if (paymentIntent.status === 'succeeded') {
        // 支付成功，开始确认流程
        console.log('[支付流程] 支付成功，开始确认流程...');
        await confirmPayment(paymentIntent.id);
      } else {
        throw new Error('Payment not completed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Payment failed';
      console.error('[支付流程] 错误:', errorMessage);
      setError(errorMessage);
      onPaymentError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#424770',
        '::placeholder': {
          color: '#aab7c4',
        },
      },
      invalid: {
        color: '#9e2146',
      },
    },
  };

  return (
    <form onSubmit={handleSubmit} className={styles.paymentForm}>
      <div className={styles.cardElement}>
        <CardElement options={cardElementOptions} />
      </div>
      
      {error && <div className={styles.errorMessage}>{error}</div>}
      
      <div className={styles.buttonGroup}>
        <button
          type="button"
          onClick={onClose}
          className={styles.cancelButton}
          disabled={isProcessing}
        >
          Cancel
        </button>
        <button
          type="submit"
          className={styles.payButton}
          disabled={!stripe || isProcessing}
        >
          {isProcessing ? 'Processing...' : `Pay $${(Number(tier.price) || 0).toFixed(2)}`}
        </button>
      </div>
    </form>
  );
};

const StripePaymentModal: React.FC<StripePaymentModalProps> = ({
  isOpen,
  onClose,
  tier,
  novelId,
  onPaymentSuccess,
  onPaymentError
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Add Card Details</h2>
          <button className={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.tierInfo}>
            <h3 className={styles.tierName}>{tier.name}</h3>
            <p className={styles.tierDescription}>{tier.description}</p>
            <div className={styles.price}>
              ${(Number(tier.price) || 0).toFixed(2)} / month
            </div>
          </div>

          <Elements stripe={stripePromise}>
            <PaymentForm
              tier={tier}
              novelId={novelId}
              onPaymentSuccess={onPaymentSuccess}
              onPaymentError={onPaymentError}
              onClose={onClose}
            />
          </Elements>

          <div className={styles.securityText}>
            By providing your bank card information, you agree to allow KongFuWorld Limited to charge your bank card for future payments according to their terms.
          </div>
        </div>
      </div>
    </div>
  );
};

export default StripePaymentModal;
