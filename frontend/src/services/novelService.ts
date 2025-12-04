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
  async getChapterContent(chapterId: number, userId?: number | null, retries: number = 3): Promise<any> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`尝试获取章节内容 (第${attempt}次尝试):`, chapterId, '用户ID:', userId);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
        
        // 构建URL，如果提供了userId则添加到查询参数中
        let url = `${this.baseURL}/chapter/${chapterId}`;
        if (userId) {
          url += `?userId=${userId}`;
        }
        
        const response = await fetch(url, {
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
        
        const apiData = data.data;
        
        console.log('📦 [novelService] ========== API 原始数据 ==========');
        console.log('📦 [novelService] apiData.unlock_price (原始值):', apiData.unlock_price);
        console.log('📦 [novelService] apiData.unlock_price (类型):', typeof apiData.unlock_price);
        console.log('📦 [novelService] apiData.unlock_price === null?:', apiData.unlock_price === null);
        console.log('📦 [novelService] apiData.unlock_price === undefined?:', apiData.unlock_price === undefined);
        console.log('📦 [novelService] apiData.unlock_price == 0?:', apiData.unlock_price == 0);
        console.log('📦 [novelService] apiData.unlock_price > 0?:', (apiData.unlock_price && apiData.unlock_price > 0));
        console.log('📦 [novelService] ======================================');
        
        // 确保 has_prev / has_next 字段存在，如果后端没给也用 prev/next id 推导
        // 注意：unlock_price 如果是 null 或 undefined，应该保持为 null，而不是转换为 0
        const chapter = {
          id: apiData.id,
          novel_id: apiData.novel_id,
          volume_id: apiData.volume_id,
          chapter_number: apiData.chapter_number,
          title: apiData.title,
          content: apiData.content,
          translator_note: apiData.translator_note,
          unlock_price: apiData.unlock_price ?? null, // 使用 ?? 而不是 ||，避免 0 被误判
          novel_title: apiData.novel_title,
          author: apiData.author,
          translator: apiData.translator,
          volume_title: apiData.volume_title,
          prev_chapter_id: apiData.prev_chapter_id ?? null,
          next_chapter_id: apiData.next_chapter_id ?? null,
          has_prev: apiData.has_prev ?? Boolean(apiData.prev_chapter_id),
          has_next: apiData.has_next ?? Boolean(apiData.next_chapter_id)
        };
        
        console.log('📦 [novelService] ========== 章节内容解析结果 ==========');
        console.log('📦 [novelService] 章节ID:', chapter.id);
        console.log('📦 [novelService] 章节号:', chapter.chapter_number);
        console.log('📦 [novelService] unlock_price (处理后):', chapter.unlock_price);
        console.log('📦 [novelService] unlock_price (类型):', typeof chapter.unlock_price);
        console.log('📦 [novelService] unlock_price > 0?:', (chapter.unlock_price && chapter.unlock_price > 0));
        console.log('📦 [novelService] has_prev:', chapter.has_prev, '| 类型:', typeof chapter.has_prev);
        console.log('📦 [novelService] has_next:', chapter.has_next, '| 类型:', typeof chapter.has_next);
        console.log('📦 [novelService] prev_chapter_id:', chapter.prev_chapter_id);
        console.log('📦 [novelService] next_chapter_id:', chapter.next_chapter_id);
        console.log('📦 [novelService] ======================================');
        
        return chapter;
        
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
