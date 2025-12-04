import { useState, useEffect } from 'react';
import ApiService from '../services/ApiService';

interface Chapter {
  id: number;
  unlock_price?: number | null;
  [key: string]: any;
}

interface User {
  id: number;
  [key: string]: any;
}

interface UseChapterLockStatusResult {
  isChapterLocked: boolean;
  isCheckingLockStatus: boolean;
  checkLockStatus: (chapter: Chapter, user: User | null) => Promise<void>;
}

/**
 * 自定义 Hook：管理章节锁定状态
 * 封装了章节锁定检查逻辑，包括权限验证和状态管理
 */
export const useChapterLockStatus = (): UseChapterLockStatusResult => {
  const [isChapterLocked, setIsChapterLocked] = useState<boolean>(false);
  const [isCheckingLockStatus, setIsCheckingLockStatus] = useState<boolean>(false);

  /**
   * 检查用户章节访问权限
   */
  const checkUserChapterAccess = async (chapter: Chapter, user: User | null) => {
    try {
      setIsCheckingLockStatus(true);
      console.log('🔍 [useChapterLockStatus] 开始检查用户章节访问权限:');
      console.log('📖 [useChapterLockStatus] 章节ID:', chapter.id);
      console.log('👤 [useChapterLockStatus] 用户ID:', user?.id);
      
      if (!user) {
        console.log('❌ [useChapterLockStatus] 用户未登录，保持锁定状态');
        setIsChapterLocked(true);
        return;
      }

      // 调用后端API检查用户权限
      console.log('📡 [useChapterLockStatus] 发送API请求...');
      const response = await ApiService.request(`/chapter-unlock/status/${chapter.id}/${user.id}`);
      console.log('📡 [useChapterLockStatus] API响应状态:', response.success);
      console.log('📊 [useChapterLockStatus] API响应数据:', response.data);
      
      if (response.success) {
        const unlockData = response.data;
        console.log('🔓 [useChapterLockStatus] 解锁状态:', unlockData);
        console.log('🔓 [useChapterLockStatus] isUnlocked:', unlockData.isUnlocked);
        
        // 如果用户已解锁，不显示锁定
        console.log('🔓 [useChapterLockStatus] 判断解锁状态...');
        console.log('🔓 [useChapterLockStatus] unlockData.isUnlocked (原始值):', unlockData.isUnlocked);
        console.log('🔓 [useChapterLockStatus] unlockData.isUnlocked (类型):', typeof unlockData.isUnlocked);
        console.log('🔓 [useChapterLockStatus] unlockData.isUnlocked (布尔值):', Boolean(unlockData.isUnlocked));
        console.log('🔓 [useChapterLockStatus] unlockData.isUnlocked === true?:', unlockData.isUnlocked === true);
        console.log('🔓 [useChapterLockStatus] unlockData.isUnlocked === 1?:', unlockData.isUnlocked === 1);
        
        if (unlockData.isUnlocked) {
          console.log('✅ [useChapterLockStatus] 用户有访问权限，不显示锁定');
          console.log('✅ [useChapterLockStatus] 设置 isChapterLocked = false');
          setIsChapterLocked(false);
        } else {
          console.log('❌ [useChapterLockStatus] 用户无访问权限，显示锁定');
          console.log('❌ [useChapterLockStatus] 设置 isChapterLocked = true');
          setIsChapterLocked(true);
        }
      } else {
        console.log('❌ [useChapterLockStatus] API调用失败，默认显示锁定');
        setIsChapterLocked(true);
      }
    } catch (error) {
      console.error('❌ [useChapterLockStatus] 检查用户权限失败:', error);
      setIsChapterLocked(true);
    } finally {
      setIsCheckingLockStatus(false);
    }
  };

  /**
   * 检查章节锁定状态
   * @param chapter 章节数据
   * @param user 用户数据（可为 null）
   */
  const checkLockStatus = async (chapter: Chapter, user: User | null) => {
    console.log('🔍 [useChapterLockStatus] ========== 章节锁定检查开始 ==========');
    console.log('📖 [useChapterLockStatus] 章节信息:', {
      id: chapter.id,
      unlock_price: chapter.unlock_price,
      unlock_price_type: typeof chapter.unlock_price,
      unlock_price_is_null: chapter.unlock_price === null,
      unlock_price_is_undefined: chapter.unlock_price === undefined,
      unlock_price_gt_0: (chapter.unlock_price && chapter.unlock_price > 0),
    });
    console.log('👤 [useChapterLockStatus] 用户信息:', {
      id: user?.id,
      username: user?.username,
      isLoggedIn: !!user
    });
    console.log('🔍 [useChapterLockStatus] 当前 isChapterLocked 状态:', isChapterLocked);

    if (chapter.unlock_price && chapter.unlock_price > 0) {
      console.log('🔒 [useChapterLockStatus] 章节被锁定，需要检查用户权限');
      console.log('🔒 [useChapterLockStatus] 设置 isChapterLocked = true (临时锁定)');
      // 先假设章节是锁定的，避免在权限检查完成前显示全部内容
      setIsChapterLocked(true);
      console.log('🔒 [useChapterLockStatus] 调用 checkUserChapterAccess...');
      // 检查用户权限
      await checkUserChapterAccess(chapter, user);
      console.log('🔒 [useChapterLockStatus] checkUserChapterAccess 完成');
    } else {
      console.log('🔓 [useChapterLockStatus] 章节未锁定，直接显示内容');
      console.log('🔓 [useChapterLockStatus] 设置 isChapterLocked = false');
      setIsChapterLocked(false);
      setIsCheckingLockStatus(false);
    }
    console.log('🔍 [useChapterLockStatus] ======================================');
  };

  return {
    isChapterLocked,
    isCheckingLockStatus,
    checkLockStatus,
  };
};

