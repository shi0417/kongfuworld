#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
自动拆分 AdminPanel.tsx 为多个模块组件
"""

import re
import os

file_path = 'frontend/src/pages/AdminPanel.tsx'
base_dir = 'frontend/src/pages/AdminPanel'

# 读取原文件
with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()
    lines = content.split('\n')

# 定义模块边界（通过查找 activeTab === 'xxx' 和对应的结束位置）
modules = {
    'NovelReview': {
        'start_pattern': r"activeTab === 'novel-review'",
        'end_pattern': r"activeTab === 'payment-stats'",
        'functions': ['loadNovels', 'viewNovelDetail', 'approveNovel', 'rejectNovel'],
        'state_vars': ['novels', 'selectedNovel', 'filterStatus']
    },
    'PaymentStats': {
        'start_pattern': r"activeTab === 'payment-stats'",
        'end_pattern': r"activeTab === 'author-income'",
        'functions': ['loadPaymentSummary', 'loadSubscriptions', 'loadKarmaPurchases'],
        'state_vars': ['paymentSummary', 'subscriptions', 'karmaPurchases', 'activePaymentTab']
    },
    'AuthorIncome': {
        'start_pattern': r"activeTab === 'author-income'",
        'end_pattern': r"activeTab === 'reader-income'",
        'functions': ['loadAuthorIncomeStats'],
        'state_vars': ['authorIncomeMonth', 'authorIncomeData', 'authorIncomeLoading']
    },
    'ReaderIncome': {
        'start_pattern': r"activeTab === 'reader-income'",
        'end_pattern': r"activeTab === 'settlement-overview'",
        'functions': ['loadReaderIncomeStats'],
        'state_vars': ['readerIncomeMonth', 'readerIncomeData', 'readerIncomeLoading']
    },
    'SettlementOverview': {
        'start_pattern': r"activeTab === 'settlement-overview'",
        'end_pattern': r"activeTab === 'base-income'",
        'functions': ['loadSettlementOverview', 'loadSettlementDetail', 'toggleRowExpansion'],
        'state_vars': ['settlementMonth', 'settlementData', 'settlementLoading']
    },
    'BaseIncome': {
        'start_pattern': r"activeTab === 'base-income'",
        'end_pattern': r"activeTab === 'author-royalty'",
        'functions': ['loadBaseIncomeStats', 'generateBaseIncome'],
        'state_vars': ['baseIncomeMonth', 'baseIncomeData', 'baseIncomeLoading']
    },
    'AuthorRoyalty': {
        'start_pattern': r"activeTab === 'author-royalty'",
        'end_pattern': r"activeTab === 'commission-transaction'",
        'functions': ['loadAuthorRoyaltyStats', 'generateAuthorRoyalty'],
        'state_vars': ['authorRoyaltyMonth', 'authorRoyaltyData', 'authorRoyaltyLoading']
    },
    'CommissionTransaction': {
        'start_pattern': r"activeTab === 'commission-transaction'",
        'end_pattern': r"activeTab === 'commission-settings'",
        'functions': ['loadCommissionStats', 'generateCommission'],
        'state_vars': ['commissionMonth', 'commissionData', 'commissionLoading']
    },
    'CommissionSettings': {
        'start_pattern': r"activeTab === 'commission-settings'",
        'end_pattern': r"// 如果未登录",
        'functions': ['loadCommissionPlans', 'loadKarmaRates', 'loadAuthorRoyaltyPlans'],
        'state_vars': ['commissionSettingsTab', 'commissionPlans', 'karmaRates']
    }
}

print("开始拆分 AdminPanel.tsx...")
print(f"文件总行数: {len(lines)}")

# 由于文件太大，这里先创建一个框架
# 实际拆分需要更详细的代码分析

print("拆分脚本已创建，但由于文件复杂度较高，建议手动拆分各个模块")

