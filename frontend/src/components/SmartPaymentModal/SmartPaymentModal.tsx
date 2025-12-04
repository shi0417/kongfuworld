import React, { useState, useEffect } from 'react';
import {
  Elements,
  CardElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import { useAuth } from '../../hooks/useAuth';
import ApiService from '../../services/ApiService';
import { loadStripeFallback } from '../../utils/stripeFallback';
import styles from './SmartPaymentModal.module.css';

// 加载Stripe（带错误处理）
const STRIPE_PUBLISHABLE_KEY = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || 'pk_test_51SDjOuDYBCezccmeveA9cNQZ4xW1VCJfbGBzFU6xsid1eiuMzK8fQDufYr6FzIURXV4U7eHYoGFrUKGyc209tfVk00yzBXGlC0';
const stripePromise = loadStripeFallback(STRIPE_PUBLISHABLE_KEY);

interface PaymentMethod {
  id: string;
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
    basePrice?: number; // 原价（如果有促销）
    description: string;
    packageId?: number; // 添加packageId用于Karma购买
  };
  novelId: number;
  onPaymentSuccess: (orderId: string) => void;
  onPaymentError: (error: string) => void;
  promotion?: {
    discount_percentage: number;
    time_remaining_formatted: string;
  } | null;
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
  promotion?: SmartPaymentModalProps['promotion'];
}> = ({ tier, novelId, onPaymentSuccess, onPaymentError, onClose, existingPaymentMethods, onPaymentMethodSaved, promotion }) => {
  const { user } = useAuth();
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  const [savePaymentMethod, setSavePaymentMethod] = useState(false);
  const [cardholderName, setCardholderName] = useState('');

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

  // 保存支付方式的辅助函数
  const savePaymentMethodToServer = async (paymentMethod: any): Promise<void> => {
    try {
      const cardInfo = {
        brand: paymentMethod.card?.brand,
        last4: paymentMethod.card?.last4,
        exp_month: paymentMethod.card?.exp_month,
        exp_year: paymentMethod.card?.exp_year
      };

      console.log('[保存支付方式] 卡片信息:', cardInfo);
      console.log('[保存支付方式] PaymentMethod ID:', paymentMethod.id);

      const saveResponse = await ApiService.request('/payment/stripe/save-payment-method', {
        method: 'POST',
        body: JSON.stringify({
          userId: 1,
          paymentMethodId: paymentMethod.id,
          cardInfo: cardInfo
        })
      });

      if (!saveResponse.success) {
        throw new Error(`API error: ${saveResponse.message}`);
      }
      console.log('[保存支付方式] 结果:', saveResponse.data);

      if (saveResponse.success) {
        console.log('[保存支付方式] 成功');
        onPaymentMethodSaved();
      } else {
        console.error('[保存支付方式] 失败:', saveResponse.message);
      }
    } catch (saveError) {
      console.error('[保存支付方式] 请求失败:', saveError);
      // 不抛出错误，避免影响主流程
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
      if (selectedPaymentMethod) {
        // 使用已保存的支付方式
        console.log(`[支付流程] 使用已保存的支付方式: ${selectedPaymentMethod}`);
        
        // 根据novelId判断是Champion还是Karma购买
        const isKarmaPurchase = novelId === 0;
        const apiEndpoint = isKarmaPurchase ? '/karma/payment/stripe/create' : '/payment/stripe/create';
        
        const requestBody = isKarmaPurchase ? {
          userId: 1,
          packageId: tier.packageId || 1, // 从tier中获取packageId
          amount: tier.price,
          currency: 'usd',
          paymentMethod: 'stripe'
        } : {
          userId: 1,
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
        
        // 根据novelId判断是Champion还是Karma购买
        const isKarmaPurchase = novelId === 0;
        const apiEndpoint = isKarmaPurchase ? '/karma/payment/stripe/create' : '/payment/stripe/create';
        
        const requestBody = isKarmaPurchase ? {
          userId: user?.id,
          packageId: tier.packageId || 1,
          amount: tier.price,
          currency: 'usd',
          paymentMethod: 'stripe'
        } : {
          userId: user?.id,
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
            billing_details: {
              name: cardholderName.trim() || 'Cardholder'
            }
          }
        });

        if (stripeError) {
          console.error('[支付流程] Stripe支付错误:', stripeError);
          throw new Error(stripeError.message);
        }

        console.log(`[支付流程] Stripe支付结果: ${paymentIntent.status}`);

        if (paymentIntent.status === 'succeeded') {
          // 如果用户选择保存支付方式
          if (savePaymentMethod && paymentIntent.payment_method && typeof paymentIntent.payment_method === 'object') {
            console.log('[支付流程] 保存支付方式:', savePaymentMethod);
            await savePaymentMethodToServer(paymentIntent.payment_method);
          } else {
            console.log('[支付流程] 未保存支付方式 - savePaymentMethod:', savePaymentMethod, 'payment_method:', paymentIntent.payment_method);
          }

          // 支付成功，开始确认流程
          console.log('[支付流程] 支付成功，开始确认流程...');
          await confirmPayment(paymentIntent.id);
        } else {
          throw new Error('Payment not completed');
        }
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
          <div className={styles.formGroup}>
            <label htmlFor="cardholder-name" className={styles.fieldLabel}>
              Cardholder Name
            </label>
            <input
              id="cardholder-name"
              type="text"
              value={cardholderName}
              onChange={(e) => setCardholderName(e.target.value)}
              placeholder="Enter cardholder name"
              className={styles.inputField}
              disabled={isProcessing}
              required
            />
          </div>
          
          <div className={styles.formGroup}>
            <label className={styles.fieldLabel}>
              Card Details
            </label>
            <div className={styles.cardElement}>
              <CardElement options={cardElementOptions} />
            </div>
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
          {isProcessing ? 'Processing...' : `Pay $${(Number(tier.price) || 0).toFixed(2)}${promotion && tier.basePrice ? ` (${promotion.discount_percentage}% OFF)` : ''}`}
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
  onPaymentError,
  promotion
}) => {
  const [existingPaymentMethods, setExistingPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(false);
  const [stripeLoaded, setStripeLoaded] = useState<boolean | null>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      fetchPaymentMethods();
      // 检查 Stripe 是否加载成功
      stripePromise.then((stripe) => {
        setStripeLoaded(stripe !== null);
      }).catch(() => {
        setStripeLoaded(false);
      });
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
        setExistingPaymentMethods(response.data.paymentMethods);
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
              {promotion && tier.basePrice ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <span style={{ textDecoration: 'line-through', color: '#999', fontSize: '18px' }}>
                      ${(Number(tier.basePrice) || 0).toFixed(2)}
                    </span>
                    <span style={{ color: '#ff6b6b', fontWeight: 'bold', fontSize: '22px' }}>
                      ${(Number(tier.price) || 0).toFixed(2)}
                    </span>
                    <span style={{ 
                      background: '#ff6b6b', 
                      color: '#fff', 
                      padding: '2px 6px', 
                      borderRadius: '4px', 
                      fontSize: '0.75rem',
                      fontWeight: 'bold'
                    }}>
                      {promotion.discount_percentage}% OFF
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#ff6b6b', fontWeight: '500' }}>
                    ⏰ {promotion.time_remaining_formatted} remaining
                  </div>
                  <div style={{ fontSize: '14px', color: '#aaa', marginTop: '2px' }}>/ month</div>
                </div>
              ) : (
                <span>${(Number(tier.price) || 0).toFixed(2)} / month</span>
              )}
            </div>
          </div>

          {loading ? (
            <div className={styles.loading}>加载支付方式中...</div>
          ) : stripeLoaded === false ? (
            <div className={styles.errorMessage}>
              <p>Stripe 支付服务暂时不可用，请稍后重试或使用其他支付方式。</p>
              <button onClick={onClose} className={styles.cancelButton}>关闭</button>
            </div>
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
                promotion={promotion}
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
