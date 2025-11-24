import { API_BASE_URL } from '../config';
import AuthService from './AuthService';
import ApiService from './ApiService';

export interface Review {
  id: number;
  content: string;
  rating?: number;
  created_at: string;
  likes: number;
  dislikes: number;
  comments: number;
  views: number;
  is_recommended: boolean;
  user_id: number;
  username: string;
  avatar?: string;
  is_vip: boolean;
}

export interface ReviewStats {
  total_reviews: number;
  average_rating: number;
  recommended_count: number;
  total_likes: number;
  recommendation_rate: number;
}

export interface ReviewResponse {
  success: boolean;
  data: {
    reviews: Review[];
    total: number;
    page: number;
    limit: number;
  };
}

export interface ReviewStatsResponse {
  success: boolean;
  data: ReviewStats;
}

class ReviewService {
  private baseUrl = `${API_BASE_URL}/api`;

  // 获取小说的评论列表
  async getNovelReviews(novelId: number, page: number = 1, limit: number = 10): Promise<ReviewResponse> {
    const response = await fetch(`${this.baseUrl}/novel/${novelId}/reviews?page=${page}&limit=${limit}`);
    
    if (!response.ok) {
      throw new Error('获取评论失败');
    }
    
    return response.json();
  }

  // 获取小说的评论统计
  async getNovelReviewStats(novelId: number): Promise<ReviewStats> {
    console.log('🔍 调用API获取统计数据，novelId:', novelId);
    const url = `${this.baseUrl}/novel/${novelId}/review-stats`;
    console.log('📡 API URL:', url);
    
    const response = await fetch(url);
    console.log('📡 API响应状态:', response.status);
    
    if (!response.ok) {
      console.error('❌ API调用失败，状态码:', response.status);
      throw new Error('获取评论统计失败');
    }
    
    const result: ReviewStatsResponse = await response.json();
    console.log('📊 API返回的原始数据:', result);
    console.log('📊 解析后的数据:', result.data);
    return result.data;
  }

  // 提交评论
  async submitReview(novelId: number, content: string, rating?: number, isRecommended: boolean = false): Promise<any> {
    const token = AuthService.getAuthState().token;
    
    // 检查token是否存在
    if (!token) {
      throw new Error('请先登录');
    }
    
    console.log('🔍 提交评论 - Token存在:', !!token);
    console.log('🔍 提交评论 - Token长度:', token.length);
    
    const response = await ApiService.request(`/novel/${novelId}/review`, {
      method: 'POST',
      body: JSON.stringify({
        content,
        rating,
        is_recommended: isRecommended
      })
    });
    
    console.log('🔍 提交评论 - 响应状态:', response.success);
    
    if (!response.success) {
      console.error('❌ 提交评论失败:', response.message);
      
      // 如果是401或403错误，清除本地认证数据
      if (response.status === 401 || response.status === 403) {
        AuthService.clearAuth();
        throw new Error('登录已过期，请重新登录');
      }
      
      throw new Error(response.message || '提交评论失败');
    }
    
    return response.data;
  }

  // 点赞评论
  async likeReview(reviewId: number): Promise<any> {
    const token = AuthService.getAuthState().token;
    
    if (!token) {
      throw new Error('请先登录');
    }
    
    const response = await ApiService.request(`/review/${reviewId}/like`, {
      method: 'POST'
    }) as any;
    
    if (!response.success) {
      // 如果是401或403错误，清除本地认证数据
      if (response.status === 401 || response.status === 403) {
        AuthService.clearAuth();
        throw new Error('登录已过期，请重新登录');
      }
      
      throw new Error(response.message || '点赞失败');
    }
    
    // 返回包含action和data的完整对象
    return {
      action: response.action,
      data: response.data
    };
  }

  // 不喜欢评论
  async dislikeReview(reviewId: number): Promise<any> {
    const response = await ApiService.request(`/review/${reviewId}/dislike`, {
      method: 'POST'
    }) as any;
    
    if (!response.success) {
      throw new Error(response.message || '不喜欢失败');
    }
    
    // 返回包含action和data的完整对象
    return {
      action: response.action,
      data: response.data
    };
  }

  // 获取评论的回复
  async getReviewComments(reviewId: number, page: number = 1, limit: number = 10): Promise<any> {
    const response = await fetch(`${this.baseUrl}/review/${reviewId}/comments?page=${page}&limit=${limit}`);
    
    if (!response.ok) {
      throw new Error('获取评论回复失败');
    }
    
    return response.json();
  }

  // 回复评论
  async replyToReview(reviewId: number, content: string): Promise<any> {
    const response = await ApiService.request(`/review/${reviewId}/comment`, {
      method: 'POST',
      body: JSON.stringify({ content })
    });
    
    if (!response.success) {
      throw new Error(response.message || '回复失败');
    }
    
    return response.data;
  }

  // 更新评论
  async updateReview(reviewId: number, content: string): Promise<any> {
    const response = await ApiService.request(`/review/${reviewId}`, {
      method: 'PUT',
      body: JSON.stringify({ content })
    });
    
    if (!response.success) {
      throw new Error(response.message || '更新评论失败');
    }
    
    return response.data;
  }
}

export default new ReviewService();
