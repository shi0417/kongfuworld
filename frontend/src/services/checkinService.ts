// 签到服务
import { API_BASE_URL } from '../config';
import AuthService from './AuthService';

export interface CheckinStatus {
  hasCheckedInToday: boolean;
  todayCheckin: any;
  userStats: {
    total_checkins: number;
    max_streak: number;
    total_keys_earned: number;
    last_checkin_date: string | null;
  };
}

export interface CheckinResult {
  success: boolean;
  message: string;
  data?: {
    keysEarned: number;
    streakDays: number;
    totalKeys: number;
    rewardDay: number;
  };
}

export interface CheckinHistory {
  checkin_date: string;
  keys_earned: number;
  streak_days: number;
  total_keys: number;
  created_at: string;
}

class CheckinService {
  private baseURL = `${API_BASE_URL}/api/checkin`;

  // 检查用户今日签到状态
  async getCheckinStatus(userId: number): Promise<CheckinStatus> {
    try {
      const response = await fetch(`${this.baseURL}/status/${userId}`);
      const data = await response.json();
      
      if (data.success) {
        return data.data;
      } else {
        throw new Error(data.message || '获取签到状态失败');
      }
    } catch (error) {
      console.error('获取签到状态失败:', error);
      throw error;
    }
  }

  // 执行签到
  async performCheckin(userId: number): Promise<CheckinResult> {
    try {
      const response = await fetch(`${this.baseURL}/${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('签到失败:', error);
      return {
        success: false,
        message: '签到失败，请稍后重试'
      };
    }
  }

  // 获取用户签到历史
  async getCheckinHistory(userId: number, limit: number = 30): Promise<CheckinHistory[]> {
    try {
      const response = await fetch(`${this.baseURL}/history/${userId}?limit=${limit}`);
      const data = await response.json();
      
      if (data.success) {
        return data.data;
      } else {
        throw new Error(data.message || '获取签到历史失败');
      }
    } catch (error) {
      console.error('获取签到历史失败:', error);
      return [];
    }
  }

  // 获取签到奖励配置
  async getRewardsConfig(): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseURL}/rewards`);
      const data = await response.json();
      
      if (data.success) {
        return data.data;
      } else {
        throw new Error(data.message || '获取奖励配置失败');
      }
    } catch (error) {
      console.error('获取奖励配置失败:', error);
      return [];
    }
  }

  // 检查用户是否已登录
  getCurrentUserId(): number | null {
    // 从用户认证状态中获取用户ID
    const user = AuthService.getCurrentUser();
    return user?.id || null;
  }

  // 检查是否应该显示签到弹窗
  async shouldShowCheckinModal(): Promise<boolean> {
    const userId = this.getCurrentUserId();
    if (!userId) {
      return false; // 未登录用户不显示签到弹窗
    }

    try {
      const status = await this.getCheckinStatus(userId);
      return !status.hasCheckedInToday; // 未签到则显示弹窗
    } catch (error) {
      console.error('检查签到状态失败:', error);
      return false; // 出错时不显示弹窗
    }
  }
}

export default new CheckinService();
