import React from 'react';
import styles from './ChapterUpdateConfirmDialog.module.css';

interface ExistingChapter {
  id: number;
  title: string;
  review_status: string;
  is_released: number;
  release_date: string | null;
  created_at: string;
}

interface ChapterUpdateConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  existingChapter: ExistingChapter | null;
  newChapterTitle: string;
  chapterNumber: number;
  isLoading?: boolean;
}

const ChapterUpdateConfirmDialog: React.FC<ChapterUpdateConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  existingChapter,
  newChapterTitle,
  chapterNumber,
  isLoading = false
}) => {
  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose();
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      'draft': 'Draft',
      'submitted': 'Submitted',
      'reviewing': 'Reviewing',
      'approved': 'Approved',
      'rejected': 'Rejected'
    };
    return statusMap[status] || status;
  };

  return (
    <div className={styles.backdrop} onClick={handleBackdropClick}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.iconWrapper}>
            <svg 
              className={styles.infoIcon} 
              viewBox="0 0 24 24" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path 
                d="M12 8V12M12 16H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h2 className={styles.title}>Chapter Already Exists</h2>
        </div>
        
        <div className={styles.body}>
          <p className={styles.message}>
            A chapter with number <strong>Chapter {chapterNumber}</strong> already exists for this novel.
          </p>
          
          {existingChapter && (
            <div className={styles.existingChapterInfo}>
              <div className={styles.infoSection}>
                <div className={styles.infoLabel}>Existing Chapter:</div>
                <div className={styles.infoValue}>{existingChapter.title}</div>
              </div>
              <div className={styles.infoRow}>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Status:</span>
                  <span className={styles.infoValue}>{getStatusText(existingChapter.review_status)}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Released:</span>
                  <span className={styles.infoValue}>{existingChapter.is_released ? 'Yes' : 'No'}</span>
                </div>
              </div>
              {existingChapter.release_date && (
                <div className={styles.infoSection}>
                  <div className={styles.infoLabel}>Release Date:</div>
                  <div className={styles.infoValue}>{formatDate(existingChapter.release_date)}</div>
                </div>
              )}
              <div className={styles.infoSection}>
                <div className={styles.infoLabel}>Created:</div>
                <div className={styles.infoValue}>{formatDate(existingChapter.created_at)}</div>
              </div>
            </div>
          )}

          <div className={styles.newChapterInfo}>
            <div className={styles.infoSection}>
              <div className={styles.infoLabel}>New Chapter Title:</div>
              <div className={styles.infoValue}>{newChapterTitle || `Chapter ${chapterNumber}`}</div>
            </div>
          </div>

          <p className={styles.confirmationMessage}>
            Would you like to <strong>update the existing chapter</strong> with the new content?
          </p>
        </div>

        <div className={styles.footer}>
          <button
            className={styles.button + ' ' + styles.cancelButton}
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            className={styles.button + ' ' + styles.confirmButton}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className={styles.loading}>
                <span className={styles.spinner}></span>
                Updating...
              </span>
            ) : (
              'Update Chapter'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChapterUpdateConfirmDialog;

