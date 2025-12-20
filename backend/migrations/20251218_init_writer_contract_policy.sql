-- 初始化签约政策文档（writer_contract_policy）
-- 注意：如果同 doc_key+language 已有 is_current=1 的记录，请先通过后台 set-current 流程处理
-- 或手动执行：UPDATE site_legal_documents SET is_current = 0 WHERE doc_key = 'writer_contract_policy' AND language = 'en';

-- 插入签约政策（英文版）
INSERT INTO site_legal_documents
(doc_key, language, title, version, content_md, status, is_current, effective_at, created_by, updated_by)
VALUES
(
  'writer_contract_policy',
  'en',
  'KongFuWorld Writer Contract Policy',
  '1.0.0',
  '# KongFuWorld Writer Contract Policy

## 1. Introduction

Welcome to KongFuWorld Writer Program. This policy outlines the terms and conditions for writers participating in our platform.

## 2. Contract Terms

### 2.1 Eligibility
- Writers must be at least 18 years old
- Writers must have a verified email address
- Writers must agree to our Terms of Service

### 2.2 Content Requirements
- All content must be original
- Content must comply with platform guidelines
- Writers retain copyright ownership

## 3. Revenue Sharing

### 3.1 Royalty Structure
- Base royalty rate: 50% of net revenue
- Additional bonuses for popular works
- Monthly payout schedule

### 3.2 Payment Terms
- Minimum payout threshold: $50 USD
- Payments processed monthly
- Payment methods: Bank transfer, PayPal

## 4. Responsibilities

Writers are responsible for:
- Maintaining content quality
- Regular updates as per schedule
- Engaging with readers

## 5. Termination

Either party may terminate the contract with 30 days notice.

## 6. Contact

For questions, contact: writers@kongfuworld.com

---

*Last Updated: December 18, 2025*',
  'published',
  1,
  NOW(),
  1,
  1
);

-- 插入公告示例（用于 writers-zone 官方动态测试）
INSERT INTO homepage_announcements
(title, content, content_format, link_url, display_order, is_active, start_date, end_date)
VALUES
(
  'Writer Program Update',
  '# Writer Program Update

We are excited to announce new features for our writer program:

- Enhanced royalty calculation system
- New writer dashboard
- Improved payment processing

Thank you for being part of KongFuWorld!',
  'markdown',
  NULL,
  0,
  1,
  NULL,
  NULL
),
(
  'Copyright Operations Update',
  '# Copyright Operations Update

Important updates regarding copyright protection:

- New DMCA process
- Enhanced content monitoring
- Updated reporting system

Please review the changes in your writer dashboard.',
  'markdown',
  NULL,
  1,
  1,
  NULL,
  NULL
),
(
  'Writer Achievement System Launched',
  '# Writer Achievement System Launched

We are launching a new achievement system to recognize outstanding writers:

- Monthly top writer awards
- Milestone badges
- Special recognition program

Check your achievements in the writer center!',
  'markdown',
  NULL,
  2,
  1,
  NULL,
  NULL
);

