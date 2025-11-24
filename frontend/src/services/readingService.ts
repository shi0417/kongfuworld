import { API_BASE_URL } from '../config';

export interface ReadingProgress {
  chapter_id: number;
  chapter_number: number;
  chapter_title: string;
  unlock_price: number;
  is_unlocked?: boolean;
  read_at?: string;
  is_first_read: boolean;
}

export interface ReadingResponse {
  success: boolean;
  data: ReadingProgress;
  message?: string;
}

class ReadingService {
  private baseUrl = API_BASE_URL;

  /**
   * 获取用户在某小说中的最后阅读章节
   * @param userId 用户ID
   * @param novelId 小说ID
   * @returns Promise<ReadingResponse>
   */
  async getLastReadChapter(userId: number, novelId: number): Promise<ReadingResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/user/${userId}/novel/${novelId}/last-read`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || '获取最后阅读章节失败');
      }
      
      return data;
    } catch (error) {
      console.error('获取最后阅读章节失败:', error);
      throw error;
    }
  }

  /**
   * 记录用户阅读章节
   * @param userId 用户ID
   * @param chapterId 章节ID
   * @returns Promise<{success: boolean, message: string, recordId?: number}>
   */
  async recordReading(userId: number, chapterId: number): Promise<{success: boolean, message: string, recordId?: number}> {
    try {
      const response = await fetch(`${this.baseUrl}/api/user/${userId}/read-chapter`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chapterId }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || '记录阅读失败');
      }
      
      return data;
    } catch (error) {
      console.error('记录阅读失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户阅读进度（用于显示在小说详情页）
   * @param userId 用户ID
   * @param novelId 小说ID
   * @returns Promise<ReadingProgress | null>
   */
  async getUserReadingProgress(userId: number, novelId: number): Promise<ReadingProgress | null> {
    try {
      const response = await this.getLastReadChapter(userId, novelId);
      return response.data;
    } catch (error) {
      console.error('获取阅读进度失败:', error);
      return null;
    }
  }

  /**
   * 判断用户是否应该从第一章开始阅读
   * @param progress 阅读进度
   * @returns boolean
   */
  shouldStartFromFirstChapter(progress: ReadingProgress | null): boolean {
    if (!progress) return true;
    return progress.is_first_read;
  }

  /**
   * 获取开始阅读的章节ID
   * @param progress 阅读进度
   * @returns number | null
   */
  getStartChapterId(progress: ReadingProgress | null): number | null {
    if (!progress) return null;
    return progress.chapter_id;
  }

  /**
   * 获取开始阅读的章节号
   * @param progress 阅读进度
   * @returns number | null
   */
  getStartChapterNumber(progress: ReadingProgress | null): number | null {
    if (!progress) return null;
    return progress.chapter_number;
  }
}

const readingService = new ReadingService();
export default readingService;
