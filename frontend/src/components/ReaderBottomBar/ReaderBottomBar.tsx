import React, { useState } from 'react';
import styles from './ReaderBottomBar.module.css';

interface ReaderBottomBarProps {
  // 是否显示（控制显隐 + 动画）
  visible: boolean;

  // 小说 & 章节信息
  novelTitle: string;
  chapterTitle: string;
  chapterNumber?: number;

  // 阅读设置相关
  fontSize: number;
  lineHeight: number;
  onFontSizeChange: (size: number) => void;
  onLineHeightChange: (lh: number) => void;

  // 上一章 / 下一章能力
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;

  // 打开章节列表（复用现有的 showChapterList）
  onToggleChapters: () => void;
}

const ReaderBottomBar: React.FC<ReaderBottomBarProps> = ({
  visible,
  novelTitle,
  chapterTitle,
  chapterNumber,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  onToggleChapters,
  fontSize,
  onFontSizeChange,
  lineHeight,
  onLineHeightChange,
}) => {
  // 内部状态，用来控制"阅读设置面板"的展开/收起
  const [showSettings, setShowSettings] = useState(false);

  // 调试日志：记录 props 变化
  React.useEffect(() => {
    console.log('📊 [ReaderBottomBar] ========== Props 更新 ==========');
    console.log('📊 [ReaderBottomBar] visible:', visible);
    console.log('📊 [ReaderBottomBar] hasPrev:', hasPrev, '| 类型:', typeof hasPrev, '| !!hasPrev:', !!hasPrev);
    console.log('📊 [ReaderBottomBar] hasNext:', hasNext, '| 类型:', typeof hasNext, '| !!hasNext:', !!hasNext);
    console.log('📊 [ReaderBottomBar] onPrev 函数存在:', typeof onPrev === 'function');
    console.log('📊 [ReaderBottomBar] onNext 函数存在:', typeof onNext === 'function');
    console.log('📊 [ReaderBottomBar] Prev 按钮应该禁用:', !hasPrev);
    console.log('📊 [ReaderBottomBar] Next 按钮应该禁用:', !hasNext);
    console.log('📊 [ReaderBottomBar] =================================');
  }, [visible, hasPrev, hasNext, onPrev, onNext]);

  return (
    <div
      className={styles.bottomBar}
      data-visible={visible ? 'true' : 'false'}
    >
      {/* 左侧：汉堡菜单 + 简短章节标题 */}
      <div className={styles.leftArea}>
        <button
          className={styles.iconButton}
          onClick={onToggleChapters}
          aria-label="Open chapter list"
        >
          {/* 三条横线的图标 */}
          <span className={styles.hamburger}>
            <span />
            <span />
            <span />
          </span>
        </button>
        <div className={styles.titleArea}>
          <div className={styles.novelTitle}>{novelTitle}</div>
          <div className={styles.chapterTitle}>
            {chapterNumber ? `Chapter ${chapterNumber}: ` : ''}
            {chapterTitle}
          </div>
        </div>
      </div>

      {/* 中间：阅读设置入口（简单版） */}
      <div className={styles.centerArea}>
        <button
          className={styles.iconButton}
          onClick={() => setShowSettings((s) => !s)}
          aria-label="Toggle reading settings"
        >
          <span className={styles.settingsIcon}>Aa</span>
        </button>

        {showSettings && (
          <div className={styles.settingsPanel}>
            <div className={styles.settingsRow}>
              <div className={styles.settingsLabel}>Font Size</div>
              <div className={styles.settingsControls}>
                <button
                  onClick={() => onFontSizeChange(fontSize - 2)}
                  className={styles.settingsBtn}
                >
                  A-
                </button>
                <span className={styles.settingsValue}>{fontSize}px</span>
                <button
                  onClick={() => onFontSizeChange(fontSize + 2)}
                  className={styles.settingsBtn}
                >
                  A+
                </button>
              </div>
            </div>

            <div className={styles.settingsRow}>
              <div className={styles.settingsLabel}>Line Height</div>
              <div className={styles.settingsControls}>
                <button
                  onClick={() => onLineHeightChange(Number((lineHeight - 0.1).toFixed(1)))}
                  className={styles.settingsBtn}
                >
                  -
                </button>
                <span className={styles.settingsValue}>
                  {lineHeight.toFixed(1)}
                </span>
                <button
                  onClick={() => onLineHeightChange(Number((lineHeight + 0.1).toFixed(1)))}
                  className={styles.settingsBtn}
                >
                  +
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 右侧：上一章 / 下一章 */}
      <div className={styles.rightArea}>
        <button
          className={styles.navButton}
          onClick={(e) => {
            console.log('🖱️ [底部栏 Prev 按钮] 点击事件触发');
            console.log('🖱️ [底部栏 Prev 按钮] event:', e);
            console.log('🖱️ [底部栏 Prev 按钮] hasPrev prop:', hasPrev);
            console.log('🖱️ [底部栏 Prev 按钮] button disabled:', !hasPrev);
            console.log('🖱️ [底部栏 Prev 按钮] onPrev 函数:', onPrev);
            if (!hasPrev) {
              console.log('🖱️ [底部栏 Prev 按钮] ⚠️ 按钮被禁用，点击无效');
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            console.log('🖱️ [底部栏 Prev 按钮] ✅ 调用 onPrev 函数');
            onPrev();
          }}
          disabled={!hasPrev}
        >
          Prev
        </button>
        <button
          className={styles.navButton}
          onClick={(e) => {
            console.log('🖱️ [底部栏 Next 按钮] 点击事件触发');
            console.log('🖱️ [底部栏 Next 按钮] event:', e);
            console.log('🖱️ [底部栏 Next 按钮] hasNext prop:', hasNext);
            console.log('🖱️ [底部栏 Next 按钮] button disabled:', !hasNext);
            console.log('🖱️ [底部栏 Next 按钮] onNext 函数:', onNext);
            if (!hasNext) {
              console.log('🖱️ [底部栏 Next 按钮] ⚠️ 按钮被禁用，点击无效');
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            console.log('🖱️ [底部栏 Next 按钮] ✅ 调用 onNext 函数');
            onNext();
          }}
          disabled={!hasNext}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default ReaderBottomBar;

