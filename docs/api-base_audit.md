# API Base Audit Report

## 基线信息

**Git Commit**: 5f1191f50535f6a25753ded1d94f048a15dd0526
**Date**: 2025-12-30 09:17:36 +0800
**Branch**: main

## Git Status

```
On branch main
Your branch is up to date with 'origin/main'.

Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
        modified:   frontend/src/config.ts
        modified:   frontend/src/pages/AdminPanel/AuthorRoyalty/index.tsx
        modified:   frontend/src/pages/AdminPanel/BaseIncome/index.tsx
        modified:   frontend/src/pages/AdminPanel/EditorBaseIncome/index.tsx
        modified:   frontend/src/pages/AdminPanel/EditorSettlementPayoutModal.tsx
        modified:   frontend/src/pages/AdminPanel/PaymentStats/index.tsx
        modified:   frontend/src/pages/AdminPanel/ReaderIncome/index.tsx
```

## Recent Commits

```
5f1191f (HEAD -> main, origin/main) Daily auto-backup: 2025-12-30 09:17:36
f490f8d Daily auto-backup: 2025-12-29 13:34:23
7381dab Daily auto-backup: 2025-12-29 12:36:25
2ae66bd Daily auto-backup: 2025-12-29 11:11:19
05a109a Daily auto-backup: 2025-12-29 10:33:01
```

## 硬编码 localhost:5000 命中统计

### frontend/src (100 hits)

**Services (3 hits)**:
- frontend/src/services/ApiService.ts:53: `private static baseURL = 'http://localhost:5000/api';`
- frontend/src/services/AuthService.ts:220: `await fetch(\`http://localhost:5000/api/checkin/status/${user.id}?timezone=UTC\`);`
- frontend/src/services/homepageService.ts:224: 注释提到 localhost:5000

**Pages (97 hits)**:
1. frontend/src/pages/NovelManage/NovelInfoTab.tsx (2 hits)
2. frontend/src/pages/NovelManage/WorkStagesTab.tsx (2 hits)
3. frontend/src/pages/NovelEdit.tsx (2 hits)
4. frontend/src/pages/CreateNovel.tsx (1 hit)
5. frontend/src/pages/ChapterWriter.tsx (16 hits)
6. frontend/src/pages/AdminRegister.tsx (2 hits)
7. frontend/src/pages/AdminPanel/EditorSettlementPayoutModal.tsx (1 hit)
8. frontend/src/pages/AdminPanel/EditorBaseIncome/index.tsx (3 hits)
9. frontend/src/pages/AdminPanel/CommissionTransaction/index.tsx (3 hits)
10. frontend/src/pages/AdminPanel/CommissionSettings/KarmaRates.tsx (2 hits)
11. frontend/src/pages/AdminPanel/CommissionSettings/CommissionPlansTable.tsx (8 hits)
12. frontend/src/pages/AdminPanel/CommissionSettings/AuthorRoyalty.tsx (12 hits)
13. frontend/src/pages/AdminPanel/CommissionSettings/ReferralTable.tsx (4 hits)
14. frontend/src/pages/AdminPanel/CommissionSettings/PricingSettings.tsx (18 hits)
15. frontend/src/pages/AdminPanel/ChapterApproval/ChapterDetail.tsx (3 hits)
16. frontend/src/pages/AdminPanel/ChapterApproval/index.tsx (1 hit)
17. frontend/src/pages/AdminPanel/BaseIncome/index.tsx (3 hits)
18. frontend/src/pages/AdminPanel/AuthorRoyalty/index.tsx (3 hits)
19. frontend/src/pages/AdminPanel/AdminPayoutAccounts.tsx (1 hit)
20. frontend/src/pages/AdminPanel/AIBatchTranslation/index.tsx (1 hit)
21. frontend/src/pages/AdminPanel/ReaderIncome/index.tsx (1 hit)
22. frontend/src/pages/AdminPanel/PaymentStats/index.tsx (3 hits)
23. frontend/src/pages/AdminPanel/InboxV2.tsx (1 hit)
24. frontend/src/pages/AdminPanel/NovelReview/index.tsx (6 hits)
25. frontend/src/pages/AdminPanel/NewNovelPool/index.tsx (1 hit)
26. frontend/src/pages/AdminPanel/EditorManagement/index.tsx (1 hit)
27. frontend/src/pages/AdminPanel/AuthorIncome/index.tsx (1 hit)
28. frontend/src/pages/AdminPanel/AdminUserPage/index.tsx (1 hit)
29. frontend/src/pages/AdminPanel/AdminUserPage/PermissionManagementTab.tsx (1 hit)

### frontend/public (3 hits)

- frontend/public/debug_token.html:130: `await fetch('http://localhost:5000/api/novel/13/review-stats', {`
- frontend/public/debug_token.html:165: `await fetch('http://localhost:5000/api/login', {`
- frontend/public/test-unlock.html:57: `await fetch('http://localhost:5000/api/chapter-unlock/status/844/1');`

## 总计

- **frontend/src**: 100 hits
- **frontend/public**: 3 hits
- **Total**: 103 hits

## 问题分类

1. **API调用硬编码**: 直接使用 `fetch('http://localhost:5000/api/...')`
2. **静态资源拼接**: 使用 `http://localhost:5000${path}` 拼接图片/封面URL
3. **服务层硬编码**: ApiService.baseURL 固定为 localhost:5000
4. **调试页面硬编码**: public目录下的HTML测试页面

## 修复策略

1. **Phase 1**: 修改 config.ts 和 ApiService.ts，引入动态API Base
2. **Phase 2**: 修复 public 目录下的调试页面
3. **Phase 3**: 引入 .env.development 环境变量
4. **Phase 4**: 逐文件修复所有硬编码点
5. **Phase 5**: 构建验收和部署
