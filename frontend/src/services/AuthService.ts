// 统一认证服务
import { jwtDecode } from 'jwt-decode';

export interface User {
  id: number;
  username: string;
  email: string;
  avatar?: string;
  points: number;
  golden_karma: number;
  checkinday?: string; // 新增签到日期字段
  created_at?: string;
  updated_at?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
}

class AuthService {
  private static listeners: Array<(authState: AuthState) => void> = [];
  private static authState: AuthState = {
    isAuthenticated: false,
    user: null,
    token: null
  };

  /**
   * 初始化认证状态
   */
  static init(): void {
    this.loadAuthFromStorage();
    this.setupBrowserCloseHandler();
  }

  /**
   * 设置浏览器关闭时的处理逻辑
   */
  private static setupBrowserCloseHandler(): void {
    // 监听页面卸载事件（浏览器关闭、刷新、导航离开）
    window.addEventListener('beforeunload', () => {
      try {
        // 从sessionStorage获取用户设置
        const settingsStr = sessionStorage.getItem('user_settings');
        if (settingsStr) {
          const settings = JSON.parse(settingsStr);
          // 如果启用了"关闭浏览器自动退出登录"，清除localStorage中的认证信息
          if (settings.auto_logout_on_browser_close === true) {
            localStorage.removeItem('user');
            localStorage.removeItem('token');
          }
        }
      } catch (error) {
        console.error('处理浏览器关闭事件失败:', error);
      }
    });
  }

  /**
   * 更新用户设置到sessionStorage（用于浏览器关闭时检查）
   */
  static updateUserSettings(settings: any): void {
    try {
      sessionStorage.setItem('user_settings', JSON.stringify(settings));
    } catch (error) {
      console.error('保存用户设置到sessionStorage失败:', error);
    }
  }

  /**
   * 从localStorage加载认证信息
   */
  private static loadAuthFromStorage(): void {
    try {
      const userStr = localStorage.getItem('user');
      const token = localStorage.getItem('token');

      if (userStr && token) {
        const user = JSON.parse(userStr);
        const isValidToken = this.isTokenValid(token);
        
        if (isValidToken) {
          this.authState = {
            isAuthenticated: true,
            user,
            token
          };
        } else {
          this.clearAuth();
        }
      } else {
        this.clearAuth();
      }
    } catch (error) {
      console.error('加载认证信息失败:', error);
      this.clearAuth();
    }
    
    this.notifyListeners();
  }

  /**
   * 验证Token是否有效
   */
  static isTokenValid(token?: string): boolean {
    const tokenToCheck = token || this.authState.token;
    if (!tokenToCheck) return false;

    try {
      // 解码token检查过期时间
      const decoded = jwtDecode(tokenToCheck) as any;
      if (!decoded || !decoded.exp) return false;

      const now = Date.now() / 1000;
      return decoded.exp > now;
    } catch (error) {
      console.error('Token验证失败:', error);
      return false;
    }
  }

  /**
   * 获取当前用户
   */
  static getCurrentUser(): User | null {
    return this.authState.user;
  }

  /**
   * 获取当前用户ID
   */
  static getCurrentUserId(): number | null {
    return this.authState.user?.id || null;
  }

  /**
   * 检查是否已认证
   */
  static isAuthenticated(): boolean {
    return this.authState.isAuthenticated && this.isTokenValid();
  }

  /**
   * 设置认证状态
   */
  static setAuth(user: User, token: string): void {
    try {
      console.log('设置认证状态:', { user, token });
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('token', token);
      
      this.authState = {
        isAuthenticated: true,
        user,
        token
      };
      
      console.log('认证状态已更新:', this.authState);
      this.notifyListeners();
    } catch (error) {
      console.error('设置认证状态失败:', error);
    }
  }

  /**
   * 登录方法
   */
  static login(user: User, token: string): void {
    console.log('AuthService.login 被调用:', { user, token });
    this.setAuth(user, token);
    console.log('AuthService.login 完成');
  }

  /**
   * 清除认证状态
   */
  static clearAuth(): void {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    
    this.authState = {
      isAuthenticated: false,
      user: null,
      token: null
    };
    
    this.notifyListeners();
  }

  /**
   * 更新用户信息
   */
  static updateUser(user: User): void {
    if (this.authState.isAuthenticated) {
      this.authState.user = user;
      localStorage.setItem('user', JSON.stringify(user));
      this.notifyListeners();
    }
  }

  /**
   * 检查今日是否已签到
   * 如果user.checkinday不等于今天，需要调用后端API检查daily_checkin表
   */
  static async hasCheckedInToday(): Promise<boolean> {
    const user = this.getCurrentUser();
    if (!user) return false;

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD格式
    
    // 如果user.checkinday等于今天，说明已签到
    if (user.checkinday === today) {
      return true;
    }
    
    // 如果user.checkinday不等于今天（包括null或其他日期），调用后端API检查daily_checkin表
    try {
      const response = await fetch(`http://localhost:5000/api/checkin/status/${user.id}?timezone=UTC`);
      const result = await response.json();
      
      if (result.success && result.data.hasCheckedInToday) {
        // 如果后端显示已签到，更新本地user.checkinday
        const updatedUser = { ...user, checkinday: today };
        this.updateUser(updatedUser);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('检查签到状态失败:', error);
      return false;
    }
  }

  /**
   * 更新签到状态
   */
  static updateCheckinStatus(): void {
    const user = this.getCurrentUser();
    if (user) {
      const today = new Date().toISOString().split('T')[0];
      const updatedUser = { ...user, checkinday: today };
      this.updateUser(updatedUser);
    }
  }

  /**
   * 添加认证状态监听器
   */
  static addListener(callback: (authState: AuthState) => void): () => void {
    this.listeners.push(callback);
    
    // 返回取消监听的函数
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * 通知所有监听器
   */
  private static notifyListeners(): void {
    this.listeners.forEach(callback => {
      try {
        callback(this.authState);
      } catch (error) {
        console.error('认证状态监听器执行失败:', error);
      }
    });
  }

  /**
   * 获取认证状态
   */
  static getAuthState(): AuthState {
    return { ...this.authState };
  }

  /**
   * 调试认证状态
   */
  static debugAuthStatus(): void {
    console.log('🔍 认证状态调试:');
    console.log('  认证状态:', this.authState);
    console.log('  localStorage user:', localStorage.getItem('user'));
    console.log('  localStorage token:', localStorage.getItem('token'));
    console.log('  Token有效:', this.isTokenValid());
    console.log('  今日已签到:', this.hasCheckedInToday());
  }
}

// 初始化认证服务
AuthService.init();

export default AuthService;
