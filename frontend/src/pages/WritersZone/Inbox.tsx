import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import ApiService from '../../services/ApiService';
import NavBar from '../../components/NavBar/NavBar';
import Footer from '../../components/Footer/Footer';
import styles from './Inbox.module.css';

interface Conversation {
  id: number;
  subject: string;
  category: string;
  status: string;
  priority: string;
  related_novel_id: number | null;
  created_at: string;
  updated_at: string;
  unread_count: number;
  last_read_at: string | null;
  last_message_content: string | null;
  last_message_at: string | null;
  novel_title: string | null;
}

interface Message {
  id: number;
  conversation_id: number;
  sender_id: number | null;
  sender_admin_id: number | null;
  sender_type: string;
  content: string;
  created_at: string;
  sender_name: string | null;
  sender_pen_name: string | null;
  sender_admin_name: string | null;
  sender_display_name: string;
  attachment_count: number;
  attachments: Attachment[];
}

interface Attachment {
  id: number;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
}

interface ConversationDetail {
  id: number;
  subject: string;
  category: string;
  status: string;
  priority: string;
  assigned_to: number | null;
  related_novel_id: number | null;
  created_at: string;
  updated_at: string;
  novel_title: string | null;
  assigned_admin_name: string | null;
}

const Inbox: React.FC = () => {
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'in_progress' | 'closed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationDetail, setConversationDetail] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<{ subject: string; category: 'contract' | 'recommendation' | 'settlement' | 'general'; content: string }>({
    subject: '',
    category: 'general',
    content: ''
  });
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalPages, setTotalPages] = useState(1);

  // 加载会话列表
  const loadConversations = async () => {
    try {
      setLoading(true);
      const response = await ApiService.get(`/writer/inbox/conversations?tab=${activeTab}&search=${encodeURIComponent(searchQuery)}&page=1&limit=50`);
      if (response.success && response.data) {
        setConversations(response.data.conversations || []);
        setTotalPages(response.data.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error('加载会话列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 加载会话详情（从会话列表中获取）
  const loadConversationDetail = async (conversationId: number) => {
    const conv = conversations.find(c => c.id === conversationId);
    if (conv) {
      setConversationDetail({
        id: conv.id,
        subject: conv.subject,
        category: conv.category,
        status: conv.status,
        priority: conv.priority,
        assigned_to: null,
        related_novel_id: conv.related_novel_id,
        created_at: conv.created_at,
        updated_at: conv.updated_at,
        novel_title: conv.novel_title,
        assigned_admin_name: null
      });
    }
  };

  // 加载消息
  const loadMessages = async (conversationId: number, pageNum: number = 1) => {
    try {
      setMessagesLoading(true);
      const response = await ApiService.get(`/writer/inbox/conversations/${conversationId}/messages?page=${pageNum}&limit=50`);
      if (response.success && response.data) {
        if (pageNum === 1) {
          setMessages(response.data.messages || []);
        } else {
          setMessages(prev => [...(response.data.messages || []), ...prev]);
        }
        setHasMore(pageNum < (response.data.pagination?.totalPages || 1));
        setPage(pageNum);
      }
    } catch (error) {
      console.error('加载消息失败:', error);
    } finally {
      setMessagesLoading(false);
    }
  };

  // 发送消息
  const sendMessage = async () => {
    if (!selectedConversation || !newMessage.trim()) return;
    
    try {
      setSending(true);
      const formData = new FormData();
      formData.append('content', newMessage.trim());
      
      const response = await ApiService.post(`/writer/inbox/conversations/${selectedConversation}/messages`, formData);
      
      if (response.success) {
        setNewMessage('');
        await loadMessages(selectedConversation, 1);
        await loadConversations();
      }
    } catch (error) {
      console.error('发送消息失败:', error);
      alert(language === 'zh' ? '发送消息失败' : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  // 创建新会话（作者发起）
  const createConversation = async () => {
    if (!createForm.subject.trim() || !createForm.content.trim()) {
      alert(language === 'zh' ? '请填写主题和内容' : 'Please fill subject and content');
      return;
    }
    try {
      setCreating(true);
      const resp = await ApiService.post('/writer/inbox/conversations', {
        subject: createForm.subject.trim(),
        category: createForm.category,
        content: createForm.content.trim()
      });
      if (resp.success && resp.data?.conversationId) {
        setShowCreate(false);
        setCreateForm({ subject: '', category: 'general', content: '' });
        await loadConversations();
        await handleSelectConversation(resp.data.conversationId);
      } else {
        alert(resp.message || (language === 'zh' ? '创建会话失败' : 'Failed to create conversation'));
      }
    } catch (e) {
      console.error('创建会话失败:', e);
      alert(language === 'zh' ? '创建会话失败' : 'Failed to create conversation');
    } finally {
      setCreating(false);
    }
  };

  // 标记为已读
  const markAsRead = async (conversationId: number) => {
    try {
      await ApiService.post(`/writer/inbox/conversations/${conversationId}/read`);
      await loadConversations();
    } catch (error) {
      console.error('标记已读失败:', error);
    }
  };

  // 选择会话
  const handleSelectConversation = async (conversationId: number) => {
    setSelectedConversation(conversationId);
    setMessages([]);
    setPage(1);
    setHasMore(true);
    await loadConversationDetail(conversationId);
    await loadMessages(conversationId, 1);
    await markAsRead(conversationId);
  };

  // 加载更多消息（向上分页）
  const loadMoreMessages = async () => {
    if (!selectedConversation || !hasMore || messagesLoading) return;
    await loadMessages(selectedConversation, page + 1);
  };

  useEffect(() => {
    loadConversations();
  }, [activeTab, searchQuery]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const locale = language === 'zh' ? 'zh-CN' : 'en-US';
    
    if (days === 0) {
      return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return language === 'zh' ? '昨天' : 'Yesterday';
    } else if (days < 7) {
      return `${days}${language === 'zh' ? '天前' : ' days ago'}`;
    } else {
      return date.toLocaleDateString(locale, { month: '2-digit', day: '2-digit' });
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, { zh: string; en: string }> = {
      contract: { zh: '签约', en: 'Contract' },
      recommendation: { zh: '推荐', en: 'Recommendation' },
      settlement: { zh: '结算', en: 'Settlement' },
      general: { zh: '一般', en: 'General' }
    };
    return labels[category]?.[language] || category;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, { zh: string; en: string }> = {
      open: { zh: '待处理', en: 'Open' },
      in_progress: { zh: '进行中', en: 'In Progress' },
      resolved: { zh: '已解决', en: 'Resolved' },
      closed: { zh: '已关闭', en: 'Closed' }
    };
    return labels[status]?.[language] || status;
  };

  return (
    <div className={styles.container}>
      <NavBar />
      
      <div className={styles.header}>
        <h1>{language === 'zh' ? '站内信' : 'Inbox'}</h1>
        <div className={styles.headerActions}>
          <button
            className={styles.langBtn}
            onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
            title={language === 'zh' ? 'Switch to English' : '切换到中文'}
          >
            {language === 'zh' ? 'EN' : '中文'}
          </button>
          <button className={styles.backBtn} onClick={() => navigate('/writers-zone')}>
            {language === 'zh' ? '← 返回' : '← Back'}
          </button>
        </div>
      </div>

      <div className={styles.inboxLayout}>
        {/* 左侧：会话列表 */}
        <div className={styles.sidebar}>
          <div className={styles.createBar}>
            <button className={styles.createBtn} onClick={() => setShowCreate(true)}>
              {language === 'zh' ? '发起会话' : 'New Conversation'}
            </button>
          </div>
          <div className={styles.searchBox}>
            <input
              type="text"
              placeholder={language === 'zh' ? '搜索会话...' : 'Search conversations...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === 'all' ? styles.active : ''}`}
              onClick={() => setActiveTab('all')}
            >
              {language === 'zh' ? '全部' : 'All'}
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'unread' ? styles.active : ''}`}
              onClick={() => setActiveTab('unread')}
            >
              {language === 'zh' ? '未读' : 'Unread'}
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'in_progress' ? styles.active : ''}`}
              onClick={() => setActiveTab('in_progress')}
            >
              {language === 'zh' ? '进行中' : 'In Progress'}
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'closed' ? styles.active : ''}`}
              onClick={() => setActiveTab('closed')}
            >
              {language === 'zh' ? '已关闭' : 'Closed'}
            </button>
          </div>

          <div className={styles.conversationList}>
            {loading ? (
              <div className={styles.loading}>{language === 'zh' ? '加载中...' : 'Loading...'}</div>
            ) : conversations.length === 0 ? (
              <div className={styles.empty}>
                <div style={{ marginBottom: '8px' }}>{language === 'zh' ? '暂无会话' : 'No conversations'}</div>
                <button className={styles.createBtnSecondary} onClick={() => setShowCreate(true)}>
                  {language === 'zh' ? '立即发起会话' : 'Start one'}
                </button>
              </div>
            ) : (
              conversations.map(conv => (
                <div
                  key={conv.id}
                  className={`${styles.conversationItem} ${selectedConversation === conv.id ? styles.active : ''} ${conv.unread_count > 0 ? styles.unread : ''}`}
                  onClick={() => handleSelectConversation(conv.id)}
                >
                  <div className={styles.convHeader}>
                    <span className={styles.convSubject}>{conv.subject}</span>
                    {conv.unread_count > 0 && (
                      <span className={styles.unreadBadge}>{conv.unread_count}</span>
                    )}
                  </div>
                  <div className={styles.convMeta}>
                    <span className={styles.convCategory}>{getCategoryLabel(conv.category)}</span>
                    <span className={styles.convTime}>{formatDate(conv.last_message_at || conv.updated_at)}</span>
                  </div>
                  {conv.last_message_content && (
                    <div className={styles.convPreview}>{conv.last_message_content.substring(0, 50)}...</div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* 中间：消息流 */}
        <div className={styles.messagesArea}>
          {!selectedConversation ? (
            <div className={styles.emptyState}>
              {language === 'zh' ? '请选择一个会话' : 'Please select a conversation'}
            </div>
          ) : (
            <>
              <div className={styles.messagesHeader}>
                <h2>{conversationDetail?.subject || ''}</h2>
                <span className={styles.convStatus}>{getStatusLabel(conversationDetail?.status || '')}</span>
              </div>

              <div className={styles.messagesList} id="messagesList">
                {hasMore && (
                  <button
                    className={styles.loadMoreBtn}
                    onClick={loadMoreMessages}
                    disabled={messagesLoading}
                  >
                    {messagesLoading ? (language === 'zh' ? '加载中...' : 'Loading...') : (language === 'zh' ? '加载更多' : 'Load More')}
                  </button>
                )}
                
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`${styles.messageItem} ${msg.sender_type === 'author' ? styles.sent : styles.received}`}
                  >
                    <div className={styles.messageHeader}>
                      <span className={styles.senderName}>{msg.sender_display_name}</span>
                      <span className={styles.messageTime}>{formatDate(msg.created_at)}</span>
                    </div>
                    <div className={styles.messageContent}>{msg.content}</div>
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className={styles.attachments}>
                        {msg.attachments.map(att => (
                          <a
                            key={att.id}
                            href={`/api/uploads/inbox/${att.file_path.split('/').pop()}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.attachment}
                          >
                            📎 {att.file_name} ({(att.file_size / 1024).toFixed(2)} KB)
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className={styles.messageInput}>
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={language === 'zh' ? '输入消息...' : 'Type a message...'}
                  className={styles.input}
                  rows={3}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim() || sending}
                  className={styles.sendBtn}
                >
                  {sending ? (language === 'zh' ? '发送中...' : 'Sending...') : (language === 'zh' ? '发送' : 'Send')}
                </button>
              </div>
            </>
          )}
        </div>

        {/* 右侧：会话信息 */}
        <div className={styles.sidebarRight}>
          {conversationDetail ? (
            <div className={styles.conversationInfo}>
              <h3>{language === 'zh' ? '会话信息' : 'Conversation Info'}</h3>
              <div className={styles.infoItem}>
                <label>{language === 'zh' ? '状态' : 'Status'}:</label>
                <span>{getStatusLabel(conversationDetail.status)}</span>
              </div>
              <div className={styles.infoItem}>
                <label>{language === 'zh' ? '分类' : 'Category'}:</label>
                <span>{getCategoryLabel(conversationDetail.category)}</span>
              </div>
              {conversationDetail.novel_title && (
                <div className={styles.infoItem}>
                  <label>{language === 'zh' ? '关联小说' : 'Related Novel'}:</label>
                  <span>{conversationDetail.novel_title}</span>
                </div>
              )}
              <div className={styles.infoItem}>
                <label>{language === 'zh' ? '创建时间' : 'Created'}:</label>
                <span>{formatDate(conversationDetail.created_at)}</span>
              </div>
            </div>
          ) : (
            <div className={styles.emptyState}>
              {language === 'zh' ? '选择会话查看详情' : 'Select a conversation to view details'}
            </div>
          )}
        </div>
      </div>

      <Footer />

      {showCreate && (
        <div className={styles.modalOverlay} onClick={() => !creating && setShowCreate(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>{language === 'zh' ? '发起会话' : 'New Conversation'}</h3>
              <button className={styles.modalClose} onClick={() => !creating && setShowCreate(false)}>×</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formRow}>
                <label>{language === 'zh' ? '主题' : 'Subject'}</label>
                <input
                  value={createForm.subject}
                  onChange={(e) => setCreateForm({ ...createForm, subject: e.target.value })}
                  placeholder={language === 'zh' ? '例如：签约申请咨询' : 'e.g. Contract inquiry'}
                />
              </div>
              <div className={styles.formRow}>
                <label>{language === 'zh' ? '分类' : 'Category'}</label>
                <select
                  value={createForm.category}
                  onChange={(e) => setCreateForm({ ...createForm, category: e.target.value as any })}
                >
                  <option value="general">{language === 'zh' ? '一般' : 'General'}</option>
                  <option value="contract">{language === 'zh' ? '签约' : 'Contract'}</option>
                  <option value="recommendation">{language === 'zh' ? '推荐' : 'Recommendation'}</option>
                  <option value="settlement">{language === 'zh' ? '结算' : 'Settlement'}</option>
                </select>
              </div>
              <div className={styles.formRow}>
                <label>{language === 'zh' ? '内容' : 'Content'}</label>
                <textarea
                  rows={6}
                  value={createForm.content}
                  onChange={(e) => setCreateForm({ ...createForm, content: e.target.value })}
                  placeholder={language === 'zh' ? '请描述你的问题/需求...' : 'Describe your issue...'}
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnGhost} onClick={() => !creating && setShowCreate(false)}>
                {language === 'zh' ? '取消' : 'Cancel'}
              </button>
              <button className={styles.btnPrimary} disabled={creating} onClick={createConversation}>
                {creating ? (language === 'zh' ? '提交中...' : 'Submitting...') : (language === 'zh' ? '提交' : 'Submit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inbox;

