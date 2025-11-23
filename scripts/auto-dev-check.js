// 自动开发检查脚本
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 开始自动开发检查...\n');

// 检查项目结构
function checkProjectStructure() {
  console.log('📁 检查项目结构...');
  
  const requiredDirs = [
    'frontend/src',
    'backend',
    'scripts'
  ];
  
  const requiredFiles = [
    'package.json',
    'frontend/package.json',
    'backend/package.json'
  ];
  
  let allGood = true;
  
  requiredDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      console.log(`❌ 缺少目录: ${dir}`);
      allGood = false;
          } else {
      console.log(`✅ 目录存在: ${dir}`);
    }
  });
  
  requiredFiles.forEach(file => {
    if (!fs.existsSync(file)) {
      console.log(`❌ 缺少文件: ${file}`);
      allGood = false;
    } else {
      console.log(`✅ 文件存在: ${file}`);
    }
  });
  
  return allGood;
}

// 检查认证服务
function checkAuthService() {
  console.log('\n🔐 检查认证服务...');
  
  const authServicePath = 'frontend/src/services/AuthService.ts';
  const apiServicePath = 'frontend/src/services/ApiService.ts';
  const useAuthPath = 'frontend/src/hooks/useAuth.ts';
  
  const authFiles = [authServicePath, apiServicePath, useAuthPath];
  let allGood = true;
  
  authFiles.forEach(file => {
    if (!fs.existsSync(file)) {
      console.log(`❌ 缺少认证文件: ${file}`);
      allGood = false;
    } else {
      console.log(`✅ 认证文件存在: ${file}`);
    }
  });
  
  return allGood;
}

// 检查认证系统开发规范
function checkAuthStandards() {
  console.log('\n📋 检查认证系统开发规范...');
  
  try {
    const { runAuthStandardsCheck } = require('./auth-standards-check.js');
    const result = runAuthStandardsCheck();
    
    if (result) {
      console.log('✅ 认证系统开发规范检查通过');
      return true;
    } else {
      console.log('❌ 认证系统开发规范检查失败');
      return false;
    }
  } catch (error) {
    console.log('⚠️ 认证系统开发规范检查脚本执行失败:', error.message);
    return false;
  }
}

// 检查数据库字段
function checkDatabaseFields() {
  console.log('\n🗄️ 检查数据库字段...');
  
  const checkindayScript = 'backend/add_checkinday_field.js';
  const optimizedCheckin = 'backend/optimized_checkin_api.js';
  
  const dbFiles = [checkindayScript, optimizedCheckin];
  let allGood = true;
  
  dbFiles.forEach(file => {
    if (!fs.existsSync(file)) {
      console.log(`❌ 缺少数据库文件: ${file}`);
      allGood = false;
    } else {
      console.log(`✅ 数据库文件存在: ${file}`);
    }
  });
  
  return allGood;
}

// 检查前端组件
function checkFrontendComponents() {
  console.log('\n⚛️ 检查前端组件...');
  
  const optimizedComponent = 'frontend/src/components/UserCenter/DailyRewardsOptimized.tsx';
  
  if (!fs.existsSync(optimizedComponent)) {
    console.log(`❌ 缺少优化组件: ${optimizedComponent}`);
    return false;
  } else {
    console.log(`✅ 优化组件存在: ${optimizedComponent}`);
    return true;
  }
}

// 运行数据库字段添加脚本
function runDatabaseSetup() {
  console.log('\n🔧 运行数据库设置...');
  
  try {
    const checkindayScript = path.join(__dirname, '../backend/add_checkinday_field.js');
    if (fs.existsSync(checkindayScript)) {
      console.log('📊 添加checkinday字段...');
      execSync(`node ${checkindayScript}`, { stdio: 'inherit' });
      console.log('✅ checkinday字段添加完成');
    } else {
      console.log('⚠️ checkinday脚本不存在，跳过数据库设置');
    }
  } catch (error) {
    console.log('⚠️ 数据库设置失败，请手动运行:', error.message);
  }
}

// 检查依赖
function checkDependencies() {
  console.log('\n📦 检查依赖...');
  
  try {
    // 检查前端依赖
    if (fs.existsSync('frontend/package.json')) {
      console.log('📱 检查前端依赖...');
      execSync('cd frontend && npm list --depth=0', { stdio: 'pipe' });
      console.log('✅ 前端依赖正常');
    }
    
    // 检查后端依赖
    if (fs.existsSync('backend/package.json')) {
      console.log('🔧 检查后端依赖...');
      execSync('cd backend && npm list --depth=0', { stdio: 'pipe' });
      console.log('✅ 后端依赖正常');
    }
  } catch (error) {
    console.log('⚠️ 依赖检查失败，请运行 npm install');
  }
}

// 主检查函数
function runAutoCheck() {
  console.log('🎯 开始自动开发检查...\n');
  
  const checks = [
    { name: '项目结构', fn: checkProjectStructure },
    { name: '认证服务', fn: checkAuthService },
    { name: '认证规范', fn: checkAuthStandards },
    { name: '数据库字段', fn: checkDatabaseFields },
    { name: '前端组件', fn: checkFrontendComponents }
  ];
  
  let allPassed = true;
  
  checks.forEach(check => {
    const result = check.fn();
    if (!result) {
      allPassed = false;
    }
  });
  
  // 运行数据库设置
  runDatabaseSetup();
  
  // 检查依赖
  checkDependencies();
  
  console.log('\n📋 检查结果总结:');
  if (allPassed) {
    console.log('✅ 所有检查通过！可以开始开发');
    console.log('\n🚀 开发建议:');
    console.log('1. 使用新的认证服务: import AuthService from "./services/AuthService"');
    console.log('2. 使用统一的API调用: import ApiService from "./services/ApiService"');
    console.log('3. 使用认证Hook: import { useAuth, useCheckin } from "./hooks/useAuth"');
    console.log('4. 签到检查现在使用checkinday字段，性能更好');
  } else {
    console.log('❌ 部分检查失败，请修复后再开始开发');
  }
  
  return allPassed;
}

// 如果直接运行此脚本
if (require.main === module) {
  runAutoCheck();
}

module.exports = { runAutoCheck };