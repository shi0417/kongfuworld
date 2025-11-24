import React, { useEffect, useState } from 'react';
import styles from './DailyRewardsModal.module.css';
import checkinService, { CheckinStatus, CheckinResult } from '../../services/checkinService';
import ApiService from '../../services/ApiService';

const REWARDS = [
  { day: 1, keys: 3 },
  { day: 2, keys: 3 },
  { day: 3, keys: 3 },
  { day: 4, keys: 5 },
  { day: 5, keys: 3 },
  { day: 6, keys: 3 },
  { day: 7, keys: 6 },
];

function getTodayKey() {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

const DailyRewardsModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const [checkinStatus, setCheckinStatus] = useState<CheckinStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [open]);

  useEffect(() => {
    if (open) {
      loadCheckinStatus();
    }
  }, [open]);

  const loadCheckinStatus = async () => {
    const userId = checkinService.getCurrentUserId();
    if (!userId) {
      onClose(); // 未登录用户关闭弹窗
      return;
    }

    try {
      setLoading(true);
      const status = await checkinService.getCheckinStatus(userId);
      setCheckinStatus(status);
    } catch (error) {
      console.error('加载签到状态失败:', error);
      onClose(); // 加载失败时关闭弹窗
    } finally {
      setLoading(false);
    }
  };

  const today = getTodayKey();
  const canSignIn = checkinStatus ? !checkinStatus.hasCheckedInToday : false;
  const nextRewardTime = new Date();
  nextRewardTime.setDate(nextRewardTime.getDate() + 1);
  nextRewardTime.setHours(0, 0, 0, 0);
  const timeLeft = Math.max(0, Math.floor((nextRewardTime.getTime() - now) / 1000));

  function formatTime(sec: number) {
    const h = Math.floor(sec / 3600).toString().padStart(2, '0');
    const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  const handleSignIn = async () => {
    if (!canSignIn || loading) return;
    
    const userId = checkinService.getCurrentUserId();
    if (!userId) return;

    try {
      setLoading(true);
      const result: CheckinResult = await checkinService.performCheckin(userId);
      
      if (result.success) {
        // 签到成功后主动调用任务初始化
        try {
          await ApiService.getUserMissions(userId);
          console.log('任务初始化调用成功');
        } catch (missionError) {
          console.error('任务初始化调用失败:', missionError);
        }
        
        // 签到成功，重新加载状态
        await loadCheckinStatus();
      } else {
        console.error('签到失败:', result.message);
        alert(result.message || '签到失败');
      }
    } catch (error) {
      console.error('签到失败:', error);
      alert('签到失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  if (loading) {
    return (
      <div className={styles.modalOverlay}>
        <div className={styles.modalBox}>
          <div className={styles.title}>Loading...</div>
          <div className={styles.subtitle}>正在加载签到信息...</div>
        </div>
      </div>
    );
  }

  if (!checkinStatus) {
    return null;
  }

  const currentStreak = checkinStatus.todayCheckin?.streak_days || 0;
  const totalKeys = checkinStatus.userStats?.total_keys_earned || 0;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalBox}>
        <div className={styles.title}>Daily rewards</div>
        <div className={styles.subtitle}>
          Sign in and visit us daily to earn a cultivation key!<br />
          Next reward in {canSignIn ? 'Now!' : formatTime(timeLeft)}
        </div>
        <div className={styles.total}>Total collected: {totalKeys} <span role="img" aria-label="key">🔑</span></div>
        <div className={styles.rewardsRow}>
          {REWARDS.map((r, i) => (
            <div key={r.day} className={styles.rewardBox + ' ' + (currentStreak === r.day ? styles.active : '')}>
              <div>Day {r.day}</div>
              <div style={{ fontSize: 22, margin: '8px 0' }}>🔑</div>
              <div>{r.keys} KEYS</div>
            </div>
          ))}
        </div>
        <div className={styles.progressBox}>
          <div className={styles.badge}><span role="img" aria-label="scroll">📜</span></div>
          <div>
            <div className={styles.progressTitle}>Regular reader</div>
            <div className={styles.progressDesc}>Login daily to continue getting rewards and keep your streak!</div>
            <div className={styles.progressBarWrap}>
              <div className={styles.progressBar} style={{ width: `${(currentStreak / 7) * 100}%` }} />
            </div>
            <div className={styles.progressText}>PROGRESS {currentStreak}/7 DAYS</div>
          </div>
        </div>
        <div className={styles.buttonRow}>
          <button 
            className={styles.signInBtn} 
            onClick={handleSignIn} 
            disabled={!canSignIn || loading}
          >
            {loading ? 'Signing In...' : (canSignIn ? 'Sign In' : 'Already Signed')}
          </button>
          <button className={styles.closeBtn} onClick={onClose}>Continue Reading</button>
        </div>
      </div>
    </div>
  );
};

export default DailyRewardsModal; 