import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import NavBar from '../components/NavBar/NavBar';
import Footer from '../components/Footer/Footer';
import PersonalInfo from '../components/PersonalInfo/PersonalInfo';
import CommentManagement from '../components/CommentManagement/CommentManagement';
import IncomeManagement from './WritersZone/IncomeManagement';
import WorkData from './WritersZone/WorkData';
import ApiService from '../services/ApiService';
import styles from './WritersZone.module.css';

// Calendar Component
interface CalendarDayData {
  date: string; // YYYY-MM-DD
  word_count: number;
  change_count: number;
}

interface CalendarComponentProps {
  year: number;
  month: number; // 0-11
  calendarData: CalendarDayData[];
}

const CalendarComponent: React.FC<CalendarComponentProps> = ({ year, month, calendarData }) => {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  
  // 将日历数据转换为按日期索引的 Map
  const statsByDay = new Map<number, CalendarDayData>();
  calendarData.forEach(day => {
    const dayNum = parseInt(day.date.split('-')[2], 10);
    statsByDay.set(dayNum, day);
  });
  
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay() === 0 ? 7 : firstDayOfMonth.getDay(); // Monday = 1
  
  const weekDays = language === 'zh' 
    ? ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  const today = new Date();
  const isToday = (day: number) => {
    return (
      today.getDate() === day &&
      today.getMonth() === month &&
      today.getFullYear() === year
    );
  };
  
  const days = [];
  
  // Empty cells for days before the first day of the month
  for (let i = 1; i < startingDayOfWeek; i++) {
    days.push(null);
  }
  
  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day);
  }
  
  const formatWordCount = (count: number) => {
    if (count >= 10000) {
      return `${(count / 10000).toFixed(1)}万`;
    }
    return count.toString();
  };
  
  // 获取日期状态：green (≥4000), yellow (<4000), orange (未更新)
  const getDayStatus = (wordCount: number) => {
    if (wordCount === 0) return 'orange'; // 未更新
    if (wordCount >= 4000) return 'green'; // ≥4000字
    return 'yellow'; // <4000字
  };
  
  return (
    <div className={styles.calendarGrid}>
      <div className={styles.calendarWeekDays}>
        {weekDays.map((day, index) => (
          <div key={index} className={styles.calendarWeekDay}>{day}</div>
        ))}
      </div>
      <div className={styles.calendarDays}>
        {days.map((day, index) => {
          if (day === null) {
            return <div key={index} className={styles.calendarDayEmpty}></div>;
          }
          const todayClass = isToday(day) ? styles.calendarDayToday : '';
          const dayData = statsByDay.get(day);
          const wordCount = dayData?.word_count || 0;
          const status = getDayStatus(wordCount);
          const statusClass = styles[`calendarDay${status.charAt(0).toUpperCase() + status.slice(1)}`] || '';
          
          return (
            <div key={index} className={`${styles.calendarDay} ${todayClass} ${statusClass}`}>
              <div className={styles.calendarDayNumber}>
                {isToday(day) ? (language === 'zh' ? '今' : 'Today') : day}
              </div>
              {wordCount > 0 ? (
                <div className={styles.calendarDayLabel}>
                  {formatWordCount(wordCount)} {language === 'zh' ? '字' : 'words'}
                </div>
              ) : (
                <div className={styles.calendarDayLabel}>
                  {language === 'zh' ? '未更新' : 'Not updated'}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div className={styles.calendarLegend}>
        <div className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.legendDotGreen}`}></span>
          <span>{language === 'zh' ? '更新字数 ≥ 4000' : 'Updated words ≥ 4000'}</span>
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.legendDotYellow}`}></span>
          <span>{language === 'zh' ? '更新字数 < 4000' : 'Updated words < 4000'}</span>
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.legendDotOrange}`}></span>
          <span>{language === 'zh' ? '未更新/请假' : 'Not updated/Leave'}</span>
        </div>
      </div>
    </div>
  );
};

interface WriterStats {
  worksCount: number;
  daysJoined: number;
  cumulativeIncome: number;
  cumulativeWordCount: number;
}

interface UserNovel {
  id: number;
  title: string;
  status: string;
  cover: string | null;
  chapters: number;
  rating: number;
  reviews: number;
  review_status: string;
  languages: string | null;
  latest_chapter_id: number | null;
  latest_chapter_title: string | null;
  latest_chapter_number: number | null;
  monthly_word_count: number;
  reviewed_word_count: number;
}

const WritersZone: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [stats, setStats] = useState<WriterStats>({
    worksCount: 0,
    daysJoined: 0,
    cumulativeIncome: 0,
    cumulativeWordCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [activeNav, setActiveNav] = useState('home');
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['workManagement']);
  const [showNovelList, setShowNovelList] = useState(false);
  const [novels, setNovels] = useState<UserNovel[]>([]);
  const [novelsLoading, setNovelsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [calendarData, setCalendarData] = useState<Array<{ date: string; word_count: number; change_count: number }>>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  const [selectedNovelId, setSelectedNovelId] = useState<string>('all'); // 'all' 表示所有小说
  const [announcements, setAnnouncements] = useState<Array<{ id: number; title: string; created_at: string; link_url: string | null }>>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // 加载用户小说列表
  const loadUserNovels = async () => {
    if (!user) return;
    
    setNovelsLoading(true);
    setError(null);
    try {
      const response = await ApiService.get(`/novels/user/${user.id}`);
      
      // 处理不同的响应格式
      let novelsList: UserNovel[] = [];
      
      // 检查响应是否是数组
      if (Array.isArray(response)) {
        novelsList = response;
      } 
      // 检查响应是否有data字段且data是数组
      else if (response && typeof response === 'object' && response.data) {
        if (Array.isArray(response.data)) {
          novelsList = response.data;
        }
      }
      
      setNovels(novelsList);
      setStats(prev => ({
        ...prev,
        worksCount: novelsList.length
      }));
    } catch (error) {
      console.error('加载小说列表失败:', error);
      setError(error instanceof Error ? error.message : '加载失败');
      setNovels([]);
    } finally {
      setNovelsLoading(false);
    }
  };

  // 加载用户数据
  const loadUserData = async () => {
    if (!user) return;
    try {
      const response = await ApiService.get(`/user/${user.id}`);
      const data = response.data || response;
      setUserData(data);
    } catch (error) {
      console.error('加载用户数据失败:', error);
    }
  };

  // 加载官方动态公告（只加载作者端公告，限制2条）
  const loadAnnouncements = async () => {
    try {
      setAnnouncementsLoading(true);
      const res = await ApiService.get('/news?target_audience=writer');
      if (res.success && res.data && res.data.items) {
        // 只取前 2 条
        const items = res.data.items.slice(0, 2);
        setAnnouncements(items);
      }
    } catch (error) {
      console.error('加载官方动态失败:', error);
      setAnnouncements([]);
    } finally {
      setAnnouncementsLoading(false);
    }
  };

  // 加载未读消息数
  const loadUnreadCount = async () => {
    try {
      const response = await ApiService.get('/writer/inbox/unread-count');
      if (response.success && response.data) {
        setUnreadCount(response.data.unreadCount || 0);
      }
    } catch (error) {
      console.error('加载未读数失败:', error);
      setUnreadCount(0);
    }
  };

  // 检查用户是否登录且是作者
  useEffect(() => {
    if (!isAuthenticated || !user) {
      navigate('/login?redirect=/writers-zone');
      return;
    }

    const checkAuthorStatus = async () => {
      try {
        const response = await ApiService.get(`/user/${user.id}`);
        const data = response.data || response;
        setUserData(data);
        const isAuthor = data.is_author === 1 || data.is_author === '1' || data.is_author === true;

        if (!isAuthor) {
          navigate('/email-verification');
          return;
        }

        // 加载统计数据
        await loadStats();
        // 加载小说列表（用于首页显示）
        await loadUserNovels();
        // 加载日历数据
        await loadCalendarData(
          currentCalendarDate.getFullYear(),
          currentCalendarDate.getMonth(),
          selectedNovelId
        );
        // 加载官方动态
        await loadAnnouncements();
        // 加载未读消息数
        await loadUnreadCount();
      } catch (error) {
        console.error('检查用户状态失败:', error);
        navigate('/email-verification');
      } finally {
        setLoading(false);
      }
    };

    checkAuthorStatus();
  }, [isAuthenticated, user, navigate]);

  // 监听笔名更新事件
  useEffect(() => {
    const handlePenNameUpdate = () => {
      loadUserData();
    };
    window.addEventListener('penNameUpdated', handlePenNameUpdate);
    return () => {
      window.removeEventListener('penNameUpdated', handlePenNameUpdate);
    };
  }, [user]);

  // 加载统计数据
  const loadStats = async () => {
    if (!user) return;
    try {
      const response = await ApiService.get('/writer/stats');
      if (response.success && response.data) {
        setStats({
          worksCount: response.data.worksCount || 0,
          daysJoined: response.data.daysJoined || 0,
          cumulativeIncome: response.data.cumulativeIncome || 0,
          cumulativeWordCount: response.data.cumulativeWordCount || 0
        });
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
      // 失败时使用默认值
      setStats({
        worksCount: 0,
        daysJoined: 0,
        cumulativeIncome: 0,
        cumulativeWordCount: 0
      });
    }
  };

  // 加载日历数据
  const loadCalendarData = async (year: number, month: number, novelId?: string) => {
    if (!user) return;
    
    setCalendarLoading(true);
    try {
      const monthParam = month + 1; // API 使用 1-12，前端使用 0-11
      let url = `/writer/calendar?year=${year}&month=${monthParam}&userId=${user.id}`;
      if (novelId && novelId !== 'all') {
        url += `&novelId=${novelId}`;
      }
      const response = await ApiService.get(url) as any; // 后端直接返回 { success, year, month, days }，不在 data 字段中
      
      if (response && response.success && response.days) {
        setCalendarData(response.days);
      } else {
        setCalendarData([]);
      }
    } catch (error) {
      console.error('加载日历数据失败:', error);
      setCalendarData([]);
    } finally {
      setCalendarLoading(false);
    }
  };

  // 切换菜单展开状态
  const toggleMenu = (menu: string) => {
    setExpandedMenus(prev =>
      prev.includes(menu)
        ? prev.filter(m => m !== menu)
        : [...prev, menu]
    );
  };

  // 处理小说导航点击
  const handleNovelNavClick = () => {
    setActiveNav('novels');
    setShowNovelList(true);
    setError(null); // 清空错误信息
    // 每次都重新加载，确保数据是最新的
    loadUserNovels();
  };

  // 获取状态显示文本
  const getStatusText = (status: string) => {
    const statusMap: { [key: string]: string } = {
      'ongoing': language === 'zh' ? '连载中' : 'Ongoing',
      'completed': language === 'zh' ? '已完结' : 'Completed',
      'hiatus': language === 'zh' ? '暂停' : 'Paused'
    };
    return statusMap[status] || status;
  };

  // 格式化字数
  const formatWordCount = (count: number) => {
    return count.toLocaleString();
  };

  // 处理操作按钮点击
  const handleUploadChapter = (novelId: number) => {
    navigate(`/novel-upload?novelId=${novelId}`);
  };

  const handleManage = (novelId: number) => {
    navigate(`/novel-manage/${novelId}`);
  };

  const handleDelete = async (novelId: number) => {
    if (window.confirm(language === 'zh' ? '确定要删除这本小说吗？' : 'Are you sure you want to delete this novel?')) {
      // TODO: 实现删除功能
      console.log('删除小说:', novelId);
    }
  };

  // 获取问候语
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('greeting');
    if (hour < 18) return t('greeting.afternoon');
    return t('greeting.evening');
  };

  if (loading) {
    return (
      <div className={`${styles.container} ${styles[theme]}`}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <NavBar />
      
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.headerTitle}>{t('header.title')}</h1>
          <div className={styles.headerActions}>
            <button className={styles.headerBtn} onClick={() => navigate('/contract-policy')}>
              {t('header.contractPolicy')}
            </button>
            <button 
              className={styles.headerBtn}
              onClick={() => navigate('/writers-zone/inbox')}
              style={{ position: 'relative' }}
            >
              <span style={{ marginRight: '4px' }}>✉️</span>
              {t('header.messages')}
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-6px',
                  right: '-6px',
                  backgroundColor: '#ff4444',
                  color: '#fff',
                  borderRadius: '10px',
                  padding: '2px 6px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  minWidth: '18px',
                  textAlign: 'center',
                  lineHeight: '16px'
                }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            <div className={styles.userDropdown}>
              <span>{userData?.pen_name || user?.username || 'User'}</span>
              <span className={styles.dropdownArrow}>▼</span>
            </div>
            <button 
              className={styles.langBtn}
              onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
              title={language === 'zh' ? 'Switch to English' : '切换到中文'}
            >
              {language === 'zh' ? 'EN' : '中文'}
            </button>
            <button 
              className={styles.themeBtn}
              onClick={toggleTheme}
              title={theme === 'light' ? 'Switch to Dark Mode' : '切换到夜间模式'}
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
          </div>
        </div>
      </header>

      <div className={styles.mainLayout}>
        {/* Left Sidebar Navigation */}
        <aside className={styles.sidebar}>
          <nav className={styles.nav}>
            <div
              className={`${styles.navItem} ${activeNav === 'home' ? styles.active : ''}`}
              onClick={() => setActiveNav('home')}
            >
              <span className={styles.navIcon}>🏠</span>
              {t('nav.home')}
            </div>

            <div className={styles.navSection}>
              <div
                className={styles.navItem}
                onClick={() => toggleMenu('workManagement')}
              >
                <span className={styles.navIcon}>📚</span>
                {t('nav.workManagement')}
                <span className={styles.expandIcon}>
                  {expandedMenus.includes('workManagement') ? '▼' : '▶'}
                </span>
              </div>
              {expandedMenus.includes('workManagement') && (
                <div className={styles.subNav}>
                  <div 
                    className={`${styles.subNavItem} ${activeNav === 'novels' ? styles.active : ''}`}
                    onClick={handleNovelNavClick}
                  >
                    {t('nav.novel')}
                  </div>
                </div>
              )}

              <div
                className={styles.navItem}
                onClick={() => toggleMenu('interactionManagement')}
              >
                <span className={styles.navIcon}>💬</span>
                {t('nav.interactionManagement')}
                <span className={styles.expandIcon}>
                  {expandedMenus.includes('interactionManagement') ? '▼' : '▶'}
                </span>
              </div>
              {expandedMenus.includes('interactionManagement') && (
                <div className={styles.subNav}>
                  <div 
                    className={`${styles.subNavItem} ${activeNav === 'commentManagement' ? styles.active : ''}`}
                    onClick={() => setActiveNav('commentManagement')}
                  >
                    {t('nav.commentManagement')}
                  </div>
                </div>
              )}

              <div
                className={`${styles.navItem} ${activeNav === 'workData' ? styles.active : ''}`}
                onClick={() => setActiveNav('workData')}
              >
                <span className={styles.navIcon}>📊</span>
                {t('nav.workData')}
              </div>

              <div
                className={`${styles.navItem} ${activeNav === 'incomeManagement' ? styles.active : ''}`}
                onClick={() => setActiveNav('incomeManagement')}
              >
                <span className={styles.navIcon}>💰</span>
                {t('nav.incomeManagement')}
              </div>

              <div
                className={`${styles.navItem} ${activeNav === 'personalInfo' ? styles.active : ''}`}
                onClick={() => setActiveNav('personalInfo')}
              >
                <span className={styles.navIcon}>👤</span>
                {t('nav.personalInfo')}
              </div>
            </div>
          </nav>
        </aside>

        {/* Main Content */}
        <main className={styles.content}>
          {/* 评论管理视图 */}
          {activeNav === 'commentManagement' ? (
            <CommentManagement userId={user?.id || 0} />
          ) : activeNav === 'incomeManagement' ? (
            <IncomeManagement />
          ) : activeNav === 'workData' ? (
            <WorkData />
          ) : activeNav === 'personalInfo' ? (
            <PersonalInfo 
              userId={user?.id || 0} 
              language={language}
              onPenNameUpdate={loadUserData}
            />
          ) : showNovelList && activeNav === 'novels' ? (
            <div className={styles.novelListSection}>
              <div className={styles.novelListHeader}>
                <h2>
                  {language === 'zh' ? '小说' : 'Novels'} 
                  <span className={styles.novelCount}>({novels.length}{language === 'zh' ? '本' : ''})</span>
                </h2>
                <div className={styles.novelListActions}>
                  <button className={styles.sortBtn}>
                    {language === 'zh' ? '调整小说排序' : 'Adjust Novel Order'}
                    <span className={styles.icon}>⇅</span>
                  </button>
                  <button 
                    className={styles.createBtn}
                    onClick={() => navigate('/create-novel')}
                  >
                    {language === 'zh' ? '新建小说' : 'Create New Novel'}
                    <span className={styles.icon}>+</span>
                  </button>
                </div>
              </div>
              <div className={styles.siteName}>奇妙小说网</div>
              
              {error && (
                <div className={styles.error}>
                  {language === 'zh' ? '加载失败: ' : 'Failed to load: '}{error}
                </div>
              )}
              {novelsLoading ? (
                <div className={styles.loading}>{language === 'zh' ? '加载中...' : 'Loading...'}</div>
              ) : novels.length === 0 ? (
                <div className={styles.noNovels}>
                  <p>{language === 'zh' ? '暂无小说' : 'No novels yet'}</p>
                  <button 
                    className={styles.createBtn}
                    onClick={() => navigate('/create-novel')}
                  >
                    {language === 'zh' ? '创建第一本小说' : 'Create Your First Novel'}
                  </button>
                </div>
              ) : (
                <div className={styles.novelList}>
                  {novels.map(novel => (
                    <div key={novel.id} className={styles.novelItem}>
                      <div className={styles.novelCover}>
                        {novel.cover ? (
                          <img src={novel.cover} alt={novel.title} />
                        ) : (
                          <div className={styles.coverPlaceholder}>
                            <div className={styles.placeholderText}>{novel.title}</div>
                          </div>
                        )}
                      </div>
                      <div className={styles.novelInfo}>
                        <div className={styles.novelHeader}>
                          <h3 className={styles.novelTitle}>{novel.title}</h3>
                          <span className={`${styles.statusTag} ${styles[novel.status]}`}>
                            {getStatusText(novel.status)}
                          </span>
                        </div>
                        <div className={styles.novelDetails}>
                          {novel.latest_chapter_title && (
                            <div className={styles.detailItem}>
                              <span className={styles.label}>
                                {language === 'zh' ? '最新章节:' : 'Latest Chapter:'}
                              </span>
                              <span className={styles.value}>
                                {language === 'zh' 
                                  ? `第${novel.latest_chapter_number}章 ${novel.latest_chapter_title}`
                                  : `Chapter ${novel.latest_chapter_number} ${novel.latest_chapter_title}`}
                              </span>
                            </div>
                          )}
                          <div className={styles.detailItem}>
                            <span className={styles.label}>
                              {language === 'zh' ? '本月更新:' : 'Updated this month:'}
                            </span>
                            <span className={styles.value}>
                              {formatWordCount(novel.monthly_word_count)}{language === 'zh' ? '字' : ' words'}
                            </span>
                          </div>
                          <div className={styles.detailItem}>
                            <span className={styles.label}>
                              {language === 'zh' ? '作品已审字数:' : 'Words under review:'}
                            </span>
                            <span className={styles.value}>
                              {formatWordCount(novel.reviewed_word_count)}{language === 'zh' ? '字' : ' words'}
                              <span className={styles.helpIcon}>?</span>
                            </span>
                          </div>
                        </div>
                        <div className={styles.novelActions}>
                          <button 
                            className={styles.actionBtn}
                            onClick={() => handleUploadChapter(novel.id)}
                          >
                            <span className={styles.actionIcon}>☁️</span>
                            {language === 'zh' ? '上传章节' : 'Upload Chapter'}
                          </button>
                          <button 
                            className={styles.actionBtn}
                            onClick={() => navigate(`/apply-contract?novelId=${novel.id}`)}
                          >
                            <span className={styles.actionIcon}>📄</span>
                            {language === 'zh' ? '申请签约' : 'Apply for Contract'}
                          </button>
                          <button 
                            className={styles.actionBtn}
                            onClick={() => handleManage(novel.id)}
                          >
                            <span className={styles.actionIcon}>⚙️</span>
                            {language === 'zh' ? '管理' : 'Manage'}
                          </button>
                          <button 
                            className={`${styles.actionBtn} ${styles.deleteBtn}`}
                            onClick={() => handleDelete(novel.id)}
                          >
                            <span className={styles.actionIcon}>🗑️</span>
                            {language === 'zh' ? '删除' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
          {/* Promotional Banner */}
          {/* User Profile and Stats */}
          <div className={styles.profileSection}>
            <div className={styles.profileCard}>
              <div className={styles.avatar}>
                {user?.avatar ? (
                  <img src={user.avatar.startsWith('http') ? user.avatar : `http://localhost:5000${user.avatar}`} alt="Avatar" />
                ) : (
                  <div className={styles.avatarPlaceholder}>👤</div>
                )}
              </div>
              <div className={styles.profileInfo}>
                <h3>{userData?.pen_name || user?.username || 'User'}, {getGreeting()}!</h3>
                <div className={styles.stats}>
                  <div className={styles.statItem}>
                    <div className={styles.statValue}>{stats.worksCount}</div>
                    <div className={styles.statLabel}>{language === 'zh' ? '本' : ''} {t('stats.works')}</div>
                  </div>
                  <div className={styles.statItem}>
                    <div className={styles.statValue}>{stats.daysJoined}</div>
                    <div className={styles.statLabel}>{t('stats.daysJoined')}</div>
                  </div>
                  <div className={styles.statItem}>
                    <div className={styles.statValue}>
                      {stats.cumulativeIncome.toFixed(2)}
                    </div>
                    <div className={styles.statLabel}>
                      {language === 'zh' ? '万元' : 'K'} {t('stats.income')}
                    </div>
                  </div>
                  <div className={styles.statItem}>
                    <div className={styles.statValue}>{stats.cumulativeWordCount}</div>
                    <div className={styles.statLabel}>
                      {language === 'zh' ? '字' : ''} {t('stats.wordCount')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Work Creation Section */}
          <div className={styles.workSection}>
            <div className={styles.workTabs}>
              <div className={styles.workTabsLeft}>
                <button className={`${styles.workTab} ${styles.active}`}>{t('nav.novel')}</button>
              </div>
              {novels.length > 0 && (
                <div className={styles.workActionsTop}>
                  <button onClick={() => navigate('/create-novel')}>{language === 'zh' ? '新建小说' : 'New Novel'} +</button>
                  <button>{language === 'zh' ? '更多' : 'More'} &gt;</button>
                </div>
              )}
            </div>
            <div className={styles.workContent}>
              {novelsLoading ? (
                <div className={styles.loading}>{language === 'zh' ? '加载中...' : 'Loading...'}</div>
              ) : novels.length > 0 ? (
                // 如果有小说，显示小说列表
                <div className={styles.homeNovelList}>
                  {novels.map(novel => (
                    <div key={novel.id} className={styles.homeNovelItem}>
                      <div className={styles.homeNovelCover}>
                        {novel.cover ? (
                          <img src={novel.cover} alt={novel.title} />
                        ) : (
                          <div className={styles.coverPlaceholder}>
                            <div className={styles.placeholderText}>{novel.title}</div>
                          </div>
                        )}
                      </div>
                      <div className={styles.homeNovelInfo}>
                        <h4 className={styles.homeNovelTitle}>{novel.title}</h4>
                        <div className={styles.homeNovelMeta}>
                          <div className={styles.homeNovelDetail}>
                            {language === 'zh' ? '本月更新:' : 'Updated this month:'} 
                            <span className={styles.homeNovelValue}>{formatWordCount(novel.monthly_word_count)}{language === 'zh' ? '字' : ' words'}</span>
                          </div>
                          <div className={styles.homeNovelDetail}>
                            {language === 'zh' ? '作品已审字数:' : 'Reviewed words:'} 
                            <span className={styles.homeNovelValue}>{formatWordCount(novel.reviewed_word_count)}{language === 'zh' ? '字' : ' words'}</span>
                          </div>
                        </div>
                        <div className={styles.homeNovelActions}>
                          <button 
                            className={styles.homeActionBtn}
                            onClick={() => navigate(`/novel-manage/${novel.id}`)}
                          >
                            {language === 'zh' ? '作品信息' : 'Work Info'}
                          </button>
                          <button 
                            className={styles.homeActionBtn}
                            onClick={() => navigate(`/novel-manage/${novel.id}?tab=chapters`)}
                          >
                            {language === 'zh' ? '章节管理' : 'Chapter Management'}
                          </button>
                          <button 
                            className={`${styles.homeActionBtn} ${styles.primaryBtn}`}
                            onClick={() => handleUploadChapter(novel.id)}
                          >
                            {language === 'zh' ? '新建章节' : 'New Chapter'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {novels.some(n => n.review_status === 'approved') && (
                    <div className={styles.contractNotice}>
                      {language === 'zh' 
                        ? '您的作品已获得「签约评估」的申请资格 查看详情 >'
                        : 'Your work has obtained the qualification to apply for "Contract Evaluation" View Details >'}
                    </div>
                  )}
                </div>
              ) : (
                // 如果没有小说，显示原来的创建提示
                <>
                  <div className={styles.noWorks}>
                    <p>{t('works.noWorks')}</p>
                    <p className={styles.createHint}>{t('works.createFirst')}</p>
                    <div className={styles.createCard} onClick={() => navigate('/create-novel')}>
                      <div className={styles.createIcon}>+</div>
                    </div>
                    <button className={styles.createBtn} onClick={() => navigate('/create-novel')}>{t('works.createNovel')}</button>
                  </div>
                  <div className={styles.workActions}>
                    <button onClick={() => navigate('/create-novel')}>{t('works.createNovel')}</button>
                    <button>{t('works.more')}</button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Update Calendar */}
          <div className={styles.calendarSection}>
            <div className={styles.sectionHeader}>
              <h3>{t('calendar.title')}</h3>
              <div className={styles.headerActions}>
                <a href="#" className={styles.link}>{t('calendar.rules')} ?</a>
                {/* 小说选择下拉框 */}
                <select 
                  className={styles.select}
                  value={selectedNovelId}
                  onChange={(e) => {
                    setSelectedNovelId(e.target.value);
                    loadCalendarData(
                      currentCalendarDate.getFullYear(),
                      currentCalendarDate.getMonth(),
                      e.target.value
                    );
                  }}
                >
                  <option value="all">{language === 'zh' ? '全部作品' : 'All Works'}</option>
                  {novels.map(novel => (
                    <option key={novel.id} value={novel.id.toString()}>
                      {novel.title}
                    </option>
                  ))}
                </select>
                {/* 月份选择器 */}
                <input
                  type="month"
                  className={styles.monthPicker}
                  value={`${currentCalendarDate.getFullYear()}-${String(currentCalendarDate.getMonth() + 1).padStart(2, '0')}`}
                  onChange={(e) => {
                    const [year, month] = e.target.value.split('-').map(Number);
                    const newDate = new Date(year, month - 1, 1);
                    setCurrentCalendarDate(newDate);
                    loadCalendarData(year, month - 1, selectedNovelId);
                  }}
                />
                <button className={styles.leaveBtn}>{t('calendar.applyLeave')}</button>
              </div>
            </div>
            <div className={styles.calendarInfo}>
              {language === 'zh' 
                ? `${currentCalendarDate.getFullYear()}年${currentCalendarDate.getMonth() + 1}月已更新${calendarData.reduce((sum, day) => sum + day.word_count, 0)}字`
                : `${calendarData.reduce((sum, day) => sum + day.word_count, 0)} words updated in ${new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth()).toLocaleString('en-US', { year: 'numeric', month: 'long' })}`}
            </div>
            {calendarLoading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>加载中...</div>
            ) : (
              <CalendarComponent 
                year={currentCalendarDate.getFullYear()} 
                month={currentCalendarDate.getMonth()} 
                calendarData={calendarData}
              />
            )}
          </div>

          {/* Official Announcements */}
          <div className={styles.announcementsSection}>
            <div className={styles.sectionHeader}>
              <h3>{t('announcements.title')}</h3>
              <Link to="/news?target_audience=writer" className={styles.link}>{t('announcements.more')}</Link>
            </div>
            <div className={styles.announcementsList}>
              {announcementsLoading ? (
                <div style={{ textAlign: 'center', padding: '10px', color: '#999' }}>
                  {language === 'zh' ? '加载中...' : 'Loading...'}
                </div>
              ) : announcements.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '10px', color: '#999' }}>
                  {language === 'zh' ? '暂无公告' : 'No announcements'}
                </div>
              ) : (
                announcements.map((item) => {
                  // 格式化日期为 MM-DD
                  const date = new Date(item.created_at);
                  const month = String(date.getMonth() + 1).padStart(2, '0');
                  const day = String(date.getDate()).padStart(2, '0');
                  const dateStr = `${month}-${day}`;
                  
                  const handleClick = () => {
                    if (item.link_url) {
                      // 如果是站内相对路径，使用 navigate
                      if (item.link_url.startsWith('/')) {
                        navigate(item.link_url);
                      } else {
                        // 外部链接，新窗口打开
                        window.open(item.link_url, '_blank', 'noopener,noreferrer');
                      }
                    } else {
                      // 跳转到公告详情页
                      navigate(`/news/${item.id}`);
                    }
                  };

                  return (
                    <div 
                      key={item.id} 
                      className={styles.announcementItem}
                      onClick={handleClick}
                      style={{ cursor: 'pointer' }}
                    >
                      <span className={styles.date}>{dateStr}</span>
                      <span className={styles.content}>{item.title}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

            </>
          )}
        </main>
      </div>

      <Footer />
    </div>
  );
};

export default WritersZone;

