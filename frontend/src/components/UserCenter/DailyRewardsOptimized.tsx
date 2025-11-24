import React, { useState, useEffect } from 'react';
import { useAuth, useCheckin } from '../../hooks/useAuth';
import ApiService from '../../services/ApiService';
import AuthService from '../../services/AuthService';
import RewardNotification from '../RewardNotification/RewardNotification';
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

interface KeyTransaction {
  id: number;
  transaction_type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  reference_id: number | null;
  reference_type: string | null;
  description: string | null;
  created_at: string;
}

const DailyRewardsOptimized: React.FC = () => {
  const { user, isAuthenticated, login, logout } = useAuth();
  const { updateCheckinStatus } = useCheckin();
  
  const [missions, setMissions] = useState<Mission[]>([]);
  const [checkinStatus, setCheckinStatus] = useState<CheckinStatus | null>(null);
  const [keyTransactions, setKeyTransactions] = useState<KeyTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [userTimezone, setUserTimezone] = useState('UTC');
  const [hasCheckedInToday, setHasCheckedInToday] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const itemsPerPage = 10;
  
  // 奖励通知状态
  const [showRewardNotification, setShowRewardNotification] = useState(false);
  const [rewardData, setRewardData] = useState<{
    type: 'checkin' | 'mission' | 'purchase' | 'unlock';
    title: string;
    message: string;
    keysEarned?: number;
    karmaEarned?: number;
    additionalInfo?: string;
  } | null>(null);

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchUserData();
    }
    // Update time every minute
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, [isAuthenticated, user]);

  const fetchUserData = async (page: number = 1) => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // 使用新的API服务
      const [missionsResponse, checkinResponse, keyTransactionsResponse] = await Promise.all([
        ApiService.getUserMissions(user.id),
        ApiService.getCheckinStatus(user.id, userTimezone),
        ApiService.getKeyTransactions(user.id, page, itemsPerPage)
      ]);

      if (missionsResponse.success) {
        setMissions(missionsResponse.data.missions);
      }

      if (checkinResponse.success) {
        setCheckinStatus(checkinResponse.data);
        setHasCheckedInToday(checkinResponse.data.hasCheckedInToday);
      }

      if (keyTransactionsResponse.success) {
        setKeyTransactions(keyTransactionsResponse.data.transactions);
        setTotalTransactions(keyTransactionsResponse.data.pagination?.totalRecords || 0);
        setTotalPages(keyTransactionsResponse.data.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error('Failed to fetch user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckin = async () => {
    if (!user) return;

    try {
      const result = await ApiService.performCheckin(user.id, userTimezone);
      
      if (result.success) {
        // 签到成功后主动调用任务初始化
        try {
          await ApiService.getUserMissions(user.id);
          console.log('任务初始化调用成功');
        } catch (missionError) {
          console.error('任务初始化调用失败:', missionError);
        }
        
        // 更新本地认证状态 - 签到成功后更新checkinday
        const today = new Date().toISOString().split('T')[0];
        const updatedUser = { ...user, checkinday: today };
        AuthService.updateUser(updatedUser);
        
        // 更新本地签到状态
        setHasCheckedInToday(true);
        
        // 刷新数据
        await fetchUserData();
        
        // 显示美观的奖励通知
        setRewardData({
          type: 'checkin',
          title: 'CHECK-IN SUCCESSFUL!',
          message: 'Daily check-in completed successfully',
          keysEarned: result.data.keysEarned,
          additionalInfo: 'Keep checking in daily to earn more rewards!'
        });
        setShowRewardNotification(true);
      } else {
        alert(result.message);
      }
    } catch (error) {
      console.error('Check-in failed:', error);
      alert('Check-in failed, please try again later');
    }
  };

  const handleClaimReward = async (missionId: number) => {
    if (!user) return;

    try {
      const result = await ApiService.claimMissionReward(user.id, missionId);
      
      if (result.success) {
        // 刷新数据
        await fetchUserData();
        
        // 显示美观的奖励通知
        setRewardData({
          type: 'mission',
          title: 'REWARD CLAIMED!',
          message: 'Mission reward claimed successfully',
          keysEarned: result.data.rewardKeys,
          additionalInfo: 'Great job completing your mission!'
        });
        setShowRewardNotification(true);
      } else {
        alert(result.message);
      }
    } catch (error) {
      console.error('Claim reward failed:', error);
      alert('Claim reward failed, please try again later');
    }
  };

  // Pagination handler functions
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchUserData(page);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      handlePageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      handlePageChange(currentPage + 1);
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

  if (!isAuthenticated || !user) {
    return (
      <div className={styles.dailyRewardsContent}>
        <div className={styles.loadingContainer}>
          <p>Please log in to view daily rewards</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.dailyRewardsContent}>
        <div className={styles.loadingContainer}>
          <div className={styles.spinner}></div>
          <p>Loading daily rewards...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.dailyRewardsContent}>
      {/* My Cultivation Keys Section */}
      <div className={styles.keysSection}>
        <div className={styles.keysHeader}>
          <div className={styles.keysIcon}>🗝️</div>
          <div className={styles.keysInfo}>
            <h2>My Cultivation Keys</h2>
            <div className={styles.keysCount}>{user.points || 0}</div>
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
              {!hasCheckedInToday ? (
                <button 
                  className={styles.checkinButton}
                  onClick={handleCheckin}
                >
                  Check In Today
                </button>
              ) : (
                <div className={styles.checkedInStatus}>
                  <div className={styles.checkedInIcon}>✅</div>
                  <div className={styles.checkedInText}>Already checked in today!</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Missions */}
        <div className={styles.missionsSection}>
          <div className={styles.sectionHeader}>
            <h3>Missions</h3>
            <p>Complete missions to earn more rewards</p>
          </div>

          <div className={styles.missionsList}>
            {missions.map((mission) => (
              <div key={mission.id} className={styles.missionCard}>
                <div className={styles.missionHeader}>
                  <div className={styles.missionTitle}>{mission.title}</div>
                  <div className={styles.missionReward}>
                    <span className={styles.rewardIcon}>🗝️</span>
                    <span className={styles.rewardAmount}>{mission.rewardKeys}</span>
                  </div>
                </div>
                
                <div className={styles.missionDescription}>
                  {mission.description}
                </div>
                
                <div className={styles.missionProgress}>
                  <div className={styles.progressBar}>
                    <div 
                      className={styles.progressFill}
                      style={{ width: `${mission.progressPercentage}%` }}
                    ></div>
                  </div>
                  <div className={styles.progressText}>
                    {mission.currentProgress}/{mission.targetValue}
                  </div>
                </div>

                {mission.isCompleted && !mission.isClaimed && (
                  <button 
                    className={styles.claimButton}
                    onClick={() => handleClaimReward(mission.id)}
                  >
                    Claim Reward
                  </button>
                )}

                {mission.isClaimed && (
                  <div className={styles.claimedStatus}>
                    <span className={styles.claimedIcon}>✅</span>
                    <span className={styles.claimedText}>Claimed</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Key Transactions History */}
      <div className={styles.transactionsSection}>
        <div className={styles.sectionHeader}>
          <h3>Key Transactions</h3>
          <p>Your recent key transactions</p>
        </div>

        <div className={styles.transactionsList}>
          {keyTransactions.map((transaction) => (
            <div key={transaction.id} className={styles.transactionItem}>
              <div className={styles.transactionInfo}>
                <div className={styles.transactionType}>
                  {transaction.transaction_type}
                </div>
                <div className={styles.transactionDescription}>
                  {transaction.description}
                </div>
                <div className={styles.transactionDate}>
                  {new Date(transaction.created_at).toLocaleDateString()}
                </div>
              </div>
              <div className={`${styles.transactionAmount} ${
                transaction.amount > 0 ? styles.positive : styles.negative
              }`}>
                {transaction.amount > 0 ? '+' : ''}{transaction.amount}
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className={styles.pagination}>
            <button 
              onClick={handlePreviousPage}
              disabled={currentPage === 1}
              className={styles.paginationButton}
            >
              Previous
            </button>
            <span className={styles.paginationInfo}>
              Page {currentPage} of {totalPages}
            </span>
            <button 
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className={styles.paginationButton}
            >
              Next
            </button>
          </div>
        )}
      </div>
      
      {/* 奖励通知 */}
      {showRewardNotification && rewardData && (
        <RewardNotification
          isOpen={showRewardNotification}
          onClose={() => setShowRewardNotification(false)}
          type={rewardData.type}
          title={rewardData.title}
          message={rewardData.message}
          keysEarned={rewardData.keysEarned}
          karmaEarned={rewardData.karmaEarned}
          additionalInfo={rewardData.additionalInfo}
          autoClose={true}
          autoCloseDelay={5000}
        />
      )}
    </div>
  );
};

export default DailyRewardsOptimized;
