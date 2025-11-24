import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './ReportModal.module.css';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reportType: string) => void;
  commentAuthor?: string;
  commentType: 'review' | 'comment' | 'paragraph_comment';
}

const REPORT_REASONS = [
  'Spoilers',
  'Abuse or harassment',
  'Spam',
  'Copyright infringement',
  'Discrimination (racism, sexism, etc.)',
  'Request to delete a comment that you created'
];

const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  commentAuthor,
  commentType
}) => {
  const [selectedReason, setSelectedReason] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!selectedReason) {
      return;
    }
    onSubmit(selectedReason);
    setSelectedReason('');
  };

  const getCommentTypeText = () => {
    switch (commentType) {
      case 'review':
        return 'review';
      case 'comment':
        return 'comment';
      case 'paragraph_comment':
        return 'comment';
      default:
        return 'comment';
    }
  };

  // 使用Portal将对话框渲染到body，避免被父容器遮挡
  return createPortal(
    <div 
      className={styles.overlay} 
      onClick={onClose}
      data-report-modal="true"
      onMouseDown={(e) => {
        // 阻止mousedown事件冒泡，防止被其他监听器捕获
        e.stopPropagation();
      }}
    >
      <div 
        className={styles.modal} 
        onClick={(e) => {
          // 阻止点击事件冒泡到overlay
          e.stopPropagation();
        }}
        onMouseDown={(e) => {
          // 阻止mousedown事件冒泡，防止被其他监听器捕获
          e.stopPropagation();
        }}
      >
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            Why do you want to report this {getCommentTypeText()}?
          </h2>
          {commentAuthor && (
            <div className={styles.commentAuthor}>
              Comment by {commentAuthor}
            </div>
          )}
        </div>

        <div className={styles.modalBody}>
          <div className={styles.reasonList}>
            {REPORT_REASONS.map((reason) => (
              <label key={reason} className={styles.reasonItem}>
                <input
                  type="radio"
                  name="reportReason"
                  value={reason}
                  checked={selectedReason === reason}
                  onChange={(e) => setSelectedReason(e.target.value)}
                  className={styles.radioInput}
                />
                <span className={styles.reasonText}>{reason}</span>
              </label>
            ))}
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button
            className={styles.cancelButton}
            onClick={onClose}
          >
            CANCEL
          </button>
          <button
            className={styles.submitButton}
            onClick={handleSubmit}
            disabled={!selectedReason}
          >
            SUBMIT
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ReportModal;

