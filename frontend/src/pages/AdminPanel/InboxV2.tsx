import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { getApiBaseUrl } from '../../config';
import styles from './InboxV2.module.css';

/**
 * Stage 2 Scaffold ONLY (Admin/Editor side)
 * - 提供 Editor 介入入口占位
 * - 提供 Admin-only 审计入口占位
 * - 不实现 join/leave/read/audit 的真实逻辑
 */
const AdminInboxV2: React.FC = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();

  const [conversationId, setConversationId] = useState<string>('1');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string>('');
  const [auditBusy, setAuditBusy] = useState(false);
  const [auditResult, setAuditResult] = useState<string>('');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  const apiBase = useMemo(() => {
    const base = getApiBaseUrl();
    if (!base) {
      throw new Error('API base url is not configured');
    }
    return base;
  }, []);

  const callJoinLeave = async (action: 'join' | 'leave') => {
    const id = parseInt(conversationId, 10);
    if (!Number.isFinite(id) || id <= 0) {
      setResult(language === 'zh' ? '请输入正确的会话ID' : 'Please enter a valid conversation id');
      return;
    }

    const adminToken = localStorage.getItem('adminToken');
    if (!adminToken) {
      setResult(language === 'zh' ? '未检测到 adminToken，请先登录管理后台' : 'adminToken missing, please login as admin/editor');
      return;
    }

    try {
      setBusy(true);
      setResult('');
      const resp = await fetch(`${apiBase}/inbox/conversation/${id}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.success) {
        setResult(data?.message || `${action} failed`);
        return;
      }
      setResult(language === 'zh' ? `已提交 ${action}（success）` : `${action} success`);
    } catch (e) {
      console.error('[AdminInboxV2] join/leave failed:', e);
      setResult(language === 'zh' ? '请求失败' : 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  const loadAudit = async () => {
    const id = parseInt(conversationId, 10);
    const adminToken = localStorage.getItem('adminToken');
    if (!adminToken) {
      setAuditResult(language === 'zh' ? '未检测到 adminToken，请先登录管理后台' : 'adminToken missing, please login as admin');
      return;
    }
    if (!Number.isFinite(id) || id <= 0) {
      setAuditResult(language === 'zh' ? '请输入正确的会话ID' : 'Please enter a valid conversation id');
      return;
    }
    try {
      setAuditBusy(true);
      setAuditResult('');
      const resp = await fetch(`${apiBase}/inbox/audit?conversation_id=${encodeURIComponent(String(id))}&page=1&limit=50`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.success) {
        setAuditLogs([]);
        setAuditResult(data?.message || 'Failed to load audit logs');
        return;
      }
      setAuditLogs(data?.data?.logs || []);
      setAuditResult('');
    } catch (e) {
      console.error('[AdminInboxV2] load audit failed:', e);
      setAuditLogs([]);
      setAuditResult(language === 'zh' ? '请求失败' : 'Request failed');
    } finally {
      setAuditBusy(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 style={{ margin: 0 }}>{language === 'zh' ? 'Inbox v2（管理端 Scaffold）' : 'Inbox v2 (Admin Scaffold)'}</h1>
        <div className={styles.headerActions}>
          <button className={styles.btn} onClick={() => navigate('/admin')}>
            {language === 'zh' ? '返回管理后台' : 'Back to Admin'}
          </button>
        </div>
      </div>

      <div className={styles.layout}>
        <div className={styles.col}>
          <div className={styles.colHeader}>
            <strong>{language === 'zh' ? '队列（占位）' : 'Queue (placeholder)'}</strong>
            <button className={styles.btn} disabled>
              {language === 'zh' ? '过滤/搜索（占位）' : 'Filter/Search (placeholder)'}
            </button>
          </div>
          <div className={styles.list}>
            <div className={styles.placeholder}>
              {language === 'zh'
                ? 'Stage 2：这里将显示会话队列（不接真实数据）'
                : 'Stage 2: conversation queue scaffold (no real data).'}
            </div>
          </div>
        </div>

        <div className={styles.col}>
          <div className={styles.colHeader}>
            <strong>{language === 'zh' ? '会话（占位）' : 'Conversation (placeholder)'}</strong>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                value={conversationId}
                onChange={(e) => setConversationId(e.target.value)}
                placeholder={language === 'zh' ? '会话ID' : 'Conversation ID'}
                style={{
                  width: 120,
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                }}
              />
              <button className={styles.btn} disabled={busy} onClick={() => callJoinLeave('join')}>
                {busy ? (language === 'zh' ? '处理中...' : 'Working...') : (language === 'zh' ? 'Join' : 'Join')}
              </button>
              <button className={styles.btn} disabled={busy} onClick={() => callJoinLeave('leave')}>
                {busy ? (language === 'zh' ? '处理中...' : 'Working...') : (language === 'zh' ? 'Leave' : 'Leave')}
              </button>
            </div>
          </div>
          <div className={styles.messages}>
            <div className={styles.systemLine}>
              <span className={styles.systemPill}>
                {language === 'zh' ? '系统消息：Editor joined（占位）' : 'System: Editor joined (placeholder)'}
              </span>
            </div>
            <div className={styles.bubble}>
              {language === 'zh'
                ? '编辑回复占位：这里将展示 editor/author/system 的分支渲染'
                : 'Placeholder: editor/author/system rendering branches.'}
            </div>
            {result && (
              <div className={styles.placeholder} style={{ paddingTop: 8 }}>
                {result}
              </div>
            )}
          </div>
          <div className={styles.inputBar}>
            <textarea className={styles.textarea} rows={2} disabled placeholder={language === 'zh' ? '输入…（占位）' : 'Type… (placeholder)'} />
            <button className={`${styles.btn} ${styles.btnPrimary}`} disabled>
              {language === 'zh' ? '发送（占位）' : 'Send (placeholder)'}
            </button>
          </div>
        </div>

        <div className={styles.col}>
          <div className={styles.colHeader}>
            <strong>{language === 'zh' ? '审计（Admin-only，占位）' : 'Audit (admin-only, placeholder)'}</strong>
            <button className={styles.btn} disabled={auditBusy} onClick={loadAudit}>
              {auditBusy ? (language === 'zh' ? '加载中...' : 'Loading...') : (language === 'zh' ? '加载审计日志' : 'Load audit')}
            </button>
          </div>
          <div className={styles.list}>
            {auditResult && <div className={styles.placeholder}>{auditResult}</div>}
            {!auditResult && auditLogs.length === 0 && (
              <div className={styles.placeholder}>
                {language === 'zh' ? '暂无审计日志（或无权限）' : 'No audit logs (or no permission)'}
              </div>
            )}
            {auditLogs.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {auditLogs.map((l) => (
                  <div key={l.id} style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 10, background: 'var(--bg-primary)' }}>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>{l.action}</div>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
                      {language === 'zh' ? '时间' : 'Time'}: {String(l.created_at)}
                    </div>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
                      {language === 'zh' ? '操作者' : 'Actor'}: {l.actor_type} {l.actor_admin_name || l.actor_user_name || ''}
                    </div>
                    {l.meta_json && (
                      <pre style={{ marginTop: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--text-secondary)' }}>
                        {typeof l.meta_json === 'string' ? l.meta_json : JSON.stringify(l.meta_json, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminInboxV2;


