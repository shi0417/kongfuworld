// 小说服务API
import { API_BASE_URL } from '../config';

export interface NovelDetail {
  id: number;
  title: string;
  author: string;
  translator?: string;
  description: string;
  chapters: number;
  licensed_from?: string;
  status: string;
  cover: string;
  rating: number;
  reviews: number;
  champion_status?: 'submitted' | 'invalid' | 'approved' | 'rejected'; // Champion会员状态: submitted=提交中, invalid=无效, approved=审核通过, rejected=审核不通过
}

export interface NovelChapter {
  id: number;
  novel_id: number;
  volume_id: number;
  chapter_number: number;
  title: string;
  content?: string;
  word_count?: number;
  created_at: string;
}

class NovelService {
  private baseURL = `${API_BASE_URL}/api`;

  // 获取小说详细信息
  async getNovelDetail(novelId: number): Promise<NovelDetail> {
    try {
      const response = await fetch(`${this.baseURL}/novel/${novelId}/details`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || '获取小说详情失败');
      }
      
      return data.novel;
    } catch (error) {
      console.error('获取小说详情失败:', error);
      throw error;
    }
  }

  // 获取小说章节列表
  async getNovelChapters(novelId: number): Promise<NovelChapter[]> {
    try {
      const response = await fetch(`${this.baseURL}/novel/${novelId}/chapters`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || '获取章节列表失败');
      }
      
      return data.chapters || [];
    } catch (error) {
      console.error('获取章节列表失败:', error);
      return [];
    }
  }

  // 获取小说信息（包含卷信息）
  async getNovelInfo(novelId: number): Promise<any> {
    try {
      const response = await fetch(`${this.baseURL}/novel/${novelId}/info`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || '获取小说信息失败');
      }
      
      return data;
    } catch (error) {
      console.error('获取小说信息失败:', error);
      throw error;
    }
  }

  // 搜索小说
  async searchNovels(query: string): Promise<NovelDetail[]> {
    try {
      const response = await fetch(`${this.baseURL}/novels/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: query }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || '搜索失败');
      }
      
      return data.novels || [];
    } catch (error) {
      console.error('搜索小说失败:', error);
      return [];
    }
  }

  // 获取所有小说
  async getAllNovels(): Promise<NovelDetail[]> {
    try {
      const response = await fetch(`${this.baseURL}/novels`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || '获取小说列表失败');
      }
      
      return data.novels || [];
    } catch (error) {
      console.error('获取小说列表失败:', error);
      return [];
    }
  }

  // 获取章节内容（带重试机制）
  async getChapterContent(chapterId: number, retries: number = 3): Promise<any> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`尝试获取章节内容 (第${attempt}次尝试):`, chapterId);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
        
        const response = await fetch(`${this.baseURL}/chapter/${chapterId}`, {
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });
        
        clearTimeout(timeoutId);
        
        console.log(`API响应状态: ${response.status}`);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`API错误响应: ${response.status} - ${errorText}`);
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        console.log('API响应数据解析成功');
        
        if (!data.success) {
          throw new Error(data.message || 'API返回失败状态');
        }
        
        if (!data.data) {
          throw new Error('API返回数据为空');
        }
        
        console.log('章节内容获取成功:', data.data.title);
        return data.data;
        
      } catch (error: any) {
        lastError = error;
        console.error(`获取章节内容失败 (第${attempt}次尝试):`, error);
        
        // 如果是网络错误或超时，等待后重试
        if (attempt < retries && (error.name === 'AbortError' || error.message.includes('fetch'))) {
          console.log(`等待${attempt * 1000}ms后重试...`);
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
          continue;
        }
        
        // 如果是其他错误或已达到最大重试次数，直接抛出
        throw error;
      }
    }
    
    throw lastError || new Error('获取章节内容失败');
  }
}

export default new NovelService();
