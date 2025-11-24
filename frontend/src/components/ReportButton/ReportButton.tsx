import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from './ReportButton.module.css';
import ReportModal from '../ReportModal/ReportModal';
import Toast from '../Toast/Toast';

interface ReportButtonProps {
  commentId: number;
  commentType: 'review' | 'comment' | 'paragraph_comment';
  commentAuthor?: string;
  userId?: number;
  onReportSubmit: (commentId: number, commentType: 'review' | 'comment' | 'paragraph_comment', reportReason: string) => Promise<void>;
}

const ReportButton: React.FC<ReportButtonProps> = ({
  commentId,
  commentType,
  commentAuthor,
  userId,
  onReportSubmit
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; right: number } | null>(null);
  const isReportClickRef = useRef(false); // 标记是否正在处理Report按钮点击

  // 计算下拉菜单位置
  useEffect(() => {
    if (showMenu && buttonRef.current) {
      const updatePosition = () => {
        if (buttonRef.current) {
          const buttonRect = buttonRef.current.getBoundingClientRect();
          
          // 使用fixed定位，直接使用视口坐标
          setDropdownPosition({
            top: buttonRect.bottom + 4, // 4px margin，使用视口坐标
            right: window.innerWidth - buttonRect.right // 使用视口坐标
          });
        }
      };
      
      updatePosition();
      
      // 窗口大小改变时重新计算位置
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('resize', updatePosition);
      };
    } else {
      setDropdownPosition(null);
    }
  }, [showMenu]);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // 如果正在处理Report点击，不关闭菜单
      if (isReportClickRef.current) {
        console.log('🔒 检测到Report点击标记，不关闭菜单');
        return;
      }
      
      const target = event.target as Node;
      
      // 检查点击是否在按钮容器或下拉菜单内部
      const isInsideMenu = menuRef.current?.contains(target);
      const isInsideDropdown = dropdownRef.current?.contains(target);
      
      // 如果点击在下拉菜单内部，不关闭菜单（让React事件处理）
      if (isInsideDropdown) {
        console.log('🔒 点击在下拉菜单内部，不关闭菜单');
        return;
      }
      
      // 如果点击在按钮容器内部但不是下拉菜单，也不关闭（可能是点击"..."按钮）
      if (isInsideMenu && !isInsideDropdown) {
        console.log('🔒 点击在按钮容器内部，不关闭菜单');
        return;
      }
      
      // 点击外部，关闭菜单
      if (!isInsideMenu && !isInsideDropdown) {
        console.log('❌ 点击外部，关闭菜单');
        setShowMenu(false);
      }
    };

    if (showMenu) {
      // 使用click事件，在冒泡阶段处理，延迟执行以确保React事件先处理
      const timeoutId = setTimeout(() => {
        document.addEventListener('click', handleClickOutside, false);
      }, 200); // 增加延迟，确保React事件完全处理

      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('click', handleClickOutside, false);
      };
    }
  }, [showMenu]);

  // 滚动时关闭菜单
  useEffect(() => {
    if (showMenu) {
      const handleScroll = () => {
        setShowMenu(false);
      };
      window.addEventListener('scroll', handleScroll, true);
      return () => {
        window.removeEventListener('scroll', handleScroll, true);
      };
    }
  }, [showMenu]);

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  const handleReportClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止事件冒泡，防止被外部点击处理器捕获
    e.preventDefault(); // 阻止默认行为
    
    console.log('🔍 Report按钮被点击');
    
    // 设置标记，防止外部点击处理器关闭菜单
    isReportClickRef.current = true;
    
    // 先打开对话框（立即执行，不等待）
    setShowReportModal(true);
    
    // 然后关闭菜单（使用setTimeout确保对话框先显示）
    setTimeout(() => {
      setShowMenu(false);
      // 延迟重置标记，确保外部点击处理器已经处理完毕
      setTimeout(() => {
        isReportClickRef.current = false;
      }, 200);
    }, 0);
  };

  const handleReportSubmit = async (reportReason: string) => {
    try {
      await onReportSubmit(commentId, commentType, reportReason);
      setShowReportModal(false);
      // 显示成功Toast提示
      setToast({
        message: 'Report submitted successfully',
        type: 'success'
      });
    } catch (error) {
      console.error('Failed to submit report:', error);
      // 显示错误Toast提示
      setToast({
        message: 'Failed to submit report. Please try again.',
        type: 'error'
      });
    }
  };

  return (
    <>
      <div className={styles.reportButtonContainer} ref={menuRef}>
        <button
          ref={buttonRef}
          className={styles.menuButton}
          onClick={handleMenuClick}
          aria-label="More options"
        >
          <span className={styles.menuIcon}>⋯</span>
        </button>
      </div>

      {/* 使用Portal将下拉菜单渲染到body，避免被父容器遮挡 */}
      {showMenu && dropdownPosition && createPortal(
        <div 
          ref={dropdownRef}
          className={styles.menuDropdown}
          style={{
            position: 'fixed',
            top: `${dropdownPosition.top}px`,
            right: `${dropdownPosition.right}px`,
            zIndex: 10000
          }}
          onMouseDown={(e) => {
            // 阻止事件冒泡到document（使用onMouseDown而不是onClick）
            e.stopPropagation();
          }}
        >
          <button
            className={styles.reportMenuItem}
            onMouseDown={(e) => {
              // 使用onMouseDown确保在捕获阶段之前执行
              e.stopPropagation();
            }}
            onClick={handleReportClick}
            type="button"
          >
            Report
          </button>
        </div>,
        document.body
      )}

      <ReportModal
        isOpen={showReportModal}
        onClose={() => {
          console.log('📝 关闭举报对话框');
          setShowReportModal(false);
        }}
        onSubmit={handleReportSubmit}
        commentAuthor={commentAuthor}
        commentType={commentType}
      />

      {/* Toast提示 */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
          duration={3000}
        />
      )}
    </>
  );
};

export default ReportButton;

