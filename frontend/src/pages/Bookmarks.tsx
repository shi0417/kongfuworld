import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import ApiService from '../services/ApiService';
import NavBar from '../components/NavBar/NavBar';
import Footer from '../components/Footer/Footer';
import styles from './Bookmarks.module.css';

interface NovelCard {
  novel_id: number;
  novel_name: string;
  novel_title: string;
  last_read_chapter_id: number;
  last_read_chapter_number?: number;
  last_read_at: string;
  chapters: number;
  novel_status: 'Ongoing' | 'Completed';
  bookmark_closed: number;
  notification_off: number;
  bookmark_locked?: number;
  chapter_title?: string;
  novel_cover?: string;
  latest_chapter_id?: number;
  latest_chapter_title?: string;
  latest_chapter_number?: number;
  chapter_bookmark_locked?: number; // 章节书签锁定状态
}

interface FavoriteNovel {
  novel_id: number;
  novel_name: string;
  novel_title: string;
  chapters: number;
  novel_status: 'Ongoing' | 'Completed';
  novel_cover?: string;
  bookmark_closed: number;
  notification_off: number;
  last_read_chapter_id?: number;
  favoriteChapters: Array<{
    chapter_id: number;
    chapter_name: string;
    chapter_title?: string;
    chapter_number?: number;
    favorited_at: string;
    updated_at?: string;
  }>;
}

const Bookmarks: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'current-reads' | 'favorite-chapters'>('current-reads');
  const [currentReads, setCurrentReads] = useState<NovelCard[]>([]);
  const [favoriteChapters, setFavoriteChapters] = useState<FavoriteNovel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 分页状态
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 20,
    hasNextPage: false,
    hasPrevPage: false
  });
  
  // 视图和排序状态
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [sortBy, setSortBy] = useState<'novel-name' | 'last-read' | 'latest-release'>('last-read');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Favorite Chapters专用排序状态
  const [favoriteSortBy, setFavoriteSortBy] = useState<'novel-name' | 'last-read'>('novel-name');
  const [favoriteSortOrder, setFavoriteSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showFavoriteSortDropdown, setShowFavoriteSortDropdown] = useState(false);
  const favoriteDropdownRef = useRef<HTMLDivElement>(null);

  // 跳转到章节阅读页面
  const handleNavigateToChapter = (novelId: number, chapterId: number) => {
    navigate(`/novel/${novelId}/chapter/${chapterId}`);
  };

  // 分页控制函数
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= pagination.totalPages) {
      if (activeTab === 'current-reads') {
        fetchCurrentReads(page);
      } else if (activeTab === 'favorite-chapters') {
        fetchFavoriteChapters(page);
      }
    }
  };

  // 排序函数
  const sortNovels = (novels: NovelCard[]) => {
    return [...novels].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'novel-name':
          comparison = (a.novel_title || '').localeCompare(b.novel_title || '');
          break;
        case 'last-read':
          comparison = (a.last_read_chapter_number || a.last_read_chapter_id) - (b.last_read_chapter_number || b.last_read_chapter_id);
          break;
        case 'latest-release':
          comparison = (a.latest_chapter_number || a.latest_chapter_id || 0) - (b.latest_chapter_number || b.latest_chapter_id || 0);
          break;
        default:
          comparison = 0;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  };

  // Favorite Chapters排序函数
  const sortFavoriteNovels = (novels: FavoriteNovel[]) => {
    return [...novels].sort((a, b) => {
      let comparison = 0;
      
      switch (favoriteSortBy) {
        case 'novel-name':
          comparison = (a.novel_title || '').localeCompare(b.novel_title || '');
          break;
        case 'last-read':
          // 按最新收藏章节的时间排序
          const aLatestChapter = a.favoriteChapters.sort((x, y) => new Date(y.favorited_at).getTime() - new Date(x.favorited_at).getTime())[0];
          const bLatestChapter = b.favoriteChapters.sort((x, y) => new Date(y.favorited_at).getTime() - new Date(x.favorited_at).getTime())[0];
          comparison = new Date(aLatestChapter?.favorited_at || 0).getTime() - new Date(bLatestChapter?.favorited_at || 0).getTime();
          break;
        default:
          comparison = 0;
      }
      
      return favoriteSortOrder === 'asc' ? comparison : -comparison;
    });
  };

  // 获取当前阅读列表
  const fetchCurrentReads = async (page: number = 1) => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const response = await ApiService.get(`/bookmarks/current-reads/${user.id}?page=${page}&limit=20`);
      if (response.success) {
        console.log('获取当前阅读列表成功:', response.data);
        // 调试：打印第一本小说的数据
        if (response.data && response.data.length > 0) {
          console.log('第一本小说数据:', response.data[0]);
          console.log('第一本小说封面:', response.data[0].novel_cover);
        }
        setCurrentReads(response.data || []);
        if ((response as any).pagination) {
          setPagination((response as any).pagination);
        }
        setError(null); // 清除错误状态
      } else {
        setError('获取当前阅读列表失败');
      }
    } catch (error) {
      console.error('获取当前阅读列表失败:', error);
      setError('获取当前阅读列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取收藏章节列表
  const fetchFavoriteChapters = async (page: number = 1) => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const response = await ApiService.get(`/bookmarks/favorite-chapters/${user.id}?page=${page}&limit=20`);
      if (response.success) {
        console.log('获取收藏章节列表成功:', response.data);
        setFavoriteChapters(response.data || []);
        if ((response as any).pagination) {
          setPagination((response as any).pagination);
        }
        setError(null); // 清除错误状态
      } else {
        setError('获取收藏章节列表失败');
      }
    } catch (error) {
      console.error('获取收藏章节列表失败:', error);
      setError('获取收藏章节列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 切换章节书签锁定状态
  const toggleBookmarkLock = async (novelId: number, currentStatus: number, chapterId?: number) => {
    if (!user?.id || !chapterId) return;
    
    try {
      const newStatus = currentStatus === 1 ? 0 : 1;
      
      const response = await ApiService.post('/bookmarklocked/toggle', {
        user_id: user.id,
        novel_id: novelId,
        chapter_id: chapterId,
        bookmark_locked: newStatus
      });
      
      if (response.success) {
        console.log(`章节书签锁定状态已更新: 小说${novelId}, 章节${chapterId}, 状态${newStatus}`);
        
        // 更新本地状态
        if (activeTab === 'current-reads') {
          setCurrentReads(prev => prev.map(novel => 
            novel.novel_id === novelId 
              ? { ...novel, chapter_bookmark_locked: newStatus }
              : novel
          ));
        } else {
          setFavoriteChapters(prev => prev.map(novel => 
            novel.novel_id === novelId 
              ? { ...novel, chapter_bookmark_locked: newStatus }
              : novel
          ));
        }
      }
    } catch (error) {
      console.error('切换章节书签锁定状态失败:', error);
    }
  };

  // 切换通知状态
  const toggleNotification = async (novelId: number, currentStatus: number) => {
    if (!user?.id) return;
    
    try {
      const response = await ApiService.post('/bookmarks/toggle-notification', {
        user_id: user.id,
        novel_id: novelId,
        status: currentStatus === 1 ? 0 : 1
      });
      
      if (response.success) {
        // 更新本地状态
        if (activeTab === 'current-reads') {
          setCurrentReads(prev => prev.map(novel => 
            novel.novel_id === novelId 
              ? { ...novel, notification_off: (response as any).notification_off }
              : novel
          ));
        } else {
          setFavoriteChapters(prev => prev.map(novel => 
            novel.novel_id === novelId 
              ? { ...novel, notification_off: (response as any).notification_off }
              : novel
          ));
        }
      }
    } catch (error) {
      console.error('切换通知状态失败:', error);
    }
  };

  // 移除小说
  const removeNovel = async (novelId: number) => {
    if (!user?.id) return;
    
    try {
      const response = await ApiService.delete(`/bookmarks/remove-novel/${user.id}/${novelId}`);
      
      if (response.success) {
        // 从本地状态中移除
        if (activeTab === 'current-reads') {
          setCurrentReads(prev => prev.filter(novel => novel.novel_id !== novelId));
        } else {
          setFavoriteChapters(prev => prev.filter(novel => novel.novel_id !== novelId));
        }
      }
    } catch (error) {
      console.error('移除小说失败:', error);
    }
  };

  // 关闭小说书签
  const closeNovelBookmark = async (novelId: number) => {
    if (!user?.id) return;
    
    try {
      const response = await ApiService.post('/bookmarks/close-novel-bookmark', {
        user_id: user.id,
        novel_id: novelId
      });
      
      if (response.success) {
        // 从本地状态中移除
        if (activeTab === 'current-reads') {
          setCurrentReads(prev => prev.filter(novel => novel.novel_id !== novelId));
        } else {
          setFavoriteChapters(prev => prev.filter(novel => novel.novel_id !== novelId));
        }
      }
    } catch (error) {
      console.error('关闭小说书签失败:', error);
    }
  };

  // 移除收藏章节
  const removeFavoriteChapter = async (novelId: number, chapterId: number) => {
    if (!user?.id) return;
    
    try {
      const response = await ApiService.delete('/bookmarks/remove-favorite-chapter', {
        user_id: user.id,
        novel_id: novelId,
        chapter_id: chapterId
      });
      
      if (response.success) {
        // 更新本地状态
        setFavoriteChapters(prev => prev.map(novel => 
          novel.novel_id === novelId 
            ? { 
                ...novel, 
                favoriteChapters: novel.favoriteChapters.filter(chapter => chapter.chapter_id !== chapterId)
              }
            : novel
        ).filter(novel => novel.favoriteChapters.length > 0));
      }
    } catch (error) {
      console.error('移除收藏章节失败:', error);
    }
  };

  useEffect(() => {
    if (user?.id) {
      if (activeTab === 'current-reads') {
        fetchCurrentReads();
      } else {
        fetchFavoriteChapters();
      }
    }
  }, [user?.id, activeTab]);

  // 点击外部关闭下拉框
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSortDropdown(false);
      }
      if (favoriteDropdownRef.current && !favoriteDropdownRef.current.contains(event.target as Node)) {
        setShowFavoriteSortDropdown(false);
      }
    }

    if (showSortDropdown || showFavoriteSortDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSortDropdown, showFavoriteSortDropdown]);

  if (!user) {
    return (
      <div className={styles.pageWrapper}>
        <NavBar />
        <div className={styles.container}>
          <div className={styles.loginPrompt}>
            <h2>请先登录</h2>
            <p>您需要登录才能查看书签</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className={styles.pageWrapper}>
      <NavBar />
      <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Bookmarks</h1>
        
        <div className={styles.tabs}>
          <button 
            className={`${styles.tab} ${activeTab === 'current-reads' ? styles.active : ''}`}
            onClick={() => setActiveTab('current-reads')}
          >
            Current Reads
          </button>
          <button 
            className={`${styles.tab} ${activeTab === 'favorite-chapters' ? styles.active : ''}`}
            onClick={() => setActiveTab('favorite-chapters')}
          >
            Favorite Chapters
          </button>
        </div>
      </div>

      {/* 控制栏 - 只在Current Reads选项卡显示 */}
      {activeTab === 'current-reads' && (
        <div className={styles.controls}>
          <div className={styles.viewControls}>
            <button 
              className={`${styles.viewBtn} ${viewMode === 'list' ? styles.active : ''}`}
              onClick={() => setViewMode('list')}
              title="列表视图"
            >
              <span className={styles.listIcon}>☰</span>
            </button>
            <button 
              className={`${styles.viewBtn} ${viewMode === 'grid' ? styles.active : ''}`}
              onClick={() => setViewMode('grid')}
              title="网格视图"
            >
              <span className={styles.gridIcon}>⊞</span>
            </button>
          </div>
          
          <div className={styles.sortControls}>
            <div className={styles.sortDropdown} ref={dropdownRef}>
              <button 
                className={styles.sortButton}
                onClick={() => setShowSortDropdown(!showSortDropdown)}
              >
                <span>{sortBy === 'novel-name' ? 'Novel Name' : sortBy === 'last-read' ? 'Last Read' : 'Latest Release'}</span>
                <span className={styles.dropdownArrow}>▼</span>
              </button>
              
              {showSortDropdown && (
                <div className={styles.sortOptions}>
                  <div 
                    className={`${styles.sortOption} ${sortBy === 'novel-name' ? styles.selected : ''}`}
                    onClick={() => { setSortBy('novel-name'); setShowSortDropdown(false); }}
                  >
                    Novel Name
                  </div>
                  <div 
                    className={`${styles.sortOption} ${sortBy === 'last-read' ? styles.selected : ''}`}
                    onClick={() => { setSortBy('last-read'); setShowSortDropdown(false); }}
                  >
                    Last Read
                  </div>
                  <div 
                    className={`${styles.sortOption} ${sortBy === 'latest-release' ? styles.selected : ''}`}
                    onClick={() => { setSortBy('latest-release'); setShowSortDropdown(false); }}
                  >
                    Latest Release
                  </div>
                </div>
              )}
            </div>
            
            <button 
              className={styles.sortOrderBtn}
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              title={`排序顺序: ${sortOrder === 'asc' ? '升序' : '降序'}`}
            >
              <span className={styles.sortOrderIcon}>
                {sortOrder === 'asc' ? '▲' : '▼'}
              </span>
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>加载中...</p>
        </div>
      )}

      {error && (
        <div className={styles.error}>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>重试</button>
        </div>
      )}

      {!loading && !error && (
        <div className={styles.content}>
          {activeTab === 'current-reads' ? (
            <>
              <div className={`${styles.novelContainer} ${viewMode === 'grid' ? styles.novelGrid : styles.novelList}`}>
                {viewMode === 'list' && (
                  <div className={styles.tableHeader}>
                    <div className={styles.titleHeader}>Title</div>
                    <div className={styles.lastReadHeader}>Last Read</div>
                    <div className={styles.latestReleaseHeader}>Latest Release</div>
                    <div className={styles.actionsHeader}></div>
                  </div>
                )}
                {sortNovels(currentReads).map(novel => (
                  viewMode === 'grid' ? (
                    <NovelCard
                      key={novel.novel_id}
                      novel={novel}
                      onToggleBookmarkLock={toggleBookmarkLock}
                      onToggleNotification={toggleNotification}
                      onRemoveNovel={removeNovel}
                      onCloseNovelBookmark={closeNovelBookmark}
                      onNavigateToChapter={handleNavigateToChapter}
                    />
                  ) : (
                    <NovelListItem
                      key={novel.novel_id}
                      novel={novel}
                      onToggleBookmarkLock={toggleBookmarkLock}
                      onToggleNotification={toggleNotification}
                      onRemoveNovel={removeNovel}
                      onCloseNovelBookmark={closeNovelBookmark}
                      onNavigateToChapter={handleNavigateToChapter}
                    />
                  )
                ))}
                {currentReads.length === 0 && (
                  <div className={styles.emptyState}>
                    <p>暂无阅读记录</p>
                  </div>
                )}
              </div>
              
              {/* 分页组件 - 只在Current Reads标签页显示 */}
              {pagination.totalPages > 1 && (
                <div className={styles.pagination}>
                  <button 
                    className={`${styles.pageBtn} ${!pagination.hasPrevPage ? styles.disabled : ''}`}
                    onClick={() => handlePageChange(pagination.currentPage - 1)}
                    disabled={!pagination.hasPrevPage}
                  >
                    ‹
                  </button>
                  
                  <div className={styles.pageNumbers}>
                    {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                      let pageNum;
                      if (pagination.totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (pagination.currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (pagination.currentPage >= pagination.totalPages - 2) {
                        pageNum = pagination.totalPages - 4 + i;
                      } else {
                        pageNum = pagination.currentPage - 2 + i;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          className={`${styles.pageBtn} ${pagination.currentPage === pageNum ? styles.active : ''}`}
                          onClick={() => handlePageChange(pageNum)}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  
                  <button 
                    className={`${styles.pageBtn} ${!pagination.hasNextPage ? styles.disabled : ''}`}
                    onClick={() => handlePageChange(pagination.currentPage + 1)}
                    disabled={!pagination.hasNextPage}
                  >
                    ›
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Favorite Chapters排序控件 */}
              <div className={`${styles.controls} ${styles.favoriteControls}`}>
                <div className={styles.sortControls}>
                  <div className={styles.sortDropdown} ref={favoriteDropdownRef}>
                    <button 
                      className={styles.sortButton}
                      onClick={() => setShowFavoriteSortDropdown(!showFavoriteSortDropdown)}
                    >
                      {favoriteSortBy === 'novel-name' ? 'Novel Name' : 'Last Read'}
                      <span className={styles.sortOrderIcon}>▼</span>
                    </button>
                    
                    {showFavoriteSortDropdown && (
                      <div className={styles.sortOptions}>
                        <div 
                          className={`${styles.sortOption} ${favoriteSortBy === 'novel-name' ? styles.active : ''}`}
                          onClick={() => {
                            setFavoriteSortBy('novel-name');
                            setShowFavoriteSortDropdown(false);
                          }}
                        >
                          Novel Name
                        </div>
                        <div 
                          className={`${styles.sortOption} ${favoriteSortBy === 'last-read' ? styles.active : ''}`}
                          onClick={() => {
                            setFavoriteSortBy('last-read');
                            setShowFavoriteSortDropdown(false);
                          }}
                        >
                          Last Read
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <button 
                    className={styles.sortOrderBtn}
                    onClick={() => setFavoriteSortOrder(favoriteSortOrder === 'asc' ? 'desc' : 'asc')}
                    title={`当前排序: ${favoriteSortOrder === 'asc' ? '升序' : '降序'}`}
                  >
                    {favoriteSortOrder === 'asc' ? '▲' : '▼'}
                  </button>
                </div>
              </div>
              
              <div className={styles.favoriteGrid}>
                {sortFavoriteNovels(favoriteChapters).map(novel => (
                  <FavoriteNovelCard
                    key={novel.novel_id}
                    novel={novel}
                    onRemoveChapter={removeFavoriteChapter}
                    onNavigateToChapter={handleNavigateToChapter}
                  />
                ))}
                {favoriteChapters.length === 0 && (
                  <div className={styles.emptyState}>
                    <p>暂无收藏章节</p>
                  </div>
                )}
              </div>
              
              {/* 分页组件 - 只在Favorite Chapters标签页显示 */}
              {pagination.totalPages > 1 && (
                <div className={styles.pagination}>
                  <button 
                    className={`${styles.pageBtn} ${!pagination.hasPrevPage ? styles.disabled : ''}`}
                    onClick={() => handlePageChange(pagination.currentPage - 1)}
                    disabled={!pagination.hasPrevPage}
                  >
                    ‹
                  </button>
                  
                  <div className={styles.pageNumbers}>
                    {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                      let pageNum;
                      if (pagination.totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (pagination.currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (pagination.currentPage >= pagination.totalPages - 2) {
                        pageNum = pagination.totalPages - 4 + i;
                      } else {
                        pageNum = pagination.currentPage - 2 + i;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          className={`${styles.pageBtn} ${pagination.currentPage === pageNum ? styles.active : ''}`}
                          onClick={() => handlePageChange(pageNum)}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  
                  <button 
                    className={`${styles.pageBtn} ${!pagination.hasNextPage ? styles.disabled : ''}`}
                    onClick={() => handlePageChange(pagination.currentPage + 1)}
                    disabled={!pagination.hasNextPage}
                  >
                    ›
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
      </div>
      <Footer />
    </div>
  );
};

// 小说卡片组件
const NovelCard: React.FC<{
  novel: NovelCard;
  onToggleBookmarkLock: (novelId: number, currentStatus: number, chapterId?: number) => void;
  onToggleNotification: (novelId: number, currentStatus: number) => void;
  onRemoveNovel: (novelId: number) => void;
  onCloseNovelBookmark: (novelId: number) => void;
  onNavigateToChapter: (novelId: number, chapterId: number) => void;
}> = ({ novel, onToggleBookmarkLock, onToggleNotification, onRemoveNovel, onCloseNovelBookmark, onNavigateToChapter }) => {
  const progress = (novel.last_read_chapter_id / novel.chapters) * 100;

  return (
    <div 
      className={styles.novelCard}
      onClick={() => onNavigateToChapter(novel.novel_id, novel.last_read_chapter_id)}
      style={{ cursor: 'pointer' }}
      title="点击跳转到最后阅读章节"
    >
      <div className={styles.cardHeader}>
        <div className={styles.statusTag}>
          {novel.novel_status}
        </div>
        <button 
          className={styles.removeBtn}
          onClick={(e) => {
            e.stopPropagation();
            onCloseNovelBookmark(novel.novel_id);
          }}
          title="关闭书签"
        >
          ×
        </button>
      </div>
      
      <div className={styles.cardContent}>
        <div className={styles.novelCover}>
          {novel.novel_cover ? (
            <img 
              src={novel.novel_cover} 
              alt={novel.novel_title || '小说封面'}
              className={styles.coverImage}
              onLoad={() => {
                console.log('封面图片加载成功:', novel.novel_cover);
              }}
              onError={(e) => {
                console.log('封面图片加载失败:', novel.novel_cover);
                // 如果图片加载失败，显示占位符
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const placeholder = target.nextElementSibling as HTMLElement;
                if (placeholder) placeholder.style.display = 'flex';
              }}
            />
          ) : null}
          <div 
            className={styles.coverPlaceholder}
            style={{ 
              display: novel.novel_cover ? 'none' : 'flex',
              zIndex: novel.novel_cover ? 0 : 1
            }}
          >
            {novel.novel_title ? novel.novel_title.charAt(0) : '?'}
          </div>
        </div>
        
        <div className={styles.novelInfo}>
          <h3 className={styles.novelTitle}>
            {novel.novel_title || '未知小说'}
          </h3>
          
          <div className={styles.progressSection}>
            <p className={styles.progressText}>
              You have read {novel.last_read_chapter_number || novel.last_read_chapter_id}/{novel.chapters}
            </p>
            <div className={styles.progressBar}>
              <div 
                className={styles.progressFill}
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
          
          <div className={styles.actionButtons}>
            <button 
              className={`${styles.actionBtn} ${(novel.chapter_bookmark_locked || 0) ? styles.active : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleBookmarkLock(novel.novel_id, novel.chapter_bookmark_locked || 0, novel.last_read_chapter_id);
              }}
            >
              {(novel.chapter_bookmark_locked || 0) ? '🔒' : '🔓'} {(novel.chapter_bookmark_locked || 0) ? 'Bookmark locked' : 'Lock bookmark'}
            </button>
            
            <button 
              className={`${styles.actionBtn} ${novel.notification_off ? styles.active : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleNotification(novel.novel_id, novel.notification_off);
              }}
            >
              {novel.notification_off ? '🔕' : '🔔'} {novel.notification_off ? 'Notification off' : 'Notification'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// 小说列表项组件 - 用于列表视图
const NovelListItem: React.FC<{
  novel: NovelCard;
  onToggleBookmarkLock: (novelId: number, currentStatus: number, chapterId?: number) => void;
  onToggleNotification: (novelId: number, currentStatus: number) => void;
  onRemoveNovel: (novelId: number) => void;
  onCloseNovelBookmark: (novelId: number) => void;
  onNavigateToChapter: (novelId: number, chapterId: number) => void;
}> = ({ novel, onToggleBookmarkLock, onToggleNotification, onRemoveNovel, onCloseNovelBookmark, onNavigateToChapter }) => {
  return (
    <div className={styles.novelListItem}>
      <div 
        className={styles.novelTitle}
        onClick={() => onNavigateToChapter(novel.novel_id, novel.last_read_chapter_id)}
        style={{ cursor: 'pointer' }}
        title="点击跳转到最后阅读章节"
      >
        {novel.novel_title || '未知小说'}
      </div>
      
      <div 
        className={styles.lastReadColumn}
        onClick={() => onNavigateToChapter(novel.novel_id, novel.last_read_chapter_id)}
        style={{ cursor: 'pointer' }}
        title="点击跳转到最后阅读章节"
      >
        Chapter {novel.last_read_chapter_number || novel.last_read_chapter_id} - {novel.chapter_title || `Chapter ${novel.last_read_chapter_number || novel.last_read_chapter_id}`}
      </div>
      
      <div 
        className={styles.latestReleaseColumn}
        onClick={() => novel.latest_chapter_id ? onNavigateToChapter(novel.novel_id, novel.latest_chapter_id) : undefined}
        style={{ cursor: novel.latest_chapter_id ? 'pointer' : 'default' }}
        title={novel.latest_chapter_id ? "点击跳转到最新章节" : undefined}
      >
        {novel.latest_chapter_id ? `Chapter ${novel.latest_chapter_number || novel.latest_chapter_id} - ${novel.latest_chapter_title || `Chapter ${novel.latest_chapter_number || novel.latest_chapter_id}`}` : 'No chapters available'}
      </div>
      
      <div className={styles.novelActions}>
        <button 
          className={`${styles.actionIcon} ${(novel.chapter_bookmark_locked || 0) ? styles.active : ''}`}
          onClick={() => onToggleBookmarkLock(novel.novel_id, novel.chapter_bookmark_locked || 0, novel.last_read_chapter_id)}
          title={(novel.chapter_bookmark_locked || 0) ? 'Bookmark locked' : 'Lock bookmark'}
        >
          {(novel.chapter_bookmark_locked || 0) ? '🔒' : '🔓'}
        </button>
        
        <button 
          className={`${styles.actionIcon} ${novel.notification_off ? styles.active : ''}`}
          onClick={() => onToggleNotification(novel.novel_id, novel.notification_off)}
          title={novel.notification_off ? 'Notification off' : 'Notification'}
        >
          {novel.notification_off ? '🔕' : '🔔'}
        </button>
        
        <button 
          className={styles.removeIcon}
          onClick={(e) => {
            e.stopPropagation();
            onCloseNovelBookmark(novel.novel_id);
          }}
          title="关闭书签"
        >
          ×
        </button>
      </div>
    </div>
  );
};

// 收藏小说卡片组件
const FavoriteNovelCard: React.FC<{
  novel: FavoriteNovel;
  onRemoveChapter: (novelId: number, chapterId: number) => void;
  onNavigateToChapter: (novelId: number, chapterId: number) => void;
}> = ({ novel, onRemoveChapter, onNavigateToChapter }) => {
  const [expanded, setExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [chapterToDelete, setChapterToDelete] = useState<{novelId: number, chapterId: number, chapterName: string} | null>(null);

  const handleChapterClick = (novelId: number, chapterId: number) => {
    onNavigateToChapter(novelId, chapterId);
  };

  const handleDeleteClick = (e: React.MouseEvent, novelId: number, chapterId: number, chapterName: string) => {
    e.stopPropagation();
    setChapterToDelete({ novelId, chapterId, chapterName });
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    if (chapterToDelete) {
      onRemoveChapter(chapterToDelete.novelId, chapterToDelete.chapterId);
      setShowDeleteConfirm(false);
      setChapterToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setChapterToDelete(null);
  };

  return (
    <div className={styles.favoriteCard}>
      <div 
        className={styles.favoriteHeader}
        onClick={() => setExpanded(!expanded)}
        style={{ cursor: 'pointer' }}
        title="点击展开/折叠章节列表"
      >
        <div className={styles.novelCover}>
          {novel.novel_cover ? (
            <img 
              src={novel.novel_cover} 
              alt={novel.novel_title || '小说封面'}
              className={styles.coverImage}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.setAttribute('style', 'display: flex; z-index: 1;');
              }}
            />
          ) : null}
          <div 
            className={styles.coverPlaceholder}
            style={{ 
              display: novel.novel_cover ? 'none' : 'flex',
              zIndex: novel.novel_cover ? 0 : 1
            }}
          >
            {novel.novel_title ? novel.novel_title.charAt(0) : '?'}
          </div>
        </div>
        
        <div className={styles.favoriteInfo}>
          <h3 className={styles.novelTitle}>{novel.novel_title || '未知小说'}</h3>
          <p className={styles.chapterCount}>
            {novel.favoriteChapters.length} 个收藏章节
          </p>
        </div>
        
        <div className={styles.favoriteActions}>
          <button 
            className={styles.expandBtn}
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>
      
      {expanded && (
        <div className={styles.chapterList}>
          {novel.favoriteChapters.map(chapter => (
            <div key={chapter.chapter_id} className={styles.chapterItem}>
              <span 
                className={styles.chapterName}
                onClick={() => handleChapterClick(novel.novel_id, chapter.chapter_id)}
                style={{ cursor: 'pointer' }}
                title="点击跳转到章节阅读页面"
              >
                {chapter.chapter_title || chapter.chapter_name}
                {chapter.chapter_number && ` (第${chapter.chapter_number}章)`}
              </span>
              <button 
                className={styles.removeChapterBtn}
                onClick={(e) => handleDeleteClick(e, novel.novel_id, chapter.chapter_id, chapter.chapter_title || chapter.chapter_name)}
                title="移除收藏"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      
      {/* 删除确认模态框 */}
      {showDeleteConfirm && chapterToDelete && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3 className={styles.modalTitle}>Are you sure?</h3>
            <p className={styles.modalMessage}>
              Do you want to delete '{chapterToDelete.chapterName}' from your favorite chapters list?
            </p>
            <div className={styles.modalActions}>
              <button 
                className={styles.modalBtnCancel}
                onClick={handleCancelDelete}
              >
                No
              </button>
              <button 
                className={styles.modalBtnConfirm}
                onClick={handleConfirmDelete}
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Bookmarks;
