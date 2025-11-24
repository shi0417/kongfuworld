import React, { useState, useEffect } from 'react';
import styles from './BotDetection.module.css';

interface BotDetectionProps {
  onSuccess?: () => void;
  onError?: () => void;
  onComplete?: (isHuman: boolean) => void;
}

const BotDetection: React.FC<BotDetectionProps> = ({
  onSuccess,
  onError,
  onComplete
}) => {
  const [isDetecting, setIsDetecting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isError, setIsError] = useState(false);
  const [detectionTime, setDetectionTime] = useState(0);

  useEffect(() => {
    // 模拟机器人检测过程
    const startDetection = () => {
      setIsDetecting(true);
      setIsSuccess(false);
      setIsError(false);
      setDetectionTime(0);

      // 模拟检测时间（1-3秒）
      const detectionDuration = Math.random() * 2000 + 1000;
      
      const timer = setInterval(() => {
        setDetectionTime(prev => {
          const newTime = prev + 100;
          if (newTime >= detectionDuration) {
            clearInterval(timer);
            // 使用setTimeout避免在渲染过程中更新状态
            setTimeout(() => {
              setIsDetecting(false);
              
              // 90% 概率通过检测
              const isHuman = Math.random() > 0.1;
              
              if (isHuman) {
                setIsSuccess(true);
                onSuccess?.();
              } else {
                setIsError(true);
                onError?.();
              }
              
              onComplete?.(isHuman);
            }, 0);
            return detectionDuration;
          }
          return newTime;
        });
      }, 100);
    };

    // 自动开始检测
    startDetection();
  }, []);

  const handleRetry = () => {
    setIsSuccess(false);
    setIsError(false);
    setIsDetecting(false);
    setDetectionTime(0);
    
    // 重新开始检测
    setTimeout(() => {
      const startDetection = () => {
        setIsDetecting(true);
        const detectionDuration = Math.random() * 2000 + 1000;
        
        const timer = setInterval(() => {
          setDetectionTime(prev => {
            const newTime = prev + 100;
            if (newTime >= detectionDuration) {
              clearInterval(timer);
              completeDetection();
              return detectionDuration;
            }
            return newTime;
          });
        }, 100);

        const completeDetection = () => {
          setIsDetecting(false);
          const isHuman = Math.random() > 0.1;
          
          if (isHuman) {
            setIsSuccess(true);
            onSuccess?.();
          } else {
            setIsError(true);
            onError?.();
          }
          
          onComplete?.(isHuman);
        };
      };
      
      startDetection();
    }, 500);
  };

  return (
    <div className={styles.botDetection}>
      {isDetecting && (
        <div className={styles.detecting}>
          <div className={styles.spinner}></div>
          <div className={styles.detectingText}>
            <div>Detecting human behavior...</div>
            <div className={styles.progress}>
              {Math.round((detectionTime / 2000) * 100)}%
            </div>
          </div>
        </div>
      )}

      {isSuccess && (
        <div className={styles.success}>
          <div className={styles.checkmark}>✓</div>
          <div className={styles.successText}>
            <div>Success!</div>
            <div className={styles.cloudflare}>
              <div className={styles.cloudflareLogo}>CLOUDFLARE</div>
              <div className={styles.cloudflareText}>Protect • Optimize</div>
            </div>
          </div>
        </div>
      )}

      {isError && (
        <div className={styles.error}>
          <div className={styles.errorIcon}>⚠</div>
          <div className={styles.errorText}>
            <div>Bot detected. Please try again.</div>
            <button 
              className={styles.retryButton}
              onClick={handleRetry}
            >
              Retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BotDetection;
