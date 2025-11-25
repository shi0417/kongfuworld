import React, { useState, useEffect } from 'react';
import styles from './CommissionSettings.module.css';
import KarmaRates from './KarmaRates';
import CommissionPlansTable from './CommissionPlansTable';
import ReferralTable from './ReferralTable';
import AuthorRoyalty from './AuthorRoyalty';
import PricingSettings from './PricingSettings';

interface CommissionSettingsProps {
  onError?: (error: string) => void;
}

const CommissionSettings: React.FC<CommissionSettingsProps> = ({ onError }) => {
  const [commissionSettingsTab, setCommissionSettingsTab] = useState<'plans' | 'karma' | 'author' | 'pricing'>('plans');
  const [promotionSubTab, setPromotionSubTab] = useState<'plans' | 'referrals'>('plans'); // 推广分成方案子选项卡
  const [readerPlans, setReaderPlans] = useState<any[]>([]);
  const [authorPlans, setAuthorPlans] = useState<any[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [triggerCreatePlan, setTriggerCreatePlan] = useState(false);

  // 初始化加载数据（如果需要）
  useEffect(() => {
    // 其他初始化逻辑
  }, []);

  return (
    <div className={styles.tabContent}>
      <div className={styles.tabHeader}>
        <h2>提成设置</h2>
      </div>

      {/* 操作栏 - 所有Tab共用 */}
      <div style={{ marginTop: '20px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          {commissionSettingsTab === 'plans' && (
            <button
              onClick={() => {
                setTriggerCreatePlan(true);
              }}
              style={{ padding: '8px 16px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              新建方案
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setCommissionSettingsTab('plans')}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: commissionSettingsTab === 'plans' ? '#007bff' : '#f0f0f0',
              color: commissionSettingsTab === 'plans' ? 'white' : '#333',
              cursor: 'pointer',
              borderRadius: '4px'
            }}
          >
            推广分成方案
          </button>
          <button
            onClick={() => setCommissionSettingsTab('karma')}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: commissionSettingsTab === 'karma' ? '#007bff' : '#f0f0f0',
              color: commissionSettingsTab === 'karma' ? 'white' : '#333',
              cursor: 'pointer',
              borderRadius: '4px'
            }}
          >
            Karma汇率
          </button>
          <button
            onClick={() => setCommissionSettingsTab('author')}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: commissionSettingsTab === 'author' ? '#007bff' : '#f0f0f0',
              color: commissionSettingsTab === 'author' ? 'white' : '#333',
              cursor: 'pointer',
              borderRadius: '4px'
            }}
          >
            作者分成方案
          </button>
          <button
            onClick={() => setCommissionSettingsTab('pricing')}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: commissionSettingsTab === 'pricing' ? '#007bff' : '#f0f0f0',
              color: commissionSettingsTab === 'pricing' ? 'white' : '#333',
              cursor: 'pointer',
              borderRadius: '4px'
            }}
          >
            章节价格设置
          </button>
        </div>
      </div>

      {/* 推广分成方案Tab */}
      {commissionSettingsTab === 'plans' && (
        <>
          {/* 子选项卡 */}
          <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', borderBottom: '2px solid #e0e0e0' }}>
            <button
              onClick={() => setPromotionSubTab('plans')}
              style={{
                padding: '10px 20px',
                border: 'none',
                background: 'transparent',
                color: promotionSubTab === 'plans' ? '#007bff' : '#666',
                cursor: 'pointer',
                borderBottom: promotionSubTab === 'plans' ? '2px solid #007bff' : '2px solid transparent',
                marginBottom: '-2px',
                fontWeight: promotionSubTab === 'plans' ? 'bold' : 'normal',
                fontSize: '16px'
              }}
            >
              推广分成方案列表
            </button>
            <button
              onClick={() => setPromotionSubTab('referrals')}
              style={{
                padding: '10px 20px',
                border: 'none',
                background: 'transparent',
                color: promotionSubTab === 'referrals' ? '#007bff' : '#666',
                cursor: 'pointer',
                borderBottom: promotionSubTab === 'referrals' ? '2px solid #007bff' : '2px solid transparent',
                marginBottom: '-2px',
                fontWeight: promotionSubTab === 'referrals' ? 'bold' : 'normal',
                fontSize: '16px'
              }}
            >
              推广关系列表
            </button>
          </div>

          {/* 推广分成方案列表 */}
          {promotionSubTab === 'plans' && (
            <CommissionPlansTable
              onError={onError}
              onPlansLoaded={(readerPlansList, authorPlansList) => {
                setReaderPlans(readerPlansList);
                setAuthorPlans(authorPlansList);
              }}
              triggerCreate={triggerCreatePlan}
              onCreateTriggered={() => setTriggerCreatePlan(false)}
            />
          )}

          {/* 推广关系列表 */}
          {commissionSettingsTab === 'plans' && promotionSubTab === 'referrals' && (
            <ReferralTable onError={onError} readerPlans={readerPlans} authorPlans={authorPlans} />
          )}
        </>
      )}

      {/* Karma汇率Tab */}
      {commissionSettingsTab === 'karma' && (
        <KarmaRates onError={onError} />
      )}

      {/* 作者分成方案Tab */}
      {commissionSettingsTab === 'author' && (
        <AuthorRoyalty onError={onError} />
      )}

      {/* 章节价格设置Tab */}
      {commissionSettingsTab === 'pricing' && (
        <PricingSettings onError={onError} />
      )}
    </div>
  );
};

export default CommissionSettings;
