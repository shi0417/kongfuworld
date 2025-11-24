import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './InsufficientKeyModal.module.css';

interface InsufficientKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  requiredKeys: number;
  currentKeys: number;
}

const InsufficientKeyModal: React.FC<InsufficientKeyModalProps> = ({
  isOpen,
  onClose,
  requiredKeys,
  currentKeys
}) => {
  const navigate = useNavigate();

  const handleEarnKeys = () => {
    navigate('/user-center?tab=daily-rewards');
    onClose();
  };

  const handlePurchaseKeys = () => {
    navigate('/user-center?tab=keys');
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
          <h2 className={styles.title}>INSUFFICIENT KEYS</h2>
        </div>
        
        <div className={styles.content}>
          <div className={styles.message}>
            <p>Your Key balance is insufficient to unlock this chapter</p>
          </div>
          
          <div className={styles.balanceInfo}>
            <div className={styles.balanceItem}>
              <span className={styles.label}>REQUIRED:</span>
              <span className={styles.required}>{requiredKeys} Keys</span>
            </div>
            <div className={styles.balanceItem}>
              <span className={styles.label}>CURRENT:</span>
              <span className={styles.current}>{currentKeys} Keys</span>
            </div>
            <div className={styles.balanceItem}>
              <span className={styles.label}>NEEDED:</span>
              <span className={styles.missing}>{requiredKeys - currentKeys} Keys</span>
            </div>
          </div>
          
          <div className={styles.suggestion}>
            <p>💡 Earn Keys through daily rewards or purchase Key packages to unlock amazing chapters!</p>
          </div>
        </div>
        
        <div className={styles.actions}>
          <button 
            className={styles.earnButton}
            onClick={handleEarnKeys}
          >
            <span className={styles.buttonIcon}>🎁</span>
            Earn Keys
          </button>
          <button 
            className={styles.purchaseButton}
            onClick={handlePurchaseKeys}
          >
            <span className={styles.buttonIcon}>🛒</span>
            Buy Keys
          </button>
          <button 
            className={styles.closeButton}
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default InsufficientKeyModal;
