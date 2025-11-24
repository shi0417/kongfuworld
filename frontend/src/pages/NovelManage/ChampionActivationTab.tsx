import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { API_BASE_URL } from '../../config';
import styles from './ChampionActivationTab.module.css';

interface ActivationStatus {
  approvedChapters: number;
  maxAdvanceChapters: number;
  requiredChapters: number;
  meetsCondition1: boolean; // 大于100章节
  meetsCondition2: boolean; // 大于50+最高tier的advance_chapters
  canApply: boolean;
  championStatus: 'submitted' | 'invalid' | 'approved' | 'rejected';
}

const ChampionActivationTab: React.FC<{ novelId: number }> = ({ novelId }) => {
  const { language } = useLanguage();
  const [status, setStatus] = useState<ActivationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadActivationStatus();
  }, [novelId]);

  const loadActivationStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/champion/activation-status/${novelId}`);
      const data = await response.json();
      
      if (data.success) {
        setStatus(data.data);
      } else {
        setMessage(data.message || (language === 'zh' ? '加载状态失败' : 'Failed to load status'));
      }
    } catch (error) {
      console.error('加载激活状态失败:', error);
      setMessage(language === 'zh' ? '加载状态失败' : 'Failed to load status');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!status?.canApply) {
      return;
    }

    try {
      setSubmitting(true);
      setMessage('');
      
      const response = await fetch(`${API_BASE_URL}/api/champion/apply/${novelId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (data.success) {
        setMessage(language === 'zh' ? '申请已提交，等待审核' : 'Application submitted, pending review');
        // 重新加载状态
        await loadActivationStatus();
      } else {
        setMessage(data.message || (language === 'zh' ? '申请失败' : 'Application failed'));
      }
    } catch (error) {
      console.error('提交申请失败:', error);
      setMessage(language === 'zh' ? '申请失败: ' + (error instanceof Error ? error.message : String(error)) : 'Application failed: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusText = () => {
    if (!status) return '';
    
    switch (status.championStatus) {
      case 'submitted':
        return language === 'zh' ? '申请中...' : 'Application pending...';
      case 'approved':
        return language === 'zh' ? '审批通过，已经拥有champion会员订阅系统' : 'Approved, you now have Champion member subscription system';
      case 'rejected':
        return language === 'zh' ? '申请被拒绝' : 'Application rejected';
      case 'invalid':
      default:
        return '';
    }
  };

  const getStatusColor = () => {
    if (!status) return '';
    
    switch (status.championStatus) {
      case 'submitted':
        return '#ff9800'; // 橙色
      case 'approved':
        return '#28a745'; // 绿色
      case 'rejected':
        return '#dc3545'; // 红色
      default:
        return '';
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          {language === 'zh' ? '加载中...' : 'Loading...'}
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          {language === 'zh' ? '无法加载激活状态' : 'Unable to load activation status'}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>{language === 'zh' ? '会员激活' : 'Champion Activation'}</h3>
        <p>{language === 'zh' ? '申请开通Champion会员订阅系统' : 'Apply for Champion member subscription system'}</p>
      </div>

      {message && (
        <div className={`${styles.message} ${message.includes(language === 'zh' ? '成功' : 'success') || message.includes('submitted') || message.includes('pending') ? styles.success : styles.error}`}>
          {message}
        </div>
      )}

      {/* 激活条件说明 */}
      <div className={styles.conditionsCard}>
        <h4>{language === 'zh' ? '激活条件' : 'Activation Conditions'}</h4>
        <div className={styles.conditionList}>
          <div className={`${styles.conditionItem} ${status.meetsCondition1 ? styles.met : styles.unmet}`}>
            <span className={styles.conditionIcon}>
              {status.meetsCondition1 ? '✓' : '✗'}
            </span>
            <div className={styles.conditionContent}>
              <strong>{language === 'zh' ? '条件1：' : 'Condition 1: '}</strong>
              {language === 'zh' ? '小说通过审核的章节大于100章节' : 'Novel has more than 100 approved chapters'}
              <span className={styles.conditionValue}>
                ({language === 'zh' ? '当前：' : 'Current: '}{status.approvedChapters} {language === 'zh' ? '章节' : 'chapters'})
              </span>
            </div>
          </div>
          
          <div className={`${styles.conditionItem} ${status.meetsCondition2 ? styles.met : styles.unmet}`}>
            <span className={styles.conditionIcon}>
              {status.meetsCondition2 ? '✓' : '✗'}
            </span>
            <div className={styles.conditionContent}>
              <strong>{language === 'zh' ? '条件2：' : 'Condition 2: '}</strong>
              {language === 'zh' ? '小说通过审核章节数量大于50+最高tier_level的advance_chapters' : 'Novel has more approved chapters than 50 + highest tier advance_chapters'}
              <span className={styles.conditionValue}>
                ({language === 'zh' ? '当前：' : 'Current: '}{status.approvedChapters} {language === 'zh' ? '章节，需要：' : 'chapters, required: '}{status.requiredChapters} {language === 'zh' ? '章节' : 'chapters'})
              </span>
              {status.maxAdvanceChapters > 0 && (
                <span className={styles.conditionDetail}>
                  ({language === 'zh' ? '最高tier预读章节数：' : 'Highest tier advance chapters: '}{status.maxAdvanceChapters})
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 当前状态 */}
      {status.championStatus !== 'invalid' && (
        <div className={styles.statusCard} style={{ borderColor: getStatusColor() }}>
          <div className={styles.statusHeader}>
            <span className={styles.statusLabel}>
              {language === 'zh' ? '当前状态：' : 'Current Status: '}
            </span>
            <span className={styles.statusValue} style={{ color: getStatusColor() }}>
              {getStatusText()}
            </span>
          </div>
        </div>
      )}

      {/* 申请按钮 */}
      <div className={styles.actions}>
        <button
          onClick={handleApply}
          disabled={!status.canApply || submitting || status.championStatus === 'submitted' || status.championStatus === 'approved'}
          className={styles.applyButton}
        >
          {submitting
            ? (language === 'zh' ? '提交中...' : 'Submitting...')
            : (language === 'zh' ? '申请开通Champion会员' : 'Apply for Champion Membership')}
        </button>
      </div>

      {!status.canApply && status.championStatus === 'invalid' && (
        <div className={styles.hint}>
          {language === 'zh' 
            ? '请先满足以上激活条件后再申请' 
            : 'Please meet the activation conditions above before applying'}
        </div>
      )}
    </div>
  );
};

export default ChampionActivationTab;

