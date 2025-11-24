import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './InsufficientKarmaModal.module.css';

interface InsufficientKarmaModalProps {
  isOpen: boolean;
  onClose: () => void;
  requiredKarma: number;
  currentKarma: number;
}

const InsufficientKarmaModal: React.FC<InsufficientKarmaModalProps> = ({
  isOpen,
  onClose,
  requiredKarma,
  currentKarma
}) => {
  const navigate = useNavigate();

  const handlePurchaseKarma = () => {
    navigate('/user-center?tab=karma');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.icon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path 
                d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" 
                fill="currentColor"
              />
            </svg>
          </div>
          <h2 className={styles.title}>INSUFFICIENT KARMA</h2>
        </div>
        
        <div className={styles.content}>
          <div className={styles.message}>
            <p>Your Golden Karma balance is insufficient to unlock this chapter</p>
          </div>
          
          <div className={styles.balanceInfo}>
            <div className={styles.balanceItem}>
              <span className={styles.label}>REQUIRED:</span>
              <span className={styles.required}>{requiredKarma} Golden Karma</span>
            </div>
            <div className={styles.balanceItem}>
              <span className={styles.label}>CURRENT:</span>
              <span className={styles.current}>{currentKarma} Golden Karma</span>
            </div>
            <div className={styles.balanceItem}>
              <span className={styles.label}>NEEDED:</span>
              <span className={styles.missing}>{requiredKarma - currentKarma} Golden Karma</span>
            </div>
          </div>
          
          <div className={styles.suggestion}>
            <p>💡 Purchase Karma packages to get more Golden Karma and unlock amazing chapters!</p>
          </div>
        </div>
        
        <div className={styles.actions}>
          <button 
            className={styles.cancelButton}
            onClick={onClose}
          >
            CANCEL
          </button>
          <button 
            className={styles.purchaseButton}
            onClick={handlePurchaseKarma}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={styles.buttonIcon}>
              <path 
                d="M7 4V2C7 1.45 7.45 1 8 1H16C16.55 1 17 1.45 17 2V4H20C20.55 4 21 4.45 21 5S20.55 6 20 6H19V19C19 20.1 18.1 21 17 21H7C5.9 21 5 20.1 5 19V6H4C3.45 6 3 5.55 3 5S3.45 4 4 4H7ZM9 3V4H15V3H9ZM7 6V19H17V6H7Z" 
                fill="currentColor"
              />
            </svg>
            PURCHASE KARMA
          </button>
        </div>
      </div>
    </div>
  );
};

export default InsufficientKarmaModal;
