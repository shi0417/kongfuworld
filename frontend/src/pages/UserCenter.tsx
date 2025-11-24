import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import NavBar from '../components/NavBar/NavBar';
import Footer from '../components/Footer/Footer';
import styles from './UserCenter.module.css';

// 导入各个选项卡组件
import DailyRewards from '../components/UserCenter/DailyRewards';
import Champion from '../components/UserCenter/Champion';
import Karma from '../components/UserCenter/Karma';
import Billing from '../components/UserCenter/Billing';
import FAQ from '../components/UserCenter/FAQ';

type TabType = 'daily-rewards' | 'champion' | 'karma' | 'billing' | 'faq';

const UserCenter: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('karma');
  const [loading, setLoading] = useState(true);

  // 认证检查
  useEffect(() => {
    const checkAuth = () => {
      if (!isAuthenticated || !user) {
        console.log('UserCenter: 认证检查失败，重定向到登录页');
        navigate('/login?redirect=/user-center');
        return;
      }
      setLoading(false);
    };

    // 延迟检查认证状态，确保登录后的状态更新完成
    const timeoutId = setTimeout(checkAuth, 100);
    return () => clearTimeout(timeoutId);
  }, [isAuthenticated, user, navigate]);

  // 从URL参数获取默认选项卡
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['daily-rewards', 'champion', 'karma', 'billing', 'faq'].includes(tabParam)) {
      setActiveTab(tabParam as TabType);
    }
  }, [searchParams]);

  const tabs = [
    { id: 'daily-rewards' as TabType, label: 'Daily Rewards' },
    { id: 'champion' as TabType, label: 'Champion' },
    { id: 'karma' as TabType, label: 'Karma' },
    { id: 'billing' as TabType, label: 'Billing' },
    { id: 'faq' as TabType, label: 'FAQ' }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'daily-rewards':
        return <DailyRewards />;
      case 'champion':
        return <Champion />;
      case 'karma':
        return <Karma />;
      case 'billing':
        return <Billing />;
      case 'faq':
        return <FAQ />;
      default:
        return <Karma />;
    }
  };

  // 显示加载状态
  if (loading) {
    return (
      <div className={styles.userCenterPage}>
        <NavBar />
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner}></div>
          <p>Loading...</p>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className={styles.userCenterPage}>
      {/* 全局顶部导航栏 */}
      <NavBar />
      
      {/* 页面顶部导航 */}
      <div className={styles.topNav}>
        {tabs.map((tab) => (
          <div 
            key={tab.id}
            className={`${styles.navItem} ${activeTab === tab.id ? styles.active : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </div>
        ))}
      </div>

      {/* 主要内容 */}
      <div className={styles.mainContent}>
        {renderTabContent()}
      </div>
      
      {/* 全局底部导航栏 */}
      <Footer />
    </div>
  );
};

export default UserCenter;
