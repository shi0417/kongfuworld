import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import ApiService from '../../services/ApiService';
import AuthService from '../../services/AuthService';
import styles from './SmartPaymentModal.module.css';

const stripePromise = loadStripe('pk_test_51SDjOuDYBCezccmeveA9cNQZ4xW1VCJfbGBzFU6xsid1eiuMzK8fQDufYr6FzIURXV4U7eHYoGFrUKGyc209tfVk00yzBXGlC0');

// 获取当前用户ID的辅助函数
const getCurrentUserId = (): number => {
  const user = AuthService.getCurrentUser();
  if (!user || !user.id) {
    throw new Error('用户未登录');
  }
  
  return user.id;
};

interface PaymentMethod {
  id: number;
  payment_method_id: string;
  card_brand: string;
  card_last4: string;
  card_exp_month: number;
  card_exp_year: number;
  is_default: boolean;
}

interface SmartPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  tier: {
    name: string;
    price: number;
    description: string;
    packageId?: number;
  };
  novelId: number;
  onPaymentSuccess: (orderId: string) => void;
  onPaymentError: (error: string) => void;
}

// 支付表单组件
const PaymentForm: React.FC<{
  tier: SmartPaymentModalProps['tier'];
  novelId: number;
  onPaymentSuccess: (orderId: string) => void;
  onPaymentError: (error: string) => void;
  onClose: () => void;
  existingPaymentMethods: PaymentMethod[];
  onPaymentMethodSaved: () => void;
}> = ({ tier, novelId, onPaymentSuccess, onPaymentError, onClose, existingPaymentMethods, onPaymentMethodSaved }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  const [savePaymentMethod, setSavePaymentMethod] = useState(false);

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
      if (selectedPaymentMethod) {
        // 使用已保存的支付方式
        console.log(`[支付流程] 使用已保存的支付方式: ${selectedPaymentMethod}`);
        
        // 根据购买类型选择API端点
        const apiEndpoint = novelId === 0 ? '/karma/payment/stripe/create' : '/payment/stripe/create';
        const requestBody = novelId === 0 ? {
          userId: getCurrentUserId(),
          packageId: tier.packageId || 1,
          amount: tier.price,
          currency: 'usd',
          paymentMethod: 'stripe'
        } : {
          userId: getCurrentUserId(),
          amount: tier.price,
          currency: 'usd',
          novelId: novelId,
          paymentMethodId: selectedPaymentMethod
        };

        const response = await ApiService.request(apiEndpoint, {
          method: 'POST',
          body: JSON.stringify(requestBody)
        });

        if (!response.success) {
          throw new Error(`API error: ${response.message}`);
        }

        const { status, paymentIntentId } = response.data;

        console.log(`[支付流程] 支付意图创建成功: ${paymentIntentId}, 状态: ${status}`);

        if (status === 'succeeded') {
          // 支付成功，开始确认流程
          console.log('[支付流程] 支付成功，开始确认流程...');
          await confirmPayment(paymentIntentId);
        } else {
          throw new Error('Payment not completed');
        }
      } else {
        // 使用新输入的卡片信息
        console.log('[支付流程] 使用新输入的卡片信息');
        
        // 根据购买类型选择API端点
        const apiEndpoint = novelId === 0 ? '/karma/payment/stripe/create' : '/payment/stripe/create';
        const requestBody = novelId === 0 ? {
          userId: getCurrentUserId(),
          packageId: tier.packageId || 1,
          amount: tier.price,
          currency: 'usd',
          paymentMethod: 'stripe'
        } : {
          userId: getCurrentUserId(),
          amount: tier.price,
          currency: 'usd',
          novelId: novelId
        };

        const response = await ApiService.request(apiEndpoint, {
          method: 'POST',
          body: JSON.stringify(requestBody)
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
          throw new Error(stripeError.message || 'Payment failed');
        }

        if (paymentIntent && paymentIntent.status === 'succeeded') {
          console.log('[支付流程] 支付成功，开始确认流程...');
          await confirmPayment(paymentIntent.id);
        } else {
          throw new Error('Payment not completed');
        }
      }
    } catch (error) {
      console.error('[支付流程] 失败:', error);
      const errorMessage = error instanceof Error ? error.message : '支付失败，请重试';
      setError(errorMessage);
      onPaymentError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  // 确认支付的辅助函数
  const confirmPayment = async (paymentIntentId: string): Promise<void> => {
    try {
      const response = await ApiService.request('/payment/stripe/confirm', {
        method: 'POST',
        body: JSON.stringify({
          paymentIntentId: paymentIntentId,
          userId: getCurrentUserId()
        })
      });

      if (response.success) {
        console.log('[支付流程] 支付确认成功');
        onPaymentSuccess(paymentIntentId);
      } else {
        throw new Error(response.message || 'Payment confirmation failed');
      }
    } catch (error) {
      console.error('[支付流程] 支付确认失败:', error);
      throw error;
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
      {/* 已保存的支付方式 */}
      {existingPaymentMethods.length > 0 && (
        <div className={styles.savedPaymentMethods}>
          <h4>选择支付方式</h4>
          {existingPaymentMethods.map((method) => (
            <label key={method.id} className={styles.paymentMethodOption}>
              <input
                type="radio"
                name="paymentMethod"
                value={method.payment_method_id}
                checked={selectedPaymentMethod === method.payment_method_id}
                onChange={(e) => setSelectedPaymentMethod(e.target.value)}
              />
              <div className={styles.paymentMethodInfo}>
                <span className={styles.cardBrand}>{method.card_brand.toUpperCase()}</span>
                <span className={styles.cardNumber}>•••• {method.card_last4}</span>
                <span className={styles.cardExpiry}>
                  {method.card_exp_month.toString().padStart(2, '0')}/{method.card_exp_year}
                </span>
                {method.is_default && <span className={styles.defaultBadge}>默认</span>}
              </div>
            </label>
          ))}
          
          <label className={styles.paymentMethodOption}>
            <input
              type="radio"
              name="paymentMethod"
              value=""
              checked={selectedPaymentMethod === ""}
              onChange={(e) => setSelectedPaymentMethod(e.target.value)}
            />
            <div className={styles.paymentMethodInfo}>
              <span>使用新卡片</span>
            </div>
          </label>
        </div>
      )}

      {/* 新卡片输入 */}
      {(!selectedPaymentMethod || selectedPaymentMethod === "") && (
        <div className={styles.newCardSection}>
          <div className={styles.cardElement}>
            <CardElement options={cardElementOptions} />
          </div>
          
          <label className={styles.saveCardOption}>
            <input
              type="checkbox"
              checked={savePaymentMethod}
              onChange={(e) => setSavePaymentMethod(e.target.checked)}
            />
            <span>保存此卡片信息以便下次使用</span>
          </label>
        </div>
      )}
      
      {error && <div className={styles.errorMessage}>{error}</div>}
      
      <div className={styles.buttonGroup}>
        <button type="button" className={styles.cancelButton} onClick={onClose}>
          取消
        </button>
        <button 
          type="submit" 
          className={styles.submitButton}
          disabled={!stripe || isProcessing}
        >
          {isProcessing ? '处理中...' : `支付 $${tier.price}`}
        </button>
      </div>
    </form>
  );
};

const SmartPaymentModal: React.FC<SmartPaymentModalProps> = ({
  isOpen,
  onClose,
  tier,
  novelId,
  onPaymentSuccess,
  onPaymentError
}) => {
  const [existingPaymentMethods, setExistingPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      fetchPaymentMethods();
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const fetchPaymentMethods = async () => {
    setLoading(true);
    try {
      const response = await ApiService.request('/payment/stripe/payment-methods/1');
      
      if (response.success) {
        setExistingPaymentMethods((response as any).paymentMethods);
      }
    } catch (error) {
      console.error('获取支付方式失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentMethodSaved = () => {
    fetchPaymentMethods();
  };

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
              ${(Number(tier.price) || 0).toFixed(2)}{novelId === 0 ? '' : ' / month'}
            </div>
          </div>

          {loading ? (
            <div className={styles.loading}>加载支付方式中...</div>
          ) : (
            <Elements stripe={stripePromise}>
              <PaymentForm
                tier={tier}
                novelId={novelId}
                onPaymentSuccess={onPaymentSuccess}
                onPaymentError={onPaymentError}
                onClose={onClose}
                existingPaymentMethods={existingPaymentMethods}
                onPaymentMethodSaved={handlePaymentMethodSaved}
              />
            </Elements>
          )}

          <div className={styles.securityText}>
            By providing your bank card information, you agree to allow KongFuWorld Limited to charge your bank card for future payments according to their terms.
          </div>
        </div>
      </div>
    </div>
  );
};

export default SmartPaymentModal;
