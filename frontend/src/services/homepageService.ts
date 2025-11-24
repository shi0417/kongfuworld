// 首页数据服务
import { API_BASE_URL } from '../config';

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

  // 获取所有首页数据（组合接口）
  async getAllHomepageData() {
    try {
      const [banners, popularNovels, newReleases, topSeries, config] = await Promise.all([
        this.getBanners(),
        this.getPopularThisWeek(),
        this.getNewReleases(),
        this.getTopSeries(),
        this.getHomepageConfig()
      ]);

      return {
        banners,
        popularNovels,
        newReleases,
        topSeries,
        config
      };
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
