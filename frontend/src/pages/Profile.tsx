import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import NavBar from '../components/NavBar/NavBar';
import Footer from '../components/Footer/Footer';
import { useAuth, useUser } from '../hooks/useAuth';
import ApiService, { ApiError } from '../services/ApiService';
import Toast from '../components/Toast/Toast';

const defaultAvatar = 'https://via.placeholder.com/150x150/4a90e2/ffffff?text=Avatar';

type Settings = {
  auto_unlock: boolean;
  paragraph_comments: boolean;
  notify_unlock_updates: boolean;
  notify_chapter_updates: boolean;
  accept_marketing: boolean;
};

type UserData = {
  id: number;
  username: string;
  email: string;
  avatar?: string;
  settings_json?: Settings;
};

const defaultSettings: Settings = {
  auto_unlock: false,
  paragraph_comments: false,
  notify_unlock_updates: false,
  notify_chapter_updates: false,
  accept_marketing: false,
};

type Notification = {
  id: number | string;
  novel_id: number | null;
  chapter_id: number | null;
  novel_title: string;
  chapter_title?: string;
  message: string;
  type: 'accept_marketing' | 'notify_unlock_updates' | 'notify_chapter_updates';
  link: string;
  is_read: number;
  created_at: string;
  updated_at?: string;
  unlock_at?: string; // 时间解锁记录仍然有这个字段
  timeAgo: string;
  isTimeUnlock?: boolean;
  isUnlocked?: boolean;
  readed?: number;
};

type NotificationPagination = {
  currentPage: number;
  totalPages: number;
  total: number;
  limit: number;
};

const Profile: React.FC = () => {
  const { isAuthenticated, user: authUser, updateUser } = useAuth();
  const { user: userData } = useUser();
  const location = useLocation();
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'profile' | 'notifications' | 'settings'>('profile');
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);
  const [uploading, setUploading] = useState(false);
  
  // 用户名和邮箱编辑状态
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ username: '', email: '' });
  const [updatingProfile, setUpdatingProfile] = useState(false);
  
  // 通知相关状态
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState<'unlock' | 'chapter_marketing'>('unlock');
  const [notificationPagination, setNotificationPagination] = useState<NotificationPagination>({
    currentPage: 1,
    totalPages: 1,
    total: 0,
    limit: 10
  });
  const [allNotificationsRead, setAllNotificationsRead] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 处理URL参数来设置默认选项卡
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const tabParam = searchParams.get('tab');
    
    if (tabParam && ['profile', 'notifications', 'settings'].includes(tabParam)) {
      setTab(tabParam as 'profile' | 'notifications' | 'settings');
    }
  }, [location.search]);

  useEffect(() => {
    // 添加延迟检查，确保认证状态完全更新
    const checkAuth = () => {
      if (!isAuthenticated || !authUser) {
        console.log('认证检查失败，重定向到登录页');
        navigate('/login?redirect=/profile');
        return;
      }
      
      const loadUserData = async () => {
        try {
          const result = await ApiService.getUser(authUser.id);
          if (result.success) {
            console.log('初始加载用户数据:', result);
            setUser(result.data);
          
          // 处理 settings_json
          let backendSettings = result.data.settings_json;
          if (typeof backendSettings === 'string') {
            try {
              backendSettings = JSON.parse(backendSettings);
            } catch (e) {
              console.error('解析初始 settings_json 失败:', e);
              backendSettings = null;
            }
          }
          
          setSettings({ ...defaultSettings, ...backendSettings });
        }
      } catch (error) {
        console.error('初始加载用户数据失败:', error);
      } finally {
        setLoading(false);
      }
      };
      
      loadUserData();
    };
    
    // 延迟检查认证状态，确保登录后的状态更新完成
    const timeoutId = setTimeout(checkAuth, 100);
    
    return () => clearTimeout(timeoutId);
  }, [isAuthenticated, authUser, navigate]);

  // 切换到settings时刷新settings_json
  useEffect(() => {
    if (tab === 'settings' && user) {
      setSettingsLoading(true);
      ApiService.request(`/user/${user.id}`)
        .then(response => {
          if (!response.success) {
            throw new Error(response.message);
          }
          const data = response.data;
          // console.log('后端返回的原始数据:', data);
          // console.log('后端返回的 settings_json:', data.user.settings_json);
          
          // 确保 settings_json 是对象
          let backendSettings = data.user.settings_json;
          if (typeof backendSettings === 'string') {
            try {
              backendSettings = JSON.parse(backendSettings);
            } catch (e) {
              console.error('解析 settings_json 字符串失败:', e);
              backendSettings = null;
            }
          }
          
          // 如果后端设置为空或null，尝试初始化
          if (!backendSettings || Object.keys(backendSettings).length === 0) {
            console.log('检测到设置为空，尝试初始化...');
            return ApiService.request(`/user/${user.id}/init-settings`, {
              method: 'POST'
            })
            .then(initData => {
              console.log('初始化设置成功:', initData);
              const newSettings = { ...defaultSettings, ...initData.data.settings };
              console.log('初始化后的 newSettings:', newSettings);
              setSettings(newSettings);
              setSettingsLoading(false);
            })
            .catch(initError => {
              console.error('初始化设置失败:', initError);
              
              // 尝试修复数据库
              console.log('尝试修复数据库...');
              return ApiService.request('/fix-database', {
                method: 'POST'
              })
              .then(fixData => {
                console.log('数据库修复结果:', fixData);
                // 修复后重新获取用户数据
                return ApiService.request(`/user/${user.id}`);
              })
              .then(data => {
                let backendSettings = data.data.user.settings_json;
                if (typeof backendSettings === 'string') {
                  try {
                    backendSettings = JSON.parse(backendSettings);
                  } catch (e) {
                    console.error('解析修复后的设置失败:', e);
                    backendSettings = null;
                  }
                }
                const newSettings = { ...defaultSettings, ...backendSettings };
                console.log('修复后的 newSettings:', newSettings);
                setSettings(newSettings);
                setSettingsLoading(false);
              })
              .catch(fixError => {
                console.error('数据库修复也失败:', fixError);
                // 最终使用默认设置
                const newSettings = { ...defaultSettings };
                setSettings(newSettings);
                setSettingsLoading(false);
              });
            });
          }
          
          const newSettings = { ...defaultSettings, ...backendSettings };
          console.log('合并后的 newSettings:', newSettings);
          setSettings(newSettings);
          setSettingsLoading(false);
        })
        .catch((error) => {
          console.error('获取用户设置失败:', error);
          setSettingsLoading(false);
        });
    }
  }, [tab, user?.id]);

  // 获取通知列表
  const fetchNotifications = async (page = 1, type = notificationFilter) => {
    if (!user) {
      console.log('用户未登录，无法获取通知');
      return;
    }
    
    console.log('开始获取通知，用户ID:', user.id, '页码:', page, '类型:', type);
    setNotificationsLoading(true);
    
    try {
      const url = `/user/${user.id}/notifications?page=${page}&type=${type}&limit=10`;
      console.log('请求URL:', url);
      
      const response = await ApiService.request(url);
      console.log('响应状态:', response.success);
      
      console.log('响应数据:', response.data);
      
      if (response.success) {
        setNotifications(response.data.notifications);
        setNotificationPagination(response.data.pagination);
        console.log('通知加载成功，数量:', response.data.notifications.length);
      } else {
        console.error('获取通知失败:', response.message);
      }
    } catch (error) {
      console.error('获取通知失败:', error);
    } finally {
      setNotificationsLoading(false);
    }
  };

  // 切换到notifications时加载数据
  useEffect(() => {
    if (tab === 'notifications' && user) {
      fetchNotifications(1, notificationFilter);
    }
  }, [tab, user?.id, notificationFilter]);

  // 标记通知为已读
  const markAsRead = async (notificationId: number | string) => {
    if (!user) return;
    
    try {
      const response = await ApiService.request(`/user/${user.id}/notifications/${notificationId}/read`, {
        method: 'POST'
      });
      
      if (response.success) {
        // 更新本地状态
        setNotifications(prev => prev.map(n => 
          n.id === notificationId ? { 
            ...n, 
            is_read: 1,
            readed: n.isTimeUnlock ? 1 : n.readed
          } : n
        ));
      }
    } catch (error) {
      console.error('标记已读失败:', error);
    }
  };

  // 标记所有通知为已读/未读
  const markAllAsRead = async () => {
    if (!user || notifications.length === 0 || isMarkingAll) {
      console.log('markAllAsRead: 跳过执行', { user: !!user, notificationsLength: notifications.length, isMarkingAll });
      return;
    }
    
    console.log('markAllAsRead: 开始执行', { 
      allNotificationsRead, 
      notificationFilter, 
      notificationIds: notifications.map(n => n.id) 
    });
    
    setIsMarkingAll(true);
    
    try {
      const action = allNotificationsRead ? 'unread' : 'read';
      const notificationIds = notifications.map(n => n.id);
      
      console.log('markAllAsRead: 发送API请求', { action, notificationIds });
      
      const response = await ApiService.request(`/user/${user.id}/notifications/mark-current-page-read`, {
        method: 'POST',
        body: JSON.stringify({
          type: notificationFilter,
          action: action,
          notificationIds: notificationIds
        })
      });
      
      console.log('markAllAsRead: API响应', response);
      
      if (response.success) {
        // 更新本地状态
        const newReadStatus = action === 'read' ? 1 : 0;
        console.log('markAllAsRead: 更新本地状态', { newReadStatus, notificationFilter });
        
        setNotifications(prev => prev.map(n => {
          if (notificationFilter === 'unlock') {
            return { ...n, readed: newReadStatus };
          } else {
            return { ...n, is_read: newReadStatus };
          }
        }));
        
        // 切换按钮状态
        console.log('markAllAsRead: 切换按钮状态', { from: allNotificationsRead, to: !allNotificationsRead });
        setAllNotificationsRead(!allNotificationsRead);
      }
    } catch (error) {
      console.error('标记当前页面通知失败:', error);
    } finally {
      console.log('markAllAsRead: 完成执行');
      setIsMarkingAll(false);
    }
  };

  // 处理通知过滤
  const handleFilterChange = (filter: typeof notificationFilter) => {
    setNotificationFilter(filter);
    setNotificationPagination(prev => ({ ...prev, currentPage: 1 }));
    setAllNotificationsRead(false); // 重置按钮状态
  };

  // 检查当前页面的通知是否都已读
  const checkAllNotificationsRead = () => {
    if (notifications.length === 0) {
      console.log('checkAllNotificationsRead: 没有通知，设置为false');
      setAllNotificationsRead(false);
      return;
    }
    
    if (notificationFilter === 'unlock') {
      const allRead = notifications.every(n => n.readed === 1);
      console.log('checkAllNotificationsRead: unlock类型', { 
        allRead, 
        notifications: notifications.map(n => ({ id: n.id, readed: n.readed })) 
      });
      setAllNotificationsRead(allRead);
    } else {
      const allRead = notifications.every(n => n.is_read === 1);
      console.log('checkAllNotificationsRead: chapter_marketing类型', { 
        allRead, 
        notifications: notifications.map(n => ({ id: n.id, is_read: n.is_read })) 
      });
      setAllNotificationsRead(allRead);
    }
  };

  // 当通知列表更新时检查状态（但不包括手动更新）
  useEffect(() => {
    // 只有在非手动操作时才检查状态
    if (!isMarkingAll) {
      checkAllNotificationsRead();
    }
  }, [notifications, notificationFilter]);

  // 处理分页
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= notificationPagination.totalPages) {
      fetchNotifications(page, notificationFilter);
    }
  };

  // 保存设置到后端（点击checkbox时立即setSettings，异步保存）
  const saveSettings = (newSettings: Settings) => {
    setSettings(newSettings);
    if (!user) return;
    ApiService.request(`/user/${user.id}/settings`, {
      method: 'POST',
      body: JSON.stringify({ settings_json: newSettings }),
    });
  };

  // 头像上传
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('🖼️ handleAvatarChange 被调用');
    console.log('用户信息:', user);
    console.log('文件列表:', e.target.files);
    
    if (!user) {
      console.error('❌ 用户信息不存在');
      return;
    }
    
    if (!e.target.files || e.target.files.length === 0) {
      console.error('❌ 没有选择文件');
      return;
    }
    
    // 防止重复提交
    if (uploading) {
      console.log('⏳ 正在上传中，跳过');
      setToast({ message: '正在上传中，请稍候...', type: 'info' });
      return;
    }
    
    const file = e.target.files[0];
    console.log('📁 选择的文件:', {
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified
    });
    
    if (!file.type.startsWith('image/')) {
      console.error('❌ 不是图片文件:', file.type);
      setToast({ message: '请上传图片文件', type: 'error' });
      return;
    }
    if (file.size > 500 * 1024) {
      console.error('❌ 文件太大:', file.size, 'bytes');
      setToast({ message: '图片大小不能超过500KB', type: 'error' });
      return;
    }
    
    setUploading(true);
    console.log('🚀 开始上传头像，文件大小:', file.size, 'bytes');
    
    try {
      const formData = new FormData();
      formData.append('avatar', file); // 字段名必须为avatar
      console.log('📤 FormData已创建，准备发送请求到 /user/' + user.id + '/avatar');
      
      const res = await ApiService.request(`/user/${user.id}/avatar`, {
        method: 'POST',
        body: formData,
      });
      
      console.log('✅ 收到响应');
      console.log('📦 响应完整对象:', res);
      console.log('📦 响应类型:', typeof res);
      console.log('📦 响应success:', res.success);
      console.log('📦 响应data:', res.data);
      console.log('📦 响应data类型:', typeof res.data);
      console.log('📦 响应data.url:', res.data?.url);
      
      // 处理响应数据 - 后端应该始终返回 { success: true, data: { url: '...' } }
      let url: string | undefined = undefined;
      
      // 标准格式: { success: true, data: { url: '...' } }
      if (res.success && res.data && typeof res.data === 'object' && 'url' in res.data) {
        url = (res.data as { url: string }).url;
        console.log('✅ 从标准格式获取URL:', url);
      } else if (res.data && typeof res.data === 'object' && 'url' in res.data) {
        // 兼容没有success字段的情况
        url = (res.data as { url: string }).url;
        console.log('✅ 从兼容格式获取URL:', url);
      } else {
        console.error('❌ 无法从响应中提取URL');
        console.error('响应结构:', {
          hasSuccess: 'success' in res,
          successValue: res.success,
          hasData: 'data' in res,
          dataType: typeof res.data,
          dataValue: res.data,
          dataKeys: res.data && typeof res.data === 'object' ? Object.keys(res.data) : 'N/A'
        });
      }
      
      if (url) {
        console.log('✅ 获取到头像URL:', url);
        const newUser = { ...user, avatar: url };
        setUser(newUser);
        localStorage.setItem('user', JSON.stringify(newUser));
        
        // 同步更新认证服务中的用户数据，确保NavBar也能显示新头像
        // 需要包含User类型所需的所有属性
        if (updateUser && authUser) {
          const updatedAuthUser = {
            ...authUser,
            avatar: url
          };
          updateUser(updatedAuthUser);
          console.log('✅ 已同步更新认证服务中的用户数据');
        }
        
        // 触发自定义事件，通知NavBar组件更新头像
        window.dispatchEvent(new Event('userDataChanged'));
        setToast({ message: '头像上传成功', type: 'success' });
        console.log('✅ 头像更新完成');
      } else {
        console.error('❌ 响应中没有找到url字段');
        console.error('完整响应对象:', JSON.stringify(res, null, 2));
        setToast({ message: '上传成功但未获取到图片地址，请刷新页面查看', type: 'warning' });
      }
    } catch (error) {
      console.error('❌ 头像上传失败:', error);
      console.error('错误类型:', error instanceof ApiError ? 'ApiError' : typeof error);
      if (error instanceof ApiError) {
        console.error('错误状态码:', error.status);
        console.error('错误消息:', error.message);
        if (error.status === 413) {
          setToast({ message: '文件太大，请上传小于500KB的图片', type: 'error' });
        } else if (error.status === 400) {
          setToast({ message: error.message || '文件格式不正确或未选择文件', type: 'error' });
        } else {
          setToast({ message: error.message || '头像上传失败', type: 'error' });
        }
      } else {
        console.error('未知错误:', error);
        setToast({ message: '头像上传失败，请重试', type: 'error' });
      }
    } finally {
      setUploading(false);
      // 清空input，允许重复选择同一文件
      if (e.target) {
        e.target.value = '';
      }
      console.log('🏁 上传流程结束');
    }
  };
  // 删除头像
  const handleDeleteAvatar = async () => {
    if (!user) return;
    const res = await ApiService.request(`/user/${user.id}/avatar`, {
      method: 'DELETE',
    });
    const data = res.data;
    if (res.success) {
      const newUser = { ...user, avatar: '' };
      setUser(newUser);
      localStorage.setItem('user', JSON.stringify(newUser)); // 同步localStorage
      // 触发自定义事件，通知NavBar组件更新头像
      window.dispatchEvent(new Event('userDataChanged'));
    }
  };

  if (loading) return <div style={{ color: '#fff', textAlign: 'center', marginTop: 80 }}>加载中...</div>;
  if (!user) return null;

  // 假设 user.avatar 是 /avatars/xxx.jpg
  const avatarUrl = user.avatar?.startsWith('http')
    ? user.avatar
    : user.avatar
      ? `http://localhost:5000${user.avatar}`
      : defaultAvatar;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', padding: '0 0 40px 0', display: 'flex', flexDirection: 'column' }}>
      <NavBar />
      <div style={{ flex: 1 }}>
        <div style={{ maxWidth: 700, margin: '0 auto', marginTop: 32 }}>
          {/* 选项卡 */}
          <div style={{ display: 'flex', gap: 40, borderBottom: '2px solid var(--border-color)', marginBottom: 32 }}>
            <div
              style={{ fontWeight: 700, fontSize: 22, paddingBottom: 10, borderBottom: tab === 'profile' ? '3px solid #1976d2' : 'none', color: tab === 'profile' ? '#fff' : '#aaa', cursor: 'pointer' }}
              onClick={() => setTab('profile')}
            >Edit Profile</div>
            <div
              style={{ fontWeight: 700, fontSize: 22, paddingBottom: 10, borderBottom: tab === 'notifications' ? '3px solid #1976d2' : 'none', color: tab === 'notifications' ? '#fff' : '#aaa', cursor: 'pointer' }}
              onClick={() => setTab('notifications')}
            >Notifications</div>
            <div
              style={{ fontWeight: 700, fontSize: 22, paddingBottom: 10, borderBottom: tab === 'settings' ? '3px solid #1976d2' : 'none', color: tab === 'settings' ? '#fff' : '#aaa', cursor: 'pointer' }}
              onClick={() => setTab('settings')}
            >Settings</div>
          </div>
          {/* Edit Profile Tab */}
          {tab === 'profile' && (
            <div style={{ maxWidth: 500, margin: '0 auto', background: '#23272F', borderRadius: 16, padding: 36, boxShadow: '0 4px 24px #0008' }}>
              <h2 style={{ fontWeight: 700, fontSize: 28, marginBottom: 24, textAlign: 'center' }}>Your Profile</h2>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
                <div
                  style={{ position: 'relative', width: 140, height: 140, marginBottom: 16, cursor: 'pointer' }}
                  onClick={() => { if (!user?.avatar && fileInputRef.current) fileInputRef.current.click(); }}
                  onDrop={e => {
                    e.preventDefault();
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      const file = e.dataTransfer.files[0];
                      if (fileInputRef.current) {
                        const dt = new DataTransfer();
                        dt.items.add(file);
                        fileInputRef.current.files = dt.files;
                        handleAvatarChange({ target: fileInputRef.current } as any);
                      }
                    }
                  }}
                  onDragOver={e => e.preventDefault()}
                >
                  {user?.avatar ? (
                    <>
                      <img
                        src={avatarUrl}
                        alt="avatar"
                        style={{ width: 140, height: 140, borderRadius: '12px', objectFit: 'cover', background: '#eee' }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          top: 0, left: 0, width: 140, height: 140,
                          borderRadius: '12px',
                          background: 'rgba(0,0,0,0.3)',
                          opacity: 0,
                          transition: 'opacity 0.2s',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                        onClick={handleDeleteAvatar}
                        title="点击删除头像"
                      >
                        <span style={{ fontSize: 48, color: '#fff', fontWeight: 700 }}>×</span>
                      </div>
                    </>
                  ) : (
                    <div
                      style={{
                        width: 140, height: 140, borderRadius: '12px', background: '#444',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: 18, flexDirection: 'column',
                        border: '2px dashed #888', cursor: 'pointer',
                      }}
                      onClick={() => fileInputRef.current && fileInputRef.current.click()}
                    >
                      Drag & Drop your picture<br />or <span style={{ color: '#1976d2', textDecoration: 'underline' }}>Browse</span>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg"
                    style={{ display: 'none' }}
                    onChange={handleAvatarChange}
                  />
                </div>
                <ul style={{ color: '#aaa', fontSize: 15, margin: '12px 0 0 0', padding: 0, listStyle: 'disc inside' }}>
                  <li>Image must be a .jpg or .png</li>
                  <li>Max file size is 500 KB</li>
                </ul>
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={{ fontWeight: 500, marginBottom: 6, display: 'block' }}>Username</label>
                <input
                  type="text"
                  value={editingProfile ? profileForm.username : user.username}
                  onChange={(e) => {
                    if (editingProfile) {
                      setProfileForm({ ...profileForm, username: e.target.value });
                    }
                  }}
                  disabled={!editingProfile}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #444',
                    borderRadius: 6,
                    fontSize: 16,
                    background: editingProfile ? '#23272F' : '#18191A',
                    color: '#fff',
                    marginBottom: 8,
                    cursor: editingProfile ? 'text' : 'not-allowed'
                  }}
                />
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={{ fontWeight: 500, marginBottom: 6, display: 'block' }}>Email</label>
                <input
                  type="email"
                  value={editingProfile ? profileForm.email : user.email}
                  onChange={(e) => {
                    if (editingProfile) {
                      setProfileForm({ ...profileForm, email: e.target.value });
                    }
                  }}
                  disabled={!editingProfile}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #444',
                    borderRadius: 6,
                    fontSize: 16,
                    background: editingProfile ? '#23272F' : '#18191A',
                    color: '#fff',
                    marginBottom: 8,
                    cursor: editingProfile ? 'text' : 'not-allowed'
                  }}
                />
              </div>
              <div style={{ marginBottom: 18 }}>
                {!editingProfile ? (
                  <button
                    onClick={() => {
                      setEditingProfile(true);
                      setProfileForm({ username: user.username, email: user.email });
                    }}
                    style={{
                      padding: '10px 24px',
                      background: '#1976d2',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: 16,
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#1565c0'}
                    onMouseOut={(e) => e.currentTarget.style.background = '#1976d2'}
                  >
                    Update
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      onClick={async () => {
                        if (!profileForm.username.trim() || !profileForm.email.trim()) {
                          setToast({ message: 'Username and email cannot be empty', type: 'error' });
                          return;
                        }
                        
                        setUpdatingProfile(true);
                        try {
                          const response = await ApiService.request(`/user/${user.id}/profile`, {
                            method: 'PUT',
                            body: JSON.stringify({
                              username: profileForm.username.trim(),
                              email: profileForm.email.trim()
                            })
                          });
                          
                          if (response.success) {
                            setUser({ ...user, username: response.data.username, email: response.data.email });
                            setEditingProfile(false);
                            setToast({ message: 'Profile updated successfully', type: 'success' });
                            // 更新auth context中的用户信息
                            if (updateUser && authUser && authUser.id) {
                              updateUser({ 
                                id: authUser.id,
                                username: response.data.username, 
                                email: response.data.email,
                                avatar: authUser.avatar,
                                points: authUser.points || 0,
                                golden_karma: authUser.golden_karma || 0,
                                checkinday: authUser.checkinday,
                                created_at: authUser.created_at,
                                updated_at: authUser.updated_at
                              });
                            }
                          } else {
                            setToast({ message: response.message || 'Update failed', type: 'error' });
                          }
                        } catch (error: any) {
                          console.error('更新用户信息失败:', error);
                          setToast({ 
                            message: error.message || 'Failed to update profile', 
                            type: 'error' 
                          });
                        } finally {
                          setUpdatingProfile(false);
                        }
                      }}
                      disabled={updatingProfile}
                      style={{
                        padding: '10px 24px',
                        background: updatingProfile ? '#666' : '#1976d2',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        fontSize: 16,
                        fontWeight: 500,
                        cursor: updatingProfile ? 'not-allowed' : 'pointer',
                        transition: 'background 0.2s'
                      }}
                      onMouseOver={(e) => {
                        if (!updatingProfile) {
                          e.currentTarget.style.background = '#1565c0';
                        }
                      }}
                      onMouseOut={(e) => {
                        if (!updatingProfile) {
                          e.currentTarget.style.background = '#1976d2';
                        }
                      }}
                    >
                      {updatingProfile ? 'Updating...' : 'Save'}
                    </button>
                    <button
                      onClick={() => {
                        setEditingProfile(false);
                        setProfileForm({ username: user.username, email: user.email });
                      }}
                      disabled={updatingProfile}
                      style={{
                        padding: '10px 24px',
                        background: 'transparent',
                        color: '#aaa',
                        border: '1px solid #444',
                        borderRadius: 6,
                        fontSize: 16,
                        fontWeight: 500,
                        cursor: updatingProfile ? 'not-allowed' : 'pointer',
                        transition: 'color 0.2s, border-color 0.2s'
                      }}
                      onMouseOver={(e) => {
                        if (!updatingProfile) {
                          e.currentTarget.style.color = '#fff';
                          e.currentTarget.style.borderColor = '#666';
                        }
                      }}
                      onMouseOut={(e) => {
                        if (!updatingProfile) {
                          e.currentTarget.style.color = '#aaa';
                          e.currentTarget.style.borderColor = '#444';
                        }
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          {/* Notifications Tab */}
          {tab === 'notifications' && (
            <div style={{ maxWidth: 800, margin: '0 auto', background: '#23272F', borderRadius: 16, padding: 36, boxShadow: '0 4px 24px #0008' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h2 style={{ fontWeight: 700, fontSize: 24, margin: 0 }}>Notifications</h2>
                <button
                  onClick={markAllAsRead}
                  disabled={isMarkingAll || notifications.length === 0}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: isMarkingAll ? '#666' : '#1976d2',
                    cursor: isMarkingAll || notifications.length === 0 ? 'not-allowed' : 'pointer',
                    fontSize: 14,
                    textDecoration: 'underline',
                    opacity: isMarkingAll || notifications.length === 0 ? 0.5 : 1
                  }}
                >
                  {isMarkingAll ? 'Processing...' : (allNotificationsRead ? 'Mark all as Unread' : 'Mark all as read')}
                </button>
              </div>
              
              {/* 过滤器 */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                {(['unlock', 'chapter_marketing'] as const).map(filter => (
                  <button
                    key={filter}
                    onClick={() => handleFilterChange(filter)}
                    style={{
                      background: notificationFilter === filter ? '#1976d2' : 'transparent',
                      color: notificationFilter === filter ? '#fff' : '#aaa',
                      border: '1px solid #444',
                      borderRadius: 20,
                      padding: '8px 16px',
                      cursor: 'pointer',
                      fontSize: 14,
                      fontWeight: 500,
                      textTransform: 'capitalize'
                    }}
                  >
                    {filter === 'unlock' ? 'Unlock' : 
                     filter === 'chapter_marketing' ? 'ChapterUpdates&Marketing' : filter}
                  </button>
                ))}
              </div>
              
              {/* 通知列表 */}
              {notificationsLoading ? (
                <div style={{ color: '#fff', textAlign: 'center', margin: 40 }}>加载中...</div>
              ) : notifications.length === 0 ? (
                <div style={{ color: '#aaa', textAlign: 'center', margin: 40 }}>暂无通知</div>
              ) : (
                <div style={{ marginBottom: 24 }}>
                  {notifications.map((notification, index) => (
                    <div
                      key={notification.id}
                      style={{
                        padding: '20px 0',
                        borderBottom: index < notifications.length - 1 ? '1px solid #444' : 'none',
                        opacity: notification.is_read ? 0.7 : 1,
                        cursor: 'pointer'
                      }}
                      onClick={() => {
                        // 根据通知类型和当前过滤器决定跳转目标
                        if (notificationFilter === 'chapter_marketing') {
                          // ChapterUpdates&Marketing类型：跳转到小说详情页
                          if (notification.novel_id) {
                            navigate(`/book/${notification.novel_id}`);
                          } else if (notification.link) {
                            navigate(notification.link);
                          }
                        } else if (notificationFilter === 'unlock') {
                          // Unlock类型：跳转到章节页
                          if (notification.chapter_id && notification.novel_id) {
                            navigate(`/novel/${notification.novel_id}/chapter/${notification.chapter_id}`);
                          } else if (notification.link) {
                            navigate(notification.link);
                          }
                        } else {
                          // 默认情况：使用原有的逻辑
                          if (notification.chapter_id && notification.novel_id) {
                            navigate(`/novel/${notification.novel_id}/chapter/${notification.chapter_id}`);
                          } else if (notification.link) {
                            navigate(notification.link);
                          }
                        }
                        
                        // 标记为已读
                        if (!notification.is_read && !notification.readed) {
                          markAsRead(notification.id);
                        }
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ 
                            fontWeight: 600, 
                            fontSize: 16, 
                            marginBottom: 4,
                            color: (notification.is_read || notification.readed) ? '#aaa' : '#fff'
                          }}>
                            {notification.novel_title}
                            {notification.chapter_title && (
                              <span style={{ color: '#888', fontSize: 14, marginLeft: 8 }}>
                                - {notification.chapter_title}
                              </span>
                            )}
                          </div>
                          <div style={{ 
                            color: (notification.is_read || notification.readed) ? '#666' : '#ccc', 
                            fontSize: 14, 
                            marginBottom: 8,
                            lineHeight: 1.4
                          }}>
                            {notification.message}
                          </div>
                          <div style={{ color: '#888', fontSize: 12 }}>
                            {notification.timeAgo}
                            {notification.isTimeUnlock && notification.unlock_at && (
                              <span style={{ marginLeft: 8, color: notification.isUnlocked ? '#4caf50' : '#ff9800' }}>
                                {notification.isUnlocked ? '✓ Unlocked' : '⏰ Pending'}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(notification.id);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#1976d2',
                            cursor: 'pointer',
                            fontSize: 14,
                            fontWeight: 500,
                            marginLeft: 16
                          }}
                        >
                          READ
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* 分页 */}
              {notificationPagination.totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                  <button
                    onClick={() => handlePageChange(notificationPagination.currentPage - 1)}
                    disabled={notificationPagination.currentPage <= 1}
                    style={{
                      background: 'none',
                      border: '1px solid #444',
                      color: notificationPagination.currentPage <= 1 ? '#666' : '#fff',
                      borderRadius: 4,
                      padding: '8px 12px',
                      cursor: notificationPagination.currentPage <= 1 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    &lt;
                  </button>
                  
                  {Array.from({ length: notificationPagination.totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      style={{
                        background: page === notificationPagination.currentPage ? '#1976d2' : 'transparent',
                        border: '1px solid #444',
                        color: page === notificationPagination.currentPage ? '#fff' : '#aaa',
                        borderRadius: 4,
                        padding: '8px 12px',
                        cursor: 'pointer',
                        minWidth: 40
                      }}
                    >
                      {page}
                    </button>
                  ))}
                  
                  <button
                    onClick={() => handlePageChange(notificationPagination.currentPage + 1)}
                    disabled={notificationPagination.currentPage >= notificationPagination.totalPages}
                    style={{
                      background: 'none',
                      border: '1px solid #444',
                      color: notificationPagination.currentPage >= notificationPagination.totalPages ? '#666' : '#fff',
                      borderRadius: 4,
                      padding: '8px 12px',
                      cursor: notificationPagination.currentPage >= notificationPagination.totalPages ? 'not-allowed' : 'pointer'
                    }}
                  >
                    &gt;
                  </button>
                </div>
              )}
            </div>
          )}
          {/* Settings Tab */}
          {tab === 'settings' && (
            <div style={{ maxWidth: 600, margin: '0 auto', background: '#23272F', borderRadius: 16, padding: 36, boxShadow: '0 4px 24px #0008' }}>
              {settingsLoading ? (
                <div style={{ color: '#fff', textAlign: 'center', margin: 40 }}>加载中...</div>
              ) : (
                <>
                  <h2 style={{ fontWeight: 700, fontSize: 24, marginBottom: 24 }}>General Settings</h2>
                  <div style={{ borderBottom: '1px solid #444', marginBottom: 18 }} />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>Enable Auto Unlock</div>
                      <div style={{ color: '#aaa', fontSize: 15 }}>Automatically unlock chapters without confirmation. Unlock will use WTU, Keys, and Karma, in that order.</div>
                    </div>
                    <input type="checkbox" checked={!!settings.auto_unlock} onChange={e => saveSettings({ ...settings, auto_unlock: e.target.checked })} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>Paragraph Comments</div>
                      <div style={{ color: '#aaa', fontSize: 15 }}>Show paragraph comments in the comment section.</div>
                    </div>
                    <input type="checkbox" checked={!!settings.paragraph_comments} onChange={e => saveSettings({ ...settings, paragraph_comments: e.target.checked })} />
                  </div>
                  <h2 style={{ fontWeight: 700, fontSize: 22, margin: '32px 0 12px 0' }}>Web Notification Settings</h2>
                  <div style={{ borderBottom: '1px solid #444', marginBottom: 18 }} />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>Unlock Updates</div>
                      <div style={{ color: '#aaa', fontSize: 15 }}>Receive notifications when chapters are ready to be unlocked</div>
                    </div>
                    <input type="checkbox" checked={!!settings.notify_unlock_updates} onChange={e => saveSettings({ ...settings, notify_unlock_updates: e.target.checked })} />
                  </div>
                  <h2 style={{ fontWeight: 700, fontSize: 22, margin: '32px 0 12px 0' }}>Push Notification Settings</h2>
                  <div style={{ borderBottom: '1px solid #444', marginBottom: 18 }} />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>Chapter Updates</div>
                      <div style={{ color: '#aaa', fontSize: 15 }}>Receive notifications when chapters of bookmarked series are published</div>
                    </div>
                    <input type="checkbox" checked={!!settings.notify_chapter_updates} onChange={e => saveSettings({ ...settings, notify_chapter_updates: e.target.checked })} />
                  </div>
                  <h2 style={{ fontWeight: 700, fontSize: 22, margin: '32px 0 12px 0' }}>Miscellaneous</h2>
                  <div style={{ borderBottom: '1px solid #444', marginBottom: 18 }} />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>Marketing</div>
                      <div style={{ color: '#aaa', fontSize: 15 }}>Allow marketing and promotional emails from Kongfuworld</div>
                    </div>
                    <input type="checkbox" checked={!!settings.accept_marketing} onChange={e => saveSettings({ ...settings, accept_marketing: e.target.checked })} />
                  </div>
                </>
              )}

              {/* Authenticator 区块 */}
              <h2 style={{ fontWeight: 700, fontSize: 22, margin: '32px 0 12px 0' }}>Authenticator</h2>
              <div style={{ borderBottom: '1px solid #444', marginBottom: 18 }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>Two-factor authentication (2FA)</div>
                  <div style={{ color: '#aaa', fontSize: 15 }}>
                    <a href="#" style={{ color: '#1976d2', textDecoration: 'underline', marginRight: 16 }}>Set up authenticator app</a>
                    <a href="#" style={{ color: '#1976d2', textDecoration: 'underline' }}>Reset authenticator app</a>
                  </div>
                </div>
              </div>

              {/* Account Settings 区块 */}
              <h2 style={{ fontWeight: 700, fontSize: 22, margin: '32px 0 12px 0' }}>Account Settings</h2>
              <div style={{ borderBottom: '1px solid #444', marginBottom: 18 }} />
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Change password</div>
                <button style={{ background: 'linear-gradient(90deg,#1976d2,#2196f3)', color: '#fff', fontWeight: 600, border: 'none', borderRadius: 8, padding: '10px 28px', fontSize: 16, cursor: 'pointer' }}
                  onClick={() => alert('弹窗输入旧密码和新密码，提交到后端 /api/user/:id/password')}
                >Change password</button>
              </div>
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Delete my Kongfuworld account</div>
                <div style={{ color: '#aaa', fontSize: 15, marginBottom: 8 }}>
                  If you delete your account, you will lose access to all associated bookmarks, purchases, and settings. Account deletion is irreversible.
                </div>
                <button style={{ background: '#f44', color: '#fff', fontWeight: 600, border: 'none', borderRadius: 8, padding: '10px 28px', fontSize: 16, cursor: 'pointer' }}
                  onClick={() => { if(window.confirm('确定要删除账号吗？此操作不可恢复')) alert('调用后端 /api/user/:id/delete 删除账号') }}
                >Delete account</button>
              </div>
            </div>
          )}
          {/* 其它tab内容略 */}
        </div>
      </div>
      <Footer />
      
      {/* Toast提示 */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
          duration={3000}
        />
      )}
    </div>
  );
};

export default Profile; 