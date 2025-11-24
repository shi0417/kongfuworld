// 任务系统服务
import { API_BASE_URL } from '../config';
import AuthService from './AuthService';

export interface Mission {
  id: number;
  missionKey: string;
  title: string;
  description: string;
  targetValue: number;
  rewardKeys: number;
  rewardKarma: number;
  resetType: string;
  currentProgress: number;
  isCompleted: boolean;
  isClaimed: boolean;
  progressDate: string;
  progressPercentage: number;
}

export interface MissionStats {
  dailyStats: Array<{
    total_completed: number;
    total_keys_earned: number;
    total_karma_earned: number;
    completion_date: string;
  }>;
  todayStats: {
    today_completed: number;
    today_keys_earned: number;
    today_karma_earned: number;
  };
}

class MissionService {
  private baseURL = `${API_BASE_URL}/api/mission`;

  // 获取用户任务列表
  async getUserMissions(userId: number, date?: string): Promise<Mission[]> {
    try {
      const url = date 
        ? `${this.baseURL}/user/${userId}?date=${date}`
        : `${this.baseURL}/user/${userId}`;
        
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success) {
        return data.data.missions;
      } else {
        throw new Error(data.message || '获取任务列表失败');
      }
    } catch (error) {
      console.error('获取用户任务失败:', error);
      throw error;
    }
  }

  // 更新任务进度
  async updateMissionProgress(userId: number, missionKey: string, progressValue: number = 1): Promise<any> {
    try {
      const response = await fetch(`${this.baseURL}/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          missionKey,
          progressValue
        })
      });
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('更新任务进度失败:', error);
      throw error;
    }
  }

  // 领取任务奖励
  async claimMissionReward(userId: number, missionId: number): Promise<any> {
    try {
      const response = await fetch(`${this.baseURL}/claim/${userId}/${missionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('领取任务奖励失败:', error);
      throw error;
    }
  }

  // 获取任务统计
  async getMissionStats(userId: number, days: number = 30): Promise<MissionStats> {
    try {
      const response = await fetch(`${this.baseURL}/stats/${userId}?days=${days}`);
      const data = await response.json();
      
      if (data.success) {
        return data.data;
      } else {
        throw new Error(data.message || '获取任务统计失败');
      }
    } catch (error) {
      console.error('获取任务统计失败:', error);
      throw error;
    }
  }

  // 检查用户是否已登录
  getCurrentUserId(): number | null {
    const user = AuthService.getCurrentUser();
    return user?.id || null;
  }
}

export default new MissionService();
