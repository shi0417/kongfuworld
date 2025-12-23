import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import NavBar from '../components/NavBar/NavBar';
import Footer from '../components/Footer/Footer';
import DailyRewardsModal from '../components/DailyRewardsModal/DailyRewardsModal';
import ReviewSectionNew from '../components/ReviewSection/ReviewSectionNew';
import ChapterDisplay from '../components/ChapterDisplay/ChapterDisplay';
import ChampionDisplay from '../components/ChampionDisplay/ChampionDisplay';
import { useAuth, useUser } from '../hooks/useAuth';
import ApiService from '../services/ApiService';
import checkinService from '../services/checkinService';
import novelService, { NovelDetail } from '../services/novelService';
import readingService, { ReadingProgress } from '../services/readingService';
import reviewService, { ReviewStats } from '../services/reviewService';
import { API_BASE_URL } from '../config';
import { debugAuthStatus } from '../utils/authDebug';

const BookDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, user: authUser } = useAuth();
  const { user: userData } = useUser();
  const [showMore, setShowMore] = useState(false);
  const [tab, setTab] = useState('About');
  const [showDailyModal, setShowDailyModal] = useState(false);
  const hasAppliedQueryTabRef = useRef(false);
  
  // 小说数据状态
  const [book, setBook] = useState<NovelDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 评论统计状态
  const [reviewStats, setReviewStats] = useState<ReviewStats | null>(null);
  
  // 阅读进度状态
  const [readingProgress, setReadingProgress] = useState<ReadingProgress | null>(null);
  // 使用认证Hook，无需手动管理用户状态
  const user = authUser || userData;

  // 使用认证Hook，无需手动监听localStorage变化

  // 获取小说详情和阅读进度
  useEffect(() => {
    const loadNovelDetail = async () => {
      if (!id) {
        setError('小说ID不存在');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const novelDetail = await novelService.getNovelDetail(parseInt(id));
        setBook(novelDetail);
        
        // 如果当前 tab 是 Champion 但该小说未批准 Champion 功能，切换到 About tab
        if (tab === 'Champion' && novelDetail.champion_status !== 'approved') {
          setTab('About');
        }
        
        // 获取评论统计
        try {
          const stats = await reviewService.getNovelReviewStats(parseInt(id));
          setReviewStats(stats);
        } catch (statsError) {
          console.log('获取评论统计失败:', statsError);
        }
        
        // 如果用户已登录，获取阅读进度
        if (user) {
          try {
            const progress = await readingService.getUserReadingProgress(user.id, parseInt(id));
            setReadingProgress(progress);
          } catch (err) {
            console.error('获取阅读进度失败:', err);
            // 阅读进度获取失败不影响主要功能
          }
        }
      } catch (err) {
        console.error('加载小说详情失败:', err);
        setError('加载小说详情失败，请稍后重试');
      } finally {
        setLoading(false);
      }
    };

    loadNovelDetail();
  }, [id, user]);

  // 仅支持 ?tab=champion：首次加载时根据 query + book 状态自动激活 Champion Tab
  // - 不引入新状态管理
  // - 不影响用户后续手动点击 Tabs（只应用一次）
  // - 如果 Champion 未启用则回退 About
  useEffect(() => {
    if (hasAppliedQueryTabRef.current) return;
    if (!book) return;

    const tabParam = searchParams.get('tab');
    if (tabParam !== 'champion') {
      hasAppliedQueryTabRef.current = true;
      return;
    }

    if (book.champion_status === 'approved') {
      setTab('Champion');
    } else {
      setTab('About');
    }

    hasAppliedQueryTabRef.current = true;
  }, [searchParams, book]);

  // 检查是否应该显示签到弹窗
  useEffect(() => {
    const checkShouldShowModal = async () => {
      try {
        const shouldShow = await checkinService.shouldShowCheckinModal();
        setShowDailyModal(shouldShow);
      } catch (error) {
        console.error('检查签到弹窗状态失败:', error);
        setShowDailyModal(false);
      }
    };

    checkShouldShowModal();
  }, []);

  // 处理开始阅读按钮点击
  const handleStartReading = () => {
    if (!id) return;
    
    // 如果用户未登录，跳转到登录页面
    if (!user) {
      navigate(`/login?redirect=/book/${id}`);
      return;
    }
    
    // 根据阅读进度决定跳转的章节
    let targetChapterId: number;
    
    if (readingProgress) {
      // 用户有阅读记录，跳转到最后阅读的章节
      targetChapterId = readingProgress.chapter_id;
    } else {
      // 用户没有阅读记录，跳转到第一章
      // 这里需要从API获取第一章的ID，暂时使用章节号作为ID
      // 在实际应用中，应该调用API获取第一章的真实ID
      targetChapterId = 1; // 这里应该从API获取第一章ID，暂时使用章节号
    }
    
    // 跳转到章节阅读页面
    navigate(`/novel/${id}/chapter/${targetChapterId}`);
  };

  // 获取开始阅读按钮的文本
  const getStartReadingButtonText = () => {
    if (!user) return 'START READING';
    if (!readingProgress) return 'START READING';
    if (readingProgress.is_first_read) return 'START READING';
    return 'CONTINUE READING';
  };

  // 处理图片URL，确保使用完整的URL
  const getImageUrl = (coverPath: string) => {
    if (!coverPath) return '/default-cover.jpg'; // 默认封面
    
    // 如果已经是完整URL，直接返回
    if (coverPath.startsWith('http://') || coverPath.startsWith('https://')) {
      return coverPath;
    }
    
    // 如果是相对路径，添加API基础URL
    if (coverPath.startsWith('/')) {
      return `${API_BASE_URL}${coverPath}`;
    }
    
    // 如果是其他情况，直接返回
    return coverPath;
  };

  // 展开/收起简介逻辑
  const shortDesc = book?.description && book.description.length > 150 ? book.description.slice(0, 150) + '...' : book?.description || '';
  const showToggle = book?.description && book.description.length > 150;

  // 加载状态
  if (loading) {
    return (
      <div style={{ background: 'var(--bg-primary)', minHeight: '100vh', color: 'var(--text-primary)', fontFamily: 'inherit', padding: '0 0 40px 0' }}>
        <NavBar />
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', marginBottom: '16px' }}>📚</div>
            <div>加载小说详情中...</div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // 错误状态
  if (error || !book) {
    return (
      <div style={{ background: 'var(--bg-primary)', minHeight: '100vh', color: 'var(--text-primary)', fontFamily: 'inherit', padding: '0 0 40px 0' }}>
        <NavBar />
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', marginBottom: '16px' }}>❌</div>
            <div style={{ marginBottom: '16px' }}>{error || '小说不存在'}</div>
            <button 
              onClick={() => navigate('/')}
              style={{
                padding: '8px 16px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              返回首页
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '100vh', color: 'var(--text-primary)', fontFamily: 'inherit', padding: '0 0 40px 0' }}>
      <DailyRewardsModal open={showDailyModal} onClose={() => setShowDailyModal(false)} />
      <NavBar />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 24px 0 24px', display: 'flex', gap: 40 }}>
        {/* Cover */}
        <div style={{ flex: '0 0 260px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <img 
            src={getImageUrl(book.cover)} 
            alt={book.title} 
            style={{ width: 240, height: 340, borderRadius: 8, boxShadow: '0 4px 32px #0008', objectFit: 'cover', background: '#222' }}
            onError={(e) => {
              e.currentTarget.src = '/default-cover.jpg';
            }}
          />
        </div>
        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ marginBottom: 8 }}>
            <span style={{ background: '#fff', color: '#222', fontWeight: 600, fontSize: 15, borderRadius: 6, padding: '2px 12px', marginRight: 8 }}>{book.status}</span>
            <div style={{ fontWeight: 700, fontSize: 32, marginTop: 8 }}>{book.title}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
            <span style={{ fontSize: 18 }}>👍 {reviewStats ? reviewStats.recommendation_rate : book.rating}%</span>
            <span style={{ fontSize: 18 }}>💙 {reviewStats ? reviewStats.total_reviews : book.reviews} Reviews</span>
          </div>
          <div style={{ marginBottom: 4 }}>
            <span style={{ color: '#aaa' }}>Author: </span><span style={{ fontWeight: 600 }}>{book.author}</span>
          </div>
          {book.translator && (
            <div style={{ marginBottom: 4 }}>
              <span style={{ color: '#aaa' }}>Translator: </span><span style={{ fontWeight: 600 }}>{book.translator}</span>
            </div>
          )}
          <div style={{ color: '#ccc', fontSize: 16, marginBottom: 8, lineHeight: 1.7, maxWidth: 600 }}>
            {showMore ? (book.description || '暂无简介') : shortDesc}
            {showToggle && (
              <div>
                <button
                  onClick={() => setShowMore(v => !v)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#2196f3',
                    fontWeight: 600,
                    fontSize: 16,
                    cursor: 'pointer',
                    padding: 0,
                    marginTop: 4,
                  }}
                >
                  {showMore ? 'Show less 5e' : 'Show more 5f'}
                </button>
              </div>
            )}
          </div>
          <div style={{ margin: '24px 0 0 0' }}>
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '8px 18px', color: '#6cf', fontWeight: 600, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
              <span>🕒 2 Free Chapters Every 23 Hrs</span>
              <span style={{ color: 'var(--text-primary)', background: 'var(--bg-tertiary)', borderRadius: 4, padding: '2px 8px', fontSize: 15 }}>23:00:00</span>
            </div>
            <button 
              onClick={handleStartReading}
              style={{ background: 'linear-gradient(90deg, #1976d2 0%, #21a1ff 100%)', color: '#fff', fontWeight: 700, fontSize: 20, border: 'none', borderRadius: 10, padding: '14px 48px', cursor: 'pointer', boxShadow: '0 2px 12px #1976d244' }}
            >
              {getStartReadingButtonText()}
            </button>
          </div>
        </div>
      </div>
      {/* Tabs */}
      <div style={{ maxWidth: 1100, margin: '32px auto 0 auto', padding: '0 24px', borderBottom: '2px solid var(--border-color)', display: 'flex', gap: 32, fontSize: 20, fontWeight: 600, position: 'relative' }}>
        {['About', 'Chapters', ...(book?.champion_status === 'approved' ? ['Champion'] : [])].map((t) => (
          <div
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '12px 0',
              borderBottom: tab === t ? '3px solid #2196f3' : '3px solid transparent',
              color: tab === t ? 'var(--text-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              position: 'relative',
              flex: 1,
              textAlign: 'center',
            }}
          >
            {/* Sponsor this story! 气泡 */}
            {t === 'Champion' && tab === 'Champion' && (
              <div style={{
                position: 'absolute',
                left: '50%',
                top: -54,
                transform: 'translateX(-50%)',
                zIndex: 2,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}>
                <div style={{
                  background: 'linear-gradient(90deg, #7b61ff 0%, #4fc3f7 100%)',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: 22,
                  borderRadius: 16,
                  padding: '10px 32px',
                  marginBottom: 0,
                  boxShadow: '0 2px 8px #0002',
                  whiteSpace: 'nowrap',
                }}>
                  Sponsor this story!
                </div>
                <div style={{
                  width: 0,
                  height: 0,
                  borderLeft: '14px solid transparent',
                  borderRight: '14px solid transparent',
                  borderTop: '14px solid #7b61ff',
                  marginTop: -2,
                  filter: 'drop-shadow(0 2px 4px #0002)',
                }} />
              </div>
            )}
            {t}
          </div>
        ))}
      </div>
      {/* About Tab Content */}
      {tab === 'About' && (
        <div style={{ maxWidth: 1100, margin: '32px auto 0 auto', padding: '0 24px', display: 'flex', gap: 80, flexDirection: 'column' }}>
          <div style={{ display: 'flex', gap: 80, alignItems: 'flex-end', marginBottom: 0, paddingBottom: 0 }}>
            <div>
              <div style={{ color: '#aaa', fontSize: 17, marginBottom: 8 }}>Chapters</div>
              <div style={{ fontWeight: 700, fontSize: 22 }}>{book.chapters} Chapters</div>
            </div>
            {book.licensed_from && (
              <div>
                <div style={{ color: '#aaa', fontSize: 17, marginBottom: 8 }}>Licensed From</div>
                <div style={{ fontWeight: 700, fontSize: 20 }}>{book.licensed_from}</div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }}>
            {/* 暂时使用默认标签，后续可以从数据库获取 */}
            {['Chinese', 'Comedy', 'Cultivation', 'Reincarnator', 'Xianxia', 'Action', 'Modern Setting'].map((tag) => (
              <span key={tag} style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', borderRadius: 8, padding: '6px 18px', fontWeight: 600, fontSize: 15 }}>{tag}</span>
            ))}
          </div>
          {/* 简介介绍区块 */}
          <div style={{ borderTop: '1px solid var(--border-color)', marginTop: 0, paddingTop: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 22, marginBottom: 12 }}>Details</div>
            {book.translator && (
              <div style={{ color: '#aaa', fontStyle: 'italic', marginBottom: 16 }}>
                Translated by {book.translator}. The translator tag user name is {book.translator}.
              </div>
            )}
            <div style={{ fontWeight: 600, marginBottom: 12 }}>
              <span style={{ textDecoration: 'underline', cursor: 'pointer' }}>Official Blurb.</span>
            </div>
            <div style={{ color: '#eee', fontSize: 17, lineHeight: 1.8, whiteSpace: 'pre-line' }}>
              {book.description || '暂无详细描述'}
            </div>
          </div>
        {/* 评论区块 */}
        <ReviewSectionNew novelId={parseInt(id!)} user={user} />
        </div>
      )}
      {/* Chapters Tab Content */}
      {tab === 'Chapters' && (
        <ChapterDisplay novelId={parseInt(id!)} user={user} />
      )}
      
      {/* Related Novels Section */}
      {tab === 'About' && (
        <div style={{ marginTop: 48 }}>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 28, marginBottom: 24 }}>Related Novels</div>
            <div style={{ display: 'flex', gap: 32 }}>
              {/* 示例相关小说卡片 */}
              {[{
                cover: 'https://static.wuxiaworld.com/bookcover/star-odyssey.png',
                title: 'Star Odyssey',
                status: 'Ongoing',
                rating: 78
              }, {
                cover: 'https://static.wuxiaworld.com/bookcover/a-villains-will-to-survive.png',
                title: "A Villain's Will to Survive",
                status: 'Ongoing',
                rating: 93
              }, {
                cover: 'https://static.wuxiaworld.com/bookcover/life-once-again.png',
                title: 'Life, Once Again!',
                status: 'Completed',
                rating: 94
              }, {
                cover: 'https://static.wuxiaworld.com/bookcover/rebirth-of-a-fashionista.png',
                title: 'Rebirth of a Fashionista: This Life Is Soo Last Season!',
                status: 'Completed',
                rating: 46
              }, {
                cover: 'https://static.wuxiaworld.com/bookcover/barbarians-adventure.png',
                title: "Barbarian's Adventure in a Fantasy World",
                status: 'Ongoing',
                rating: 68
              }].map((novel, idx) => (
                <div key={idx} style={{ width: 160, background: 'var(--bg-secondary)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px #0002', marginRight: 8 }}>
                  <div style={{ position: 'relative' }}>
                    <img src={novel.cover} alt={novel.title} style={{ width: '100%', height: 220, objectFit: 'cover' }} />
                    <span style={{ position: 'absolute', top: 8, left: 8, background: '#222', color: '#fff', borderRadius: 6, padding: '2px 10px', fontSize: 13, fontWeight: 600 }}>{novel.status}</span>
                  </div>
                  <div style={{ padding: '12px 10px 8px 10px' }}>
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{novel.title}</div>
                    <div style={{ color: '#aaa', fontSize: 15, marginBottom: 4 }}>👍 {novel.rating}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
      )}
      {/* Champion Tab Content */}
      {tab === 'Champion' && book?.champion_status === 'approved' && (
        <div style={{ maxWidth: 1100, margin: '32px auto 0 auto', padding: '0 24px' }}>
          <ChampionDisplay 
            novelId={book?.id || 0} 
            novelTitle={book?.title || ''}
            onSubscribe={(tierLevel) => {
              console.log('用户订阅了Champion等级:', tierLevel);
              // 可以在这里添加订阅成功后的逻辑
            }}
          />
        </div>
      )}
      <Footer />
    </div>
  );
};

export default BookDetail; 