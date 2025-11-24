import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import styles from './ScheduleReleaseModal.module.css';

interface ScheduleReleaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (releaseDate: Date) => void;
  initialDate?: Date; // 当前章节已设置的发布时间（用于编辑时自动填充）
  minReleaseDate?: Date; // 最小发布时间（不能早于上一章节的发布时间）
  isLoading?: boolean;
  novelTitle?: string;
  previousChapter?: string;
  currentChapter?: string;
  wordCount?: number;
  isEditMode?: boolean; // 是否是编辑模式
}

const ScheduleReleaseModal: React.FC<ScheduleReleaseModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  initialDate,
  minReleaseDate,
  isLoading = false,
  novelTitle = '',
  previousChapter = '',
  currentChapter = '',
  wordCount = 0,
  isEditMode = false
}) => {
  const { language } = useLanguage();
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedHour, setSelectedHour] = useState<number>(0);

  useEffect(() => {
    if (isOpen) {
      // 如果有已设置的发布时间（initialDate），使用它
      if (initialDate) {
        const year = initialDate.getFullYear();
        const month = String(initialDate.getMonth() + 1).padStart(2, '0');
        const day = String(initialDate.getDate()).padStart(2, '0');
        setSelectedDate(`${year}-${month}-${day}`);
        setSelectedHour(initialDate.getHours());
      } else {
        // 否则，默认设置为下一个整点
        const now = new Date();
        const nextHour = new Date(now);
        nextHour.setHours(now.getHours() + 1, 0, 0, 0);
        
        // 如果下一个整点还是今天，设置为明天
        if (nextHour <= now) {
          nextHour.setDate(nextHour.getDate() + 1);
          nextHour.setHours(0, 0, 0, 0);
        }

        const year = nextHour.getFullYear();
        const month = String(nextHour.getMonth() + 1).padStart(2, '0');
        const day = String(nextHour.getDate()).padStart(2, '0');
        
        setSelectedDate(`${year}-${month}-${day}`);
        setSelectedHour(nextHour.getHours());
      }
    }
  }, [isOpen, initialDate]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose();
    }
  };

  const handleConfirm = () => {
    if (selectedDate) {
      const [year, month, day] = selectedDate.split('-').map(Number);
      const releaseDate = new Date(year, month - 1, day, selectedHour, 0, 0, 0);
      
      // 验证日期不能是过去
      const now = new Date();
      now.setMinutes(0, 0, 0);
      
      if (releaseDate <= now) {
        alert(language === 'zh' ? '发布时间不能是过去的时间' : 'Release time cannot be in the past');
        return;
      }
      
      // 验证不能早于上一章节的发布时间（可以相等或晚）
      if (minReleaseDate) {
        const minDate = new Date(minReleaseDate);
        minDate.setMinutes(0, 0, 0);
        
        if (releaseDate < minDate) {
          const minDateStr = minDate.toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });
          alert(language === 'zh' 
            ? `发布时间不能早于上一章节的发布时间（${minDateStr}），可以相等或晚于该时间` 
            : `Release time cannot be earlier than the previous chapter's release time (${minDateStr}), it can be equal to or later than that time`);
          return;
        }
      }
      
      onConfirm(releaseDate);
    }
  };

  const renderHours = () => {
    const hours = [];
    for (let i = 0; i < 24; i++) {
      hours.push(
        <option key={i} value={i}>
          {String(i).padStart(2, '0')}
        </option>
      );
    }
    return hours;
  };

  // 获取最小日期（今天或上一章节的发布时间，取较晚的）
  const today = new Date();
  let minDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  // 如果上一章节的发布时间晚于今天，使用上一章节的发布时间作为最小日期
  if (minReleaseDate) {
    const minReleaseDateStr = `${minReleaseDate.getFullYear()}-${String(minReleaseDate.getMonth() + 1).padStart(2, '0')}-${String(minReleaseDate.getDate()).padStart(2, '0')}`;
    if (minReleaseDate > today) {
      minDateStr = minReleaseDateStr;
    }
  }

  const title = isEditMode 
    ? (language === 'zh' ? '修改定时发布时间' : 'Modify Scheduled Release Time')
    : (language === 'zh' ? '设置定时发布时间' : 'Set Scheduled Release Time');
  const dateLabel = language === 'zh' ? '选择日期' : 'Select Date';
  const hourLabel = language === 'zh' ? '选择时间 (小时)' : 'Select Time (Hour)';
  const confirmText = isEditMode
    ? (language === 'zh' ? '确认更新' : 'Confirm Update')
    : (language === 'zh' ? '确认设置' : 'Confirm Set');
  const cancelText = language === 'zh' ? '取消' : 'Cancel';
  const workNameLabel = language === 'zh' ? '作品名称' : 'Work Name';
  const prevChapterLabel = language === 'zh' ? '上一章' : 'Previous Chapter';
  const currentChapterLabel = language === 'zh' ? '当前章节' : 'Current Chapter';
  const wordCountLabel = language === 'zh' ? '章节字数' : 'Chapter Word Count';

  const previewDate = selectedDate ? new Date(selectedDate + `T${String(selectedHour).padStart(2, '0')}:00:00`) : null;

  return (
    <div className={styles.backdrop} onClick={handleBackdropClick}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>{title}</h3>
          <button className={styles.closeButton} onClick={onClose} disabled={isLoading}>
            ×
          </button>
        </div>

        <div className={styles.content}>
          {/* Chapter Information Section */}
          {(novelTitle || previousChapter || currentChapter) && (
            <div className={styles.chapterInfo}>
              <div className={styles.bookCover}>
                <div className={styles.coverPlaceholder}>
                  {novelTitle ? novelTitle.charAt(0) : '📖'}
                </div>
              </div>
              <div className={styles.workDetails}>
                {novelTitle && (
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>{workNameLabel}:</span>
                    <span className={styles.detailValue}>{novelTitle}</span>
                  </div>
                )}
                {previousChapter && (
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>{prevChapterLabel}:</span>
                    <span className={styles.detailValue}>{previousChapter}</span>
                  </div>
                )}
                {currentChapter && (
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>{currentChapterLabel}:</span>
                    <span className={styles.detailValue}>{currentChapter}</span>
                  </div>
                )}
                {wordCount > 0 && (
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>{wordCountLabel}:</span>
                    <span className={styles.detailValue}>{wordCount.toLocaleString()}{language === 'zh' ? '字' : ' words'}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Time Selection Section */}
          <div className={styles.timeSelection}>
            <div className={styles.formGroup}>
              <label>{dateLabel}:</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={minDateStr}
                className={styles.dateInput}
                disabled={isLoading}
              />
            </div>
            <div className={styles.formGroup}>
              <label>{hourLabel}:</label>
              <select
                value={selectedHour}
                onChange={(e) => setSelectedHour(parseInt(e.target.value))}
                className={styles.hourSelect}
                disabled={isLoading}
              >
                {renderHours()}
              </select>
            </div>
            {previewDate && (
              <div className={styles.preview}>
                {language === 'zh' ? '计划发布时间: ' : 'Scheduled Release Time: '}
                <strong>
                  {previewDate.toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                  })}
                </strong>
              </div>
            )}
          </div>
        </div>

        <div className={styles.footer}>
          <button
            className={styles.cancelButton}
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelText}
          </button>
          <button
            className={styles.confirmButton}
            onClick={handleConfirm}
            disabled={isLoading || !selectedDate}
          >
            {isLoading ? (
              <span className={styles.loading}>
                <span className={styles.spinner}></span>
                {language === 'zh' ? '设置中...' : 'Setting...'}
              </span>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScheduleReleaseModal;

