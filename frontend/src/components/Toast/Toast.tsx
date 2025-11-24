import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './Toast.module.css';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ 
  message, 
  type = 'success', 
  duration = 3000,
  onClose 
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // 触发显示动画
    setIsVisible(true);

    // 自动关闭
    const timer = setTimeout(() => {
      setIsVisible(false);
      // 等待动画完成后再调用onClose
      setTimeout(() => {
        onClose();
      }, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  // 使用Portal将Toast渲染到body，避免被父容器遮挡
  return createPortal(
    <div className={`${styles.toast} ${styles[type]} ${isVisible ? styles.show : styles.hide}`}>
      <div className={styles.icon}>
        {type === 'success' && '✓'}
        {type === 'error' && '✕'}
        {type === 'info' && 'ℹ'}
        {type === 'warning' && '⚠'}
      </div>
      <span className={styles.message}>{message}</span>
    </div>,
    document.body
  );
};

export default Toast;

