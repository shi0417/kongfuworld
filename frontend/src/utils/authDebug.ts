// 调试用户认证状态的工具函数
import AuthService from '../services/AuthService';
import ApiService from '../services/ApiService';

export const debugAuthStatus = () => {
  console.log('🔍 调试用户认证状态:');
  
  // 检查认证状态
  const user = AuthService.getCurrentUser();
  const authState = AuthService.getAuthState();
  
  console.log('📱 认证状态:');
  console.log('  user:', user ? '存在' : '不存在');
  console.log('  token:', authState.token ? '存在' : '不存在');
  
  if (user) {
    console.log('👤 用户数据:', user);
  }
  
  if (authState.token) {
    console.log('🔑 Token 长度:', authState.token.length);
    console.log('🔑 Token 前10位:', authState.token.substring(0, 10) + '...');
  }
  
  // 检查认证状态
  const isAuthenticated = authState.isAuthenticated;
  console.log('✅ 认证状态:', isAuthenticated ? '已登录' : '未登录');
  
  return {
    hasUser: !!user,
    hasToken: !!authState.token,
    isAuthenticated
  };
};

// 测试评论API认证
export const testReviewAPI = async (novelId: number) => {
  console.log('🧪 测试评论API认证...');
  
  const authState = AuthService.getAuthState();
  if (!authState.token) {
    console.error('❌ 没有找到token，请先登录');
    return;
  }
  
  try {
    const response = await ApiService.request(`/novel/${novelId}/review-stats`);
    
    if (response.success) {
      console.log('✅ 评论API认证成功:', response.data);
    } else {
      console.error('❌ 评论API认证失败:', response.message);
    }
  } catch (error) {
    console.error('❌ 网络请求失败:', error);
  }
};

// 清除认证数据
export const clearAuthData = () => {
  console.log('🧹 清除认证数据...');
  localStorage.removeItem('user');
  localStorage.removeItem('token');
  console.log('✅ 认证数据已清除');
};

// 在浏览器控制台中调用
if (typeof window !== 'undefined') {
  (window as any).debugAuth = debugAuthStatus;
  (window as any).testReviewAPI = testReviewAPI;
  (window as any).clearAuthData = clearAuthData;
}