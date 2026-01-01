import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../hooks/useAuth';
import ApiService from '../../services/ApiService';
import styles from './WorkStagesTab.module.css';
import { toAssetUrl } from '../../config';

interface ContractStatus {
  total_word_count: number;
  can_contract: boolean;
  required_word_count: number;
  has_contract: boolean;
  current_contract: {
    plan_id: number;
    plan_name: string;
    royalty_percent: number;
    effective_from: string;
  } | null;
  available_plans: Array<{
    id: number;
    name: string;
    royalty_percent: number;
    is_custom: boolean;
  }>;
  novel_status: string;
}

interface NovelInfo {
  id: number;
  title: string;
  description: string;
  cover: string | null;
  status: string;
  review_status: string;
  languages: string | null;
  created_at: string;
  genres?: Array<{ id: number; name: string }>;
}

const WorkStagesTab: React.FC<{ novelId: number }> = ({ novelId }) => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();

  // 子选项卡状态
  const [activeSubTab, setActiveSubTab] = useState<'create' | 'sign' | 'publish'>('create');
  
  
  // 小说信息
  const [novelInfo, setNovelInfo] = useState<NovelInfo | null>(null);
  const [novelLoading, setNovelLoading] = useState(true);
  
  // 签约相关状态
  const [contractStatus, setContractStatus] = useState<ContractStatus | null>(null);
  const [contractLoading, setContractLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [contractError, setContractError] = useState<string>('');
  
  // 上架相关状态
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string>('');

  // 加载小说信息
  useEffect(() => {
    loadNovelInfo();
  }, [novelId]);

  // 加载签约状态（仅在申请签约选项卡时加载）
  useEffect(() => {
    if (activeSubTab === 'sign') {
      loadContractStatus();
    }
  }, [novelId, activeSubTab]);

  const loadNovelInfo = async () => {
    try {
      setNovelLoading(true);
      const response: any = await ApiService.get(`/novel/${novelId}/detail`);
      
      // 处理不同的响应格式
      let novelData = null;
      if (response && (response as any).novel) {
        novelData = (response as any).novel;
      } else if (response && (response as any).data) {
        novelData = (response as any).data;
      } else if (response && (response as any).success && (response as any).data) {
        novelData = (response as any).data;
      } else if (response && !(response as any).success && (response as any).id) {
        // 直接返回小说对象的情况
        novelData = response;
      }
      
      if (novelData) {
        setNovelInfo(novelData);
      }
    } catch (error: any) {
      console.error('加载小说信息失败:', error);
    } finally {
      setNovelLoading(false);
    }
  };

  const loadContractStatus = async () => {
    try {
      setContractLoading(true);
      setContractError('');
      const response = await ApiService.get(`/writer/novel/${novelId}/contract-status`);
      
      if (response && response.success && response.data) {
        setContractStatus(response.data);
      } else {
        setContractError(response?.message || '加载失败');
      }
    } catch (error: any) {
      console.error('检查签约状态失败:', error);
      setContractError(error.message || error.response?.data?.message || '加载失败');
    } finally {
      setContractLoading(false);
    }
  };

  const handleSubmitContract = async () => {
    if (!selectedPlanId) {
      setContractError('请选择分成方案');
      return;
    }

    if (!agreeTerms) {
      setContractError('请先阅读并同意《作者签约协议》');
      return;
    }

    try {
      setSubmitting(true);
      setContractError('');
      
      const response = await ApiService.post(`/writer/novel/${novelId}/contract`, {
        plan_id: selectedPlanId,
        agree_terms: agreeTerms
      });
      
      if (response.success) {
        // 重新加载签约状态和小说信息
        await Promise.all([loadContractStatus(), loadNovelInfo()]);
      } else {
        setContractError(response.message || '提交失败');
      }
    } catch (error: any) {
      console.error('提交签约申请失败:', error);
      setContractError(error.response?.data?.message || error.message || '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublish = async () => {
    if (novelInfo?.review_status !== 'approved') {
      setPublishError('作品尚未通过审核，无法上架');
      return;
    }

    try {
      setPublishing(true);
      setPublishError('');
      
      const response = await ApiService.post(`/writer/novel/${novelId}/publish`);
      
      if (response.success) {
        // 重新加载小说信息
        await loadNovelInfo();
      } else {
        setPublishError(response.message || '上架失败');
      }
    } catch (error: any) {
      console.error('作品上架失败:', error);
      setPublishError(error.response?.data?.message || error.message || '上架失败');
    } finally {
      setPublishing(false);
    }
  };

  const formatWordCount = (count: number) => {
    return count.toLocaleString('zh-CN');
  };

  const formatPercent = (percent: number) => {
    return (percent * 100).toFixed(2);
  };

  const getStatusText = (status: string) => {
    const statusMap: { [key: string]: string } = {
      'created': language === 'zh' ? '草稿' : 'Draft',
      'submitted': language === 'zh' ? '已提交' : 'Submitted',
      'reviewing': language === 'zh' ? '审核中' : 'Reviewing',
      'approved': language === 'zh' ? '审核通过' : 'Approved',
      'published': language === 'zh' ? '已上架' : 'Published',
      'unlisted': language === 'zh' ? '已下架' : 'Unlisted',
      'archived': language === 'zh' ? '已归档' : 'Archived',
      'locked': language === 'zh' ? '已锁定' : 'Locked'
    };
    return statusMap[status] || status;
  };

  return (
    <div className={styles.container}>
      {/* 子选项卡 */}
      <div className={styles.subTabs}>
        <button
          className={`${styles.subTab} ${activeSubTab === 'create' ? styles.active : ''}`}
          onClick={() => setActiveSubTab('create')}
        >
          {language === 'zh' ? '作品创建' : 'Work Creation'}
        </button>
        <button
          className={`${styles.subTab} ${activeSubTab === 'sign' ? styles.active : ''}`}
          onClick={() => setActiveSubTab('sign')}
        >
          {language === 'zh' ? '申请签约' : 'Apply Contract'}
        </button>
        <button
          className={`${styles.subTab} ${activeSubTab === 'publish' ? styles.active : ''}`}
          onClick={() => setActiveSubTab('publish')}
        >
          {language === 'zh' ? '作品上架' : 'Publish Work'}
        </button>
      </div>

      {/* 子选项卡内容 */}
      <div className={styles.subTabContent}>
        {activeSubTab === 'create' && (
          <div className={styles.createTab}>
            {novelLoading ? (
              <div className={styles.loading}>{language === 'zh' ? '加载中...' : 'Loading...'}</div>
            ) : novelInfo ? (
              <div className={styles.novelInfoCard}>
                <div className={styles.novelCoverSection}>
                  {novelInfo.cover ? (
                    <img
                      src={
                        toAssetUrl(novelInfo.cover.startsWith('/') ? novelInfo.cover : `/covers/${novelInfo.cover}`)
                      }
                      alt={novelInfo.title}
                      className={styles.novelCover}
                      onError={(e) => {
                        // 如果图片加载失败，显示占位符
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const placeholder = target.nextElementSibling as HTMLElement;
                        if (placeholder && placeholder.classList.contains(styles.novelCoverPlaceholder)) {
                          placeholder.style.display = 'flex';
                        }
                      }}
                    />
                  ) : (
                    <div className={styles.novelCoverPlaceholder}>
                      {language === 'zh' ? '暂无封面' : 'No Cover'}
                    </div>
                  )}
                </div>
                <div className={styles.novelInfoSection}>
                  <h2 className={styles.novelTitle}>{novelInfo.title}</h2>
                  <div className={styles.novelMeta}>
                    <p><strong>{language === 'zh' ? '小说ID：' : 'Novel ID: '}</strong>{novelInfo.id}</p>
                    <p><strong>{language === 'zh' ? '当前状态：' : 'Current Status: '}</strong>
                      <span className={styles.statusBadge}>{getStatusText(novelInfo.review_status)}</span>
                    </p>
                    {novelInfo.languages && (
                      <p><strong>{language === 'zh' ? '语言：' : 'Language: '}</strong>{novelInfo.languages}</p>
                    )}
                    <p><strong>{language === 'zh' ? '创建时间：' : 'Created At: '}</strong>
                      {new Date(novelInfo.created_at).toLocaleString('zh-CN')}
                    </p>
                  </div>
                  {novelInfo.description && (
                    <div className={styles.novelDescription}>
                      <h3>{language === 'zh' ? '作品简介' : 'Description'}</h3>
                      <p>{novelInfo.description}</p>
                    </div>
                  )}
                  <button
                    className={styles.actionButton}
                    onClick={() => navigate(`/novel-manage/${novelId}?tab=chapters`)}
                  >
                    {language === 'zh' ? '前往章节管理' : 'Go to Chapter Management'}
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.error}>{language === 'zh' ? '加载失败' : 'Load Failed'}</div>
            )}
          </div>
        )}

        {activeSubTab === 'sign' && (
          <div className={styles.signTab}>
            {contractLoading ? (
              <div className={styles.loading}>{language === 'zh' ? '加载中...' : 'Loading...'}</div>
            ) : contractError && !contractStatus ? (
              <div className={styles.error}>{contractError}</div>
            ) : contractStatus?.has_contract ? (
              // 已签约状态
              <div className={styles.contractCompleted}>
                <div className={styles.iconContainer}>
                  <div className={styles.checkIcon}>✓</div>
                </div>
                <h2 className={styles.title}>
                  {language === 'zh' ? '该作品已完成签约' : 'Contract Completed'}
                </h2>
                <div className={styles.contractInfo}>
                  {contractStatus.current_contract && (
                    <>
                      <p><strong>{language === 'zh' ? '分成方案：' : 'Royalty Plan: '}</strong>{contractStatus.current_contract.plan_name}</p>
                      <p><strong>{language === 'zh' ? '作者分成比例：' : 'Author Royalty: '}</strong>{formatPercent(contractStatus.current_contract.royalty_percent)}%</p>
                    </>
                  )}
                  <p><strong>{language === 'zh' ? '当前状态：' : 'Current Status: '}</strong>{getStatusText(contractStatus.novel_status)}</p>
                </div>
              </div>
            ) : !contractStatus?.can_contract ? (
              // 字数不足状态
              <div className={styles.wordCountInsufficient}>
                <div className={styles.iconContainer}>
                  <div className={styles.docIcon}>📝</div>
                </div>
                <h2 className={styles.title}>
                  {language === 'zh' ? '字数不足，暂不能签约' : 'Insufficient Word Count'}
                </h2>
                <div className={styles.wordCountInfo}>
                  <p className={styles.wordCount}>
                    <strong>{language === 'zh' ? '当前作品可统计字数：' : 'Current Word Count: '}</strong>
                    <span className={styles.highlight}>{formatWordCount(contractStatus?.total_word_count || 0)}</span>
                    {language === 'zh' ? ' 字' : ' words'}
                  </p>
                  <p className={styles.requirement}>
                    {language === 'zh' ? '签约至少需要 ' : 'Contract requires at least '}
                    <span className={styles.highlight}>{formatWordCount(contractStatus?.required_word_count || 20000)}</span>
                    {language === 'zh' ? ' 字（草稿章节不计入字数）' : ' words (draft chapters excluded)'}
                  </p>
                  <p className={styles.hint}>
                    {language === 'zh' ? '请继续发布章节，达到要求后即可发起签约。' : 'Please continue publishing chapters to meet the requirement.'}
                  </p>
                </div>
              </div>
            ) : (
              // 可签约状态
              <div className={styles.contractForm}>
                <div className={styles.statusInfo}>
                  <p className={styles.wordCount}>
                    <strong>{language === 'zh' ? '当前作品可统计字数：' : 'Current Word Count: '}</strong>
                    <span className={styles.highlight}>{formatWordCount(contractStatus?.total_word_count || 0)}</span>
                    {language === 'zh' ? ' 字（草稿不计入）' : ' words (draft excluded)'}
                  </p>
                  <p className={styles.eligibility}>
                    {language === 'zh' ? '您已满足签约条件，请选择分成方案发起签约。' : 'You meet the contract requirements. Please select a royalty plan.'}
                  </p>
                </div>

                {/* 分成方案选择 */}
                {contractStatus?.available_plans && contractStatus.available_plans.length > 0 && (
                  <div className={styles.plansSection}>
                    <h3 className={styles.plansTitle}>
                      {language === 'zh' ? '选择分成方案' : 'Select Royalty Plan'}
                    </h3>
                    <div className={styles.plansList}>
                      {contractStatus.available_plans.map((plan) => (
                        <div
                          key={plan.id}
                          className={`${styles.planCard} ${selectedPlanId === plan.id ? styles.planCardSelected : ''}`}
                          onClick={() => setSelectedPlanId(plan.id)}
                        >
                          <div className={styles.planHeader}>
                            <input
                              type="radio"
                              name="plan"
                              checked={selectedPlanId === plan.id}
                              onChange={() => setSelectedPlanId(plan.id)}
                              className={styles.planRadio}
                            />
                            <div className={styles.planName}>{plan.name}</div>
                            {plan.is_custom && (
                              <span className={styles.customTag}>
                                {language === 'zh' ? '专属方案' : 'Custom Plan'}
                              </span>
                            )}
                          </div>
                          <div className={styles.planPercent}>
                            {formatPercent(plan.royalty_percent)}%
                          </div>
                          <div className={styles.planDescription}>
                            {language === 'zh' 
                              ? `作者可获得作品基础收入的 ${formatPercent(plan.royalty_percent)}% 作为分成`
                              : `Author receives ${formatPercent(plan.royalty_percent)}% of base income as royalty`}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 协议确认 */}
                <div className={styles.termsSection}>
                  <label className={styles.termsCheckbox}>
                    <input
                      type="checkbox"
                      checked={agreeTerms}
                      onChange={(e) => setAgreeTerms(e.target.checked)}
                    />
                    <span>
                      {language === 'zh' ? '我已阅读并同意《作者签约协议》' : 'I have read and agree to the Author Contract Agreement'}
                    </span>
                  </label>
                </div>

                {/* 错误提示 */}
                {contractError && (
                  <div className={styles.errorMessage}>{contractError}</div>
                )}

                {/* 提交按钮 */}
                <button
                  className={styles.applyBtn}
                  onClick={handleSubmitContract}
                  disabled={
                    !selectedPlanId || 
                    !agreeTerms || 
                    submitting || 
                    contractStatus?.novel_status === 'submitted' ||
                    contractStatus?.novel_status === 'reviewing'
                  }
                >
                  {submitting 
                    ? (language === 'zh' ? '提交中...' : 'Submitting...')
                    : contractStatus?.novel_status === 'submitted' || contractStatus?.novel_status === 'reviewing'
                    ? (language === 'zh' ? '作品申请签约中…' : 'Contract Application Pending...')
                    : (language === 'zh' ? '申请签约' : 'Apply Contract')}
                </button>
                
                {(contractStatus?.novel_status === 'submitted' || contractStatus?.novel_status === 'reviewing') && (
                  <p className={styles.submitHint}>
                    {language === 'zh' ? '您的签约申请已提交，等待平台审核。' : 'Your contract application has been submitted and is pending platform review.'}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {activeSubTab === 'publish' && (
          <div className={styles.publishTab}>
            {novelLoading ? (
              <div className={styles.loading}>{language === 'zh' ? '加载中...' : 'Loading...'}</div>
            ) : novelInfo ? (
              <>
                {novelInfo.review_status === 'published' ? (
                  // 已上架状态
                  <div className={styles.publishCompleted}>
                    <div className={styles.iconContainer}>
                      <div className={styles.checkIcon}>✓</div>
                    </div>
                    <h2 className={styles.title}>
                      {language === 'zh' ? '作品已经上架' : 'Work Published'}
                    </h2>
                    <p className={styles.successMessage}>
                      {language === 'zh' 
                        ? '作品已成功上架，读者现在可以在前台看到本书。'
                        : 'Your work has been successfully published. Readers can now see it on the frontend.'}
                    </p>
                  </div>
                ) : novelInfo.review_status === 'approved' ? (
                  // 可以上架状态
                  <div className={styles.publishForm}>
                    <div className={styles.iconContainer}>
                      <div className={styles.publishIcon}>📚</div>
                    </div>
                    <h2 className={styles.title}>
                      {language === 'zh' ? '作品上架' : 'Publish Work'}
                    </h2>
                    <p className={styles.publishDescription}>
                      {language === 'zh' 
                        ? '您的作品已通过审核，可以正式上架展示给读者。'
                        : 'Your work has been approved and can be published for readers.'}
                    </p>
                    {publishError && (
                      <div className={styles.errorMessage}>{publishError}</div>
                    )}
                    <button
                      className={styles.publishBtn}
                      onClick={handlePublish}
                      disabled={publishing}
                    >
                      {publishing 
                        ? (language === 'zh' ? '上架中...' : 'Publishing...')
                        : (language === 'zh' ? '作品上架' : 'Publish Work')}
                    </button>
                  </div>
                ) : (
                  // 不能上架状态
                  <div className={styles.publishDisabled}>
                    <div className={styles.iconContainer}>
                      <div className={styles.lockIcon}>🔒</div>
                    </div>
                    <h2 className={styles.title}>
                      {language === 'zh' ? '暂不能上架' : 'Cannot Publish'}
                    </h2>
                    <p className={styles.disabledMessage}>
                      {language === 'zh' 
                        ? '当前作品尚未通过签约审核，暂时无法上架。'
                        : 'Your work has not passed the contract review yet and cannot be published.'}
                    </p>
                    <p className={styles.currentStatus}>
                      <strong>{language === 'zh' ? '当前状态：' : 'Current Status: '}</strong>
                      <span className={styles.statusBadge}>{getStatusText(novelInfo.review_status)}</span>
                    </p>
                    <button
                      className={styles.publishBtn}
                      disabled
                      style={{ opacity: 0.6, cursor: 'not-allowed' }}
                    >
                      {language === 'zh' ? '作品上架' : 'Publish Work'}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className={styles.error}>{language === 'zh' ? '加载失败' : 'Load Failed'}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkStagesTab;
