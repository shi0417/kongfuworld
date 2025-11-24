import React, { useState, useEffect } from 'react';
import { loadStripeFallback } from '../../utils/stripeFallback';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useAuth, useUser } from '../../hooks/useAuth';
import ApiService from '../../services/ApiService';
import styles from './KarmaPaymentModal.module.css';

interface KarmaPackage {
  id: number;
  package_name: string;
  karma_amount: number;
  price: number;
  currency: string;
  karma_type: string;
  bonus_karma: number;
  bonus_percentage: number;
  description: string;
}

interface KarmaPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  package: KarmaPackage;
  onPaymentSuccess: (orderId: string) => void;
  onPaymentError: (error: string) => void;
}

// Stripe Elements component
const StripePaymentForm: React.FC<{
  package: KarmaPackage;
  onPaymentSuccess: (orderId: string) => void;
  onPaymentError: (error: string) => void;
  onClose: () => void;
  authUser?: any;
  userData?: any;
}> = ({ package: pkg, onPaymentSuccess, onPaymentError, onClose, authUser, userData }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardholderName, setCardholderName] = useState('');

  const handleStripePayment = async () => {
    if (!stripe || !elements) {
      onPaymentError('Stripe not initialized');
      return;
    }

    setIsProcessing(true);
    try {
      const user = authUser || userData;
      const userId = user?.id || 1;

      // Create Stripe payment intent
      const result = await ApiService.post('/karma/payment/stripe/create', {
        userId: userId,
        packageId: pkg.id,
        amount: pkg.price,
        currency: pkg.currency,
        paymentMethod: 'stripe'
      });

      if (result.success && (result as any).clientSecret) {
        // Confirm payment with Stripe Elements
        const { error, paymentIntent } = await stripe.confirmCardPayment((result as any).clientSecret, {
          payment_method: {
            card: elements.getElement(CardElement)!,
            billing_details: {
              name: cardholderName.trim() || 'Cardholder'
            }
          }
        });

        if (error) {
          throw new Error(error.message);
        }

        if (paymentIntent && paymentIntent.status === 'succeeded') {
          // Call backend confirmation API
          const confirmResponse = await ApiService.request('/karma/payment/stripe/confirm', {
            method: 'POST',
            body: JSON.stringify({ paymentIntentId: (result as any).paymentIntentId })
          });
          
          if (confirmResponse.success) {
            onPaymentSuccess((result as any).paymentIntentId || '');
          } else {
            throw new Error(confirmResponse.message || 'Stripe payment confirmation failed');
          }
        } else {
          throw new Error('Payment not completed');
        }
      } else {
        throw new Error(result.message || 'Stripe payment creation failed');
      }
    } catch (error) {
      onPaymentError(error instanceof Error ? error.message : 'Payment failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#ffffff', // White text
        backgroundColor: '#2a2a2a', // Dark background
        '::placeholder': {
          color: '#cccccc', // Light gray placeholder
        },
        '::selection': {
          backgroundColor: '#667eea', // Selection background color
        },
      },
      invalid: {
        color: '#ff6b6b', // Red error text
        backgroundColor: '#2a2a2a',
      },
      complete: {
        color: '#4caf50', // Green completion text
        backgroundColor: '#2a2a2a',
      },
    },
  };

  return (
    <div className={styles.stripeForm}>
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>Cardholder Name</label>
        <input
          type="text"
          value={cardholderName}
          onChange={(e) => setCardholderName(e.target.value)}
          placeholder="Enter cardholder name"
          className={styles.formInput}
          required
        />
      </div>
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>Card Number</label>
        <div className={styles.cardElement}>
          <CardElement options={cardElementOptions} />
        </div>
      </div>
      <div className={styles.buttonGroup}>
        <button type="button" onClick={onClose} className={styles.cancelButton}>
          Cancel
        </button>
        <button 
          type="button" 
          onClick={handleStripePayment} 
          disabled={!stripe || isProcessing || !cardholderName.trim()}
          className={styles.payButton}
        >
          {isProcessing ? 'Processing...' : `Pay $${pkg.price}`}
        </button>
      </div>
    </div>
  );
};

const KarmaPaymentModal: React.FC<KarmaPaymentModalProps> = ({
  isOpen,
  onClose,
  package: pkg,
  onPaymentSuccess,
  onPaymentError
}) => {
  const { isAuthenticated, user: authUser } = useAuth();
  const { user: userData } = useUser();
  const [paymentMethod, setPaymentMethod] = useState<'paypal' | 'stripe'>('paypal');
  const [stripePromise, setStripePromise] = useState<any>(null);

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

  // Initialize Stripe with fallback
  useEffect(() => {
    const initStripe = async () => {
      const stripe = await loadStripeFallback('pk_test_51SDjOuDYBCezccmeveA9cNQZ4xW1VCJfbGBzFU6xsid1eiuMzK8fQDufYr6FzIURXV4U7eHYoGFrUKGyc209tfVk00yzBXGlC0');
      setStripePromise(stripe);
    };
    initStripe();
  }, []);

  const handlePayPalPayment = async () => {
    try {
      const user = authUser || userData;
      const userId = user?.id || 1;

      const response = await ApiService.request('/karma/payment/paypal/create', {
        method: 'POST',
        body: JSON.stringify({
          userId: userId,
          packageId: pkg.id,
          amount: pkg.price,
          currency: pkg.currency,
          paymentMethod: 'paypal'
        })
      });
      
      if (response.success) {
        // 直接使用后端返回的approvalUrl
        if ((response as any).approvalUrl) {
          window.location.href = (response as any).approvalUrl;
        } else {
          throw new Error('PayPal approval URL not found');
        }
      } else {
        throw new Error(response.message || 'PayPal payment creation failed');
      }
    } catch (error) {
      onPaymentError(error instanceof Error ? error.message : 'Payment failed');
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>Purchase Golden Karma</h2>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>

        <div className={styles.packageInfo}>
          <div className={styles.packageCard}>
            <h3>{pkg.package_name}</h3>
            <div className={styles.karmaInfo}>
              <span className={styles.karmaAmount}>{pkg.karma_amount.toLocaleString()} Golden Karma</span>
              {pkg.bonus_karma > 0 && (
                <span className={styles.bonus}>+{pkg.bonus_karma} Bonus</span>
              )}
            </div>
            <div className={styles.price}>${pkg.price}</div>
            {pkg.bonus_percentage > 0 && (
              <div className={styles.bonusText}>
                Most popular choice with {pkg.bonus_percentage}% bonus
              </div>
            )}
          </div>
        </div>

        <div className={styles.paymentSection}>
          <h4>Select Payment Method</h4>
          <div className={styles.paymentMethods}>
            <label className={styles.paymentOption}>
              <input
                type="radio"
                name="paymentMethod"
                value="paypal"
                checked={paymentMethod === 'paypal'}
                onChange={(e) => setPaymentMethod(e.target.value as 'paypal' | 'stripe')}
              />
              <span>PayPal - Pay with PayPal</span>
            </label>
            <label className={styles.paymentOption}>
              <input
                type="radio"
                name="paymentMethod"
                value="stripe"
                checked={paymentMethod === 'stripe'}
                onChange={(e) => setPaymentMethod(e.target.value as 'paypal' | 'stripe')}
              />
              <span>Stripe - Pay with Credit Card</span>
            </label>
          </div>
        </div>

        <div className={styles.orderSummary}>
          <div className={styles.summaryItem}>
            <span>Package:</span>
            <span>{pkg.package_name}</span>
          </div>
          <div className={styles.summaryItem}>
            <span>Golden Karma:</span>
            <span>{pkg.karma_amount}</span>
          </div>
          <div className={styles.summaryItem}>
            <span>Price:</span>
            <span>${pkg.price}</span>
          </div>
        </div>

        {paymentMethod === 'paypal' ? (
          <div className={styles.buttonGroup}>
            <button type="button" onClick={onClose} className={styles.cancelButton}>
              Cancel
            </button>
            <button type="button" onClick={handlePayPalPayment} className={styles.payButton}>
              Pay ${pkg.price}
            </button>
          </div>
        ) : (
          stripePromise ? (
            <Elements stripe={stripePromise}>
              <StripePaymentForm
                package={pkg}
                onPaymentSuccess={onPaymentSuccess}
                onPaymentError={onPaymentError}
                onClose={onClose}
                authUser={authUser}
                userData={userData}
              />
            </Elements>
          ) : (
            <div className={styles.loading}>Loading Stripe...</div>
          )
        )}

        <div className={styles.securityText}>
          Secure payment, supports PayPal and Stripe. Your payment information will be processed securely.
        </div>
      </div>
    </div>
  );
};

export default KarmaPaymentModal;