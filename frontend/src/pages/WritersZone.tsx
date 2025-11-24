import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import NavBar from '../components/NavBar/NavBar';
import Footer from '../components/Footer/Footer';
import PersonalInfo from '../components/PersonalInfo/PersonalInfo';
import CommentManagement from '../components/CommentManagement/CommentManagement';
import IncomeManagement from './WritersZone/IncomeManagement';
import ApiService from '../services/ApiService';
import styles from './WritersZone.module.css';

// Calendar Component
const CalendarComponent: React.FC = () => {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
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
          return (
            <div key={index} className={`${styles.calendarDay} ${todayClass}`}>
              <div className={styles.calendarDayNumber}>{day}</div>
              {isToday(day) && (
                <div className={styles.calendarDayLabel}>
                  {t('calendar.today')} {t('calendar.notUpdated')}
                </div>
              )}
            </div>
          );
        })}
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
    try {
      // TODO: 实现获取统计数据API
      // const response = await ApiService.get(`/writers-zone/stats/${user?.id}`);
      // setStats(response.data);
      
      // 临时数据
      if (user) {
        const joinDate = new Date(user.created_at || Date.now());
        const daysJoined = Math.floor((Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24));
        setStats({
          worksCount: 0,
          daysJoined: daysJoined || 109,
          cumulativeIncome: 0,
          cumulativeWordCount: 0
        });
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
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
            <button className={styles.headerBtn} onClick={() => navigate('/writers-exchange')}>
              {t('header.writerExchange')}
            </button>
            <button className={styles.headerBtn} onClick={() => navigate('/contract-policy')}>
              {t('header.contractPolicy')}
            </button>
            <button className={styles.headerBtn}>
              {t('header.messages')}
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
                  <div className={styles.subNavItem}>{t('nav.shortStory')}</div>
                  <div className={styles.subNavItem}>{t('nav.script')}</div>
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
                  <div className={styles.subNavItem}>{t('nav.readerCorrections')}</div>
                </div>
              )}

              <div className={styles.navItem}>
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
                className={styles.navItem}
                onClick={() => toggleMenu('learningExchange')}
              >
                <span className={styles.navIcon}>📖</span>
                {t('nav.learningExchange')}
                <span className={styles.expandIcon}>
                  {expandedMenus.includes('learningExchange') ? '▼' : '▶'}
                </span>
              </div>
              {expandedMenus.includes('learningExchange') && (
                <div className={styles.subNav}>
                  <div className={styles.subNavItem}>{t('header.writerExchange')}</div>
                  <div className={styles.subNavItem}>{t('nav.writerAcademy')}</div>
                </div>
              )}

              <div className={styles.navItem}>
                <span className={styles.navIcon}>📅</span>
                {t('nav.leaveManagement')}
              </div>

              <div
                className={`${styles.navItem} ${activeNav === 'personalInfo' ? styles.active : ''}`}
                onClick={() => setActiveNav('personalInfo')}
              >
                <span className={styles.navIcon}>👤</span>
                {t('nav.personalInfo')}
              </div>

              <div className={styles.navItem}>
                <span className={styles.navIcon}>📄</span>
                {t('nav.myContracts')}
              </div>

              <div className={styles.navItem}>
                <span className={styles.navIcon}>📝</span>
                {t('nav.myPosts')}
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
          <div className={styles.banner}>
            <div className={styles.bannerContent}>
              <div className={styles.bannerText}>
                <h2>
                  {language === 'zh' 
                    ? '从拒稿到签约 新手作家的签约过稿心得'
                    : 'From Rejection to Contract: New Writer\'s Contract Submission Experience'}
                </h2>
              </div>
              <div className={styles.bannerIllustration}>🎨</div>
              <button className={styles.bannerBtn}>
                {t('btn.viewNow')}
              </button>
            </div>
          </div>

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
                <button className={styles.workTab}>{t('nav.shortStory')}</button>
                <button className={styles.workTab}>{t('nav.script')}</button>
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
                <select className={styles.select}>
                  <option>2025-11</option>
                </select>
                <button className={styles.leaveBtn}>{t('calendar.applyLeave')}</button>
              </div>
            </div>
            <div className={styles.calendarInfo}>
              {language === 'zh' 
                ? `2025年11月已更新${stats.cumulativeWordCount}字`
                : `${stats.cumulativeWordCount} words updated in November 2025`}
            </div>
            <CalendarComponent />
          </div>

          {/* Official Announcements */}
          <div className={styles.announcementsSection}>
            <div className={styles.sectionHeader}>
              <h3>{t('announcements.title')}</h3>
              <a href="#" className={styles.link}>{t('announcements.more')}</a>
            </div>
            <div className={styles.announcementsList}>
              <div className={styles.announcementItem}>
                <span className={styles.date}>10-31</span>
                <span className={styles.content}>
                  {language === 'zh'
                    ? '版权运营相关更新说明'
                    : 'Copyright Operations Update'}
                </span>
              </div>
              <div className={styles.announcementItem}>
                <span className={styles.date}>10-28</span>
                <span className={styles.content}>
                  {language === 'zh'
                    ? '作家成就系统上线'
                    : 'Writer Achievement System Launched'}
                </span>
              </div>
            </div>
          </div>

          {/* Writing Contests */}
          <div className={styles.contestsSection}>
            <div className={styles.sectionHeader}>
              <h3>{t('contests.title')}</h3>
              <a href="#" className={styles.link}>{t('works.more')}</a>
            </div>
            <div className={styles.contestCards}>
              <div className={styles.contestCard}>
                <div className={styles.contestImage}>特色职业</div>
              </div>
              <div className={styles.contestCard}>
                <div className={styles.contestImage}>强取豪夺</div>
              </div>
              <div className={styles.contestCard}>
                <div className={styles.contestImage}>地域风情</div>
              </div>
            </div>
          </div>

          {/* Recommended Courses */}
          <div className={styles.coursesSection}>
            <div className={styles.sectionHeader}>
              <h3>{t('courses.title')}</h3>
              <a href="#" className={styles.link}>{t('works.more')}</a>
            </div>
            <div className={styles.courseList}>
              <div className={styles.courseItem}>
                <div className={styles.courseInfo}>
                  <h4>
                    {language === 'zh'
                      ? '剧情拖沓,节奏太慢?如何加快故事节奏?'
                      : 'Plot Dragging, Rhythm Too Slow? How to Speed Up Story Rhythm?'}
                  </h4>
                  <div className={styles.courseMeta}>
                    <span>10-28</span>
                    <span>100 reads</span>
                    <span>50 likes</span>
                    <span>20 favorites</span>
                  </div>
                </div>
                <div className={styles.courseImage}>📚</div>
              </div>
            </div>
          </div>

          {/* Trending Topics */}
          <div className={styles.topicsSection}>
            <div className={styles.sectionHeader}>
              <h3>{t('topics.title')}</h3>
              <a href="#" className={styles.link}>{t('works.more')}</a>
            </div>
            <div className={styles.topicList}>
              <div className={styles.topicItem}>
                <span className={styles.topicContent}>
                  {language === 'zh'
                    ? '短故事福利升级相关讨论'
                    : 'Short Story Welfare Upgrade Discussion'}
                </span>
                <div className={styles.topicMeta}>
                  <span>💬 10 comments</span>
                  <span>100 reads</span>
                  <span>5 replies</span>
                </div>
              </div>
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

