import React, { useState, useEffect } from 'react';
import styles from './ChapterApproval.module.css';

interface ChapterDetailData {
  id: number;
  novel_id: number;
  novel_title: string;
  novel_cover?: string;
  requires_chief_edit?: boolean;
  volume_id: number;
  volume_name: string;
  volume_number?: number;
  chapter_number: number;
  title: string;
  content?: string;
  translator_note?: string;
  word_count: number;
  author: string;
  editor_admin_id?: number;
  editor_name?: string;
  chief_editor_admin_id?: number;
  chief_editor_name?: string;
  review_status: string;
  is_released: boolean;
  is_advance: boolean;
  unlock_price: number;
  key_cost: number;
  unlock_priority: string;
  release_date?: string;
  created_at: string;
  updated_at?: string;
}

interface ChapterDetailProps {
  chapter: ChapterDetailData;
  currentAdminRole: string;
  onReview: (chapterId: number, result: string, comment: string) => Promise<void>;
  onNavigate: (direction: 'prev' | 'next') => void;
  onClose: () => void;
  canNavigatePrev: boolean;
  canNavigateNext: boolean;
}

const ChapterDetail: React.FC<ChapterDetailProps> = ({
  chapter,
  currentAdminRole,
  onReview,
  onNavigate,
  onClose,
  canNavigatePrev,
  canNavigateNext
}) => {
  const [reviewComment, setReviewComment] = useState('');
  const [fontSize, setFontSize] = useState(14);
  const [showEmptyLines, setShowEmptyLines] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showFullContent, setShowFullContent] = useState(false);

  useEffect(() => {
    setReviewComment('');
    setShowFullContent(false);
  }, [chapter.id]);

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      'submitted': '已提交',
      'reviewing': '审核中',
      'approved': '已批准',
      'rejected': '已拒绝',
      'draft': '草稿',
      'pending_chief': '等待主编终审'
    };
    return statusMap[status] || status;
  };

  const getStatusClass = (status: string) => {
    return styles[`status_${status}`] || '';
  };

  // 判断按钮显示逻辑
  const requiresChiefEdit = chapter.requires_chief_edit === true;
  const isEditor = currentAdminRole === 'editor';
  const isChiefEditor = currentAdminRole === 'chief_editor';
  const isSuperAdmin = currentAdminRole === 'super_admin';
  const isPendingChief = chapter.review_status === 'pending_chief';

  // 获取"审核通过"按钮的文本
  const getApproveButtonText = () => {
    if (!requiresChiefEdit) {
      // 不需要主编终审：直接显示"审核通过"
      return '审核通过';
    } else {
      // 需要主编终审
      if (isEditor) {
        // 编辑：显示"提交主编终审"
        return '提交主编终审';
      } else if (isChiefEditor || isSuperAdmin) {
        // 主编/超管：根据状态显示
        if (isPendingChief) {
          return '终审通过';
        } else {
          return '审核通过';
        }
      }
    }
    return '审核通过';
  };

  // 判断"审核通过"按钮是否可用
  const canApprove = () => {
    if (requiresChiefEdit) {
      if (isEditor) {
        // 编辑可以提交主编终审
        return true;
      } else if (isChiefEditor || isSuperAdmin) {
        // 主编/超管可以终审通过（特别是 pending_chief 状态）
        return true;
      }
      return false;
    } else {
      // 不需要主编终审：编辑和超管都可以直接通过
      return isEditor || isSuperAdmin;
    }
  };

  // 处理审核操作
  // 三个按钮的语义：
  // - 保存为"审核中"：标记章节为审核中状态，不写入归属信息
  // - 审核通过/提交主编终审/终审通过：审核通过，写入 editor_admin_id/chief_editor_admin_id 归属信息
  // - 审核拒绝：拒绝章节，必须填写备注
  const handleReview = async (result: string) => {
    if (result === 'rejected' && !reviewComment.trim()) {
      alert('拒绝时必须填写审核备注');
      return;
    }

    setSaving(true);
    try {
      await onReview(chapter.id, result, reviewComment);
    } finally {
      setSaving(false);
    }
  };

  // 打开章节阅读页
  const openReader = () => {
    window.open(`/novel/${chapter.novel_id}/chapter/${chapter.id}`, '_blank');
  };

  const formatContent = (content: string) => {
    if (!content) return '';
    if (showEmptyLines) {
      return content.split('\n').map((line, idx) => (
        <React.Fragment key={idx}>
          {line}
          <br />
        </React.Fragment>
      ));
    } else {
      return content.split('\n').filter(line => line.trim()).map((line, idx) => (
        <React.Fragment key={idx}>
          {line}
          <br />
        </React.Fragment>
      ));
    }
  };

  return (
    <div className={styles.detailContainer}>
      <div className={styles.detailHeader}>
        <div className={styles.detailHeaderTop}>
          <h2>章节详情</h2>
          <button onClick={onClose} className={styles.closeBtn}>×</button>
        </div>
        
        {/* 章节基本信息 */}
        <div className={styles.chapterInfo}>
          {chapter.novel_cover && (
            <img
              src={
                chapter.novel_cover.startsWith('http')
                  ? chapter.novel_cover
                  : chapter.novel_cover.startsWith('/')
                  ? `http://localhost:5000${chapter.novel_cover}`
                  : `http://localhost:5000/covers/${chapter.novel_cover}`
              }
              alt={chapter.novel_title}
              className={styles.novelCover}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          )}
          <div className={styles.chapterInfoText}>
            <h3>{chapter.novel_title}</h3>
            <div className={styles.chapterMeta}>
              <span><strong>卷名：</strong>{chapter.volume_name}</span>
              <span><strong>章节号：</strong>{chapter.chapter_number}</span>
              <span><strong>标题：</strong>{chapter.title}</span>
              <span><strong>章节ID：</strong>{chapter.id}</span>
              <span><strong>字数：</strong>{chapter.word_count}</span>
              <span><strong>作者：</strong>{chapter.author}</span>
              <span><strong>本章责任编辑：</strong>
                {chapter.editor_admin_id ? (
                  chapter.editor_name || `ID: ${chapter.editor_admin_id}`
                ) : '尚未分配'}
              </span>
              {chapter.chief_editor_admin_id && (
                <span><strong>本章主编：</strong>
                  {chapter.chief_editor_name || `ID: ${chapter.chief_editor_admin_id}`}
                </span>
              )}
              <span><strong>是否预读：</strong>{chapter.is_advance ? '是' : '否'}</span>
              <span><strong>审核状态：</strong>
                <span className={`${styles.statusBadge} ${getStatusClass(chapter.review_status)}`}>
                  {getStatusText(chapter.review_status)}
                </span>
              </span>
              <span><strong>是否发布：</strong>{chapter.is_released ? '是' : '否'}</span>
              {chapter.release_date && (
                <span><strong>发布日期：</strong>{new Date(chapter.release_date).toLocaleString('zh-CN')}</span>
              )}
              <span><strong>解锁设置：</strong>
                优先级: {chapter.unlock_priority || 'free'}, 
                价格: {chapter.unlock_price > 0 ? `${chapter.unlock_price} Karma` : '免费'}, 
                钥匙: {chapter.key_cost || 0}
              </span>
              <span><strong>创建时间：</strong>{new Date(chapter.created_at).toLocaleString('zh-CN')}</span>
              {chapter.updated_at && (
                <span><strong>更新时间：</strong>{new Date(chapter.updated_at).toLocaleString('zh-CN')}</span>
              )}
            </div>
          </div>
        </div>

        {/* 快捷导航 */}
        <div className={styles.navigation}>
          <button
            onClick={() => onNavigate('prev')}
            disabled={!canNavigatePrev}
            className={styles.navBtn}
          >
            ← 上一章
          </button>
          <button
            onClick={() => onNavigate('next')}
            disabled={!canNavigateNext}
            className={styles.navBtn}
          >
            下一章 →
          </button>
        </div>
      </div>

      {/* 正文内容 */}
      <div className={styles.contentSection}>
        <div className={styles.contentToolbar}>
          <div className={styles.toolbarGroup}>
            <label>字体大小：</label>
            <input
              type="range"
              min="12"
              max="20"
              value={fontSize}
              onChange={(e) => setFontSize(parseInt(e.target.value))}
              className={styles.fontSizeSlider}
            />
            <span>{fontSize}px</span>
          </div>
          <div className={styles.toolbarGroup}>
            <label>
              <input
                type="checkbox"
                checked={showEmptyLines}
                onChange={(e) => setShowEmptyLines(e.target.checked)}
              />
              显示空行
            </label>
          </div>
          <div className={styles.toolbarGroup}>
            <button onClick={openReader} className={styles.readerBtn}>
              在阅读页中打开完整内容
            </button>
          </div>
        </div>
        
        <div className={styles.contentArea} style={{ fontSize: `${fontSize}px` }}>
          {chapter.content ? (
            <div className={styles.contentText}>
              {showFullContent ? (
                formatContent(chapter.content)
              ) : (
                <>
                  {formatContent(chapter.content.substring(0, 2000))}
                  {chapter.content.length > 2000 && (
                    <div className={styles.contentPreviewHint}>
                      <p>（仅显示前2000字预览）</p>
                      <button onClick={() => setShowFullContent(true)} className={styles.showMoreBtn}>
                        显示全部内容
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className={styles.emptyContent}>暂无内容</div>
          )}
        </div>

        {chapter.translator_note && (
          <div className={styles.translatorNote}>
            <strong>翻译备注：</strong>
            <p>{chapter.translator_note}</p>
          </div>
        )}
      </div>

      {/* 审核操作区 */}
      <div className={styles.reviewSection}>
        <h3>审核操作</h3>
        
        <div className={styles.reviewForm}>
          {/* 当前审核状态（只读展示） */}
          <div className={styles.formGroup}>
            <label>当前审核状态：</label>
            <span className={`${styles.statusBadge} ${getStatusClass(chapter.review_status)}`}>
              {getStatusText(chapter.review_status)}
            </span>
          </div>

          <div className={styles.formGroup}>
            <label>审核备注：</label>
            <textarea
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder="请输入审核备注（审核拒绝时必填）..."
              rows={4}
              className={styles.commentTextarea}
            />
          </div>

          <div className={styles.reviewActions}>
            <button
              onClick={() => handleReview('reviewing')}
              disabled={saving || chapter.review_status === 'reviewing'}
              className={styles.saveBtn}
            >
              保存为"审核中"
            </button>
            <button
              onClick={() => handleReview('approved')}
              disabled={saving || !canApprove()}
              className={styles.approveBtn}
            >
              {getApproveButtonText()}
            </button>
            <button
              onClick={() => handleReview('rejected')}
              disabled={saving || !reviewComment.trim()}
              className={styles.rejectBtn}
            >
              审核拒绝
            </button>
          </div>
        </div>
      </div>

      {/* 日志模块（预留） */}
      <div className={styles.logSection}>
        <h3>审核日志</h3>
        <div className={styles.logPlaceholder}>
          <p>审核日志功能待实现</p>
        </div>
      </div>
    </div>
  );
};

export default ChapterDetail;

