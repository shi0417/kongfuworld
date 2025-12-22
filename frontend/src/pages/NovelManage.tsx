import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import NavBar from '../components/NavBar/NavBar';
import ApiService from '../services/ApiService';
import { AuthorSidebar, useAuthorSidebarState } from '../components/AuthorCenter';
import styles from './NovelManage.module.css';
import NovelInfoTab from './NovelManage/NovelInfoTab';
import ChapterManageTab from './NovelManage/ChapterManageTab';
import DraftBoxTab from './NovelManage/DraftBoxTab';
import WorkStagesTab from './NovelManage/WorkStagesTab';
import MemberSettingsTab from './NovelManage/MemberSettingsTab';
import ChargeManagementTab from './NovelManage/ChargeManagementTab';

interface Novel {
  id: number;
  title: string;
  status: string;
  cover: string | null;
  description: string;
  recommendation: string | null;
  languages: string | null;
  author: string | null;
  translator: string | null;
}

const NovelManage: React.FC = () => {
  const { novelId } = useParams<{ novelId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [novel, setNovel] = useState<Novel | null>(null);
  const [loading, setLoading] = useState(true);
  
  // 从URL参数获取tab，如果没有则默认为'info'
  const tabFromUrl = searchParams.get('tab') as 'info' | 'chapters' | 'upload' | 'drafts' | 'stages' | 'members' | 'charges' | null;
  const [activeTab, setActiveTab] = useState<'info' | 'chapters' | 'upload' | 'drafts' | 'stages' | 'members' | 'charges'>(
    tabFromUrl && ['info', 'chapters', 'upload', 'drafts', 'stages', 'members', 'charges'].includes(tabFromUrl) 
      ? tabFromUrl 
      : 'info'
  );
  
  // 当URL参数中的tab变化时，更新activeTab
  useEffect(() => {
    if (tabFromUrl && ['info', 'chapters', 'upload', 'drafts', 'stages', 'members', 'charges'].includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  // 当切换到上传选项卡时，自动导航到上传页面
  useEffect(() => {
    if (activeTab === 'upload' && novel && novelId) {
      navigate(`/novel-upload?novelId=${novelId}&title=${encodeURIComponent(novel.title)}`);
    }
  }, [activeTab, novel, novelId, navigate]);
  const { expandedMenus, toggleMenu } = useAuthorSidebarState();

  // 检查认证
  useEffect(() => {
    if (!isAuthenticated || !user) {
      navigate('/login?redirect=/novel-manage/' + novelId);
      return;
    }
  }, [isAuthenticated, user, navigate, novelId]);

  // 加载小说信息
  useEffect(() => {
    const loadNovel = async () => {
      if (!novelId) return;
      
      try {
        // TODO: 实现获取小说详细信息的API
        const response = await ApiService.get(`/novel/${novelId}`);
        const novelData = response.data || response;
        
        // 验证用户是否有权限管理该小说
        if (novelData.user_id !== user?.id) {
          alert(language === 'zh' ? '您没有权限管理该小说' : 'You do not have permission to manage this novel');
          navigate('/writers-zone');
          return;
        }
        
        setNovel(novelData);
      } catch (error) {
        console.error('加载小说信息失败:', error);
        alert(language === 'zh' ? '加载小说信息失败' : 'Failed to load novel information');
        navigate('/writers-zone');
      } finally {
        setLoading(false);
      }
    };

    if (user && novelId) {
      loadNovel();
    }
  }, [novelId, user, navigate, language]);

  if (loading) {
    return (
      <div className={`${styles.container} ${styles[theme]}`}>
        <NavBar />
        <div className={styles.loading}>
          {language === 'zh' ? '加载中...' : 'Loading...'}
        </div>
      </div>
    );
  }

  if (!novel) {
    return (
      <div className={`${styles.container} ${styles[theme]}`}>
        <NavBar />
        <div className={styles.error}>
          {language === 'zh' ? '小说不存在' : 'Novel not found'}
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${styles[theme]}`}>
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
              <span>{user?.username || 'User'}</span>
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
        <AuthorSidebar
          t={t}
          navigate={(to) => navigate(to)}
          styles={styles}
          activeKey="novels"
          expandedMenus={expandedMenus}
          onToggleMenu={toggleMenu}
        />

        {/* Main Content */}
        <main className={styles.content}>
          <div className={styles.manageContainer}>
            {/* Tabs */}
            <div className={styles.tabs}>
              <button
                className={`${styles.tab} ${activeTab === 'info' ? styles.active : ''}`}
                onClick={() => {
                  setActiveTab('info');
                  setSearchParams({});
                }}
              >
                {language === 'zh' ? '作品信息' : 'Work Info'}
              </button>
              <button
                className={`${styles.tab} ${activeTab === 'chapters' ? styles.active : ''}`}
                onClick={() => {
                  setActiveTab('chapters');
                  setSearchParams({ tab: 'chapters' });
                }}
              >
                {language === 'zh' ? '章节管理' : 'Chapter Management'}
              </button>
              <button
                className={`${styles.tab} ${activeTab === 'upload' ? styles.active : ''}`}
                onClick={() => setActiveTab('upload')}
              >
                {language === 'zh' ? '上传章节' : 'Upload Chapter'}
              </button>
              <button
                className={`${styles.tab} ${activeTab === 'drafts' ? styles.active : ''}`}
                onClick={() => setActiveTab('drafts')}
              >
                {language === 'zh' ? '草稿箱' : 'Draft Box'}
              </button>
              <button
                className={`${styles.tab} ${activeTab === 'stages' ? styles.active : ''}`}
                onClick={() => setActiveTab('stages')}
              >
                {language === 'zh' ? '作品阶段' : 'Work Stages'}
              </button>
              <button
                className={`${styles.tab} ${activeTab === 'members' ? styles.active : ''}`}
                onClick={() => setActiveTab('members')}
              >
                {language === 'zh' ? '会员设置' : 'Member Settings'}
              </button>
              <button
                className={`${styles.tab} ${activeTab === 'charges' ? styles.active : ''}`}
                onClick={() => setActiveTab('charges')}
              >
                {language === 'zh' ? '收费管理' : 'Charge Management'}
              </button>
            </div>

            {/* Tab Content */}
            <div className={styles.tabContent}>
              {activeTab === 'info' && <NovelInfoTab novelId={parseInt(novelId || '0')} novel={novel} />}
              {activeTab === 'chapters' && <ChapterManageTab novelId={parseInt(novelId || '0')} novelTitle={novel.title} />}
              {activeTab === 'upload' && (
                <div style={{ padding: '2rem' }}>
                  <p>{language === 'zh' ? '正在跳转到上传章节页面...' : 'Redirecting to upload page...'}</p>
                </div>
              )}
              {activeTab === 'drafts' && <DraftBoxTab novelId={parseInt(novelId || '0')} novelTitle={novel.title} />}
              {activeTab === 'stages' && <WorkStagesTab novelId={parseInt(novelId || '0')} />}
              {activeTab === 'members' && <MemberSettingsTab novelId={parseInt(novelId || '0')} />}
              {activeTab === 'charges' && <ChargeManagementTab novelId={parseInt(novelId || '0')} />}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default NovelManage;

