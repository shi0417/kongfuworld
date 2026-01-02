// 统一API调用服务
import AuthService from './AuthService';
import { getApiBaseUrl } from '../config';

export interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  status?: number;
  pagination?: PaginationInfo;
}

// PayPal支付响应类型
export interface PayPalPaymentResponse {
  success: boolean;
  orderId: string;
  approvalUrl: string;
  paymentRecordId: number;
  message?: string;
}

// Stripe支付方式响应类型
export interface StripePaymentMethodsResponse {
  success: boolean;
  paymentMethods: any[];
  message?: string;
}

// 统一的Stripe支付创建响应类型
export interface StripePaymentCreateResponse {
  success: boolean;
  clientSecret: string;
  paymentIntentId: string;
  paymentRecordId?: number;
  status: string;
  message?: string;
}

export interface ApiError {
  message: string;
  status: number;
  code?: string;
}

class ApiService {
  /**
   * 统一API调用方法
   */
  static async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const base = getApiBaseUrl();
      if (!base) {
        throw new ApiError('API base url is not configured', 500);
      }
      
      const url = `${base}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
      
      if (process.env.NODE_ENV !== 'production') {
        console.log('ApiService请求URL:', url);
      }
      
      // 检查是否是管理员API，如果是则使用管理员Token
      const isAdminApi = endpoint.startsWith('/admin');
      let token: string | null = null;
      
      if (isAdminApi) {
        // 管理员API使用adminToken
        token = localStorage.getItem('adminToken');
      } else {
        // 普通API使用用户Token
        token = AuthService.getAuthState().token;
      }
      
      // 检查body是否是FormData，如果是则不设置Content-Type（让浏览器自动设置）
      const isFormData = options.body instanceof FormData;
      
      // 将headers转换为Record类型以便操作
      const headersObj: Record<string, string> = {};
      
      // 复制已有的headers
      if (options.headers) {
        if (options.headers instanceof Headers) {
          options.headers.forEach((value, key) => {
            headersObj[key] = value;
          });
        } else if (Array.isArray(options.headers)) {
          options.headers.forEach(([key, value]) => {
            headersObj[key] = value;
          });
        } else {
          Object.assign(headersObj, options.headers);
        }
      }

      // 只有当不是FormData时才设置Content-Type
      if (!isFormData && !headersObj['Content-Type']) {
        headersObj['Content-Type'] = 'application/json';
      }

      // 如果有token，添加到请求头
      if (token) {
        // 对于管理员Token，只检查是否存在（后端会验证签名）
        // 对于普通用户Token，使用AuthService验证
        if (isAdminApi || AuthService.isTokenValid(token)) {
          headersObj['Authorization'] = `Bearer ${token}`;
        }
      }

      const headers: HeadersInit = headersObj;

      const response = await fetch(url, {
        ...options,
        headers
      });

      // 处理HTTP错误
      if (!response.ok) {
        if (response.status === 401) {
          // Token过期或无效
          if (isAdminApi) {
            // 管理员API：清除管理员Token
            localStorage.removeItem('adminToken');
          } else {
            // 普通API：清除用户认证状态
            AuthService.clearAuth();
          }
          throw new ApiError('认证失败，请重新登录', 401);
        }
        
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.message || `HTTP ${response.status}`,
          response.status
        );
      }

      const data = await response.json();
      if (process.env.NODE_ENV !== 'production') {
        console.log('ApiService响应数据:', data);
      }
      return data;
    } catch (error) {
      console.error('API请求失败:', error);
      
      if (error instanceof ApiError) {
        throw error;
      }
      
      throw new ApiError(
        error instanceof Error ? error.message : '网络请求失败',
        0
      );
    }
  }

  /**
   * GET请求
   */
  static async get<T = any>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  /**
   * POST请求
   */
  static async post<T = any>(
    endpoint: string,
    data?: any,
    options?: RequestInit
  ): Promise<ApiResponse<T>> {
    const isFormData = data instanceof FormData;
    return this.request<T>(endpoint, {
      method: 'POST',
      body: isFormData ? data : (data ? JSON.stringify(data) : undefined),
      ...options
    });
  }

  /**
   * PUT请求
   */
  static async put<T = any>(
    endpoint: string,
    data?: any
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  /**
   * DELETE请求
   */
  static async delete<T = any>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { 
      method: 'DELETE', 
      body: data ? JSON.stringify(data) : undefined 
    });
  }

  /**
   * 用户相关API
   */
  static async getUser(userId: number) {
    return this.get(`/user/${userId}`);
  }

  static async updateUser(userId: number, userData: any) {
    return this.put(`/user/${userId}`, userData);
  }

  /**
   * 签到相关API
   */
  static async getCheckinStatus(userId: number, timezone = 'UTC') {
    return this.get(`/checkin/status/${userId}?timezone=${timezone}`);
  }

  static async performCheckin(userId: number, timezone = 'UTC') {
    return this.post(`/checkin/${userId}`, { timezone });
  }

  static async getCheckinHistory(userId: number, limit = 30) {
    return this.get(`/checkin/history/${userId}?limit=${limit}`);
  }

  /**
   * 任务相关API
   */
  static async getUserMissions(userId: number) {
    return this.get(`/mission-v2/user/${userId}`);
  }

  static async claimMissionReward(userId: number, missionId: number) {
    return this.post(`/mission-v2/claim/${userId}/${missionId}`);
  }

  /**
   * 钥匙交易相关API
   */
  static async getKeyTransactions(userId: number, page = 1, limit = 10) {
    return this.get(`/key-transaction/transactions?userId=${userId}&page=${page}&limit=${limit}`);
  }

  /**
   * 章节解锁相关API
   */
  static async getChapterUnlockStatus(chapterId: number, userId: number) {
    return this.get(`/chapter-unlock/status/${chapterId}/${userId}`);
  }

  static async unlockChapter(chapterId: number, userId: number, unlockMethod: string) {
    return this.post(`/chapter-unlock/unlock`, {
      chapterId,
      userId,
      unlockMethod
    });
  }

  /**
   * 评论相关API
   */
  static async getNovelReviews(novelId: number, page = 1, limit = 10) {
    return this.get(`/novel/${novelId}/reviews?page=${page}&limit=${limit}`);
  }

  static async submitReview(novelId: number, content: string, rating?: number) {
    return this.post(`/novel/${novelId}/review`, {
      content,
      rating
    });
  }

  /**
   * 文件上传API
   */
  static async uploadFile(file: File, endpoint: string) {
    const formData = new FormData();
    formData.append('file', file);

    return this.request(endpoint, {
      method: 'POST',
      body: formData,
      headers: {} // 不设置Content-Type，让浏览器自动设置
    });
  }
}

export class ApiError extends Error {
  public status: number;
  public code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export default ApiService;
