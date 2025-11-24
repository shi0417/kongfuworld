// 认证状态监听Hook
import { useState, useEffect } from 'react';
import AuthService, { AuthState, User } from '../services/AuthService';

/**
 * 认证状态Hook
 */
export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>(AuthService.getAuthState());

  useEffect(() => {
    // 添加认证状态监听器
    const unsubscribe = AuthService.addListener((newAuthState) => {
      setAuthState(newAuthState);
    });

    // 清理监听器
    return unsubscribe;
  }, []);

  return {
    ...authState,
    // 便捷方法
    login: (user: User, token: string) => AuthService.setAuth(user, token),
    logout: () => AuthService.clearAuth(),
    updateUser: (user: User) => AuthService.updateUser(user),
    hasCheckedInToday: () => AuthService.hasCheckedInToday(),
    updateCheckinStatus: () => AuthService.updateCheckinStatus()
  };
};

/**
 * 用户信息Hook
 */
export const useUser = () => {
  const { user, isAuthenticated } = useAuth();
  
  return {
    user,
    isAuthenticated,
    userId: user?.id || null,
    username: user?.username || null,
    email: user?.email || null,
    avatar: user?.avatar || null,
    points: user?.points || 0,
    goldenKarma: user?.golden_karma || 0,
    checkinday: user?.checkinday || null
  };
};

/**
 * 签到状态Hook
 */
export const useCheckin = () => {
  const { user, isAuthenticated } = useAuth();
  
  const hasCheckedInToday = async () => {
    return await AuthService.hasCheckedInToday();
  };

  const updateCheckinStatus = () => {
    if (user) {
      const today = new Date().toISOString().split('T')[0];
      const updatedUser = { ...user, checkinday: today };
      AuthService.updateUser(updatedUser);
    }
  };

  return {
    hasCheckedInToday: hasCheckedInToday(),
    updateCheckinStatus,
    isAuthenticated
  };
};

export default useAuth;
