import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../components/NavBar/NavBar';
import BannerCarousel from '../components/BannerCarousel/BannerCarousel';
import Announcements from '../components/Announcements/Announcements';
import NovelListSection from '../components/NovelListSection/NovelListSection';
import Footer from '../components/Footer/Footer';
import homepageService, { Novel, Banner } from '../services/homepageService';
import styles from './Home.module.css';

const HomeDynamic: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 数据状态
  const [banners, setBanners] = useState<Banner[]>([]);
  const [popularNovels, setPopularNovels] = useState<Novel[]>([]);
  const [newReleases, setNewReleases] = useState<Novel[]>([]);
  const [topSeries, setTopSeries] = useState<Novel[]>([]);

  useEffect(() => {
    loadHomepageData();
  }, []);

  const loadHomepageData = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await homepageService.getAllHomepageData();
      
      setBanners(data.banners);
      setPopularNovels(data.popularNovels);
      setNewReleases(data.newReleases);
      setTopSeries(data.topSeries);

    } catch (err) {
      console.error('加载首页数据失败:', err);
      setError('加载首页数据失败，请稍后重试');
      
      // 如果API失败，使用默认数据
      loadFallbackData();
    } finally {
      setLoading(false);
    }
  };

  const loadFallbackData = () => {
    // 备用数据，当API失败时使用
    const fallbackPopular = [
      { id: 1, cover: 'https://picsum.photos/140/180?1', title: "The People's God", author: 'Han Wu', status: 'Ongoing', rating: 4.5, reviews: 120 },
      { id: 2, cover: 'https://picsum.photos/140/180?2', title: "Here's an Opportunity", author: 'Unknown', status: 'Ongoing', rating: 4.2, reviews: 89 },
      { id: 3, cover: 'https://picsum.photos/140/180?3', title: "World's No. 1 Swordsman", author: 'Wang Sheng', status: 'Ongoing', rating: 4.7, reviews: 156 },
    ];

    const fallbackNew = [
      { id: 4, cover: 'https://picsum.photos/140/180?4', title: 'Not a Regressor', author: 'Unknown', status: 'Ongoing', rating: 4.0, reviews: 45 },
      { id: 5, cover: 'https://picsum.photos/140/180?5', title: 'My Journey to Immortality', author: 'Li Yuan', status: 'Ongoing', rating: 4.3, reviews: 78 },
      { id: 6, cover: 'https://picsum.photos/140/180?6', title: "The Duke's Son :Re", author: 'Unknown', status: 'Ongoing', rating: 4.1, reviews: 67 },
    ];

    const fallbackTop = [
      { id: 7, cover: 'https://picsum.photos/140/180?7', title: 'Overgeared', author: 'Unknown', status: 'Completed', rating: 4.8, reviews: 234 },
      { id: 8, cover: 'https://picsum.photos/140/180?8', title: 'Champion', author: 'Unknown', status: 'Ongoing', rating: 4.6, reviews: 189 },
      { id: 9, cover: 'https://picsum.photos/140/180?9', title: 'Sneak Peeks', author: 'Unknown', status: 'Preview', rating: 4.4, reviews: 98 },
    ];

    setPopularNovels(fallbackPopular);
    setNewReleases(fallbackNew);
    setTopSeries(fallbackTop);
  };

  const handleNovelClick = (novel: Novel) => {
    // 记录访问统计
    homepageService.recordNovelView(novel.id);
    // 导航到小说详情页
    navigate(`/book/${novel.id}`);
  };

  if (loading) {
    return (
      <div>
        <NavBar />
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner}></div>
          <p>加载中...</p>
        </div>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <NavBar />
        <div className={styles.errorContainer}>
          <p className={styles.errorMessage}>{error}</p>
          <button onClick={loadHomepageData} className={styles.retryButton}>
            重试
          </button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div>
      <NavBar />
      <div className={styles.topRow}>
        <div className={styles.left}>
          <BannerCarousel banners={banners} />
        </div>
        <div className={styles.right}>
          <Announcements />
        </div>
      </div>
      
      <NovelListSection 
        title="Popular This Week" 
        novels={popularNovels} 
        onNovelClick={handleNovelClick}
      />
      <NovelListSection 
        title="New Releases" 
        novels={newReleases} 
        onNovelClick={handleNovelClick}
      />
      <NovelListSection 
        title="Top Series" 
        novels={topSeries} 
        onNovelClick={handleNovelClick}
      />
      
      <Footer />
    </div>
  );
};

export default HomeDynamic;
