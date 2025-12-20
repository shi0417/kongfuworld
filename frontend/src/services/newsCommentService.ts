// 公告评论服务（复用章节评论的接口风格）
import ApiService from './ApiService';

export interface NewsComment {
  id: number;
  content: string;
  created_at: string;
  likes: number;
  dislikes: number;
  username: string;
  avatar?: string;
  is_vip: boolean;
  parent_comment_id?: number | null;
  user_id?: number;
}

export interface NewsCommentListData {
  comments: NewsComment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

class NewsCommentService {
  async getNewsComments(newsId: number, page: number = 1, limit: number = 10): Promise<NewsCommentListData> {
    const resp = await ApiService.request(`/news/${newsId}/comments?page=${page}&limit=${limit}`);
    if (!resp.success) {
      throw new Error(resp.message || '获取公告评论失败');
    }
    return resp.data as any;
  }

  async submitNewsComment(newsId: number, content: string): Promise<any> {
    const resp = await ApiService.request(`/news/${newsId}/comment`, {
      method: 'POST',
      body: JSON.stringify({ content })
    });
    if (!resp.success) {
      throw new Error(resp.message || '提交评论失败');
    }
    return resp.data;
  }

  async replyToNewsComment(commentId: number, content: string): Promise<any> {
    const resp = await ApiService.request(`/newscomment/${commentId}/reply`, {
      method: 'POST',
      body: JSON.stringify({ content })
    });
    if (!resp.success) {
      throw new Error(resp.message || '回复失败');
    }
    return resp.data;
  }

  async getNewsCommentReplies(commentId: number, page: number = 1, limit: number = 50): Promise<NewsComment[]> {
    const resp = await ApiService.request(`/newscomment/${commentId}/replies?page=${page}&limit=${limit}`);
    if (!resp.success) {
      throw new Error(resp.message || '获取回复失败');
    }
    return (resp.data as any) || [];
  }

  async updateNewsComment(commentId: number, content: string): Promise<any> {
    const resp = await ApiService.request(`/newscomment/${commentId}`, {
      method: 'PUT',
      body: JSON.stringify({ content })
    });
    if (!resp.success) {
      throw new Error(resp.message || '更新评论失败');
    }
    return resp.data;
  }

  async likeNewsComment(commentId: number): Promise<any> {
    const resp = (await ApiService.request(`/newscomment/${commentId}/like`, { method: 'POST' })) as any;
    if (!resp.success) {
      throw new Error(resp.message || '点赞失败');
    }
    return { action: resp.action, data: resp.data };
  }

  async dislikeNewsComment(commentId: number): Promise<any> {
    const resp = (await ApiService.request(`/newscomment/${commentId}/dislike`, { method: 'POST' })) as any;
    if (!resp.success) {
      throw new Error(resp.message || '点踩失败');
    }
    return { action: resp.action, data: resp.data };
  }
}

export default new NewsCommentService();


