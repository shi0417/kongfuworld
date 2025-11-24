import React, { useState, useEffect } from 'react';
import RewardNotification from '../RewardNotification/RewardNotification';
import styles from './DailyRewards.module.css';
import ApiService from '../../services/ApiService';
import AuthService from '../../services/AuthService';

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

const DailyRewards: React.FC = () => {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [checkinStatus, setCheckinStatus] = useState<CheckinStatus | null>(null);
  const [userKeys, setUserKeys] = useState(0);
  const [keyTransactions, setKeyTransactions] = useState<KeyTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [userTimezone, setUserTimezone] = useState('UTC');
  const [showUTC, setShowUTC] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchUserData();
    // Update time every minute
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const fetchUserData = async (page: number = 1) => {
    try {
      setLoading(true);
      const userId = getCurrentUserId();
      if (!userId) {
        return;
      }

      // Fetch data in parallel
      const [missionsResponse, checkinResponse, userResponse, keyTransactionsResponse] = await Promise.all([
        ApiService.getUserMissions(userId),
        ApiService.getCheckinStatus(userId, userTimezone),
        ApiService.getUser(userId),
        ApiService.getKeyTransactions(userId, page, itemsPerPage)
      ]);

      const missionsData = await missionsResponse;
      const checkinData = await checkinResponse;
      const userData = await userResponse;
      const keyTransactionsData = await keyTransactionsResponse;

      if (missionsData.success) {
        setMissions(missionsData.data.missions);
      }

      if (checkinData.success) {
        setCheckinStatus(checkinData.data);
      }

      if (userData.success) {
        setUserKeys(userData.data.points || 0);
      }

      if (keyTransactionsData.success) {
        setKeyTransactions(keyTransactionsData.data.transactions);
        setTotalTransactions(keyTransactionsData.data.pagination?.totalRecords || 0);
        setTotalPages(keyTransactionsData.data.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error('Failed to fetch user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentUserId = (): number | null => {
    const user = AuthService.getCurrentUser();
    return user?.id || null;
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

  const handleCheckin = async () => {
    const userId = getCurrentUserId();
    if (!userId) return;

    try {
      const response = await ApiService.request(`/checkin/${userId}`, {
        method: 'POST',
        body: JSON.stringify({ timezone: userTimezone })
      });

      if (response.success) {
        // 签到成功后主动调用任务初始化
        try {
          await ApiService.getUserMissions(userId);
          console.log('任务初始化调用成功');
        } catch (missionError) {
          console.error('任务初始化调用失败:', missionError);
        }
        
        // Refresh data
        await fetchUserData();
        // 移除签到成功提示框，静默处理
      } else {
        alert(response.message);
      }
    } catch (error) {
      console.error('Check-in failed:', error);
      alert('Check-in failed, please try again later');
    }
  };

  const handleClaimReward = async (missionId: number) => {
    const userId = getCurrentUserId();
    if (!userId) return;

    try {
      const response = await ApiService.request(`/mission-v2/claim/${userId}/${missionId}`, {
        method: 'POST'
      });

      if (response.success) {
        // Refresh data
        await fetchUserData();
        // 移除成功提示框，静默处理
      } else {
        alert(response.message);
      }
    } catch (error) {
      console.error('Failed to claim reward:', error);
      alert('Failed to claim reward, please try again later');
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

            {/* Timezone Toggle */}
            <div className={styles.timezoneToggle}>
              <label className={styles.toggleLabel}>
                <input 
                  type="checkbox" 
                  checked={showUTC}
                  onChange={(e) => setShowUTC(e.target.checked)}
                />
                <span className={styles.toggleSlider}></span>
                Show awarded time in UTC
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

      {/* Key transaction records table */}
      <div className={styles.keyTransactionsSection}>
        <h3 className={styles.sectionTitle}>Cultivation Keys Awarded and Redeemed</h3>
        <div className={styles.tableContainer}>
          <table className={styles.transactionsTable}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Balance Before</th>
                <th>Balance After</th>
                <th>Reference</th>
                <th>Description</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {keyTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className={styles.emptyRow}>No transactions found</td>
                </tr>
              ) : (
                keyTransactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>{transaction.id}</td>
                    <td>
                      <span className={`${styles.transactionType} ${styles[transaction.transaction_type]}`}>
                        {transaction.transaction_type}
                      </span>
                    </td>
                    <td className={transaction.amount > 0 ? styles.positiveAmount : styles.negativeAmount}>
                      {transaction.amount > 0 ? '+' : ''}{transaction.amount}
                    </td>
                    <td>{transaction.balance_before}</td>
                    <td>{transaction.balance_after}</td>
                    <td>
                      {transaction.reference_id && transaction.reference_type ? 
                        `${transaction.reference_type}: ${transaction.reference_id}` : 
                        '-'
                      }
                    </td>
                    <td>{transaction.description || '-'}</td>
                    <td>{new Date(transaction.created_at).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination component */}
        {totalPages > 1 && (
          <div className={styles.paginationContainer}>
            <div className={styles.paginationInfo}>
              Showing {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, totalTransactions)} of {totalTransactions} records
            </div>
            <div className={styles.pagination}>
              <button 
                className={`${styles.paginationButton} ${currentPage === 1 ? styles.disabled : ''}`}
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
              >
                &lt;
              </button>
              
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  className={`${styles.paginationButton} ${currentPage === page ? styles.active : ''}`}
                  onClick={() => handlePageChange(page)}
                >
                  {page}
                </button>
              ))}
              
              <button 
                className={`${styles.paginationButton} ${currentPage === totalPages ? styles.disabled : ''}`}
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
              >
                &gt;
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyRewards;
