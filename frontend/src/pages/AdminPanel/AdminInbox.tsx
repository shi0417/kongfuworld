import React, { useState, useEffect } from 'react';
import ApiService from '../../services/ApiService';
import styles from './AdminInbox.module.css';

interface AdminInboxProps {
  onError?: (error: string) => void;
}

interface Conversation {
  id: number;
  subject: string;
  category: string;
  status: string;
  priority: string;
  assigned_to: number | null;
  // v2 Join/Claim 负责人视图：active admin participant（最后 join 的那位）
  active_assigned_admin_id?: number | null;
  active_assigned_admin_name?: string | null;
  related_novel_id: number | null;
  created_at: string;
  updated_at: string;
  created_by: number;
  author_name: string | null;
  author_pen_name: string | null;
  assigned_admin_name: string | null;
  novel_title: string | null;
  message_count: number;
  last_message_content: string | null;
  last_message_at: string | null;
}

interface Message {
  id: number;
  conversation_id: number;
  sender_id: number | null;
  sender_admin_id: number | null;
  sender_type: string;
  content: string;
  internal_note: number;
  created_at: string;
  sender_name: string | null;
  sender_pen_name: string | null;
  sender_admin_name: string | null;
  attachment_count: number;
}

interface ConversationDetail extends Conversation {
  internal_note: string | null;
}

const AdminInbox: React.FC<AdminInboxProps> = ({ onError }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<number | null>(null);
  const [conversationDetail, setConversationDetail] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    category: '',
    assigned_to: '',
    search: ''
  });
  const [admins, setAdmins] = useState<Array<{ id: number; username: string }>>([]);
  const [claimingId, setClaimingId] = useState<number | null>(null);
  const [claimError, setClaimError] = useState<string>('');

  const decodeAdminToken = () => {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) return null;
      const parts = token.split('.');
      if (parts.length < 2) return null;
      const base64Url = parts[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(base64Url.length / 4) * 4, '=');
      const json = atob(base64);
      const payload = JSON.parse(json);
      const adminId = payload.adminId ?? payload.id;
      const name = payload.name ?? payload.username ?? '';
      if (!adminId) return null;
      return { adminId: Number(adminId), name: String(name || '') };
    } catch {
      return null;
    }
  };

  const currentAdmin = decodeAdminToken();
  const currentAdminId = currentAdmin?.adminId ?? null;
  const currentAdminName = currentAdmin?.name ?? '';

  // 加载管理员列表
  const loadAdmins = async () => {
    try {
      const response = await ApiService.get('/admin/admin-users?page=1&pageSize=100');
      if (response.success && response.data && response.data.list) {
        setAdmins(response.data.list.filter((u: any) => u.role === 'admin' || u.role === 'super_admin') || []);
      }
    } catch (error) {
      console.error('加载管理员列表失败:', error);
    }
  };

  // 加载会话列表
  const loadConversations = async () => {
    try {
      setLoading(true);
      setClaimError('');
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.category) params.append('category', filters.category);
      if (filters.assigned_to) params.append('assigned_to', filters.assigned_to);
      if (filters.search) params.append('search', filters.search);
      params.append('page', '1');
      params.append('limit', '50');

      const response = await ApiService.get(`/admin/inbox/conversations?${params.toString()}`);
      if (response.success && response.data) {
        setConversations(response.data.conversations || []);
      }
    } catch (error: any) {
      console.error('加载会话列表失败:', error);
      if (onError) onError(error.message || '加载会话列表失败');
    } finally {
      setLoading(false);
    }
  };

  const claimConversation = async (conversationId: number) => {
    const currentAdmin = decodeAdminToken();
    if (!currentAdmin) {
      setClaimError('未检测到当前登录管理员信息（adminToken）');
      return;
    }
    const adminToken = localStorage.getItem('adminToken');
    if (!adminToken) {
      setClaimError('未检测到 adminToken，请先登录管理后台');
      return;
    }
    try {
      setClaimingId(conversationId);
      setClaimError('');
      // 1) join/claim (must succeed before assign)
      const resp = await fetch(`http://localhost:5000/api/inbox/conversation/${conversationId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || data?.success !== true) {
        setClaimError(data?.message || '分配失败');
        return;
      }

      // 2) assign (must succeed)
      const assignResp = await ApiService.post(`/admin/inbox/conversations/${conversationId}/assign`, {
        assigned_to: currentAdmin.adminId
      });
      if (!assignResp.success) {
        setClaimError('assign failed');
        return;
      }

      // 成功后刷新（保持现有 assigned_to 筛选语义）
      if (selectedConversation === conversationId) {
        await loadConversationDetail(conversationId);
      }
      await loadConversations();
    } catch (e: any) {
      console.error('分配给我失败:', e);
      setClaimError(e?.message || '分配失败');
    } finally {
      setClaimingId(null);
    }
  };

  // 加载会话详情
  const loadConversationDetail = async (conversationId: number) => {
    try {
      const response = await ApiService.get(`/admin/inbox/conversations/${conversationId}`);
      if (response.success && response.data) {
        setConversationDetail(response.data);
      }
    } catch (error: any) {
      console.error('加载会话详情失败:', error);
      if (onError) onError(error.message || '加载会话详情失败');
    }
  };

  // 加载消息
  const loadMessages = async (conversationId: number) => {
    try {
      setMessagesLoading(true);
      const response = await ApiService.get(`/admin/inbox/conversations/${conversationId}/messages?page=1&limit=100`);
      if (response.success && response.data) {
        setMessages(response.data.messages || []);
      }
    } catch (error: any) {
      console.error('加载消息失败:', error);
      if (onError) onError(error.message || '加载消息失败');
    } finally {
      setMessagesLoading(false);
    }
  };

  // 选择会话
  const handleSelectConversation = async (conversationId: number) => {
    setSelectedConversation(conversationId);
    await loadConversationDetail(conversationId);
    await loadMessages(conversationId);
  };

  // 分配负责人
  const handleAssign = async (adminId: number | null) => {
    if (!selectedConversation) return;
    try {
      const response = await ApiService.post(`/admin/inbox/conversations/${selectedConversation}/assign`, {
        assigned_to: adminId
      });
      if (response.success) {
        await loadConversationDetail(selectedConversation);
        await loadConversations();
      }
    } catch (error: any) {
      if (onError) onError(error.message || '分配失败');
    }
  };

  // 更新状态
  const handleStatusChange = async (status: string) => {
    if (!selectedConversation) return;
    try {
      const response = await ApiService.post(`/admin/inbox/conversations/${selectedConversation}/status`, { status });
      if (response.success) {
        await loadConversationDetail(selectedConversation);
        await loadConversations();
      }
    } catch (error: any) {
      if (onError) onError(error.message || '更新状态失败');
    }
  };

  // 发送消息
  const sendMessage = async () => {
    if (!selectedConversation || !newMessage.trim()) return;
    try {
      setSending(true);
      const formData = new FormData();
      formData.append('content', newMessage.trim());

      const response = await ApiService.request(`/admin/inbox/conversations/${selectedConversation}/messages`, {
        method: 'POST',
        body: formData
      });

      if (response.success) {
        setNewMessage('');
        await loadMessages(selectedConversation);
        await loadConversations();
      }
    } catch (error: any) {
      if (onError) onError(error.message || '发送消息失败');
    } finally {
      setSending(false);
    }
  };

  // 添加内部备注
  const addInternalNote = async () => {
    if (!selectedConversation || !internalNote.trim()) return;
    try {
      const response = await ApiService.post(`/admin/inbox/conversations/${selectedConversation}/internal-note`, {
        content: internalNote.trim()
      });
      if (response.success) {
        setInternalNote('');
        await loadMessages(selectedConversation);
        await loadConversations();
      }
    } catch (error: any) {
      if (onError) onError(error.message || '添加内部备注失败');
    }
  };

  useEffect(() => {
    loadAdmins();
    loadConversations();
  }, []);

  useEffect(() => {
    loadConversations();
  }, [filters.status, filters.category, filters.assigned_to, filters.search]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      contract: '签约',
      recommendation: '推荐',
      settlement: '结算',
      general: '一般'
    };
    return labels[category] || category;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      open: '待处理',
      in_progress: '进行中',
      resolved: '已解决',
      closed: '已关闭'
    };
    return labels[status] || status;
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>站内信管理</h2>
      </div>

      <div className={styles.filters}>
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          className={styles.filterSelect}
        >
          <option value="">全部状态</option>
          <option value="open">待处理</option>
          <option value="in_progress">进行中</option>
          <option value="resolved">已解决</option>
          <option value="closed">已关闭</option>
        </select>

        <select
          value={filters.category}
          onChange={(e) => setFilters({ ...filters, category: e.target.value })}
          className={styles.filterSelect}
        >
          <option value="">全部分类</option>
          <option value="contract">签约</option>
          <option value="recommendation">推荐</option>
          <option value="settlement">结算</option>
          <option value="general">一般</option>
        </select>

        <select
          value={filters.assigned_to}
          onChange={(e) => setFilters({ ...filters, assigned_to: e.target.value })}
          className={styles.filterSelect}
        >
          <option value="">全部负责人</option>
          <option value="unassigned">未分配</option>
          <option value="me">分配给我</option>
          {admins.map(admin => (
            <option key={admin.id} value={admin.id.toString()}>{admin.username}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="搜索主题..."
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          className={styles.searchInput}
        />
      </div>

      <div className={styles.layout}>
        {/* 左侧：会话列表 */}
        <div className={styles.sidebar}>
          {claimError && (
            <div className={styles.empty} style={{ color: '#ff6666' }}>
              {claimError}
            </div>
          )}
          {loading ? (
            <div className={styles.loading}>加载中...</div>
          ) : conversations.length === 0 ? (
            <div className={styles.empty}>暂无会话</div>
          ) : (
            conversations.map(conv => (
              <div
                key={conv.id}
                className={`${styles.conversationItem} ${selectedConversation === conv.id ? styles.active : ''}`}
                onClick={() => handleSelectConversation(conv.id)}
              >
                <div className={styles.convHeader}>
                  <span className={styles.convSubject}>{conv.subject}</span>
                  <span className={styles.convStatus}>{getStatusLabel(conv.status)}</span>
                </div>
                <div className={styles.convMeta}>
                  <span>{conv.author_pen_name || conv.author_name || '未知作者'}</span>
                  <span>{formatDate(conv.last_message_at || conv.updated_at)}</span>
                </div>
                <div className={styles.convMeta} style={{ marginTop: 6 }}>
                  <span>
                    负责人：{conv.active_assigned_admin_name || conv.assigned_admin_name || '未分配'}
                    {currentAdminId && conv.assigned_to === currentAdminId ? '（我）' : ''}
                  </span>
                  {currentAdminId && (conv.assigned_to == null || conv.assigned_to !== currentAdminId) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        claimConversation(conv.id);
                      }}
                      disabled={claimingId === conv.id}
                      className={styles.actionSelect}
                      style={{ padding: '4px 8px', cursor: 'pointer' }}
                    >
                      {claimingId === conv.id ? '分配中...' : '分配给我'}
                    </button>
                  )}
                </div>
                {conv.last_message_content && (
                  <div className={styles.convPreview}>{conv.last_message_content.substring(0, 50)}...</div>
                )}
              </div>
            ))
          )}
        </div>

        {/* 右侧：消息和详情 */}
        <div className={styles.content}>
          {!selectedConversation ? (
            <div className={styles.emptyState}>请选择一个会话</div>
          ) : (
            <>
              {/* 会话操作栏 */}
              <div className={styles.actions}>
                <div className={styles.actionGroup}>
                  <label>负责人：</label>
                  <select
                    value={conversationDetail?.assigned_to || ''}
                    onChange={(e) => handleAssign(e.target.value ? parseInt(e.target.value) : null)}
                    className={styles.actionSelect}
                  >
                    <option value="">未分配</option>
                    {admins.map(admin => (
                      <option key={admin.id} value={admin.id.toString()}>{admin.username}</option>
                    ))}
                  </select>
                </div>

                <div className={styles.actionGroup}>
                  <label>状态：</label>
                  <select
                    value={conversationDetail?.status || ''}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className={styles.actionSelect}
                  >
                    <option value="open">待处理</option>
                    <option value="in_progress">进行中</option>
                    <option value="resolved">已解决</option>
                    <option value="closed">已关闭</option>
                  </select>
                </div>
              </div>

              {/* 消息列表 */}
              <div className={styles.messagesList}>
                {messagesLoading ? (
                  <div className={styles.loading}>加载中...</div>
                ) : (
                  messages.map(msg => (
                    <div
                      key={msg.id}
                      className={`${styles.messageItem} ${msg.internal_note ? styles.internalNote : ''} ${msg.sender_type === 'admin' ? styles.adminMessage : styles.authorMessage}`}
                    >
                      <div className={styles.messageHeader}>
                        <span className={styles.senderName}>
                          {msg.internal_note ? '[内部备注] ' : ''}
                          {msg.sender_admin_name || msg.sender_pen_name || msg.sender_name || '系统'}
                        </span>
                        <span className={styles.messageTime}>{formatDate(msg.created_at)}</span>
                      </div>
                      <div className={styles.messageContent}>{msg.content}</div>
                    </div>
                  ))
                )}
              </div>

              {/* 输入区域 */}
              <div className={styles.inputArea}>
                <div className={styles.messageInput}>
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="输入回复消息..."
                    className={styles.textarea}
                    rows={3}
                  />
                  <button onClick={sendMessage} disabled={!newMessage.trim() || sending} className={styles.sendBtn}>
                    {sending ? '发送中...' : '发送'}
                  </button>
                </div>

                <div className={styles.internalNoteInput}>
                  <textarea
                    value={internalNote}
                    onChange={(e) => setInternalNote(e.target.value)}
                    placeholder="输入内部备注（仅管理员可见）..."
                    className={styles.textarea}
                    rows={2}
                  />
                  <button onClick={addInternalNote} disabled={!internalNote.trim()} className={styles.noteBtn}>
                    添加内部备注
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminInbox;

