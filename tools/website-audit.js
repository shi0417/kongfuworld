/**
 * 网站质量审计脚本
 * 执行性能、SEO、安全、可访问性等全面检查
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const http = require('http');

const REPORTS_DIR = path.join(__dirname, '..', 'reports');
const RAW_DIR = path.join(REPORTS_DIR, 'raw');
const LIGHTHOUSE_DIR = path.join(RAW_DIR, 'lighthouse');
const HEADERS_DIR = path.join(RAW_DIR, 'headers');
const DEPS_DIR = path.join(RAW_DIR, 'deps');
const CRAWL_DIR = path.join(RAW_DIR, 'crawl');
const E2E_DIR = path.join(RAW_DIR, 'e2e');
const A11Y_DIR = path.join(RAW_DIR, 'a11y');

// 配置
const CONFIG = {
  frontendUrl: 'http://localhost:3000',
  backendUrl: 'http://localhost:5000',
  frontendPort: 3000,
  backendPort: 5000,
  timeout: 30000,
};

// 审计结果
const auditResults = {
  project: {},
  performance: {},
  seo: {},
  accessibility: {},
  security: {},
  dependencies: {},
  crawl: {},
  e2e: {},
  issues: [],
  startTime: new Date(),
};

/**
 * 工具函数
 */
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  const logFile = path.join(REPORTS_DIR, 'raw', 'runtime.log');
  fs.appendFileSync(logFile, `[${timestamp}] ${message}\n`);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function checkUrl(url, timeout = 5000) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const req = http.get(url, (res) => {
      resolve({
        status: res.statusCode,
        headers: res.headers,
        time: Date.now() - startTime,
      });
    });
    req.on('error', () => {
      resolve({ status: 0, error: 'Connection failed', time: Date.now() - startTime });
    });
    req.setTimeout(timeout, () => {
      req.destroy();
      resolve({ status: 0, error: 'Timeout', time: timeout });
    });
  });
}

/**
 * 1. 项目结构识别
 */
function identifyProject() {
  log('=== 1. 识别项目结构 ===');
  
  const rootDir = path.join(__dirname, '..');
  const frontendDir = path.join(rootDir, 'frontend');
  const backendDir = path.join(rootDir, 'backend');
  
  // 读取 package.json
  const rootPkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  const frontendPkg = JSON.parse(fs.readFileSync(path.join(frontendDir, 'package.json'), 'utf8'));
  const backendPkg = JSON.parse(fs.readFileSync(path.join(backendDir, 'package.json'), 'utf8'));
  
  auditResults.project = {
    name: rootPkg.name,
    version: rootPkg.version,
    frontend: {
      framework: 'React',
      version: frontendPkg.dependencies.react,
      port: CONFIG.frontendPort,
      buildTool: 'react-scripts',
      typescript: !!frontendPkg.devDependencies.typescript,
    },
    backend: {
      framework: 'Express',
      version: backendPkg.dependencies.express,
      port: CONFIG.backendPort,
      runtime: 'Node.js',
    },
    structure: {
      frontend: frontendDir,
      backend: backendDir,
    },
  };
  
  log(`项目: ${auditResults.project.name}`);
  log(`前端: React ${auditResults.project.frontend.version} (端口 ${auditResults.project.frontend.port})`);
  log(`后端: Express ${auditResults.project.backend.version} (端口 ${auditResults.project.backend.port})`);
  
  return auditResults.project;
}

/**
 * 2. 检查服务是否运行
 */
async function checkServices() {
  log('=== 2. 检查服务状态 ===');
  
  const frontendStatus = await checkUrl(CONFIG.frontendUrl);
  const backendStatus = await checkUrl(CONFIG.backendUrl);
  
  auditResults.project.services = {
    frontend: {
      url: CONFIG.frontendUrl,
      status: frontendStatus.status,
      running: frontendStatus.status === 200,
      responseTime: frontendStatus.time,
    },
    backend: {
      url: CONFIG.backendUrl,
      status: backendStatus.status,
      running: backendStatus.status === 200,
      responseTime: backendStatus.time,
    },
  };
  
  log(`前端服务: ${frontendStatus.status === 200 ? '✅ 运行中' : '❌ 未运行'} (${frontendStatus.time}ms)`);
  log(`后端服务: ${backendStatus.status === 200 ? '✅ 运行中' : '❌ 未运行'} (${backendStatus.time}ms)`);
  
  if (!frontendStatus.status === 200) {
    auditResults.issues.push({
      severity: 'P0',
      category: 'Service',
      issue: '前端服务未运行',
      description: `无法访问 ${CONFIG.frontendUrl}`,
      recommendation: '请启动前端服务: cd frontend && npm start',
    });
  }
  
  return auditResults.project.services;
}

/**
 * 3. 依赖漏洞扫描
 */
function scanDependencies() {
  log('=== 3. 扫描依赖漏洞 ===');
  
  try {
    // 扫描前端依赖
    log('扫描前端依赖...');
    const frontendDir = path.join(__dirname, '..', 'frontend');
    const frontendAudit = execSync('npm audit --json', { 
      encoding: 'utf8', 
      timeout: 60000,
      cwd: frontendDir 
    });
    const frontendAuditData = JSON.parse(frontendAudit);
    
    // 扫描后端依赖
    log('扫描后端依赖...');
    const backendDir = path.join(__dirname, '..', 'backend');
    const backendAudit = execSync('npm audit --json', { 
      encoding: 'utf8', 
      timeout: 60000,
      cwd: backendDir 
    });
    const backendAuditData = JSON.parse(backendAudit);
    
    // 保存原始数据
    fs.writeFileSync(
      path.join(DEPS_DIR, 'frontend-audit.json'),
      JSON.stringify(frontendAuditData, null, 2)
    );
    fs.writeFileSync(
      path.join(DEPS_DIR, 'backend-audit.json'),
      JSON.stringify(backendAuditData, null, 2)
    );
    
    // 统计漏洞
    const frontendVulns = frontendAuditData.metadata?.vulnerabilities || {};
    const backendVulns = backendAuditData.metadata?.vulnerabilities || {};
    
    auditResults.dependencies = {
      frontend: {
        critical: frontendVulns.critical || 0,
        high: frontendVulns.high || 0,
        moderate: frontendVulns.moderate || 0,
        low: frontendVulns.low || 0,
        info: frontendVulns.info || 0,
        total: Object.values(frontendVulns).reduce((a, b) => a + b, 0),
      },
      backend: {
        critical: backendVulns.critical || 0,
        high: backendVulns.high || 0,
        moderate: backendVulns.moderate || 0,
        low: backendVulns.low || 0,
        info: backendVulns.info || 0,
        total: Object.values(backendVulns).reduce((a, b) => a + b, 0),
      },
    };
    
    log(`前端漏洞: 严重 ${auditResults.dependencies.frontend.critical}, 高危 ${auditResults.dependencies.frontend.high}`);
    log(`后端漏洞: 严重 ${auditResults.dependencies.backend.critical}, 高危 ${auditResults.dependencies.backend.high}`);
    
    // 提取高危漏洞
    if (frontendAuditData.vulnerabilities) {
      Object.entries(frontendAuditData.vulnerabilities).forEach(([name, vuln]) => {
        if (vuln.severity === 'critical' || vuln.severity === 'high') {
          auditResults.issues.push({
            severity: vuln.severity === 'critical' ? 'P0' : 'P1',
            category: 'Dependency',
            issue: `前端依赖漏洞: ${name}`,
            description: vuln.title || name,
            recommendation: `升级到安全版本: ${vuln.fixAvailable?.version || '检查更新'}`,
          });
        }
      });
    }
    
    if (backendAuditData.vulnerabilities) {
      Object.entries(backendAuditData.vulnerabilities).forEach(([name, vuln]) => {
        if (vuln.severity === 'critical' || vuln.severity === 'high') {
          auditResults.issues.push({
            severity: vuln.severity === 'critical' ? 'P0' : 'P1',
            category: 'Dependency',
            issue: `后端依赖漏洞: ${name}`,
            description: vuln.title || name,
            recommendation: `升级到安全版本: ${vuln.fixAvailable?.version || '检查更新'}`,
          });
        }
      });
    }
    
  } catch (error) {
    log(`依赖扫描失败: ${error.message}`);
    auditResults.dependencies.error = error.message;
    
    // 尝试读取已保存的审计文件
    try {
      const frontendAuditPath = path.join(DEPS_DIR, 'frontend-audit.json');
      const backendAuditPath = path.join(DEPS_DIR, 'backend-audit.json');
      
      if (fs.existsSync(frontendAuditPath)) {
        const content = fs.readFileSync(frontendAuditPath, 'utf8');
        if (content && !content.includes('npm ERR')) {
          const frontendAuditData = JSON.parse(content);
          const frontendVulns = frontendAuditData.metadata?.vulnerabilities || {};
          auditResults.dependencies.frontend = {
            critical: frontendVulns.critical || 0,
            high: frontendVulns.high || 0,
            moderate: frontendVulns.moderate || 0,
            low: frontendVulns.low || 0,
            info: frontendVulns.info || 0,
            total: Object.values(frontendVulns).reduce((a, b) => a + b, 0),
          };
          
          // 提取高危漏洞
          if (frontendAuditData.vulnerabilities) {
            Object.entries(frontendAuditData.vulnerabilities).forEach(([name, vuln]) => {
              if (vuln.severity === 'critical' || vuln.severity === 'high') {
                auditResults.issues.push({
                  severity: vuln.severity === 'critical' ? 'P0' : 'P1',
                  category: 'Dependency',
                  issue: `前端依赖漏洞: ${name}`,
                  description: vuln.title || name,
                  recommendation: `升级到安全版本: ${vuln.fixAvailable?.version || '检查更新'}`,
                });
              }
            });
          }
        }
      }
      
      if (fs.existsSync(backendAuditPath)) {
        const content = fs.readFileSync(backendAuditPath, 'utf8');
        if (content && !content.includes('npm ERR')) {
          const backendAuditData = JSON.parse(content);
          const backendVulns = backendAuditData.metadata?.vulnerabilities || {};
          auditResults.dependencies.backend = {
            critical: backendVulns.critical || 0,
            high: backendVulns.high || 0,
            moderate: backendVulns.moderate || 0,
            low: backendVulns.low || 0,
            info: backendVulns.info || 0,
            total: Object.values(backendVulns).reduce((a, b) => a + b, 0),
          };
          
          // 提取高危漏洞
          if (backendAuditData.vulnerabilities) {
            Object.entries(backendAuditData.vulnerabilities).forEach(([name, vuln]) => {
              if (vuln.severity === 'critical' || vuln.severity === 'high') {
                auditResults.issues.push({
                  severity: vuln.severity === 'critical' ? 'P0' : 'P1',
                  category: 'Dependency',
                  issue: `后端依赖漏洞: ${name}`,
                  description: vuln.title || name,
                  recommendation: `升级到安全版本: ${vuln.fixAvailable?.version || '检查更新'}`,
                });
              }
            });
          }
        }
      }
    } catch (readError) {
      log(`读取已保存的审计文件失败: ${readError.message}`);
    }
  }
}

/**
 * 4. 安全头检查
 */
async function checkSecurityHeaders() {
  log('=== 4. 检查安全头 ===');
  
  const frontendHeaders = await checkUrl(CONFIG.frontendUrl);
  const backendHeaders = await checkUrl(CONFIG.backendUrl);
  
  const securityHeaders = {
    'Strict-Transport-Security': 'HSTS',
    'Content-Security-Policy': 'CSP',
    'X-Content-Type-Options': 'X-Content-Type-Options',
    'X-Frame-Options': 'X-Frame-Options',
    'Referrer-Policy': 'Referrer-Policy',
    'Permissions-Policy': 'Permissions-Policy',
  };
  
  const frontendMissing = [];
  const backendMissing = [];
  
  Object.entries(securityHeaders).forEach(([header, name]) => {
    if (!frontendHeaders.headers[header.toLowerCase()]) {
      frontendMissing.push(name);
    }
    if (!backendHeaders.headers[header.toLowerCase()]) {
      backendMissing.push(name);
    }
  });
  
  auditResults.security = {
    frontend: {
      headers: frontendHeaders.headers,
      missing: frontendMissing,
      score: ((Object.keys(securityHeaders).length - frontendMissing.length) / Object.keys(securityHeaders).length * 100).toFixed(0),
    },
    backend: {
      headers: backendHeaders.headers,
      missing: backendMissing,
      score: ((Object.keys(securityHeaders).length - backendMissing.length) / Object.keys(securityHeaders).length * 100).toFixed(0),
    },
  };
  
  // 保存头部信息
  fs.writeFileSync(
    path.join(HEADERS_DIR, 'headers.txt'),
    `前端安全头检查 (${CONFIG.frontendUrl}):\n` +
    `缺失: ${frontendMissing.join(', ') || '无'}\n` +
    `得分: ${auditResults.security.frontend.score}%\n\n` +
    `后端安全头检查 (${CONFIG.backendUrl}):\n` +
    `缺失: ${backendMissing.join(', ') || '无'}\n` +
    `得分: ${auditResults.security.backend.score}%\n\n` +
    `详细头部信息:\n` +
    JSON.stringify({ frontend: frontendHeaders.headers, backend: backendHeaders.headers }, null, 2)
  );
  
  log(`前端安全头得分: ${auditResults.security.frontend.score}%`);
  log(`后端安全头得分: ${auditResults.security.backend.score}%`);
  
  // 记录缺失的安全头
  frontendMissing.forEach(header => {
    auditResults.issues.push({
      severity: 'P1',
      category: 'Security',
      issue: `前端缺失安全头: ${header}`,
      description: `前端响应中缺少 ${header} 安全头`,
      recommendation: `在 Express 中间件或 Web 服务器配置中添加 ${header}`,
    });
  });
}

/**
 * 5. SEO 基础检查
 */
async function checkSEO() {
  log('=== 5. SEO 基础检查 ===');
  
  const seoIssues = [];
  
  // 检查 robots.txt
  const robotsUrl = `${CONFIG.frontendUrl}/robots.txt`;
  const robotsStatus = await checkUrl(robotsUrl);
  if (robotsStatus.status !== 200) {
    seoIssues.push('缺少 robots.txt');
    auditResults.issues.push({
      severity: 'P2',
      category: 'SEO',
      issue: '缺少 robots.txt',
      description: '网站根目录缺少 robots.txt 文件',
      recommendation: '在 public/ 目录创建 robots.txt 文件',
    });
  }
  
  // 检查 sitemap.xml
  const sitemapUrl = `${CONFIG.frontendUrl}/sitemap.xml`;
  const sitemapStatus = await checkUrl(sitemapUrl);
  if (sitemapStatus.status !== 200) {
    seoIssues.push('缺少 sitemap.xml');
    auditResults.issues.push({
      severity: 'P2',
      category: 'SEO',
      issue: '缺少 sitemap.xml',
      description: '网站根目录缺少 sitemap.xml 文件',
      recommendation: '生成并部署 sitemap.xml 文件',
    });
  }
  
  auditResults.seo = {
    robotsTxt: robotsStatus.status === 200,
    sitemapXml: sitemapStatus.status === 200,
    issues: seoIssues,
  };
  
  log(`robots.txt: ${robotsStatus.status === 200 ? '✅' : '❌'}`);
  log(`sitemap.xml: ${sitemapStatus.status === 200 ? '✅' : '❌'}`);
}

/**
 * 6. Lighthouse 性能测试（需要安装 lighthouse）
 */
async function runLighthouse() {
  log('=== 6. Lighthouse 性能测试 ===');
  
  try {
    // 检查是否安装了 lighthouse
    execSync('npx lighthouse --version', { stdio: 'ignore' });
    
    const pages = [
      { name: 'homepage', url: CONFIG.frontendUrl },
      { name: 'series', url: `${CONFIG.frontendUrl}/series` },
    ];
    
    for (const page of pages) {
      log(`测试页面: ${page.name} (${page.url})`);
      
      try {
        // 运行 Lighthouse（移动端）
        const lighthouseCmd = `npx lighthouse ${page.url} --output html --output json --output-path ${path.join(LIGHTHOUSE_DIR, `${page.name}-mobile`)} --chrome-flags="--headless" --only-categories=performance,accessibility,best-practices,seo --emulated-form-factor=mobile --throttling-method=simulate`;
        execSync(lighthouseCmd, { timeout: 120000, stdio: 'pipe' });
        
        // 读取结果
        const jsonPath = path.join(LIGHTHOUSE_DIR, `${page.name}-mobile.report.json`);
        if (fs.existsSync(jsonPath)) {
          const report = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
          auditResults.performance[page.name] = {
            mobile: {
              performance: report.categories?.performance?.score * 100 || 0,
              accessibility: report.categories?.accessibility?.score * 100 || 0,
              bestPractices: report.categories?.['best-practices']?.score * 100 || 0,
              seo: report.categories?.seo?.score * 100 || 0,
              metrics: {
                lcp: report.audits?.['largest-contentful-paint']?.numericValue || 0,
                fid: report.audits?.['max-potential-fid']?.numericValue || 0,
                cls: report.audits?.['cumulative-layout-shift']?.numericValue || 0,
                fcp: report.audits?.['first-contentful-paint']?.numericValue || 0,
                ttfb: report.audits?.['server-response-time']?.numericValue || 0,
              },
            },
          };
        }
      } catch (error) {
        log(`Lighthouse 测试失败 (${page.name}): ${error.message}`);
      }
    }
    
  } catch (error) {
    log(`Lighthouse 未安装或无法运行: ${error.message}`);
    log('提示: 运行 npm install -g lighthouse 或使用 npx lighthouse');
    auditResults.performance.error = 'Lighthouse 未安装';
  }
}

/**
 * 主函数
 */
async function main() {
  log('开始网站质量审计...');
  log(`报告目录: ${REPORTS_DIR}`);
  
  ensureDir(REPORTS_DIR);
  ensureDir(RAW_DIR);
  ensureDir(LIGHTHOUSE_DIR);
  ensureDir(HEADERS_DIR);
  ensureDir(DEPS_DIR);
  ensureDir(CRAWL_DIR);
  ensureDir(E2E_DIR);
  ensureDir(A11Y_DIR);
  
  // 执行各项检查
  identifyProject();
  await checkServices();
  scanDependencies();
  await checkSecurityHeaders();
  await checkSEO();
  await runLighthouse();
  
  // 保存审计结果
  auditResults.endTime = new Date();
  auditResults.duration = auditResults.endTime - auditResults.startTime;
  
  fs.writeFileSync(
    path.join(RAW_DIR, 'audit-results.json'),
    JSON.stringify(auditResults, null, 2)
  );
  
  log('审计完成！');
  log(`共发现 ${auditResults.issues.length} 个问题`);
  log(`结果已保存到: ${path.join(RAW_DIR, 'audit-results.json')}`);
  
  return auditResults;
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, auditResults };

