import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, useUser } from '../../hooks/useAuth';
import ApiService from '../../services/ApiService';
import { getApiBaseUrl } from '../../config';
import styles from './NavBar.module.css';
import { useTheme } from '../../contexts/ThemeContext';

const defaultAvatar = 'https://via.placeholder.com/150x150/4a90e2/ffffff?text=Avatar';

type Notification = {
  id: number | string;
  novel_id: number | null;
  chapter_id: number | null;
  novel_title: string;
  chapter_title?: string;
  message: string;
  type: 'accept_marketing' | 'notify_unlock_updates' | 'notify_chapter_updates';
  link: string;
  is_read: number;
  created_at: string;
  updated_at?: string;
  unlock_at?: string;
  timeAgo: string;
  isTimeUnlock?: boolean;
  isUnlocked?: boolean;
  readed?: number;
};

const getAvatarUrl = (avatar?: string) => {
  if (!avatar) return defaultAvatar;
  if (avatar.startsWith('http')) return avatar;
  return `${getApiBaseUrl()}${avatar}`;
};

const NavBar: React.FC = () => {
  const { isAuthenticated, user: authUser, logout } = useAuth();
  const { user: userData, points, goldenKarma } = useUser();
  const { theme, toggleTheme } = useTheme();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [diamondDropdownOpen, setDiamondDropdownOpen] = useState(false);
  const [notificationDropdownOpen, setNotificationDropdownOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const diamondDropdownRef = useRef<HTMLDivElement>(null);
  const notificationDropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // 使用认证Hook，无需手动监听localStorage变化
  const user = authUser || userData;
  
  // 调试信息
  console.log('NavBar - authUser:', authUser);
  console.log('NavBar - userData:', userData);
  console.log('NavBar - points:', points);
  console.log('NavBar - goldenKarma:', goldenKarma);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
      if (diamondDropdownRef.current && !diamondDropdownRef.current.contains(event.target as Node)) {
        setDiamondDropdownOpen(false);
      }
      if (notificationDropdownRef.current && !notificationDropdownRef.current.contains(event.target as Node)) {
        setNotificationDropdownOpen(false);
      }
    }
    if (dropdownOpen || diamondDropdownOpen || notificationDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen, diamondDropdownOpen, notificationDropdownOpen]);

  // 获取通知数据
  const fetchNotifications = async () => {
    if (!user) return;
    
    setNotificationsLoading(true);
    try {
      // 获取unlock类型的通知（用于显示）
      const unlockResponse = await ApiService.request(`/user/${user.id}/notifications?type=unlock&page=1&limit=5`);
      // 获取chapter_marketing类型的通知（用于显示）
      const marketingResponse = await ApiService.request(`/user/${user.id}/notifications?type=chapter_marketing&page=1&limit=5`);
      
      const displayNotifications = [
        ...(unlockResponse.success ? unlockResponse.data.notifications : []),
        ...(marketingResponse.success ? marketingResponse.data.notifications : [])
      ];
      
      // 按时间排序
      displayNotifications.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setNotifications(displayNotifications.slice(0, 10)); // 只显示最新的10条
      
      // 获取所有未读通知的总数量
      await fetchTotalUnreadCount();
    } catch (error) {
      console.error('获取通知失败:', error);
    } finally {
      setNotificationsLoading(false);
    }
  };

  // 获取所有未读通知的总数量
  const fetchTotalUnreadCount = async () => {
    if (!user) return;
    
    try {
      // 获取unlock类型的所有未读通知数量
      const unlockUnreadResponse = await ApiService.request(`/user/${user.id}/notifications?type=unlock&page=1&limit=1000`);
      // 获取chapter_marketing类型的所有未读通知数量
      const marketingUnreadResponse = await ApiService.request(`/user/${user.id}/notifications?type=chapter_marketing&page=1&limit=1000`);
      
      const allUnlockNotifications = unlockUnreadResponse.success ? unlockUnreadResponse.data.notifications : [];
      const allMarketingNotifications = marketingUnreadResponse.success ? marketingUnreadResponse.data.notifications : [];
      
      // 计算所有未读通知的总数量
      const totalUnread = [
        ...allUnlockNotifications,
        ...allMarketingNotifications
      ].filter(n => {
        if (n.isTimeUnlock) {
          return n.readed !== 1;
        } else {
          return n.is_read !== 1;
        }
      }).length;
      
      setUnreadCount(totalUnread);
    } catch (error) {
      console.error('获取未读通知总数失败:', error);
    }
  };

  // 标记通知为已读
  const markAsRead = async (notificationId: number | string) => {
    if (!user) return;
    
    try {
      await ApiService.request(`/user/${user.id}/notifications/${notificationId}/read`, {
        method: 'POST'
      });
      
      // 更新本地状态
      setNotifications(prev => prev.map(n => 
        n.id === notificationId ? { 
          ...n, 
          is_read: 1,
          readed: n.isTimeUnlock ? 1 : n.readed
        } : n
      ));
      
      // 重新获取所有未读通知的总数量
      await fetchTotalUnreadCount();
    } catch (error) {
      console.error('标记已读失败:', error);
    }
  };

  // 当用户登录时获取通知
  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user]);

  const handleLogout = () => {
    logout();
    setDropdownOpen(false);
    navigate('/login');
  };

  // 处理Writers Zone点击
  const handleWritersZoneClick = async () => {
    // 检查用户是否登录
    if (!isAuthenticated || !user) {
      // 未登录，跳转到登录页面，并设置重定向参数
      navigate(`/login?redirect=/writers-zone`);
      return;
    }

    // 检查用户是否是作者
    try {
      const response = await ApiService.get(`/user/${user.id}`);
      // 处理不同的响应格式
      const userData = response.data || response;
      
      console.log('检查用户作者状态:', { 
        userId: user.id, 
        is_author: userData.is_author,
        is_author_type: typeof userData.is_author,
        confirmed_email: userData.confirmed_email 
      });
      
      // 判断是否已经是作者（兼容数字1和字符串"1"）
      const isAuthor = userData.is_author === 1 || userData.is_author === '1' || userData.is_author === true;
      
      if (isAuthor) {
        // 已经是作者，直接跳转到writers-zone页面
        console.log('✅ 用户已是作者，直接跳转到Writers Zone');
        navigate('/writers-zone');
        return;
      }
      
      // 如果is_author为0、false、null或未设置，跳转到邮箱验证页面
      console.log('⚠️  用户不是作者，跳转到邮箱验证页面');
      navigate('/email-verification');
    } catch (error) {
      console.error('❌ 检查用户状态失败:', error);
      // 如果API调用失败，跳转到邮箱验证页面（保守策略）
      navigate('/email-verification');
    }
  };

  return (
    <nav className={styles.navbar}>
      <div className={styles.logo} onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>KongFuWorld</div>
      
      {/* Left navigation links */}
      <div className={styles.leftNav}>
        <div className={styles.navLink} onClick={() => navigate('/series')}>Series</div>
        <div className={styles.navLink} onClick={() => navigate('/bookmarks')}>Bookmarks</div>
        <div className={styles.navLink} onClick={handleWritersZoneClick}>
          Writers' Zone
        </div>
      </div>

      {/* Search bar - moved to right side */}
      <div className={styles.searchContainerRight}>
        <div className={styles.searchBar}>
          <span className={styles.searchIcon}>🔍</span>
          <input 
            type="text" 
            placeholder="Search" 
            className={styles.searchInput}
          />
        </div>
      </div>

      {/* Right buttons */}
      <div className={styles.rightNav}>
        {/* Diamond button */}
        <div className={styles.iconButton} style={{ position: 'relative' }} onClick={() => setDiamondDropdownOpen(!diamondDropdownOpen)}>
          <span className={styles.diamondIcon}>💎</span>
          
          {/* Diamond dropdown menu */}
          {diamondDropdownOpen && (
            <div
              ref={diamondDropdownRef}
              className={styles.diamondDropdown}
            >
              {/* User resources/currency section */}
              <div className={styles.resourcesSection}>
                <div className={styles.resourceItem}>
                  <span className={styles.yellowYinYang}>☯</span>
                  <span>{goldenKarma}</span>
                </div>
                <div className={styles.resourceItem}>
                  <span className={styles.keyIcon}>🔑</span>
                  <span>{points}</span>
                </div>
                <button 
                  className={styles.karmaShopButton}
                  onClick={() => { setDiamondDropdownOpen(false); navigate('/user-center?tab=karma'); }}
                >
                  <span className={styles.yellowYinYang}>☯</span>
                  Karma Shop
                </button>
              </div>

              {/* Daily rewards section */}
              <div className={styles.dailyRewardsSection}>
                <h4 className={styles.sectionTitle}>Daily rewards</h4>
                <p className={styles.sectionDescription}>Complete missions to earn keys!</p>
                <button 
                  className={styles.viewMissionsButton}
                  onClick={() => { setDiamondDropdownOpen(false); navigate('/user-center?tab=daily-rewards'); }}
                >
                  View missions
                </button>
              </div>

              {/* Navigation links section */}
              <div className={styles.navigationSection}>
                <div className={styles.navItem} onClick={() => { setDiamondDropdownOpen(false); navigate('/user-center?tab=champion'); }}>Champion</div>
                <div className={styles.navItem} onClick={() => { setDiamondDropdownOpen(false); navigate('/user-center?tab=billing'); }}>Billing</div>
                <div className={styles.navItem} onClick={() => { setDiamondDropdownOpen(false); navigate('/user-center?tab=faq'); }}>FAQ</div>
              </div>
            </div>
          )}
        </div>
        
        {/* Notification button */}
        <div className={styles.iconButton} style={{ position: 'relative' }} onClick={() => setNotificationDropdownOpen(!notificationDropdownOpen)}>
          <span className={styles.bellIcon}>🔔</span>
          {unreadCount > 0 && (
            <span className={styles.notificationBadge}>{unreadCount}</span>
          )}
          
          {/* Notification dropdown menu */}
          {notificationDropdownOpen && (
            <div
              ref={notificationDropdownRef}
              className={styles.notificationDropdown}
            >
              <div className={styles.notificationHeader}>
                <span>Notifications {unreadCount}</span>
                <button 
                  className={styles.viewAllButton}
                  onClick={() => { setNotificationDropdownOpen(false); navigate('/profile?tab=notifications'); }}
                >
                  VIEW ALL
                </button>
              </div>
              
              <div className={styles.notificationList}>
                {notificationsLoading ? (
                  <div className={styles.notificationItem}>Loading...</div>
                ) : notifications.length === 0 ? (
                  <div className={styles.notificationItem}>No notifications</div>
                ) : (
                  notifications.map((notification) => {
                    const isRead = notification.isTimeUnlock ? notification.readed === 1 : notification.is_read === 1;
                    return (
                      <div
                        key={notification.id}
                        className={`${styles.notificationItem} ${isRead ? styles.read : ''}`}
                        onClick={() => {
                          // 根据通知类型决定跳转
                          if (notification.isTimeUnlock) {
                            // Unlock类型：跳转到章节页
                            if (notification.chapter_id && notification.novel_id) {
                              navigate(`/novel/${notification.novel_id}/chapter/${notification.chapter_id}`);
                            }
                          } else {
                            // ChapterUpdates&Marketing类型：跳转到小说详情页
                            if (notification.novel_id) {
                              navigate(`/book/${notification.novel_id}`);
                            }
                          }
                          
                          // 标记为已读
                          if (!isRead) {
                            markAsRead(notification.id);
                          }
                          setNotificationDropdownOpen(false);
                        }}
                      >
                        <div className={styles.notificationContent}>
                          <div className={styles.notificationTitle}>{notification.novel_title}</div>
                          <div className={styles.notificationMessage}>{notification.message}</div>
                          <div className={styles.notificationTime}>{notification.timeAgo}</div>
                        </div>
                        {!isRead && (
                          <button 
                            className={styles.readButton}
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(notification.id);
                            }}
                          >
                            READ
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              
              {notifications.length > 0 && (
                <div className={styles.notificationFooter}>
                  <button 
                    className={styles.markAllReadButton}
                    onClick={() => {
                      // 标记所有为已读的逻辑可以在这里实现
                      setNotificationDropdownOpen(false);
                      navigate('/profile?tab=notifications');
                    }}
                  >
                    Mark all as read
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* User avatar */}
        <div style={{ position: 'relative' }}>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => setDropdownOpen(v => !v)}>
              <img
                src={getAvatarUrl(user.avatar)}
                alt="avatar"
                style={{ width: 32, height: 32, borderRadius: '8px', marginRight: 8, objectFit: 'cover', background: 'var(--bg-tertiary)' }}
              />
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{user.username}</span>
              <span style={{ marginLeft: 4, color: 'var(--text-primary)' }}>▼</span>
            </div>
          ) : (
            <Link to="/login" style={{ color: 'var(--text-primary)', textDecoration: 'none' }}>Login</Link>
          )}
          {dropdownOpen && user && (
            <div
              ref={dropdownRef}
              style={{
                position: 'absolute',
                right: 0,
                top: 40,
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                borderRadius: 10,
                boxShadow: '0 4px 16px var(--shadow-color)',
                border: '1px solid var(--border-color)',
                minWidth: 200,
                zIndex: 1000,
                padding: '16px 0'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', padding: '0 20px 12px 20px', borderBottom: '1px solid var(--border-color)' }}>
                <img
                  src={getAvatarUrl(user.avatar)}
                  alt="avatar"
                  style={{ width: 40, height: 40, borderRadius: '8px', marginRight: 12, objectFit: 'cover', background: 'var(--bg-tertiary)' }}
                />
                <div>
                  <div style={{ fontWeight: 600 }}>{user.username}</div>
                </div>
              </div>
              <div style={{ padding: '10px 20px', cursor: 'pointer' }} onClick={() => { setDropdownOpen(false); navigate('/profile'); }}>Profile</div>
              <div style={{ padding: '10px 20px', cursor: 'pointer' }} onClick={() => { setDropdownOpen(false); navigate('/bookmarks'); }}>Bookmarks</div>
              <div style={{ padding: '10px 20px', cursor: 'pointer' }}>Notifications <span style={{ background: '#1976d2', borderRadius: 8, padding: '2px 8px', marginLeft: 6, fontSize: 12 }}>9</span></div>
              <div style={{ padding: '10px 20px', cursor: 'pointer' }} onClick={() => { setDropdownOpen(false); navigate('/settings'); }}>Settings</div>
              <div style={{ padding: '10px 20px', cursor: 'pointer', color: '#f44' }} onClick={handleLogout}>Log out</div>
              <div
                role="button"
                tabIndex={0}
                onClick={() => toggleTheme()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') toggleTheme();
                  if (e.key === ' ') {
                    e.preventDefault();
                    toggleTheme();
                  }
                }}
                style={{ padding: '10px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                Mode <span style={{ marginLeft: 8 }}>{theme === 'light' ? '📖 Reading' : '🌙 Dark'}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default NavBar; 