import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../components/NavBar/NavBar';
import Footer from '../components/Footer/Footer';
import { useAuth, useUser } from '../hooks/useAuth';
import ApiService from '../services/ApiService';
import styles from './DailyRewards.module.css';

interface Mission {
  id: number;
  missionKey: string;
  title: string;
  description: string;
  targetValue: number;
  rewardKeys: number;
  rewardKarma: number;
  resetType: string;
  currentProgress: number;
  isCompleted: boolean;
  isClaimed: boolean;
  progressDate: string;
  progressPercentage: number;
}

interface CheckinStatus {
  hasCheckedInToday: boolean;
  todayCheckin: any;
  userStats: {
    total_checkins: number;
    max_streak: number;
    total_keys_earned: number;
    last_checkin_date: string | null;
  };
}

const DailyRewards: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user: authUser } = useAuth();
  const { user: userData } = useUser();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [checkinStatus, setCheckinStatus] = useState<CheckinStatus | null>(null);
  const [userKeys, setUserKeys] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    fetchUserData();
    // 每分钟更新时间
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      if (!userId) {
        navigate('/login');
        return;
      }

      // 并行获取数据
      const [missionsResponse, checkinResponse, userResponse] = await Promise.all([
        ApiService.getUserMissions(userId),
        ApiService.getCheckinStatus(userId),
        ApiService.getUser(userId)
      ]);

      const missionsData = await missionsResponse;
      const checkinData = await checkinResponse;
      const userData = await userResponse;

      if (missionsData.success) {
        setMissions(missionsData.data.missions);
      }

      if (checkinData.success) {
        setCheckinStatus(checkinData.data);
      }

      if (userData.success) {
        setUserKeys(userData.data.points || 0);
      }
    } catch (error) {
      console.error('获取用户数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 使用认证Hook获取用户ID
  const user = authUser || userData;
  const userId = user?.id || null;

  const handleCheckin = async () => {
    if (!userId) return;

    try {
      const result = await ApiService.performCheckin(userId);
      if (result.success) {
        // 签到成功后主动调用任务初始化
        try {
          await ApiService.getUserMissions(userId);
          console.log('任务初始化调用成功');
        } catch (missionError) {
          console.error('任务初始化调用失败:', missionError);
        }
        
        // 刷新数据
        await fetchUserData();
        alert(`签到成功！获得 ${result.data.keysEarned} 把钥匙`);
      } else {
        alert(result.message);
      }
    } catch (error) {
      console.error('签到失败:', error);
      alert('签到失败，请稍后重试');
    }
  };

  const handleClaimReward = async (missionId: number) => {
    if (!userId) return;

    try {
      const result = await ApiService.claimMissionReward(userId, missionId);
      if (result.success) {
        // 刷新数据
        await fetchUserData();
        alert(`奖励领取成功！获得 ${result.data.rewardKeys} 把钥匙`);
      } else {
        alert(result.message);
      }
    } catch (error) {
      console.error('领取奖励失败:', error);
      alert('领取奖励失败，请稍后重试');
    }
  };

  const getResetTime = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  };

  const getTimeUntilReset = () => {
    const resetTime = getResetTime();
    const now = new Date();
    const diff = resetTime.getTime() - now.getTime();
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className={styles.dailyRewardsPage}>
        <NavBar />
        <div className={styles.loadingContainer}>
          <div className={styles.spinner}></div>
          <p>Loading daily rewards...</p>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className={styles.dailyRewardsPage}>
      <NavBar />
      
      {/* 页面顶部导航 */}
      <div className={styles.topNav}>
        <div className={`${styles.navItem} ${styles.active}`}>Daily Rewards</div>
        <div className={styles.navItem} onClick={() => navigate('/champion')}>Champion</div>
        <div className={styles.navItem} onClick={() => navigate('/karma')}>Karma</div>
        <div className={styles.navItem}>Billing</div>
        <div className={styles.navItem}>FAQ</div>
      </div>

      {/* 主要内容 */}
      <div className={styles.mainContent}>
        {/* My Cultivation Keys Section */}
        <div className={styles.keysSection}>
          <div className={styles.keysHeader}>
            <div className={styles.keysIcon}>🗝️</div>
            <div className={styles.keysInfo}>
              <h2>My Cultivation Keys</h2>
              <div className={styles.keysCount}>{userKeys}</div>
            </div>
          </div>
        </div>

        {/* Daily Rewards Title */}
        <div className={styles.titleSection}>
          <h1 className={styles.pageTitle}>Daily Rewards</h1>
          <p className={styles.subtitle}>Log in daily to win attractive prizes and rewards.</p>
        </div>

        {/* Two Column Layout */}
        <div className={styles.rewardsContainer}>
          {/* Left Column: Login Rewards */}
          <div className={styles.loginRewards}>
            <div className={styles.sectionHeader}>
              <h3>Login rewards</h3>
              <p>Keep going to get more free cultivation keys</p>
            </div>

            {/* Regular Reader Progress */}
            <div className={styles.progressCard}>
              <div className={styles.progressHeader}>
                <div className={styles.progressIcon}>📜</div>
                <div className={styles.progressTitle}>Regular reader</div>
              </div>
              
              <div className={styles.progressBar}>
                <div className={styles.progressLabel}>PROGRESS</div>
                <div className={styles.progressContainer}>
                  <div 
                    className={styles.progressFill}
                    style={{ width: `${checkinStatus ? (checkinStatus.userStats.max_streak % 7) * 14.28 : 0}%` }}
                  ></div>
                </div>
                <div className={styles.progressText}>
                  {checkinStatus ? `${checkinStatus.userStats.max_streak % 7}/7 DAYS` : '0/7 DAYS'}
                </div>
              </div>

              {/* Upcoming Rewards */}
              <div className={styles.upcomingRewards}>
                <h4>UPCOMING REWARDS</h4>
                <div className={styles.rewardsList}>
                  {[3, 4, 5, 6, 7].map((day, index) => {
                    const isCurrentDay = checkinStatus && (checkinStatus.userStats.max_streak % 7) === day - 1;
                    const keys = day === 4 ? 5 : day === 7 ? 6 : 3;
                    
                    return (
                      <div 
                        key={day} 
                        className={`${styles.rewardItem} ${isCurrentDay ? styles.currentDay : ''}`}
                      >
                        <div className={styles.dayLabel}>Day {day}</div>
                        <div className={styles.rewardIcon}>🗝️</div>
                        <div className={styles.rewardText}>{keys} KEYS</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Check-in Button */}
              <div className={styles.checkinSection}>
                {checkinStatus && !checkinStatus.hasCheckedInToday ? (
                  <button 
                    className={styles.checkinButton}
                    onClick={handleCheckin}
                  >
                    Check In Today
                  </button>
                ) : (
                  <div className={styles.checkedIn}>
                    <span>✓ Checked In Today</span>
                  </div>
                )}
              </div>

              {/* Notification Toggle */}
              <div className={styles.notificationToggle}>
                <label className={styles.toggleLabel}>
                  <input type="checkbox" defaultChecked />
                  <span className={styles.toggleSlider}></span>
                  Turn on notifications for reminder
                </label>
              </div>
            </div>
          </div>

          {/* Right Column: Mission Rewards */}
          <div className={styles.missionRewards}>
            <div className={styles.sectionHeader}>
              <h3>Mission rewards</h3>
              <div className={styles.resetTimer}>
                Resets in {getTimeUntilReset()} Hour(s)
              </div>
            </div>

            <div className={styles.missionsList}>
              {missions.map((mission) => (
                <div key={mission.id} className={styles.missionCard}>
                  <div className={styles.missionHeader}>
                    <div className={styles.missionIcon}>📖</div>
                    <div className={styles.missionInfo}>
                      <div className={styles.missionTitle}>{mission.title}</div>
                      <div className={styles.missionReward}>
                        <span className={styles.rewardIcon}>🗝️</span>
                        <span>{mission.rewardKeys} keys</span>
                      </div>
                    </div>
                    <div className={styles.missionActions}>
                      {mission.isCompleted && !mission.isClaimed ? (
                        <button 
                          className={styles.claimButton}
                          onClick={() => handleClaimReward(mission.id)}
                        >
                          REDEEM
                        </button>
                      ) : mission.isClaimed ? (
                        <div className={styles.claimedStatus}>✓ Claimed</div>
                      ) : (
                        <div className={styles.inProgressStatus}>In Progress</div>
                      )}
                    </div>
                  </div>
                  
                  <div className={styles.missionProgress}>
                    <div className={styles.progressText}>
                      {mission.currentProgress}/{mission.targetValue}
                    </div>
                    <div className={styles.progressBar}>
                      <div 
                        className={styles.progressFill}
                        style={{ width: `${mission.progressPercentage}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default DailyRewards;
