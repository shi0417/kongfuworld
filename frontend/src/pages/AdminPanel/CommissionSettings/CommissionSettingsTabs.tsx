import React from 'react';

interface CommissionSettingsTabsProps {
  activeTab: 'plans' | 'karma' | 'author' | 'pricing';
  onTabChange: (tab: 'plans' | 'karma' | 'author' | 'pricing') => void;
  onCreatePlan?: () => void;
  onCreateKarmaRate?: () => void;
  onCreateAuthorPlan?: () => void;
}

const CommissionSettingsTabs: React.FC<CommissionSettingsTabsProps> = ({
  activeTab,
  onTabChange,
  onCreatePlan,
  onCreateKarmaRate,
  onCreateAuthorPlan
}) => {
  return (
    <>
      {/* 操作栏 - 所有Tab共用 */}
      <div style={{ marginTop: '20px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          {activeTab === 'plans' && onCreatePlan && (
            <button
              onClick={onCreatePlan}
              style={{ padding: '8px 16px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              新建方案
            </button>
          )}
          {activeTab === 'karma' && onCreateKarmaRate && (
            <button
              onClick={onCreateKarmaRate}
              style={{ padding: '8px 16px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              新增汇率
            </button>
          )}
          {activeTab === 'author' && onCreateAuthorPlan && (
            <button
              onClick={onCreateAuthorPlan}
              style={{ padding: '8px 16px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              新建方案
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => onTabChange('plans')}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: activeTab === 'plans' ? '#007bff' : '#f0f0f0',
              color: activeTab === 'plans' ? 'white' : '#333',
              cursor: 'pointer',
              borderRadius: '4px'
            }}
          >
            推广分成方案
          </button>
          <button
            onClick={() => onTabChange('karma')}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: activeTab === 'karma' ? '#007bff' : '#f0f0f0',
              color: activeTab === 'karma' ? 'white' : '#333',
              cursor: 'pointer',
              borderRadius: '4px'
            }}
          >
            Karma汇率
          </button>
          <button
            onClick={() => onTabChange('author')}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: activeTab === 'author' ? '#007bff' : '#f0f0f0',
              color: activeTab === 'author' ? 'white' : '#333',
              cursor: 'pointer',
              borderRadius: '4px'
            }}
          >
            作者分成方案
          </button>
          <button
            onClick={() => onTabChange('pricing')}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: activeTab === 'pricing' ? '#007bff' : '#f0f0f0',
              color: activeTab === 'pricing' ? 'white' : '#333',
              cursor: 'pointer',
              borderRadius: '4px'
            }}
          >
            章节价格设置
          </button>
        </div>
      </div>
    </>
  );
};

export default CommissionSettingsTabs;

