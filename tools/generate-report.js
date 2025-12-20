/**
 * 生成网站质量审计报告
 */

const fs = require('fs');
const path = require('path');

const REPORTS_DIR = path.join(__dirname, '..', 'reports');
const RAW_DIR = path.join(REPORTS_DIR, 'raw');
const REPORT_FILE = path.join(REPORTS_DIR, 'website-audit-report.md');

// 读取审计结果
let auditResults = {};
try {
  auditResults = JSON.parse(fs.readFileSync(path.join(RAW_DIR, 'audit-results.json'), 'utf8'));
} catch (error) {
  console.error('无法读取审计结果:', error.message);
  process.exit(1);
}

// 读取依赖审计结果
let frontendAudit = null;
let backendAudit = null;
try {
  const frontendAuditPath = path.join(RAW_DIR, 'deps', 'frontend-audit.json');
  if (fs.existsSync(frontendAuditPath)) {
    const content = fs.readFileSync(frontendAuditPath, 'utf8');
    if (content && !content.includes('npm ERR') && content.trim().startsWith('{')) {
      frontendAudit = JSON.parse(content);
      // 更新审计结果
      if (frontendAudit.metadata?.vulnerabilities) {
        const vulns = frontendAudit.metadata.vulnerabilities;
        auditResults.dependencies = auditResults.dependencies || {};
        auditResults.dependencies.frontend = {
          critical: vulns.critical || 0,
          high: vulns.high || 0,
          moderate: vulns.moderate || 0,
          low: vulns.low || 0,
          info: vulns.info || 0,
          total: vulns.total || 0,
        };
      }
    }
  }
} catch (error) {
  console.log('前端依赖审计结果不可用:', error.message);
}

try {
  const backendAuditPath = path.join(RAW_DIR, 'deps', 'backend-audit.json');
  if (fs.existsSync(backendAuditPath)) {
    const content = fs.readFileSync(backendAuditPath, 'utf8');
    if (content && !content.includes('npm ERR') && content.trim().startsWith('{')) {
      backendAudit = JSON.parse(content);
      // 更新审计结果
      if (backendAudit.metadata?.vulnerabilities) {
        const vulns = backendAudit.metadata.vulnerabilities;
        auditResults.dependencies = auditResults.dependencies || {};
        auditResults.dependencies.backend = {
          critical: vulns.critical || 0,
          high: vulns.high || 0,
          moderate: vulns.moderate || 0,
          low: vulns.low || 0,
          info: vulns.info || 0,
          total: vulns.total || 0,
        };
      }
    }
  }
} catch (error) {
  console.log('后端依赖审计结果不可用:', error.message);
}

// 生成报告
function generateReport() {
  const issues = auditResults.issues || [];
  const p0Issues = issues.filter(i => i.severity === 'P0');
  const p1Issues = issues.filter(i => i.severity === 'P1');
  const p2Issues = issues.filter(i => i.severity === 'P2');
  
  // 计算总体评分
  let overallScore = 100;
  overallScore -= p0Issues.length * 20;
  overallScore -= p1Issues.length * 10;
  overallScore -= p2Issues.length * 5;
  overallScore = Math.max(0, overallScore);
  
  const statusColor = overallScore >= 80 ? '🟢' : overallScore >= 60 ? '🟡' : '🔴';
  
  let report = `# 网站质量审计报告

**生成时间**: ${new Date().toLocaleString('zh-CN')}  
**审计工具**: 自定义审计脚本  
**项目**: ${auditResults.project?.name || 'N/A'}

---

## Executive Summary

${statusColor} **总体评分**: ${overallScore}/100

### 关键指标

| 类别 | 状态 | 得分 |
|------|------|------|
| 性能 (Performance) | ${auditResults.performance?.error ? '⚠️ 未测试' : '✅ 已测试'} | ${auditResults.performance?.homepage?.mobile?.performance || 'N/A'} |
| SEO | ${auditResults.seo?.robotsTxt && auditResults.seo?.sitemapXml ? '✅' : '⚠️'} | ${auditResults.seo?.robotsTxt ? '50' : '0'}% |
| 可访问性 (Accessibility) | ⚠️ 未测试 | N/A |
| 安全头 (Security Headers) | ${parseInt(auditResults.security?.frontend?.score || 0) >= 50 ? '⚠️' : '🔴'} | 前端: ${auditResults.security?.frontend?.score || 0}% / 后端: ${auditResults.security?.backend?.score || 0}% |
| 依赖漏洞 | ${auditResults.dependencies?.error ? '⚠️ 扫描失败' : '✅ 已扫描'} | ${auditResults.dependencies?.frontend?.critical || 0} 严重 / ${auditResults.dependencies?.frontend?.high || 0} 高危 |

### 问题统计

- 🔴 **P0 (严重)**: ${p0Issues.length} 个
- 🟡 **P1 (高)**: ${p1Issues.length} 个
- 🟢 **P2 (中)**: ${p2Issues.length} 个
- **总计**: ${issues.length} 个问题

---

## Scope & Environment

### 检查范围

- **前端应用**: ${auditResults.project?.frontend?.framework || 'N/A'} ${auditResults.project?.frontend?.version || 'N/A'} (端口 ${auditResults.project?.frontend?.port || 'N/A'})
- **后端API**: ${auditResults.project?.backend?.framework || 'N/A'} ${auditResults.project?.backend?.version || 'N/A'} (端口 ${auditResults.project?.backend?.port || 'N/A'})
- **测试URL**: 
  - 前端: ${auditResults.project?.services?.frontend?.url || 'N/A'}
  - 后端: ${auditResults.project?.services?.backend?.url || 'N/A'}

### 执行环境

- **操作系统**: Windows
- **Node.js版本**: ${process.version}
- **执行时间**: ${new Date(auditResults.startTime).toLocaleString('zh-CN')}
- **耗时**: ${(auditResults.duration / 1000).toFixed(2)} 秒

### 服务状态

| 服务 | 状态 | 响应时间 |
|------|------|----------|
| 前端 | ${auditResults.project?.services?.frontend?.running ? '✅ 运行中' : '❌ 未运行'} | ${auditResults.project?.services?.frontend?.responseTime || 'N/A'}ms |
| 后端 | ${auditResults.project?.services?.backend?.running ? '✅ 运行中' : '❌ 未运行'} | ${auditResults.project?.services?.backend?.responseTime || 'N/A'}ms |

---

## Project Overview

### 技术栈

**前端**:
- Framework: ${auditResults.project?.frontend?.framework || 'N/A'}
- Version: ${auditResults.project?.frontend?.version || 'N/A'}
- Build Tool: ${auditResults.project?.frontend?.buildTool || 'N/A'}
- TypeScript: ${auditResults.project?.frontend?.typescript ? '✅' : '❌'}

**后端**:
- Framework: ${auditResults.project?.backend?.framework || 'N/A'}
- Version: ${auditResults.project?.backend?.version || 'N/A'}
- Runtime: ${auditResults.project?.backend?.runtime || 'N/A'}

### 目录结构

\`\`\`
${auditResults.project?.name || 'project'}/
├── frontend/          # React 前端应用
├── backend/           # Express 后端API
├── tools/             # 工具脚本
└── reports/           # 审计报告
    └── raw/           # 原始数据
\`\`\`

---

## Findings

### Performance (CWV + Lighthouse)

${auditResults.performance?.error ? `
⚠️ **Lighthouse 测试未完成**

原因: ${auditResults.performance.error}

**建议**: 
- 确保 Chrome/Chromium 已安装
- 检查防火墙设置
- 尝试手动运行: \`npx lighthouse http://localhost:3000 --output html --output-path ./reports/raw/lighthouse/homepage.html\`
` : auditResults.performance?.homepage ? `
#### 首页性能指标

| 指标 | 移动端 | 目标值 | 状态 |
|------|--------|--------|------|
| Performance Score | ${(auditResults.performance.homepage.mobile.performance || 0).toFixed(0)} | ≥90 | ${(auditResults.performance.homepage.mobile.performance || 0) >= 90 ? '✅' : '⚠️'} |
| LCP | ${(auditResults.performance.homepage.mobile.metrics?.lcp || 0).toFixed(0)}ms | <2500ms | ${(auditResults.performance.homepage.mobile.metrics?.lcp || 0) < 2500 ? '✅' : '⚠️'} |
| FID | ${(auditResults.performance.homepage.mobile.metrics?.fid || 0).toFixed(0)}ms | <100ms | ${(auditResults.performance.homepage.mobile.metrics?.fid || 0) < 100 ? '✅' : '⚠️'} |
| CLS | ${(auditResults.performance.homepage.mobile.metrics?.cls || 0).toFixed(3)} | <0.1 | ${(auditResults.performance.homepage.mobile.metrics?.cls || 0) < 0.1 ? '✅' : '⚠️'} |
| FCP | ${(auditResults.performance.homepage.mobile.metrics?.fcp || 0).toFixed(0)}ms | <1800ms | ${(auditResults.performance.homepage.mobile.metrics?.fcp || 0) < 1800 ? '✅' : '⚠️'} |
| TTFB | ${(auditResults.performance.homepage.mobile.metrics?.ttfb || 0).toFixed(0)}ms | <800ms | ${(auditResults.performance.homepage.mobile.metrics?.ttfb || 0) < 800 ? '✅' : '⚠️'} |

**详细报告**: \`./reports/raw/lighthouse/homepage-mobile.report.html\`
` : '⚠️ 性能测试未执行'}

---

### SEO

#### 基础SEO检查

| 项目 | 状态 | 说明 |
|------|------|------|
| robots.txt | ${auditResults.seo?.robotsTxt ? '✅ 存在' : '❌ 缺失'} | ${auditResults.seo?.robotsTxt ? '文件可访问' : '需要在 public/ 目录创建 robots.txt'} |
| sitemap.xml | ${auditResults.seo?.sitemapXml ? '✅ 存在' : '❌ 缺失'} | ${auditResults.seo?.sitemapXml ? '文件可访问' : '需要生成并部署 sitemap.xml'} |

**问题**:
${auditResults.seo?.issues?.length > 0 ? auditResults.seo.issues.map(i => `- ❌ ${i}`).join('\n') : '- ✅ 无问题'}

---

### Accessibility

⚠️ **可访问性测试未执行**

**建议**: 
- 安装并运行 pa11y: \`npm install -g pa11y && pa11y http://localhost:3000\`
- 或使用 Lighthouse Accessibility 审计

---

### Security Headers

#### 前端安全头检查

**得分**: ${auditResults.security?.frontend?.score || 0}/100

| 安全头 | 状态 | 当前值 |
|--------|------|--------|
| HSTS | ${auditResults.security?.frontend?.missing?.includes('HSTS') ? '❌ 缺失' : '✅ 存在'} | ${auditResults.security?.frontend?.headers?.['strict-transport-security'] || 'N/A'} |
| CSP | ${auditResults.security?.frontend?.missing?.includes('CSP') ? '❌ 缺失' : '✅ 存在'} | ${auditResults.security?.frontend?.headers?.['content-security-policy'] || 'N/A'} |
| X-Content-Type-Options | ${auditResults.security?.frontend?.missing?.includes('X-Content-Type-Options') ? '❌ 缺失' : '✅ 存在'} | ${auditResults.security?.frontend?.headers?.['x-content-type-options'] || 'N/A'} |
| X-Frame-Options | ${auditResults.security?.frontend?.missing?.includes('X-Frame-Options') ? '❌ 缺失' : '✅ 存在'} | ${auditResults.security?.frontend?.headers?.['x-frame-options'] || 'N/A'} |
| Referrer-Policy | ${auditResults.security?.frontend?.missing?.includes('Referrer-Policy') ? '❌ 缺失' : '✅ 存在'} | ${auditResults.security?.frontend?.headers?.['referrer-policy'] || 'N/A'} |
| Permissions-Policy | ${auditResults.security?.frontend?.missing?.includes('Permissions-Policy') ? '❌ 缺失' : '✅ 存在'} | ${auditResults.security?.frontend?.headers?.['permissions-policy'] || 'N/A'} |

#### 后端安全头检查

**得分**: ${auditResults.security?.backend?.score || 0}/100

| 安全头 | 状态 | 当前值 |
|--------|------|--------|
| HSTS | ${auditResults.security?.backend?.missing?.includes('HSTS') ? '❌ 缺失' : '✅ 存在'} | ${auditResults.security?.backend?.headers?.['strict-transport-security'] || 'N/A'} |
| CSP | ${auditResults.security?.backend?.missing?.includes('CSP') ? '❌ 缺失' : '✅ 存在'} | ${auditResults.security?.backend?.headers?.['content-security-policy'] || 'N/A'} |
| X-Content-Type-Options | ${auditResults.security?.backend?.missing?.includes('X-Content-Type-Options') ? '❌ 缺失' : '✅ 存在'} | ${auditResults.security?.backend?.headers?.['x-content-type-options'] || 'N/A'} |
| X-Frame-Options | ${auditResults.security?.backend?.missing?.includes('X-Frame-Options') ? '❌ 缺失' : '✅ 存在'} | ${auditResults.security?.backend?.headers?.['x-frame-options'] || 'N/A'} |
| Referrer-Policy | ${auditResults.security?.backend?.missing?.includes('Referrer-Policy') ? '❌ 缺失' : '✅ 存在'} | ${auditResults.security?.backend?.headers?.['referrer-policy'] || 'N/A'} |
| Permissions-Policy | ${auditResults.security?.backend?.missing?.includes('Permissions-Policy') ? '❌ 缺失' : '✅ 存在'} | ${auditResults.security?.backend?.headers?.['permissions-policy'] || 'N/A'} |

**详细输出**: \`./reports/raw/headers/headers.txt\`

---

### Dependency Vulnerabilities

${auditResults.dependencies?.error ? `
⚠️ **依赖扫描失败**

原因: ${auditResults.dependencies.error}

**建议**: 手动运行以下命令:
\`\`\`bash
cd frontend && npm audit --json > ../reports/raw/deps/frontend-audit.json
cd ../backend && npm audit --json > ../reports/raw/deps/backend-audit.json
\`\`\`
` : `
#### 前端依赖漏洞

| 严重度 | 数量 |
|--------|------|
| 🔴 Critical | ${auditResults.dependencies?.frontend?.critical || 0} |
| 🟡 High | ${auditResults.dependencies?.frontend?.high || 0} |
| 🟢 Moderate | ${auditResults.dependencies?.frontend?.moderate || 0} |
| ⚪ Low | ${auditResults.dependencies?.frontend?.low || 0} |
| **总计** | **${auditResults.dependencies?.frontend?.total || 0}** |

#### 后端依赖漏洞

| 严重度 | 数量 |
|--------|------|
| 🔴 Critical | ${auditResults.dependencies?.backend?.critical || 0} |
| 🟡 High | ${auditResults.dependencies?.backend?.high || 0} |
| 🟢 Moderate | ${auditResults.dependencies?.backend?.moderate || 0} |
| ⚪ Low | ${auditResults.dependencies?.backend?.low || 0} |
| **总计** | **${auditResults.dependencies?.backend?.total || 0}** |

**详细报告**: 
- \`./reports/raw/deps/frontend-audit.json\`
- \`./reports/raw/deps/backend-audit.json\`
`}

---

### Crawl / Broken Links

⚠️ **站点爬取未执行**

**建议**: 
- 使用 broken-link-checker: \`npm install -g broken-link-checker && blc http://localhost:3000 -ro\`
- 或使用自定义爬虫脚本

---

### Reliability Notes

${!auditResults.project?.services?.frontend?.running ? `
⚠️ **前端服务未运行**

- 无法访问 ${auditResults.project?.services?.frontend?.url || 'N/A'}
- 建议: \`cd frontend && npm start\`
` : ''}
${!auditResults.project?.services?.backend?.running ? `
⚠️ **后端服务未运行**

- 无法访问 ${auditResults.project?.services?.backend?.url || 'N/A'}
- 建议: \`cd backend && node server.js\`
` : ''}

---

## Prioritized Issues

### 🔴 P0 - 严重问题 (${p0Issues.length} 个)

${p0Issues.length > 0 ? p0Issues.map((issue, idx) => `
#### ${idx + 1}. ${issue.issue}

- **类别**: ${issue.category}
- **描述**: ${issue.description}
- **修复建议**: ${issue.recommendation}
`).join('\n') : '- ✅ 无严重问题'}

### 🟡 P1 - 高优先级问题 (${p1Issues.length} 个)

${p1Issues.length > 0 ? p1Issues.map((issue, idx) => `
#### ${idx + 1}. ${issue.issue}

- **类别**: ${issue.category}
- **描述**: ${issue.description}
- **修复建议**: ${issue.recommendation}
`).join('\n') : '- ✅ 无高优先级问题'}

### 🟢 P2 - 中优先级问题 (${p2Issues.length} 个)

${p2Issues.length > 0 ? p2Issues.map((issue, idx) => `
#### ${idx + 1}. ${issue.issue}

- **类别**: ${issue.category}
- **描述**: ${issue.description}
- **修复建议**: ${issue.recommendation}
`).join('\n') : '- ✅ 无中优先级问题'}

---

## Recommended Fix Plan

### 🚨 立即修复 (1天内)

${p0Issues.length > 0 ? p0Issues.map(i => `1. **${i.issue}**\n   - ${i.recommendation}`).join('\n\n') : '- ✅ 无需要立即修复的问题'}

### ⚠️ 短期修复 (3天内)

${p1Issues.slice(0, 5).map(i => `1. **${i.issue}**\n   - ${i.recommendation}`).join('\n\n') || '- 无'}

### 📋 中期优化 (7天内)

${p2Issues.map(i => `1. **${i.issue}**\n   - ${i.recommendation}`).join('\n\n') || '- 无'}

---

## Re-test Checklist

### 复测前准备

- [ ] 确保前端服务运行: \`cd frontend && npm start\`
- [ ] 确保后端服务运行: \`cd backend && node server.js\`
- [ ] 检查服务可访问性: \`curl http://localhost:3000\` 和 \`curl http://localhost:5000\`

### 复测命令

\`\`\`bash
# 1. 运行完整审计
node tools/website-audit.js

# 2. 手动运行 Lighthouse (如果自动测试失败)
npx lighthouse http://localhost:3000 --output html --output-path ./reports/raw/lighthouse/homepage.html

# 3. 手动运行依赖扫描
cd frontend && npm audit --json > ../reports/raw/deps/frontend-audit.json
cd ../backend && npm audit --json > ../reports/raw/deps/backend-audit.json

# 4. 检查安全头
curl -I http://localhost:3000 > ./reports/raw/headers/frontend-headers.txt
curl -I http://localhost:5000 > ./reports/raw/headers/backend-headers.txt

# 5. 生成报告
node tools/generate-report.js
\`\`\`

### 验证修复

- [ ] 所有 P0 问题已修复
- [ ] 安全头得分 ≥ 80%
- [ ] 依赖漏洞数量减少
- [ ] SEO 基础检查通过
- [ ] 性能指标达标 (LCP < 2.5s, CLS < 0.1)

---

## Appendix

### 文件清单

- **审计结果**: \`./reports/raw/audit-results.json\`
- **运行时日志**: \`./reports/raw/runtime.log\`
- **安全头检查**: \`./reports/raw/headers/headers.txt\`
- **依赖审计**: \`./reports/raw/deps/*.json\`
- **Lighthouse报告**: \`./reports/raw/lighthouse/*.html\`

### 工具脚本

- **审计脚本**: \`tools/website-audit.js\`
- **报告生成**: \`tools/generate-report.js\`

---

**报告生成时间**: ${new Date().toLocaleString('zh-CN')}  
**下次审计建议**: ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('zh-CN')}

`;

  fs.writeFileSync(REPORT_FILE, report, 'utf8');
  console.log(`✅ 报告已生成: ${REPORT_FILE}`);
}

generateReport();

