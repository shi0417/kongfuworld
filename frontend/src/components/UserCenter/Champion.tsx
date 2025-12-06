import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import ApiService from '../../services/ApiService';
import styles from './Champion.module.css';

interface ChampionSubscription {
  id: number;
  novel_id: number;
  novel_title: string;
  tier_level: number;
  tier_name: string;
  monthly_price: number;
  start_date: string;
  end_date: string;
  payment_method: string;
  auto_renew: boolean;
  cancel_at_period_end?: boolean;
  stripe_subscription_id?: string | null;
  advance_chapters: number;
  status: 'active' | 'expired' | 'inactive';
}

const Champion: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const [subscriptions, setSubscriptions] = useState<ChampionSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchUserSubscriptions();
  }, []);

  const fetchUserSubscriptions = async () => {
    try {
      setLoading(true);
      
      // 使用认证Hook获取用户信息
      console.log('Champion: 获取用户信息', { user, isAuthenticated });
      
      if (!user?.id) {
        console.error('用户未登录');
        return;
      }
      
      console.log('Champion: 获取订阅记录，用户ID:', user.id);
      const result = await ApiService.get(`/champion/user-subscriptions?userId=${user.id}`);
      console.log('Champion: API响应', result);
      
      if (result.success) {
        console.log('Champion: 订阅数据', result.data);
        console.log('Champion: 订阅数量', result.data.subscriptions?.length);
        setSubscriptions(result.data.subscriptions || []);
        setTotalCount(result.data.totalCount || 0);
        console.log('Champion: 设置订阅数据完成');
      } else {
        console.error('获取订阅记录失败:', result.message);
      }
    } catch (error) {
      console.error('获取订阅记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAutoRenew = async (subscriptionId: number) => {
    if (!window.confirm('确定要取消自动续费吗？当前周期结束后将不再续费。')) {
      return;
    }

    try {
      const result = await ApiService.request(`/champion/subscription/${subscriptionId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({
          userId: user?.id
        })
      });

      if (result.success) {
        alert('自动续费已取消');
        // 刷新订阅列表
        fetchUserSubscriptions();
      } else {
        alert('取消失败: ' + (result.message || '未知错误'));
      }
    } catch (error) {
      console.error('取消自动续费失败:', error);
      alert('取消失败，请稍后重试');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className={styles.statusActive}>Active</span>;
      case 'expired':
        return <span className={styles.statusExpired}>Expired</span>;
      default:
        return <span className={styles.statusInactive}>Inactive</span>;
    }
  };

  const getTierColor = (tierLevel: number) => {
    switch (tierLevel) {
      case 1:
        return styles.tierMartialCultivator;
      case 2:
        return styles.tierProfoundRealm;
      case 3:
        return styles.tierMartialLord;
      default:
        return styles.tierDefault;
    }
  };

  const totalPages = Math.ceil(totalCount / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentSubscriptions = subscriptions.slice(startIndex, endIndex);
  
  console.log('Champion: 渲染数据', { 
    subscriptions: subscriptions.length, 
    totalCount, 
    currentSubscriptions: currentSubscriptions.length,
    startIndex, 
    endIndex 
  });

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Loading champion subscriptions...</p>
      </div>
    );
  }

  return (
    <div className={styles.championContent}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Champion</h1>
        <p className={styles.subtitle}>Support your favourite translators!</p>
      </div>

      {/* Championed Novels Section */}
      <div className={styles.championedNovelsSection}>
        <h2 className={styles.sectionTitle}>Championed Novels</h2>
        
        {subscriptions.length === 0 ? (
          <div className={styles.noRecords}>
            <div className={styles.noRecordsTable}>
              <table className={styles.subscriptionTable}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Novel</th>
                    <th>Extra Chapters</th>
                    <th>Tier</th>
                    <th>Price</th>
                    <th>Active Until</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={6} className={styles.emptyRow}>No records found</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className={styles.subscriptionTableContainer}>
            <table className={styles.subscriptionTable}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Novel</th>
                  <th>Extra Chapters</th>
                  <th>Tier</th>
                  <th>Price</th>
                  <th>Active Until</th>
                </tr>
              </thead>
              <tbody>
                {currentSubscriptions.map((subscription, index) => (
                  <tr 
                    key={subscription.id} 
                    className={styles.subscriptionRow}
                    onClick={() => {
                      console.log('点击表格行:', subscription.novel_title, 'ID:', subscription.novel_id);
                      window.location.href = `/book/${subscription.novel_id}`;
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>{startIndex + index + 1}</td>
                    <td>
                      <div className={styles.novelInfo}>
                        <span 
                          className={styles.novelTitle}
                          style={{ 
                            color: '#007bff',
                            textDecoration: 'underline',
                            display: 'inline-block',
                            padding: '2px 4px',
                            borderRadius: '3px',
                            backgroundColor: 'rgba(0, 123, 255, 0.1)'
                          }}
                        >
                          {subscription.novel_title}
                        </span>
                        {getStatusBadge(subscription.status)}
                      </div>
                    </td>
                    <td>{subscription.advance_chapters || 0}</td>
                    <td>
                      <span className={`${styles.tierBadge} ${getTierColor(subscription.tier_level)}`}>
                        {subscription.tier_name}
                      </span>
                    </td>
                    <td>${subscription.monthly_price}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span>{formatDate(subscription.end_date)}</span>
                        <div style={{ fontSize: '0.75rem', color: '#666' }}>
                          {subscription.auto_renew && !subscription.cancel_at_period_end ? (
                            <span style={{ color: '#28a745' }}>Auto-renew: ON</span>
                          ) : (
                            <span style={{ color: '#999' }}>Auto-renew: OFF</span>
                          )}
                        </div>
                        {subscription.auto_renew && !subscription.cancel_at_period_end && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancelAutoRenew(subscription.id);
                            }}
                            style={{
                              marginTop: '4px',
                              padding: '4px 8px',
                              fontSize: '0.75rem',
                              backgroundColor: '#dc3545',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                          >
                            Cancel auto-renew
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {/* 分页控件 */}
            {totalPages > 1 && (
              <div className={styles.pagination}>
                <button 
                  className={styles.pageButton}
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  ←
                </button>
                <span className={styles.pageInfo}>
                  Page {currentPage} of {totalPages}
                </span>
                <button 
                  className={styles.pageButton}
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  →
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Champion Benefits Section */}
      <div className={styles.benefitsSection}>
        <div className={styles.benefitsHeader}>
          <h2 className={styles.benefitsTitle}>Champion your favorite stories!</h2>
          <p className={styles.benefitsSubtitle}>Subscribe to your favorite stories and be rewarded for it!</p>
        </div>
        
        <div className={styles.benefitsCards}>
          <div className={styles.benefitCard}>
            <div className={styles.benefitIcon}>⚡</div>
            <div className={styles.benefitTitle}>Free Access</div>
            <div className={styles.benefitDescription}>All Published Chapters</div>
          </div>
          
          <div className={styles.benefitCard}>
            <div className={styles.benefitIcon}>🔒</div>
            <div className={styles.benefitTitle}>Early Access</div>
            <div className={styles.benefitDescription}>Advance Chapters</div>
          </div>
          
          <div className={styles.benefitCard}>
            <div className={styles.benefitIcon}>📖</div>
            <div className={styles.benefitTitle}>Sneak Peeks</div>
            <div className={styles.benefitDescription}>Upcoming Novels</div>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className={styles.faqSection}>
        <h2 className={styles.faqTitle}>Champion FAQ</h2>
        
        <div className={styles.faqItem}>
          <div className={styles.faqQuestion}>
            What is 'Access to all published chapters of the series'?
          </div>
          <div className={styles.faqAnswer}>
            All chapters of the series which would normally require Karma or WTU to read will be unlocked for the duration of the subscription.
          </div>
        </div>
        
        <div className={styles.faqItem}>
          <div className={styles.faqQuestion}>
            What is 'Access to all Advance chapters of the series'?
          </div>
          <div className={styles.faqAnswer}>
            Advance chapters are chapters that have not yet been released. As an example, if the latest published chapter is Chapter 100 and you subscribe to a tier that grants access to 10 additional chapters, you will immediately be able to read up to Chapter 110. When Chapter 101 is published, you will gain access to Chapter 111. This continues for as long as you remain subscribed.
          </div>
        </div>
      </div>
    </div>
  );
};

export default Champion;
