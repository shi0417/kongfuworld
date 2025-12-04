import React, { useState } from 'react';
import styles from './PaymentModal.module.css';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  tier: {
    level: number;
    name: string;
    price: number;
    basePrice?: number; // 原价（如果有促销）
    advanceChapters: number;
    description: string;
  };
  novelTitle: string;
  onConfirm: (paymentMethod: string) => void;
  promotion?: {
    discount_percentage: number;
    time_remaining_formatted: string;
  } | null;
}

const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  tier,
  novelTitle,
  onConfirm,
  promotion
}) => {
  const [paymentMethod, setPaymentMethod] = useState('stripe');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (agreedToTerms) {
      onConfirm(paymentMethod);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>Confirm</h2>
          <button className={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>

        {/* Subscription Details */}
        <div className={styles.subscriptionDetails}>
          <p className={styles.planText}>
            You have selected the plan <strong>{tier.name}</strong>.
          </p>
          <p className={styles.billingText}>
            {promotion && tier.basePrice ? (
              <div>
                <span style={{ textDecoration: 'line-through', color: '#999', marginRight: '8px' }}>
                  ${(Number(tier.basePrice) || 0).toFixed(2)}
                </span>
                <span style={{ color: '#ff6b6b', fontWeight: 'bold' }}>
                  ${(Number(tier.price) || 0).toFixed(2)}
                </span>
                <span style={{ 
                  background: '#ff6b6b', 
                  color: '#fff', 
                  padding: '2px 6px', 
                  borderRadius: '4px', 
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  marginLeft: '8px'
                }}>
                  {promotion.discount_percentage}% OFF
                </span>
                <div style={{ fontSize: '0.75rem', color: '#ff6b6b', marginTop: '4px' }}>
                  ⏰ {promotion.time_remaining_formatted} remaining
                </div>
                <div style={{ marginTop: '4px' }}>
                  You will be charged <strong>${(Number(tier.price) || 0).toFixed(2)}</strong> USD monthly until cancellation.
                </div>
              </div>
            ) : (
              `You will be charged ${(Number(tier.price) || 0).toFixed(2)} USD monthly until cancellation.`
            )}
          </p>
          <label className={styles.termsLabel}>
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className={styles.checkbox}
            />
            I acknowledge that I have read and accept the{' '}
            <button type="button" className={styles.refundLink}>refund policy</button>.
          </label>
        </div>

        {/* Order Summary */}
        <div className={styles.orderSummary}>
          <h3 className={styles.summaryTitle}>{novelTitle}</h3>
          <div className={styles.summaryItem}>
            <span className={styles.itemText}>
              1 × {novelTitle} {promotion && tier.basePrice ? (
                <span>
                  (at <span style={{ textDecoration: 'line-through', color: '#999' }}>${(Number(tier.basePrice) || 0).toFixed(2)}</span>{' '}
                  <span style={{ color: '#ff6b6b', fontWeight: 'bold' }}>${(Number(tier.price) || 0).toFixed(2)}</span> / month)
                </span>
              ) : (
                `(at ${(Number(tier.price) || 0).toFixed(2)} / month)`
              )}
            </span>
            <span className={styles.itemPrice}>
              {promotion && tier.basePrice ? (
                <div>
                  <span style={{ textDecoration: 'line-through', color: '#999', fontSize: '0.9rem', marginRight: '8px' }}>
                    ${(Number(tier.basePrice) || 0).toFixed(2)}
                  </span>
                  <span style={{ color: '#ff6b6b', fontWeight: 'bold' }}>
                    ${(Number(tier.price) || 0).toFixed(2)}
                  </span>
                </div>
              ) : (
                `$${(Number(tier.price) || 0).toFixed(2)}`
              )}
            </span>
          </div>
          <div className={styles.totalRow}>
            <span className={styles.totalLabel}>Total</span>
            <span className={styles.totalPrice}>
              {promotion && tier.basePrice ? (
                <div>
                  <span style={{ textDecoration: 'line-through', color: '#999', fontSize: '0.9rem', marginRight: '8px' }}>
                    ${(Number(tier.basePrice) || 0).toFixed(2)}
                  </span>
                  <span style={{ color: '#ff6b6b', fontWeight: 'bold' }}>
                    ${(Number(tier.price) || 0).toFixed(2)}
                  </span>
                </div>
              ) : (
                `$${(Number(tier.price) || 0).toFixed(2)}`
              )}
            </span>
          </div>
        </div>

        {/* Payment Methods */}
        <div className={styles.paymentMethods}>
          <h3 className={styles.paymentTitle}>Payment Methods</h3>
          
          <div className={styles.paymentOptions}>
            <div 
              className={`${styles.paymentOption} ${paymentMethod === 'stripe' ? styles.selected : ''}`}
              onClick={() => setPaymentMethod('stripe')}
            >
              <div className={styles.paymentInfo}>
                <span className={styles.paymentLogo}>stripe</span>
                <span className={styles.paymentText}>Add new card</span>
              </div>
              <div className={`${styles.radioButton} ${paymentMethod === 'stripe' ? styles.checked : ''}`}>
                {paymentMethod === 'stripe' && <span className={styles.checkmark}>✓</span>}
              </div>
            </div>

            <div 
              className={`${styles.paymentOption} ${paymentMethod === 'paypal' ? styles.selected : ''}`}
              onClick={() => setPaymentMethod('paypal')}
            >
              <div className={styles.paymentInfo}>
                <span className={styles.paymentLogo}>PayPal</span>
                <span className={styles.paymentText}>Pay with PayPal</span>
              </div>
              <div className={`${styles.radioButton} ${paymentMethod === 'paypal' ? styles.checked : ''}`}>
                {paymentMethod === 'paypal' && <span className={styles.checkmark}>✓</span>}
              </div>
            </div>
          </div>

          <button type="button" className={styles.addCardLink}>Add new card</button>
          <p className={styles.securityText}>
            Secure checkout experience provided by Stripe or PayPal. No payment method information is stored on KongFuWorld.
          </p>
        </div>

        {/* Action Buttons */}
        <div className={styles.actionButtons}>
          <button className={styles.cancelButton} onClick={onClose}>
            Cancel
          </button>
          <button 
            className={`${styles.confirmButton} ${!agreedToTerms ? styles.disabled : ''}`}
            onClick={handleConfirm}
            disabled={!agreedToTerms}
          >
            Yes
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
