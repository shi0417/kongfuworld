import React, { useEffect, useState } from 'react';
import styles from './RewardNotification.module.css';

interface RewardNotificationProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'checkin' | 'mission' | 'purchase' | 'unlock';
  title: string;
  message: string;
  keysEarned?: number;
  karmaEarned?: number;
  additionalInfo?: string;
  autoClose?: boolean;
  autoCloseDelay?: number;
}

const RewardNotification: React.FC<RewardNotificationProps> = ({
  isOpen,
  onClose,
  type,
  title,
  message,
  keysEarned = 0,
  karmaEarned = 0,
  additionalInfo,
  autoClose = true,
  autoCloseDelay = 4000
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setIsAnimating(true);
      
      if (autoClose) {
        const timer = setTimeout(() => {
          handleClose();
        }, autoCloseDelay);
        
        return () => clearTimeout(timer);
      }
    }
  }, [isOpen, autoClose, autoCloseDelay]);

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(() => {
      setIsVisible(false);
      onClose();
    }, 300);
  };

  const getIcon = () => {
    switch (type) {
      case 'checkin':
        return (
          <div className={styles.iconContainer}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className={styles.icon}>
              <path 
                d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
            </svg>
          </div>
        );
      case 'mission':
        return (
          <div className={styles.iconContainer}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className={styles.icon}>
              <path 
                d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" 
                fill="currentColor"
              />
            </svg>
          </div>
        );
      case 'purchase':
        return (
          <div className={styles.iconContainer}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className={styles.icon}>
              <path 
                d="M7 4V2C7 1.45 7.45 1 8 1H16C16.55 1 17 1.45 17 2V4H20C20.55 4 21 4.45 21 5S20.55 6 20 6H19V19C19 20.1 18.1 21 17 21H7C5.9 21 5 20.1 5 19V6H4C3.45 6 3 5.55 3 5S3.45 4 4 4H7ZM9 3V4H15V3H9ZM7 6V19H17V6H7Z" 
                fill="currentColor"
              />
            </svg>
          </div>
        );
      case 'unlock':
        return (
          <div className={styles.iconContainer}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className={styles.icon}>
              <path 
                d="M12 1L3 5V11C3 16.55 6.84 21.74 12 23C17.16 21.74 21 16.55 21 11V5L12 1ZM10 17L5 12L6.41 10.59L10 14.17L17.59 6.58L19 8L10 17Z" 
                fill="currentColor"
              />
            </svg>
          </div>
        );
      default:
        return null;
    }
  };

  const getRewardText = () => {
    const rewards = [];
    if (keysEarned > 0) {
      rewards.push(`${keysEarned} Key${keysEarned > 1 ? 's' : ''}`);
    }
    if (karmaEarned > 0) {
      rewards.push(`${karmaEarned} Karma`);
    }
    return rewards.join(' + ');
  };

  if (!isVisible) return null;

  return (
    <div className={`${styles.overlay} ${isAnimating ? styles.visible : styles.hidden}`}>
      <div className={`${styles.notification} ${styles[type]}`}>
        <div className={styles.header}>
          {getIcon()}
          <div className={styles.headerContent}>
            <h2 className={styles.title}>{title}</h2>
            <p className={styles.message}>{message}</p>
          </div>
          <button className={styles.closeButton} onClick={handleClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path 
                d="M18 6L6 18M6 6L18 18" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
        
        {(keysEarned > 0 || karmaEarned > 0) && (
          <div className={styles.rewardSection}>
            <div className={styles.rewardIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path 
                  d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" 
                  fill="currentColor"
                />
              </svg>
            </div>
            <div className={styles.rewardContent}>
              <span className={styles.rewardLabel}>REWARD EARNED</span>
              <span className={styles.rewardAmount}>{getRewardText()}</span>
            </div>
          </div>
        )}
        
        {additionalInfo && (
          <div className={styles.additionalInfo}>
            <p>{additionalInfo}</p>
          </div>
        )}
        
        <div className={styles.footer}>
          <button className={styles.continueButton} onClick={handleClose}>
            CONTINUE
          </button>
        </div>
      </div>
    </div>
  );
};

export default RewardNotification;
