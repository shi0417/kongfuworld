/**
 * 作品数据页面组件
 * 用于展示作者作品的详细统计数据
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../contexts/LanguageContext';
import ApiService from '../../services/ApiService';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import styles from './WorkData.module.css';

// TypeScript 类型定义
interface UserNovel {
  id: number;
  title: string;
  cover?: string;
  status: string;
}

interface NovelDailyStats {
  id: number;
  novel_id: number;
  stat_date: string;
  views: number;
  unique_readers: number;
  views_24h: number;
  views_7d: number;
  effective_reads: number;
  avg_stay_duration_sec: number;
  finish_rate: number;
  avg_read_chapters_per_user: number;
  paid_unlock_count: number;
  time_unlock_count: number;
  paid_reader_count: number;
  chapter_revenue: number;
  champion_revenue: number;
  champion_active_count: number;
  rating_count: number;
  rating_sum: number;
  avg_rating_snapshot: number;
  new_comments: number;
  new_paragraph_comments: number;
  new_comment_likes: number;
  new_comment_dislikes: number;
  new_chapter_likes: number;
  new_chapter_dislikes: number;
  created_at: string;
  updated_at: string;
}

interface NovelAnalyticsSummary {
  novel_id: number;
  total_views: number;
  total_unique_readers: number;
  total_chapter_revenue: number;
  total_champion_revenue: number;
  total_comments: number;
  total_paragraph_comments: number;
  avg_rating: number;
  rating_count: number;
  popularity_score: number;
  engagement_score: number;
  monetization_score: number;
  reputation_score: number;
  community_score: number;
  final_score: number;
  last_calculated_at: string;
  created_at: string;
  updated_at: string;
}

type TimeRange = '7d' | '30d' | '90d' | 'all';

const WorkData: React.FC = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [novels, setNovels] = useState<UserNovel[]>([]);
  const [selectedNovelId, setSelectedNovelId] = useState<number | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [dailyStats, setDailyStats] = useState<NovelDailyStats[]>([]);
  const [summary, setSummary] = useState<NovelAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 统一把后端返回的数字字段（可能是 string / null）转为 number，避免 toFixed 等运行时错误
  const toNumber = (value: any, fallback = 0): number => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
    if (typeof value === 'string') {
      const n = Number(value);
      return Number.isFinite(n) ? n : fallback;
    }
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (value == null) return fallback;
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  const normalizeDailyStat = (raw: any): NovelDailyStats => {
    return {
      id: toNumber(raw.id),
      novel_id: toNumber(raw.novel_id),
      stat_date: String(raw.stat_date || ''),
      views: toNumber(raw.views),
      unique_readers: toNumber(raw.unique_readers),
      views_24h: toNumber(raw.views_24h),
      views_7d: toNumber(raw.views_7d),
      effective_reads: toNumber(raw.effective_reads),
      avg_stay_duration_sec: toNumber(raw.avg_stay_duration_sec),
      finish_rate: toNumber(raw.finish_rate),
      avg_read_chapters_per_user: toNumber(raw.avg_read_chapters_per_user),
      paid_unlock_count: toNumber(raw.paid_unlock_count),
      time_unlock_count: toNumber(raw.time_unlock_count),
      paid_reader_count: toNumber(raw.paid_reader_count),
      chapter_revenue: toNumber(raw.chapter_revenue),
      champion_revenue: toNumber(raw.champion_revenue),
      champion_active_count: toNumber(raw.champion_active_count),
      rating_count: toNumber(raw.rating_count),
      rating_sum: toNumber(raw.rating_sum),
      avg_rating_snapshot: toNumber(raw.avg_rating_snapshot),
      new_comments: toNumber(raw.new_comments),
      new_paragraph_comments: toNumber(raw.new_paragraph_comments),
      new_comment_likes: toNumber(raw.new_comment_likes),
      new_comment_dislikes: toNumber(raw.new_comment_dislikes),
      new_chapter_likes: toNumber(raw.new_chapter_likes),
      new_chapter_dislikes: toNumber(raw.new_chapter_dislikes),
      created_at: String(raw.created_at || ''),
      updated_at: String(raw.updated_at || '')
    };
  };

  const normalizeSummary = (raw: any): NovelAnalyticsSummary => {
    return {
      novel_id: toNumber(raw.novel_id),
      total_views: toNumber(raw.total_views),
      total_unique_readers: toNumber(raw.total_unique_readers),
      total_chapter_revenue: toNumber(raw.total_chapter_revenue),
      total_champion_revenue: toNumber(raw.total_champion_revenue),
      total_comments: toNumber(raw.total_comments),
      total_paragraph_comments: toNumber(raw.total_paragraph_comments),
      avg_rating: toNumber(raw.avg_rating),
      rating_count: toNumber(raw.rating_count),
      popularity_score: toNumber(raw.popularity_score),
      engagement_score: toNumber(raw.engagement_score),
      monetization_score: toNumber(raw.monetization_score),
      reputation_score: toNumber(raw.reputation_score),
      community_score: toNumber(raw.community_score),
      final_score: toNumber(raw.final_score),
      last_calculated_at: String(raw.last_calculated_at || ''),
      created_at: String(raw.created_at || ''),
      updated_at: String(raw.updated_at || '')
    };
  };

  // 加载用户作品列表
  const loadUserNovels = useCallback(async () => {
    if (!user) return;
    try {
      const response = await ApiService.get(`/novels/user/${user.id}`);
      const novelsList = Array.isArray(response) ? response : (response.data || []);
      setNovels(novelsList);
      
      // 默认选中第一本作品（或最近更新的作品）
      if (novelsList.length > 0 && !selectedNovelId) {
        setSelectedNovelId(novelsList[0].id);
      }
    } catch (error) {
      console.error('加载作品列表失败:', error);
      setError('加载作品列表失败');
    }
  }, [user, selectedNovelId]);

  // 计算日期范围
  const getDateRange = useCallback((range: TimeRange): { startDate: string; endDate: string } => {
    const endDate = new Date();
    const startDate = new Date();
    
    switch (range) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case 'all':
        startDate.setFullYear(2020, 0, 1); // 设置一个很早的日期
        break;
    }
    
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };
  }, []);

  // 加载每日统计数据
  const loadDailyStats = useCallback(async () => {
    if (!selectedNovelId) return;
    
    setLoading(true);
    setError(null);
    try {
      const { startDate, endDate } = getDateRange(timeRange);
      const response = await ApiService.get(
        `/analytics/novels/${selectedNovelId}/daily?startDate=${startDate}&endDate=${endDate}`
      );
      
      if (response.success && response.data) {
        const normalized = Array.isArray(response.data) ? response.data.map(normalizeDailyStat) : [];
        setDailyStats(normalized);
      } else {
        setDailyStats([]);
      }
    } catch (error) {
      console.error('加载每日统计数据失败:', error);
      setError('加载每日统计数据失败');
      setDailyStats([]);
    } finally {
      setLoading(false);
    }
  }, [selectedNovelId, timeRange, getDateRange]);

  // 加载综合评分摘要
  const loadSummary = useCallback(async () => {
    if (!selectedNovelId) return;
    
    try {
      const response = await ApiService.get(`/analytics/novels/${selectedNovelId}/summary`);
      
      if (response.success && response.data) {
        setSummary(normalizeSummary(response.data));
      } else {
        setSummary(null);
      }
    } catch (error) {
      console.error('加载综合评分摘要失败:', error);
      setSummary(null);
    }
  }, [selectedNovelId]);

  // 初始化加载
  useEffect(() => {
    loadUserNovels();
  }, [loadUserNovels]);

  // 当选择的作品或时间范围变化时，重新加载数据
  useEffect(() => {
    if (selectedNovelId) {
      loadDailyStats();
      loadSummary();
    }
  }, [selectedNovelId, timeRange, loadDailyStats, loadSummary]);

  // 计算 KPI 数据
  const calculateKPIs = () => {
    if (dailyStats.length === 0) {
      return {
        totalViews: 0,
        totalUniqueReaders: 0,
        effectiveReadsRatio: 0,
        avgStayDuration: 0,
        totalChapterRevenue: 0,
        totalChampionRevenue: 0,
        paidReaderCount: 0,
        avgRating: 0,
        totalComments: 0
      };
    }

    const totalViews = dailyStats.reduce((sum, stat) => sum + toNumber(stat.views), 0);
    const totalUniqueReaders = Math.max(...dailyStats.map(stat => toNumber(stat.unique_readers)), 0);
    const totalEffectiveReads = dailyStats.reduce((sum, stat) => sum + toNumber(stat.effective_reads), 0);
    const effectiveReadsRatio = totalViews > 0 ? (totalEffectiveReads / totalViews) * 100 : 0;
    const avgStayDuration = dailyStats.reduce((sum, stat) => sum + toNumber(stat.avg_stay_duration_sec), 0) / dailyStats.length;
    const totalChapterRevenue = dailyStats.reduce((sum, stat) => sum + toNumber(stat.chapter_revenue), 0);
    const totalChampionRevenue = dailyStats.reduce((sum, stat) => sum + toNumber(stat.champion_revenue), 0);
    const paidReaderCount = Math.max(...dailyStats.map(stat => toNumber(stat.paid_reader_count)), 0);
    const avgRating = summary?.avg_rating || 0;
    const totalComments = dailyStats.reduce(
      (sum, stat) => sum + toNumber(stat.new_comments) + toNumber(stat.new_paragraph_comments),
      0
    );

    return {
      totalViews,
      totalUniqueReaders,
      effectiveReadsRatio,
      avgStayDuration: Number.isFinite(avgStayDuration) ? avgStayDuration : 0,
      totalChapterRevenue,
      totalChampionRevenue,
      paidReaderCount,
      avgRating,
      totalComments
    };
  };

  const kpis = calculateKPIs();
  const selectedNovel = novels.find(n => n.id === selectedNovelId);

  // 格式化数字
  const formatNumber = (num: number) => {
    if (num >= 10000) {
      return (num / 10000).toFixed(1) + '万';
    }
    return num.toLocaleString();
  };

  // 格式化时长（秒转分钟）
  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}分${secs}秒`;
  };

  // 获取状态文本
  const getStatusText = (status: string) => {
    const statusMap: { [key: string]: string } = {
      'ongoing': language === 'zh' ? '连载中' : 'Ongoing',
      'completed': language === 'zh' ? '已完结' : 'Completed',
      'hiatus': language === 'zh' ? '暂停' : 'Paused'
    };
    return statusMap[status] || status;
  };

  // 准备雷达图数据
  const radarData = summary ? [
    { dimension: language === 'zh' ? '热度' : 'Popularity', score: summary.popularity_score },
    { dimension: language === 'zh' ? '阅读质量' : 'Engagement', score: summary.engagement_score },
    { dimension: language === 'zh' ? '变现能力' : 'Monetization', score: summary.monetization_score },
    { dimension: language === 'zh' ? '口碑' : 'Reputation', score: summary.reputation_score },
    { dimension: language === 'zh' ? '社区活跃' : 'Community', score: summary.community_score }
  ] : [];

  return (
    <div className={styles.container}>
      {/* 顶部过滤区 */}
      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>
            {language === 'zh' ? '选择作品' : 'Select Novel'}
          </label>
          <select
            className={styles.novelSelect}
            value={selectedNovelId || ''}
            onChange={(e) => setSelectedNovelId(Number(e.target.value))}
          >
            {novels.map(novel => (
              <option key={novel.id} value={novel.id}>
                {novel.title} ({getStatusText(novel.status)})
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>
            {language === 'zh' ? '时间范围' : 'Time Range'}
          </label>
          <div className={styles.timeRangeButtons}>
            {(['7d', '30d', '90d', 'all'] as TimeRange[]).map(range => (
              <button
                key={range}
                className={`${styles.timeRangeBtn} ${timeRange === range ? styles.active : ''}`}
                onClick={() => setTimeRange(range)}
              >
                {range === '7d' ? (language === 'zh' ? '近7天' : '7 Days') :
                 range === '30d' ? (language === 'zh' ? '近30天' : '30 Days') :
                 range === '90d' ? (language === 'zh' ? '近90天' : '90 Days') :
                 (language === 'zh' ? '全部' : 'All')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}

      {loading && (
        <div className={styles.loading}>
          {language === 'zh' ? '加载中...' : 'Loading...'}
        </div>
      )}

      {!loading && selectedNovelId && (
        <>
          {/* KPI 卡片区 */}
          <div className={styles.kpiCards}>
            <div className={styles.kpiCard}>
              <div className={styles.kpiTitle}>{language === 'zh' ? '总阅读量' : 'Total Views'}</div>
              <div className={styles.kpiValue}>{formatNumber(kpis.totalViews)}</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiTitle}>{language === 'zh' ? '独立读者数' : 'Unique Readers'}</div>
              <div className={styles.kpiValue}>{formatNumber(kpis.totalUniqueReaders)}</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiTitle}>{language === 'zh' ? '有效阅读占比' : 'Effective Reads Ratio'}</div>
              <div className={styles.kpiValue}>{kpis.effectiveReadsRatio.toFixed(1)}%</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiTitle}>{language === 'zh' ? '平均停留时长' : 'Avg Stay Duration'}</div>
              <div className={styles.kpiValue}>{formatDuration(kpis.avgStayDuration)}</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiTitle}>{language === 'zh' ? '章节付费收入' : 'Chapter Revenue'}</div>
              <div className={styles.kpiValue}>${kpis.totalChapterRevenue.toFixed(2)}</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiTitle}>{language === 'zh' ? 'Champion订阅收入' : 'Champion Revenue'}</div>
              <div className={styles.kpiValue}>${kpis.totalChampionRevenue.toFixed(2)}</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiTitle}>{language === 'zh' ? '付费读者数' : 'Paid Readers'}</div>
              <div className={styles.kpiValue}>{formatNumber(kpis.paidReaderCount)}</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiTitle}>{language === 'zh' ? '平均评分' : 'Avg Rating'}</div>
              <div className={styles.kpiValue}>{kpis.avgRating.toFixed(1)}</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiTitle}>{language === 'zh' ? '新增评论数' : 'New Comments'}</div>
              <div className={styles.kpiValue}>{formatNumber(kpis.totalComments)}</div>
            </div>
            {summary && (
              <div className={styles.kpiCard}>
                <div className={styles.kpiTitle}>{language === 'zh' ? '综合评分' : 'Final Score'}</div>
                <div className={styles.kpiValue}>{summary.final_score.toFixed(1)}</div>
              </div>
            )}
          </div>

          {/* 图表区域 - 2行2列 */}
          <div className={styles.chartsGrid}>
            {/* 模块 A：阅读趋势 */}
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>{language === 'zh' ? '阅读趋势' : 'Reading Trends'}</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dailyStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="stat_date" 
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return `${date.getMonth() + 1}/${date.getDate()}`;
                    }}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(value) => {
                      const date = new Date(value);
                      return date.toLocaleDateString('zh-CN');
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="views" stroke="#8884d8" name={language === 'zh' ? '阅读次数' : 'Views'} />
                  <Line type="monotone" dataKey="unique_readers" stroke="#82ca9d" name={language === 'zh' ? '独立读者' : 'Unique Readers'} />
                  <Line type="monotone" dataKey="effective_reads" stroke="#ffc658" name={language === 'zh' ? '有效阅读' : 'Effective Reads'} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* 模块 B：阅读深度 & 参与度 */}
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>{language === 'zh' ? '阅读深度 & 参与度' : 'Reading Depth & Engagement'}</h3>
              <div className={styles.engagementContent}>
                <div className={styles.engagementLeft}>
                  {/* TODO: 章节阅读漏斗图 - 需要后端提供数据 */}
                  <div className={styles.placeholder}>
                    {language === 'zh' ? '章节阅读漏斗图（待实现）' : 'Chapter Reading Funnel (TODO)'}
                  </div>
                </div>
                <div className={styles.engagementRight}>
                  <div className={styles.engagementStat}>
                    <div className={styles.statLabel}>{language === 'zh' ? '有效阅读占比' : 'Effective Reads Ratio'}</div>
                    <div className={styles.statValue}>{kpis.effectiveReadsRatio.toFixed(1)}%</div>
                  </div>
                  <div className={styles.engagementStat}>
                    <div className={styles.statLabel}>{language === 'zh' ? '平均完读率' : 'Avg Finish Rate'}</div>
                    <div className={styles.statValue}>
                      {dailyStats.length > 0 
                        ? (dailyStats.reduce((sum, stat) => sum + stat.finish_rate, 0) / dailyStats.length * 100).toFixed(1) + '%'
                        : '0%'}
                    </div>
                  </div>
                  <div className={styles.engagementStat}>
                    <div className={styles.statLabel}>{language === 'zh' ? '人均阅读章节数' : 'Avg Chapters per User'}</div>
                    <div className={styles.statValue}>
                      {dailyStats.length > 0
                        ? dailyStats.reduce((sum, stat) => sum + stat.avg_read_chapters_per_user, 0) / dailyStats.length
                        : 0}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 模块 C：付费 & 收入 */}
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>{language === 'zh' ? '付费 & 收入' : 'Payment & Revenue'}</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dailyStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="stat_date" 
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return `${date.getMonth() + 1}/${date.getDate()}`;
                    }}
                  />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip 
                    labelFormatter={(value) => {
                      const date = new Date(value);
                      return date.toLocaleDateString('zh-CN');
                    }}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="chapter_revenue" fill="#8884d8" name={language === 'zh' ? '章节付费收入' : 'Chapter Revenue'} />
                  <Bar yAxisId="left" dataKey="champion_revenue" fill="#82ca9d" name={language === 'zh' ? 'Champion订阅收入' : 'Champion Revenue'} />
                  <Line 
                    yAxisId="right" 
                    type="monotone" 
                    dataKey="paid_unlock_count" 
                    stroke="#ff7300" 
                    name={language === 'zh' ? '付费解锁次数' : 'Paid Unlocks'} 
                  />
                </BarChart>
              </ResponsiveContainer>
              <div className={styles.revenueStats}>
                <div className={styles.revenueStat}>
                  <span className={styles.revenueLabel}>{language === 'zh' ? '总收入' : 'Total Revenue'}:</span>
                  <span className={styles.revenueValue}>
                    ${(kpis.totalChapterRevenue + kpis.totalChampionRevenue).toFixed(2)}
                  </span>
                </div>
                <div className={styles.revenueStat}>
                  <span className={styles.revenueLabel}>{language === 'zh' ? '章节收入占比' : 'Chapter Revenue %'}:</span>
                  <span className={styles.revenueValue}>
                    {kpis.totalChapterRevenue + kpis.totalChampionRevenue > 0
                      ? ((kpis.totalChapterRevenue / (kpis.totalChapterRevenue + kpis.totalChampionRevenue)) * 100).toFixed(1)
                      : 0}%
                  </span>
                </div>
                <div className={styles.revenueStat}>
                  <span className={styles.revenueLabel}>{language === 'zh' ? '付费读者数' : 'Paid Readers'}:</span>
                  <span className={styles.revenueValue}>{formatNumber(kpis.paidReaderCount)}</span>
                </div>
              </div>
            </div>

            {/* 模块 D：口碑 & 社区互动 */}
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>{language === 'zh' ? '口碑 & 社区互动' : 'Reputation & Community'}</h3>
              <div className={styles.reputationCharts}>
                <div className={styles.reputationChart}>
                  <h4 className={styles.subChartTitle}>{language === 'zh' ? '评分趋势' : 'Rating Trend'}</h4>
                  <ResponsiveContainer width="100%" height={150}>
                    <LineChart data={dailyStats}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="stat_date" 
                        tickFormatter={(value) => {
                          const date = new Date(value);
                          return `${date.getMonth() + 1}/${date.getDate()}`;
                        }}
                      />
                      <YAxis domain={[0, 5]} />
                      <Tooltip 
                        labelFormatter={(value) => {
                          const date = new Date(value);
                          return date.toLocaleDateString('zh-CN');
                        }}
                      />
                      <Line type="monotone" dataKey="avg_rating_snapshot" stroke="#8884d8" name={language === 'zh' ? '平均评分' : 'Avg Rating'} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className={styles.reputationChart}>
                  <h4 className={styles.subChartTitle}>{language === 'zh' ? '互动统计' : 'Interaction Stats'}</h4>
                  <ResponsiveContainer width="100%" height={150}>
                    <BarChart data={dailyStats}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="stat_date" 
                        tickFormatter={(value) => {
                          const date = new Date(value);
                          return `${date.getMonth() + 1}/${date.getDate()}`;
                        }}
                      />
                      <YAxis />
                      <Tooltip 
                        labelFormatter={(value) => {
                          const date = new Date(value);
                          return date.toLocaleDateString('zh-CN');
                        }}
                      />
                      <Legend />
                      <Bar dataKey="new_comments" fill="#8884d8" name={language === 'zh' ? '新增评论' : 'New Comments'} />
                      <Bar dataKey="new_paragraph_comments" fill="#82ca9d" name={language === 'zh' ? '新增段评' : 'New Paragraph Comments'} />
                      <Bar dataKey="new_chapter_likes" fill="#2e7d32" name={language === 'zh' ? '新增章点赞' : 'New Chapter Likes'} />
                      <Bar dataKey="new_chapter_dislikes" fill="#c62828" name={language === 'zh' ? '新增章点踩' : 'New Chapter Dislikes'} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* 维度雷达图模块 */}
          {summary && (
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>{language === 'zh' ? '作品综合质量' : 'Overall Quality'}</h3>
              <div className={styles.radarContainer}>
                <ResponsiveContainer width="100%" height={400}>
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="dimension" />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} />
                    <Radar
                      name={language === 'zh' ? '评分' : 'Score'}
                      dataKey="score"
                      stroke="#8884d8"
                      fill="#8884d8"
                      fillOpacity={0.6}
                    />
                  </RadarChart>
                </ResponsiveContainer>
                <div className={styles.finalScore}>
                  {language === 'zh' ? '本书综合评分' : 'Final Score'}: <strong>{summary.final_score.toFixed(1)} / 100</strong>
                </div>
              </div>
            </div>
          )}

          {/* 底部明细表 */}
          <div className={styles.chartCard}>
            <h3 className={styles.chartTitle}>{language === 'zh' ? '每日明细数据' : 'Daily Details'}</h3>
            <div className={styles.tableContainer}>
              <table className={styles.detailsTable}>
                <thead>
                  <tr>
                    <th>{language === 'zh' ? '日期' : 'Date'}</th>
                    <th>{language === 'zh' ? '阅读量' : 'Views'}</th>
                    <th>{language === 'zh' ? '独立读者' : 'Unique Readers'}</th>
                    <th>{language === 'zh' ? '有效阅读' : 'Effective Reads'}</th>
                    <th>{language === 'zh' ? '章节收入' : 'Chapter Revenue'}</th>
                    <th>{language === 'zh' ? '订阅收入' : 'Champion Revenue'}</th>
                    <th>{language === 'zh' ? '新增评论' : 'New Comments'}</th>
                    <th>{language === 'zh' ? '平均评分' : 'Avg Rating'}</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyStats.length === 0 ? (
                    <tr>
                      <td colSpan={8} className={styles.noData}>
                        {language === 'zh' ? '暂无数据' : 'No Data'}
                      </td>
                    </tr>
                  ) : (
                    dailyStats.map(stat => (
                      <tr key={stat.id}>
                        <td>{new Date(stat.stat_date).toLocaleDateString('zh-CN')}</td>
                        <td>{formatNumber(stat.views)}</td>
                        <td>{formatNumber(stat.unique_readers)}</td>
                        <td>{formatNumber(stat.effective_reads)}</td>
                        <td>${stat.chapter_revenue.toFixed(2)}</td>
                        <td>${stat.champion_revenue.toFixed(2)}</td>
                        <td>{formatNumber(stat.new_comments + stat.new_paragraph_comments)}</td>
                        <td>{stat.avg_rating_snapshot.toFixed(1)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {/* TODO: 导出 CSV/Excel 功能 */}
          </div>
        </>
      )}

      {!selectedNovelId && novels.length === 0 && (
        <div className={styles.emptyState}>
          {language === 'zh' ? '暂无作品数据' : 'No Novels Available'}
        </div>
      )}
    </div>
  );
};

export default WorkData;

