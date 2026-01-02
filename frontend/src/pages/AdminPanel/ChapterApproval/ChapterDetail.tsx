import React, { useState, useEffect } from 'react';
import { getApiOrigin } from '../../../config';
import styles from './ChapterApproval.module.css';

interface ChapterDetailData {
  id: number;
  novel_id: number;
  novel_title: string;
  novel_cover?: string;
  requires_chief_edit?: boolean;
  can_review?: boolean; // 是否有审核权限（基于有效合同）
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
  novel_editor_admin_id?: number | null;
  novel_editor_name?: string | null;
  novel_chief_editor_admin_id?: number | null;
  novel_chief_editor_name?: string | null;
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
  currentAdminId: number | null;
  onReview: (chapterId: number, result: string, comment: string) => Promise<void>;
  onClose: () => void;
}

const ChapterDetail: React.FC<ChapterDetailProps> = ({
  chapter,
  currentAdminRole,
  currentAdminId,
  onReview,
  onClose
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

  // 核心权限判断：完全依赖后端返回的 can_review 字段
  const canReview = chapter.can_review === true;

  // 获取"审核通过"按钮的文本（仅用于显示，不影响禁用逻辑）
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

  // 按钮禁用状态计算（完全依赖 can_review，不再使用 review_status 判断）
  const disableSaveAsReviewing = !canReview;
  // "审核通过/提交主编终审/终审通过"按钮：只依赖 can_review
  // 注意：按钮文本会根据 requires_chief_edit 和状态变化，但禁用逻辑统一
  const disableApprove = !canReview;
  const disableReject = !canReview;

  // 调试日志
  useEffect(() => {
    console.log('[前端调试] 章节详情数据 - can_review:', chapter.can_review);
    console.log('[前端调试] 章节详情数据 - requires_chief_edit:', chapter.requires_chief_edit);
    console.log('[前端调试] 章节详情数据 - review_status:', chapter.review_status);
    console.log('[前端调试] 按钮禁用状态:', {
      disableSaveAsReviewing,
      disableApprove,
      disableReject,
      canReview,
      requiresChiefEdit
    });
  }, [chapter.id, disableSaveAsReviewing, disableApprove, disableReject, canReview, requiresChiefEdit]);

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

  // 小说级别编辑信息（便于使用）
  // 始终显示小说级别的编辑信息，即使值为空也显示"未分配"
  // 调试日志：检查接收到的数据
  useEffect(() => {
    console.log('[前端调试] 章节详情数据 - 原始对象:', chapter);
    console.log('[前端调试] 章节详情数据 - 字段检查:', {
      'chapter.novel_editor_admin_id': chapter.novel_editor_admin_id,
      'chapter.novel_editor_name': chapter.novel_editor_name,
      'chapter.novel_chief_editor_admin_id': chapter.novel_chief_editor_admin_id,
      'chapter.novel_chief_editor_name': chapter.novel_chief_editor_name,
      'chapter.novel_id': chapter.novel_id,
      'chapter.novel_title': chapter.novel_title,
      'typeof novel_editor_admin_id': typeof chapter.novel_editor_admin_id,
      'novel_editor_admin_id === null': chapter.novel_editor_admin_id === null,
      'novel_editor_admin_id === undefined': chapter.novel_editor_admin_id === undefined
    });
    console.log('[前端调试] 完整章节对象 (JSON):', JSON.stringify(chapter, null, 2));
  }, [chapter.id]);
  
  const novelEditorName =
    chapter.novel_editor_name ||
    (chapter.novel_editor_admin_id ? `ID: ${chapter.novel_editor_admin_id}` : null);

  const novelChiefEditorName =
    chapter.novel_chief_editor_name ||
    (chapter.novel_chief_editor_admin_id ? `ID: ${chapter.novel_chief_editor_admin_id}` : null);

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
                  ? `${getApiOrigin()}${chapter.novel_cover}`
                  : `${getApiOrigin()}/covers/${chapter.novel_cover}`
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
            
            <div className={styles.novelEditorsLine}>
              <span>
                小说责任编辑：{novelEditorName || '未分配'}
              </span>
              <span style={{ marginLeft: 16 }}>
                主编：{novelChiefEditorName || '未分配'}
              </span>
            </div>

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

          {/* 如果没有审核权限，显示提示（super_admin 不显示此提示） */}
          {chapter.can_review === false && currentAdminRole !== 'super_admin' && (
            <div className={styles.noReviewPermission}>
              <p>您当前对本章节没有审核权限（可能是没有生效合同，或章节状态/归属不允许），因此不能进行审核操作。</p>
            </div>
          )}
          
          <div className={styles.reviewActions}>
            <button
              onClick={() => handleReview('reviewing')}
              disabled={saving || disableSaveAsReviewing}
              className={styles.saveBtn}
            >
              保存为"审核中"
            </button>
            <button
              onClick={() => handleReview('approved')}
              disabled={saving || disableApprove}
              className={styles.approveBtn}
            >
              {getApproveButtonText()}
            </button>
            <button
              onClick={() => handleReview('rejected')}
              disabled={saving || !reviewComment.trim() || disableReject}
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

