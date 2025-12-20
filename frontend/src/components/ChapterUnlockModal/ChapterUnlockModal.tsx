import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './ChapterUnlockModal.module.css';
import InsufficientKarmaModal from '../InsufficientKarmaModal/InsufficientKarmaModal';
import InsufficientKeyModal from '../InsufficientKeyModal/InsufficientKeyModal';
import ApiService from '../../services/ApiService';

interface ChapterUnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  chapterId: number;
  novelId: number;
  userId: number;
  onUnlockSuccess: () => void;
}

interface UnlockStatus {
  chapterId: number;
  novelTitle: string;
  chapterNumber: number;
  isPremium: boolean;
  keyCost: number;
  unlockPrice: number;
  final_unlock_price?: number; // 最终价格（包含促销折扣）
  isUnlocked: boolean;
  unlockMethod: string | null;
  userKeyBalance: number;
  userKarmaBalance: number;
  canUnlockWithKey: boolean;
  canUnlockWithKarma: boolean;
  hasChampionSubscription: boolean;
  timeUnlock?: {
    status: string;
    unlockAt: string;
    timeRemaining: number;
    countdown: {
      total_ms: number;
      hours: number;
      minutes: number;
      seconds: number;
      formatted: string;
      is_expired: boolean;
    };
  };
  promotion?: {
    id: number;
    promotion_type: string;
    discount_value: number;
    discount_percentage: number; // 折扣百分比，如70表示70% off
    base_price: number;
    discounted_price: number;
    start_at: string;
    end_at: string;
    time_remaining: number;
    time_remaining_formatted: string;
  } | null;
}

const ChapterUnlockModal: React.FC<ChapterUnlockModalProps> = ({
  isOpen,
  onClose,
  chapterId,
  novelId,
  userId,
  onUnlockSuccess
}) => {
  const navigate = useNavigate();
  const [unlockStatus, setUnlockStatus] = useState<UnlockStatus | null>(null);
  const [showInsufficientKarmaModal, setShowInsufficientKarmaModal] = useState(false);
  const [showInsufficientKeyModal, setShowInsufficientKeyModal] = useState(false);
  const [karmaInfo, setKarmaInfo] = useState({ required: 0, current: 0 });
  const [keyInfo, setKeyInfo] = useState({ required: 0, current: 0 });
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [timeUntilFree, setTimeUntilFree] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false); // Prevent duplicate refresh
  const [promotionTimeRemaining, setPromotionTimeRemaining] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && chapterId && userId) {
      fetchUnlockStatus();
    }
  }, [isOpen, chapterId, userId]);

  // 更新促销倒计时
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isOpen && unlockStatus?.promotion) {
      const updatePromotionTime = () => {
        const now = new Date();
        const endAt = new Date(unlockStatus.promotion!.end_at);
        const timeRemaining = endAt.getTime() - now.getTime();
        
        if (timeRemaining > 0) {
          const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
          const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);
          setPromotionTimeRemaining(`${hours}h:${minutes.toString().padStart(2, '0')}m:${seconds.toString().padStart(2, '0')}s`);
        } else {
          setPromotionTimeRemaining('00h:00m:00s');
          // 促销已过期，刷新状态
          fetchUnlockStatus();
        }
      };
      
      // 立即执行一次
      updatePromotionTime();
      
      // 每秒更新一次
      interval = setInterval(updatePromotionTime, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOpen, unlockStatus?.promotion]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    let hasCalledRefresh = false; // Prevent duplicate status refresh calls
    
    if (isOpen && unlockStatus) {
      // Execute immediately once
      updateTimeUntilFree();
      
      // Only start timer for real time unlock
      if (unlockStatus?.timeUnlock && !unlockStatus?.isUnlocked) {
        // Update every second
        interval = setInterval(() => {
          // Check if already unlocked, stop timer if unlocked
          if (unlockStatus?.isUnlocked) {
            console.log('✅ Chapter unlocked, stopping countdown');
            clearInterval(interval);
            return;
          }
          
          updateTimeUntilFree();
        }, 1000);
      }
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOpen, unlockStatus]);

  const fetchUnlockStatus = async () => {
    // Prevent duplicate calls
    if (isRefreshing) {
      console.log('⏳ Refreshing status, skipping duplicate call');
      return;
    }
    
    setIsRefreshing(true);
    setLoading(true);
    try {
      console.log('🔍 Starting to fetch unlock status:', { chapterId, userId });
      const response = await ApiService.request(`/chapter-unlock/status/${chapterId}/${userId}`);
      console.log('📡 API response status:', response.success);
      
      if (!response.success) {
        throw new Error(`API error: ${response.message}`);
      }
      
      console.log('📊 Unlock status data:', response.data);
      
      if (response.success) {
        setUnlockStatus(response.data);
        console.log('✅ Unlock status set successfully');
        
        // If chapter is unlocked, trigger success callback
        if (response.data.isUnlocked) {
          console.log('🎉 Chapter unlocked, triggering success callback');
          setTimeout(() => {
            onUnlockSuccess();
          }, 1000); // Close modal after 1 second delay
        }
      } else {
        console.error('❌ API returned failure:', response.message);
      }
    } catch (error) {
      console.error('❌ Failed to fetch unlock status:', error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const updateTimeUntilFree = () => {
    // Use backend returned time unlock information
    if (unlockStatus?.timeUnlock && !unlockStatus?.isUnlocked) {
      const timeUnlock = unlockStatus.timeUnlock;
      const now = new Date();
      const unlockAt = new Date(timeUnlock.unlockAt);
      const timeRemaining = unlockAt.getTime() - now.getTime();
      
      if (timeRemaining > 0) {
        const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
        const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);
        setTimeUntilFree(`${hours.toString().padStart(2, '0')}h:${minutes.toString().padStart(2, '0')}m:${seconds.toString().padStart(2, '0')}s`);
      } else {
        // Time has arrived, show 00:00:00
        setTimeUntilFree("00h:00m:00s");
        // Refresh status to check if unlocked
        console.log('⏰ Time unlock expired, refreshing status...');
        fetchUnlockStatus();
      }
    } else {
      // For other cases, show fixed time
      setTimeUntilFree("23h:00m:00s");
    }
  };

  const handleUnlockWithKey = async () => {
    setActionLoading('key');
    try {
      const response = await ApiService.request(`/chapter-unlock/unlock-with-key/${chapterId}/${userId}`, {
        method: 'POST'
      });
      
      if (response.success) {
        console.log('✅ Key unlock successful');
        onUnlockSuccess();
      } else {
        console.error('❌ Key unlock failed:', response.message);
        
        // Check if it's insufficient Key balance
        if (response.message && response.message.includes('Insufficient Key balance')) {
          // Extract key information from error message
          const requiredMatch = response.message.match(/Required: (\d+) Keys/);
          const currentMatch = response.message.match(/Current balance: (\d+) Keys/);
          
          if (requiredMatch && currentMatch) {
            const required = parseInt(requiredMatch[1]);
            const current = parseInt(currentMatch[1]);
            
            setKeyInfo({ required, current });
            setShowInsufficientKeyModal(true);
          } else {
            // Fallback to navigation if parsing fails
            console.log('🔑 Insufficient key balance, navigating to daily rewards page');
            navigate('/user-center?tab=daily-rewards');
            onClose();
          }
        } else {
          // Show other error messages
          alert('Unlock failed: ' + response.message);
        }
      }
    } catch (error) {
      console.error('❌ Key unlock failed:', error);
      alert('Unlock failed, please try again later');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBuyWithKarma = async () => {
    setActionLoading('karma');
    try {
      const response = await ApiService.request(`/chapter-unlock/unlock-with-karma/${chapterId}/${userId}`, {
        method: 'POST'
      });
      
      if (response.success) {
        console.log('✅ Karma purchase successful');
        onUnlockSuccess();
      } else {
        console.error('❌ Karma purchase failed:', response.message);
        
        // Check if it's insufficient Karma balance
        if (response.message && response.message.includes('Insufficient Golden Karma balance')) {
          // Extract karma information from error message
          const requiredMatch = response.message.match(/Required: (\d+) Golden Karma/);
          const currentMatch = response.message.match(/Current balance: (\d+) Golden Karma/);
          
          if (requiredMatch && currentMatch) {
            const required = parseInt(requiredMatch[1]);
            const current = parseInt(currentMatch[1]);
            
            setKarmaInfo({ required, current });
            setShowInsufficientKarmaModal(true);
          } else {
            // Fallback to navigation if parsing fails
            console.log('💰 Insufficient karma balance, navigating to purchase page');
            navigate('/user-center?tab=karma');
            onClose();
          }
        } else {
          // Show other error messages
          alert('Purchase failed: ' + response.message);
        }
      }
    } catch (error) {
      console.error('❌ Karma purchase failed:', error);
      alert('Purchase failed, please try again later');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSubscribe = () => {
    // 只负责“跳转 + 意图表达”，不在这里做 Champion 状态判断，也不调用 Champion API
    navigate(`/book/${novelId}?tab=champion`);
  };

  if (!isOpen) return null;

  return (
    <div className={styles.unlockWindowContainer}>
      <div className={styles.unlockWindowContent}>
        {loading ? (
          <div className={styles.loading}>
            <div className={styles.spinner}></div>
            <p>Loading...</p>
          </div>
        ) : unlockStatus ? (
          <div className={styles.unlockContainer}>
            {/* Time unlock section */}
            <div className={styles.timeUnlockSection}>
              <div className={styles.clockIcon}>
                <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                  <circle cx="40" cy="40" r="35" fill="#4A90E2" stroke="#6BB6FF" strokeWidth="2"/>
                  <circle cx="40" cy="40" r="25" fill="#87CEEB" opacity="0.3"/>
                  <path d="M40 20 L40 40 L50 50" stroke="white" strokeWidth="3" strokeLinecap="round"/>
                  <circle cx="40" cy="40" r="3" fill="white"/>
                </svg>
              </div>
              <div className={styles.timeInfo}>
                <h2>Time Until Free Chapter</h2>
                <div className={styles.helpIcon}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path fillRule="evenodd" clipRule="evenodd" d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14ZM7.25 4.75a.75.75 0 0 1 1.5 0v.5a.25.25 0 0 0 .5 0 .75.75 0 0 1 1.5 0 1.75 1.75 0 0 1-3.5 0v-.5ZM8 12a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"></path>
                  </svg>
                </div>
                <div className={styles.countdown}>
                  {timeUntilFree || "22h:50m:50s"}
                </div>
              </div>
            </div>

            {/* Key unlock */}
            <button 
              className={styles.keyUnlockButton}
              onClick={handleUnlockWithKey}
              disabled={actionLoading === 'key'}
            >
              <div className={styles.buttonIcon}>🔑</div>
              <div className={styles.buttonText}>
                <span className={styles.buttonTitle}>Key Unlock</span>
                <span className={styles.buttonCost}>1 Key per chapter</span>
              </div>
              <div className={styles.buttonAction}>
                {actionLoading === 'key' ? 'Unlocking...' : 'Unlock Now'}
              </div>
            </button>

            {/* Karma purchase */}
            <button 
              className={styles.karmaUnlockButton}
              onClick={handleBuyWithKarma}
              disabled={actionLoading === 'karma'}
            >
              <div className={styles.buttonIcon}>💎</div>
              <div className={styles.buttonText}>
                <span className={styles.buttonTitle}>Karma Unlock</span>
                <div className={styles.buttonCost}>
                  {unlockStatus?.promotion ? (
                    <div className={styles.promotionPrice}>
                      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <span className={styles.originalPrice}>
                          {unlockStatus.promotion.base_price} Karma
                        </span>
                        <span className={styles.discountedPrice}>
                          {unlockStatus.promotion.discounted_price} Karma
                        </span>
                        <span className={styles.discountBadge}>
                          {unlockStatus.promotion.discount_percentage}% OFF
                        </span>
                      </div>
                      <div className={styles.promotionTime}>
                        ⏰ {promotionTimeRemaining || unlockStatus.promotion.time_remaining_formatted} remaining
                      </div>
                    </div>
                  ) : (
                    <span>{unlockStatus?.final_unlock_price || unlockStatus?.unlockPrice || 10} Karma per chapter</span>
                  )}
                </div>
              </div>
              <div className={styles.buttonAction}>
                {actionLoading === 'karma' ? 'Purchasing...' : 'Permanent Purchase'}
              </div>
            </button>

            {/* Champion subscription */}
            <button className={styles.championUnlockButton} onClick={handleSubscribe}>
              <div className={styles.buttonIcon}>🏅</div>
              <div className={styles.buttonText}>
                <span className={styles.buttonTitle}>Champion Subscription</span>
                <span className={styles.buttonCost}>Unlock all chapters</span>
              </div>
              <div className={styles.buttonAction}>Subscribe Now</div>
            </button>

            {/* Auto unlock settings */}
            <div className={styles.autoUnlockSection}>
              <input type="checkbox" name="auto-unlock" id="auto-unlock" className={styles.autoUnlockCheckbox} />
              <label htmlFor="auto-unlock">Enable Auto Unlock</label>
            </div>
          </div>
        ) : (
          <div className={styles.error}>
            <p>Loading failed</p>
            <button onClick={onClose}>Close</button>
          </div>
        )}
      </div>
      
      {/* Insufficient Karma Modal */}
      <InsufficientKarmaModal
        isOpen={showInsufficientKarmaModal}
        onClose={() => setShowInsufficientKarmaModal(false)}
        requiredKarma={karmaInfo.required}
        currentKarma={karmaInfo.current}
      />
      
      {/* Insufficient Key Modal */}
      <InsufficientKeyModal
        isOpen={showInsufficientKeyModal}
        onClose={() => setShowInsufficientKeyModal(false)}
        requiredKeys={keyInfo.required}
        currentKeys={keyInfo.current}
      />
    </div>
  );
};

export default ChapterUnlockModal;