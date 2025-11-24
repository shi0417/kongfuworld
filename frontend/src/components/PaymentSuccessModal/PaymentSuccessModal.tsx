import React from 'react';
import styles from './PaymentSuccessModal.module.css';

interface PaymentSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchaseDetails: {
    packageName: string;
    karmaAmount: number;
    bonusKarma: number;
    totalKarma: number;
    price: number;
    currency: string;
    paymentMethod: string;
    currentBalance: {
      goldenKarma: number;
      regularKarma: number;
    };
  };
}

const PaymentSuccessModal: React.FC<PaymentSuccessModalProps> = ({
  isOpen,
  onClose,
  purchaseDetails
}) => {
  if (!isOpen) return null;

  const {
    packageName,
    karmaAmount,
    bonusKarma,
    totalKarma,
    price,
    currency,
    paymentMethod,
    currentBalance
  } = purchaseDetails;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {/* Success icon and title */}
        <div className={styles.header}>
          <div className={styles.successIcon}>
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h2 className={styles.title}>Purchase Successful!</h2>
          <p className={styles.subtitle}>Your Golden Karma has been added</p>
        </div>

        {/* Purchase details card */}
        <div className={styles.purchaseCard}>
          <div className={styles.cardHeader}>
            <div className={styles.karmaIcon}>☯</div>
            <div className={styles.packageInfo}>
              <h3 className={styles.packageName}>{packageName}</h3>
              <div className={styles.karmaDetails}>
                <span className={styles.baseKarma}>{Number(karmaAmount).toLocaleString()} Golden Karma</span>
                {bonusKarma > 0 && (
                  <span className={styles.bonusKarma}>+ {Number(bonusKarma).toLocaleString()} Bonus</span>
                )}
              </div>
            </div>
          </div>
          
          <div className={styles.totalKarma}>
            <span className={styles.totalLabel}>Total Acquired:</span>
            <span className={styles.totalAmount}>{Number(totalKarma).toLocaleString()} Golden Karma</span>
          </div>
        </div>

        {/* Payment information */}
        <div className={styles.paymentInfo}>
          <div className={styles.paymentRow}>
            <span className={styles.label}>Payment Amount:</span>
            <span className={styles.amount}>{currency} ${Number(price).toFixed(2)}</span>
          </div>
          <div className={styles.paymentRow}>
            <span className={styles.label}>Payment Method:</span>
            <span className={styles.method}>
              {paymentMethod === 'stripe' ? '💳 Credit Card' : '💳 PayPal'}
            </span>
          </div>
        </div>

        {/* Account balance */}
        <div className={styles.balanceInfo}>
          <h4 className={styles.balanceTitle}>Current Account Balance</h4>
          <div className={styles.balanceRow}>
            <div className={styles.balanceItem}>
              <span className={styles.balanceIcon}>☯</span>
              <span className={styles.balanceLabel}>Golden Karma</span>
              <span className={styles.balanceAmount}>{Number(currentBalance.goldenKarma).toLocaleString()}</span>
            </div>
            <div className={styles.balanceItem}>
              <span className={styles.balanceIcon}>⚡</span>
              <span className={styles.balanceLabel}>Regular Karma</span>
              <span className={styles.balanceAmount}>{Number(currentBalance.regularKarma).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Benefits information */}
        <div className={styles.benefitsInfo}>
          <h4 className={styles.benefitsTitle}>Golden Karma Benefits</h4>
          <ul className={styles.benefitsList}>
            <li>✨ Unlock advanced chapter content</li>
            <li>🎁 Participate in exclusive member activities</li>
          </ul>
        </div>

        {/* Action buttons */}
        <div className={styles.actions}>
          <button className={styles.primaryButton} onClick={onClose}>
            Start Using
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccessModal;
