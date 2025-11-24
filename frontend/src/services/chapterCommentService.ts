// 章节评论服务
import { API_BASE_URL } from '../config';
import ApiService from './ApiService';

export interface ChapterComment {
  id: number;
  content: string;
  created_at: string;
  likes: number;
  dislikes: number; // 添加不喜欢字段
  username: string;
  avatar?: string;
  is_vip: boolean;
  parent_comment_id?: number; // 添加父评论ID字段
  user_id?: number; // 添加用户ID字段，用于判断是否可以编辑
}

export interface ChapterCommentStats {
  total_comments: number;
  like_rate: number;
  total_likes: number;
}

export interface ChapterCommentResponse {
  success: boolean;
  data: {
    comments: ChapterComment[];
    total: number;
    like_rate: number;
    total_likes: number;
  };
}

class ChapterCommentService {
  private baseUrl = `${API_BASE_URL}/api`;

  // 获取章节评论
  async getChapterComments(chapterId: number, page: number = 1, limit: number = 10): Promise<ChapterCommentResponse['data']> {
    const response = await ApiService.request(`/chapter/${chapterId}/comments?page=${page}&limit=${limit}`);
    
    if (!response.success) {
      throw new Error(response.message || '获取章节评论失败');
    }
    
    return response.data;
  }

  // 提交章节评论
  async submitChapterComment(chapterId: number, content: string): Promise<any> {
    const response = await ApiService.request(`/chapter/${chapterId}/comment`, {
      method: 'POST',
      body: JSON.stringify({ content })
    });
    
    if (!response.success) {
      throw new Error(response.message || '提交评论失败');
    }
    
    return response.data;
  }

  // 点赞章节评论
  async likeChapterComment(commentId: number): Promise<any> {
    console.log('🔍 likeChapterComment - 开始点赞评论:', commentId);
    
    const response = await ApiService.request(`/comment/${commentId}/like`, {
      method: 'POST'
    }) as any;
    
    console.log('🔍 likeChapterComment - 响应状态:', response.success);
    
    if (!response.success) {
      console.error('❌ likeChapterComment - API错误:', response.message);
      throw new Error(response.message || '点赞失败');
    }
    
    console.log('✅ likeChapterComment - API成功:', response);
    // 返回包含action和data的完整对象
    return {
      action: response.action,
      data: response.data
    };
  }

  // 回复评论
  async replyToComment(commentId: number, content: string): Promise<any> {
    console.log('🔍 replyToComment called with:', { commentId, content });
    
    const response = await ApiService.request(`/comment/${commentId}/reply`, {
      method: 'POST',
      body: JSON.stringify({ content })
    });
    
    console.log('📡 Response status:', response.success);
    console.log('📡 Response ok:', response.success);
    
    if (!response.success) {
      console.error('❌ API Error:', response.message);
      throw new Error(response.message || '回复失败');
    }
    
    console.log('✅ API Success:', response.data);
    return response.data;
  }

  // 获取评论回复
  async getCommentReplies(commentId: number, page: number = 1, limit: number = 10): Promise<ChapterComment[]> {
    const response = await fetch(`${this.baseUrl}/comment/${commentId}/replies?page=${page}&limit=${limit}`);
    
    if (!response.ok) {
      throw new Error('获取回复失败');
    }
    
    const result = await response.json();
    return result.data;
  }

  // 不喜欢章节评论
  async dislikeChapterComment(commentId: number): Promise<any> {
    console.log('🔍 dislikeChapterComment - 开始不喜欢评论:', commentId);
    
    const response = await ApiService.request(`/comment/${commentId}/dislike`, {
      method: 'POST'
    }) as any;
    
    console.log('🔍 dislikeChapterComment - 响应状态:', response.success);
    console.log('🔍 dislikeChapterComment - 响应OK:', response.success);
    
    if (!response.success) {
      console.error('❌ dislikeChapterComment - API错误:', response.message);
      throw new Error(response.message || '不喜欢失败');
    }
    
    console.log('✅ dislikeChapterComment - API成功:', response);
    // 返回包含action和data的完整对象
    return {
      action: response.action,
      data: response.data
    };
  }

  // 更新章节评论
  async updateChapterComment(commentId: number, content: string): Promise<any> {
    const response = await ApiService.request(`/comment/${commentId}`, {
      method: 'PUT',
      body: JSON.stringify({ content })
    });
    
    if (!response.success) {
      throw new Error(response.message || '更新评论失败');
    }
    
    return response.data;
  }
}

export default new ChapterCommentService();
