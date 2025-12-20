import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../../components/NavBar/NavBar';
import Footer from '../../components/Footer/Footer';
import { useLanguage } from '../../contexts/LanguageContext';
import ApiService from '../../services/ApiService';
import styles from './InboxV2.module.css';

import type { InboxV2ConversationSummary, InboxV2ConversationDetail, InboxV2Message } from '../../features/inboxV2/types';

/**
 * Stage 2 Scaffold ONLY
 * - 结构骨架：三栏布局
 * - sender_type === system：仅占位渲染
 * - unread/read：仅 UI 占位（不接真实逻辑）
 * - Editor 介入入口：按钮占位（不实现行为）
 * - 不调用真实后端，不写任何业务逻辑
 */
const InboxV2: React.FC = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();

  // TODO(STAGE 3): 从 auth token / admin 面板上下文注入 viewerRole（author/editor/admin）。
  // Stage 2 Scaffold：这里硬编码仅用于“占位分支演示”，UI 不应因此暗示 editor/admin 行为已实现。
  const viewerRole: 'author' | 'editor' | 'admin' = 'author';

  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [draft, setDraft] = useState('');

  const [conversations, setConversations] = useState<InboxV2ConversationSummary[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<InboxV2ConversationDetail | null>(null);
  const [messages, setMessages] = useState<InboxV2Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const loadConversations = useCallback(async () => {
    if (viewerRole !== 'author') return;
    setConversationsLoading(true);
    try {
      const resp = await ApiService.get<{ conversations: any[]; pagination: any }>('/inbox/conversations?page=1&limit=50');
      if ((resp as any).success && resp.data?.conversations) {
        const mapped: InboxV2ConversationSummary[] = resp.data.conversations.map((c: any) => ({
          id: c.id,
          subject: c.subject,
          status: c.status,
          unreadCount: Number(c.unread_count || 0),
          updatedAt: c.updated_at,
        }));
        setConversations(mapped);
        if (!activeConversationId && mapped.length > 0) {
          setActiveConversationId(mapped[0].id);
        }
      }
    } catch (e) {
      console.error('[InboxV2] load conversations failed:', e);
    } finally {
      setConversationsLoading(false);
    }
  }, [activeConversationId, viewerRole]);

  const loadConversation = useCallback(
    async (conversationId: number) => {
      if (viewerRole !== 'author') return;
      setMessagesLoading(true);
      try {
        const resp = await ApiService.get<any>(`/inbox/conversation/${conversationId}?page=1&limit=200`);
        if ((resp as any).success && resp.data) {
          setSelectedConversation({
            id: resp.data.conversation.id,
            subject: resp.data.conversation.subject,
            status: resp.data.conversation.status,
          });
          const mappedMessages: InboxV2Message[] = (resp.data.messages || []).map((m: any) => ({
            id: m.id,
            conversationId: m.conversation_id,
            senderType: m.sender_type === 'admin' ? 'editor' : m.sender_type,
            senderDisplayName: m.sender_type === 'system' ? undefined : (m.sender_type === 'author' ? (language === 'zh' ? '作者' : 'Author') : (language === 'zh' ? '编辑' : 'Editor')),
            content: m.content,
            createdAt: m.created_at,
            isRead: typeof m.is_read === 'number' ? Boolean(m.is_read) : m.is_read,
            readAt: m.read_at ?? null,
          }));
          setMessages(mappedMessages);

          // Stage 3A: author 打开会话时自动标记未读消息为已读（排除 system，排除 author 自己消息）
          const unreadIds = mappedMessages
            .filter((mm) => mm.senderType !== 'system' && mm.senderType !== 'author' && mm.isRead === false)
            .map((mm) => mm.id);

          if (unreadIds.length > 0) {
            try {
              await ApiService.post('/inbox/message/read', { message_ids: unreadIds });
              // 刷新列表未读数（聚合来自后端）
              await loadConversations();
              // 本地直接标为已读，避免二次请求
              setMessages((prev) =>
                prev.map((mm) =>
                  unreadIds.includes(mm.id) ? { ...mm, isRead: true, readAt: mm.readAt ?? new Date().toISOString() } : mm
                )
              );
            } catch (writeErr) {
              // 写入失败不得影响会话读取：仅记录日志
              console.warn('[InboxV2] mark read failed (non-blocking):', writeErr);
            }
          }
        }
      } catch (e) {
        console.error('[InboxV2] load conversation failed:', e);
      } finally {
        setMessagesLoading(false);
      }
    },
    [language, loadConversations, viewerRole]
  );

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (activeConversationId) {
      void loadConversation(activeConversationId);
    } else {
      setSelectedConversation(null);
      setMessages([]);
    }
  }, [activeConversationId, loadConversation]);

  const renderMessage = (m: InboxV2Message) => {
    if (m.senderType === 'system') {
      return (
        <div key={m.id} className={styles.systemLine} aria-label="system-message">
          <span className={styles.systemPill}>{m.content}</span>
        </div>
      );
    }

    const mine = m.senderType === 'author' && viewerRole === 'author';
    return (
      <div
        key={m.id}
        className={`${styles.bubble} ${mine ? styles.bubbleMine : ''}`}
        aria-label={`message-${m.senderType}`}
      >
        <div style={{ fontSize: '0.85rem', opacity: 0.85, marginBottom: 4 }}>
          <strong>{m.senderDisplayName || (language === 'zh' ? '未知' : 'Unknown')}</strong>
          {' · '}
          <span>
            {language === 'zh'
              ? m.isRead === null || typeof m.isRead === 'undefined'
                ? '—'
                : m.isRead
                  ? '已读'
                  : '未读'
              : m.isRead === null || typeof m.isRead === 'undefined'
                ? '—'
                : m.isRead
                  ? 'Read'
                  : 'Unread'}
          </span>
        </div>
        <div>{m.content}</div>
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <NavBar />

      <div className={styles.header}>
        <h1 style={{ margin: 0 }}>{language === 'zh' ? '站内信 v2（Scaffold）' : 'Inbox v2 (Scaffold)'}</h1>
        <div className={styles.headerActions}>
          <button className={styles.btn} onClick={() => navigate('/writers-zone/inbox')}>
            {language === 'zh' ? '返回 v1' : 'Back to v1'}
          </button>
          <button className={styles.btn} onClick={() => navigate('/writers-zone')}>
            {language === 'zh' ? '返回作家专区' : 'Back to Writers Zone'}
          </button>
        </div>
      </div>

      <div className={styles.layout}>
        {/* Left: conversation list */}
        <div className={styles.col}>
          <div className={styles.colHeader}>
            <strong>{language === 'zh' ? '会话' : 'Conversations'}</strong>
            <span style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>{language === 'zh' ? '未读来自后端聚合' : 'Unread from backend aggregate'}</span>
          </div>
          <div className={styles.list}>
            {conversationsLoading ? (
              <div className={styles.placeholder}>{language === 'zh' ? '加载中…' : 'Loading…'}</div>
            ) : conversations.length === 0 ? (
              <div className={styles.placeholder}>{language === 'zh' ? '暂无会话' : 'No conversations'}</div>
            ) : conversations.map(c => (
              <div
                key={c.id}
                className={`${styles.item} ${activeConversationId === c.id ? styles.itemActive : ''}`}
                onClick={() => setActiveConversationId(c.id)}
                role="button"
                tabIndex={0}
              >
                <div className={styles.itemTitleRow}>
                  <div className={styles.itemTitle}>{c.subject}</div>
                  {c.unreadCount > 0 && <span className={styles.badge}>{c.unreadCount}</span>}
                </div>
                <div style={{ marginTop: 6, color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                  {language === 'zh' ? '状态' : 'Status'}: {c.status}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Middle: message stream */}
        <div className={styles.col}>
          <div className={styles.colHeader}>
            <strong>{selectedConversation?.subject || (language === 'zh' ? '请选择会话' : 'Select a conversation')}</strong>
            <button className={styles.btn} disabled>
              {language === 'zh' ? '加载更多（占位）' : 'Load more (placeholder)'}
            </button>
          </div>
          <div className={styles.messages}>
            {messagesLoading ? (
              <div className={styles.placeholder}>{language === 'zh' ? '加载中…' : 'Loading…'}</div>
            ) : !selectedConversation ? (
              <div className={styles.placeholder}>{language === 'zh' ? '暂无会话详情' : 'No conversation selected'}</div>
            ) : (
              messages.map(renderMessage)
            )}
          </div>
          <div className={styles.inputBar}>
            <textarea
              className={styles.textarea}
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={language === 'zh' ? '输入消息…（Scaffold，不会发送）' : 'Type a message… (scaffold, not sent)'}
            />
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              disabled
              onClick={() => {
                // Stage 2: 不实现真实发送
                void draft;
              }}
            >
              {language === 'zh' ? '发送（占位）' : 'Send (placeholder)'}
            </button>
          </div>
        </div>

        {/* Right: info / editor entry */}
        <div className={styles.col}>
          <div className={styles.colHeader}>
            <strong>{language === 'zh' ? '会话信息' : 'Conversation Info'}</strong>
            <span style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>{language === 'zh' ? 'Editor入口占位' : 'Editor entry placeholder'}</span>
          </div>
          <div className={styles.list}>
            {!selectedConversation ? (
              <div className={styles.placeholder}>{language === 'zh' ? '选择会话查看' : 'Select a conversation'}</div>
            ) : (
              <>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{language === 'zh' ? '状态' : 'Status'}</div>
                  <div style={{ marginTop: 6 }}>{selectedConversation.status}</div>
                </div>

                <button
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  disabled
                  title={language === 'zh' ? 'Stage 2：占位入口（未实现）' : 'Stage 2: placeholder entry (not implemented)'}
                  onClick={() => {
                    // Stage 2: 不实现 join 行为
                  }}
                >
                  {language === 'zh' ? '编辑介入（Join，占位）' : 'Editor Join (placeholder)'}
                </button>

                <div style={{ marginTop: 12, color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
                  {language === 'zh'
                    ? '说明：本阶段仅实现作者端“消息级已读”；system 消息不参与已读；join/leave/audit/推送均不在本阶段。'
                    : 'Note: Stage 3A implements author-only message-level read; system messages are excluded; join/leave/audit/push are out of scope.'}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default InboxV2;


