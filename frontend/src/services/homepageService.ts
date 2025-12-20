// 首页数据服务
import { API_BASE_URL } from '../config';
import ApiService from './ApiService';

export interface Novel {
  id: number;
  title: string;
  author: string;
  cover: string;
  rating: number;
  reviews: number;
  status: string;
  display_order?: number;
  section_type?: string;
  weekly_views?: number;
  weekly_reads?: number;
  latest_chapter_date?: string;
  chapters?: number;
}

export interface Banner {
  id: number;
  title: string;
  subtitle?: string;
  image_url: string;
  link_url?: string;
  novel_id?: number;
  novel_title?: string;
}

export interface HomepageConfig {
  section_name: string;
  section_title: string;
  display_limit: number;
  sort_by: string;
  is_active: boolean;
  description?: string;
}

export type HomepageV2Announcement = {
  id: number;
  title: string;
  content?: string | null;
  link_url?: string | null;
  display_order?: number;
  created_at?: string;
};

export type HomepageV2GenreTab = {
  id: number;
  slug: string;
  name: string;
  chinese_name?: string | null;
  novel_count?: number;
};

export type HomepageV2HeroItem = {
  banner_id: number;
  banner_title?: string;
  banner_subtitle?: string;
  image_url: string;
  link_url?: string | null;
  novel_id?: number | null;
  novel_title?: string | null;
  author?: string | null;
  translator?: string | null;
  cover?: string | null;
  status?: string | null;
  description?: string | null;
  chapters?: number | null;
  latest_chapter_id?: number | null;
  latest_chapter_number?: number | null;
  latest_chapter_title?: string | null;
  latest_chapter_created_at?: string | null;
};

export type HomepageV2RecentUpdateItem = {
  novel_id: number;
  novel_title: string;
  cover?: string | null;
  translator?: string | null;
  chapter_id: number;
  chapter_number: number;
  chapter_title: string;
  chapter_created_at: string;
};

export type HomepageV2PromotionItem = {
  promotion: {
    id: number;
    promotion_type: 'discount';
    discount_value: number; // 0.7
    discount_percentage: number; // 30
    start_at: string;
    end_at: string | null;
    status: 'active';
  };
  novel: Novel & {
    cover?: string | null;
  };
};

export type HomepageV2ContinueReadingItem = Novel & {
  last_read_chapter_id: number;
  last_read_chapter_number?: number;
  last_read_chapter_title?: string;
  last_read_at?: string;
};

export type HomepageV2 = {
  hero: { items: HomepageV2HeroItem[] };
  announcements: { items: HomepageV2Announcement[]; view_all_url: string };
  promotions?: { items: HomepageV2PromotionItem[]; view_all_url?: string };
  popular_this_week: { items: Novel[]; view_all_url: string };
  trending: { tabs: HomepageV2GenreTab[]; items_by_tab: Record<string, Novel[]>; view_all_url: string };
  new_books: { items: Novel[]; view_all_url: string };
  popular_genres: { tabs: HomepageV2GenreTab[]; items_by_tab: Record<string, Novel[]> };
  champion: { cta_url: string; items: Novel[] };
  recent_updates: { items: HomepageV2RecentUpdateItem[]; view_all_url: string };
  because_you_read?: { continue_reading: HomepageV2ContinueReadingItem[]; recommendations: Novel[]; view_all_url: string };
};

export type HomepageAllResponse = {
  success: boolean;
  data: {
    banners: Banner[];
    popularNovels: Novel[];
    newReleases: Novel[];
    topSeries: Novel[];
    config: HomepageConfig[];
    v2?: HomepageV2;
  };
};

class HomepageService {
  private baseURL = `${API_BASE_URL}/api/homepage`;

  // 获取推荐小说
  async getFeaturedNovels(section: string, limit: number = 6): Promise<Novel[]> {
    try {
      const response = await fetch(`${this.baseURL}/featured-novels/${section}?limit=${limit}`);
      const data = await response.json();
      return data.novels || [];
    } catch (error) {
      console.error('获取推荐小说失败:', error);
      return [];
    }
  }

  // 获取轮播图
  async getBanners(): Promise<Banner[]> {
    try {
      const response = await fetch(`${this.baseURL}/banners`);
      const data = await response.json();
      return data.banners || [];
    } catch (error) {
      console.error('获取轮播图失败:', error);
      return [];
    }
  }

  // 获取本周热门小说
  async getPopularThisWeek(limit: number = 6): Promise<Novel[]> {
    try {
      const response = await fetch(`${this.baseURL}/popular-this-week?limit=${limit}`);
      const data = await response.json();
      return data.novels || [];
    } catch (error) {
      console.error('获取本周热门失败:', error);
      return [];
    }
  }

  // 获取最新发布
  async getNewReleases(limit: number = 6): Promise<Novel[]> {
    try {
      const response = await fetch(`${this.baseURL}/new-releases?limit=${limit}`);
      const data = await response.json();
      return data.novels || [];
    } catch (error) {
      console.error('获取最新发布失败:', error);
      return [];
    }
  }

  // 获取高分小说
  async getTopSeries(limit: number = 6): Promise<Novel[]> {
    try {
      const response = await fetch(`${this.baseURL}/top-series?limit=${limit}`);
      const data = await response.json();
      return data.novels || [];
    } catch (error) {
      console.error('获取高分小说失败:', error);
      return [];
    }
  }

  // 记录小说访问
  async recordNovelView(novelId: number): Promise<void> {
    try {
      await fetch(`${API_BASE_URL}/api/novel/${novelId}/view`, {
        method: 'POST',
      });
    } catch (error) {
      console.error('记录访问失败:', error);
    }
  }

  // 获取首页配置
  async getHomepageConfig(): Promise<HomepageConfig[]> {
    try {
      const response = await fetch(`${this.baseURL}/config`);
      const data = await response.json();
      return data.configs || [];
    } catch (error) {
      console.error('获取首页配置失败:', error);
      return [];
    }
  }

  // V2：一次性获取 /api/homepage/all（含旧字段 + data.v2）
  async getHomepageAll(limit: number = 6): Promise<HomepageAllResponse> {
    // 使用 ApiService：自动从 AuthService 注入 Authorization（已登录时），未登录则不带 token
    // 注意：ApiService.baseURL = http://localhost:5000/api，所以 endpoint 需以 /homepage/all 开头
    const res = await ApiService.get(`/homepage/all?limit=${limit}`);
    return res as unknown as HomepageAllResponse;
  }

  // V2：只返回 data.v2；若后端未返回 v2，则返回 null（由页面回退到旧版）
  async getHomepageV2(limit: number = 6): Promise<HomepageV2 | null> {
    try {
      const all = await this.getHomepageAll(limit);
      if (all && all.success && all.data && all.data.v2) return all.data.v2;
      return null;
    } catch (e) {
      console.error('获取首页 V2 数据失败:', e);
      return null;
    }
  }

  // 获取所有首页数据（组合接口）
  async getAllHomepageData() {
    try {
      // 保持向后兼容：仍返回旧字段结构，但内部优先走单请求 /api/homepage/all
      const all = await this.getHomepageAll();
      if (all && all.success && all.data) {
        return {
          banners: all.data.banners || [],
          popularNovels: all.data.popularNovels || [],
          newReleases: all.data.newReleases || [],
          topSeries: all.data.topSeries || [],
          config: all.data.config || []
        };
      }

      // fallback：保留原有 5 并发请求逻辑（万一 /all 不可用）
      const [banners, popularNovels, newReleases, topSeries, config] = await Promise.all([
        this.getBanners(),
        this.getPopularThisWeek(),
        this.getNewReleases(),
        this.getTopSeries(),
        this.getHomepageConfig()
      ]);

      return { banners, popularNovels, newReleases, topSeries, config };
    } catch (error) {
      console.error('获取首页数据失败:', error);
      return {
        banners: [],
        popularNovels: [],
        newReleases: [],
        topSeries: [],
        config: []
      };
    }
  }
}

export default new HomepageService();
