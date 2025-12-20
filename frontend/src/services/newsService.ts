import ApiService from './ApiService';

export type NewsListItem = {
  id: number;
  title: string;
  content: string | null;
  content_format: 'markdown' | 'html';
  created_at: string;
  updated_at: string;
  link_url?: string | null;
  display_order?: number;
};

export type NewsListResponse = {
  items: NewsListItem[];
};

class NewsService {
  async getNewsList(targetAudience?: 'reader' | 'writer'): Promise<NewsListResponse> {
    let url = '/news';
    if (targetAudience) {
      url += `?target_audience=${targetAudience}`;
    }
    const resp = await ApiService.request(url);
    if (!resp.success) {
      throw new Error(resp.message || '获取公告列表失败');
    }
    return resp.data as any;
  }

  async getNewsById(id: number) {
    const resp = await ApiService.request(`/news/${id}`);
    if (!resp.success) {
      throw new Error(resp.message || '获取公告失败');
    }
    return resp.data as any;
  }
}

export default new NewsService();


