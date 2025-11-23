// 认证系统开发规范检查脚本
const fs = require('fs');
const path = require('path');

console.log('🔐 开始认证系统开发规范检查...\n');

// 检查禁止的模式
function checkForbiddenPatterns() {
  console.log('🚫 检查禁止的认证模式...');
  
  const forbiddenPatterns = [
    {
      pattern: /localStorage\.getItem\('user'\)/g,
      message: '❌ 发现直接访问localStorage user，应使用AuthService.getCurrentUser()'
    },
    {
      pattern: /localStorage\.getItem\('token'\)/g,
      message: '❌ 发现直接访问localStorage token，应使用AuthService.getAuthState().token'
    },
    {
      pattern: /JSON\.parse\(localStorage\.getItem\('user'\)\)/g,
      message: '❌ 发现直接解析localStorage user，应使用AuthService.getCurrentUser()'
    },
    {
      pattern: /const getCurrentUserId = \(\) =>/g,
      message: '❌ 发现自定义getCurrentUserId函数，应使用AuthService.getCurrentUserId()'
    },
    {
      pattern: /fetch\(['"`]http:\/\/localhost:5000\/api/g,
      message: '❌ 发现直接fetch API调用，应使用ApiService方法'
    },
    {
      pattern: /Authorization.*Bearer/g,
      message: '❌ 发现手动设置Authorization头，应使用ApiService自动处理'
    },
    {
      pattern: /SELECT \* FROM daily_checkin WHERE user_id.*checkin_date/g,
      message: '❌ 发现低效的签到检查，应使用user.checkinday字段'
    }
  ];
  
  let violations = 0;
  
  // 扫描前端文件
  const frontendFiles = getAllFiles('frontend/src', ['.ts', '.tsx', '.js', '.jsx']);
  
  frontendFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    
    // 排除核心服务文件的内部实现
    const isApiService = file.includes('ApiService.ts');
    const isAuthService = file.includes('AuthService.ts');
    
    forbiddenPatterns.forEach(({ pattern, message }) => {
      const matches = content.match(pattern);
      if (matches) {
        // 排除ApiService中的Authorization头设置（这是必要的内部实现）
        if (isApiService && pattern.source.includes('Authorization')) {
          return;
        }
        
        // 排除AuthService中的localStorage访问和fetch调用（这是必要的内部实现）
        if (isAuthService && (
          pattern.source.includes('localStorage') || 
          pattern.source.includes('fetch')
        )) {
          return;
        }
        
        console.log(`${message}`);
        console.log(`   文件: ${file}`);
        console.log(`   匹配: ${matches[0]}`);
        violations++;
      }
    });
  });
  
  // 扫描后端文件
  const backendFiles = getAllFiles('backend', ['.js']);
  
  backendFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    
    // 排除已经使用user.checkinday优化的文件和修复脚本
    const isOptimizedFile = file.includes('daily_checkin_api.js') || 
                           file.includes('daily_checkin_with_mission.js') ||
                           file.includes('fix_daily_checkin_data.js') ||
                           file.includes('optimized_checkin_api.js');
    
    // 检查后端特定的禁止模式
    const backendForbiddenPatterns = [
      {
        pattern: /SELECT \* FROM daily_checkin WHERE user_id.*checkin_date/g,
        message: '❌ 发现低效的签到检查，应使用user.checkinday字段'
      }
    ];
    
    backendForbiddenPatterns.forEach(({ pattern, message }) => {
      const matches = content.match(pattern);
      if (matches) {
        // 排除已经使用user.checkinday优化的文件（这些查询是在优化检查后的必要查询）
        if (isOptimizedFile) {
          return;
        }
        
        console.log(`${message}`);
        console.log(`   文件: ${file}`);
        console.log(`   匹配: ${matches[0]}`);
        violations++;
      }
    });
  });
  
  return violations;
}

// 检查正确的模式
function checkCorrectPatterns() {
  console.log('\n✅ 检查正确的认证模式...');
  
  const correctPatterns = [
    {
      pattern: /import.*AuthService/g,
      message: '✅ 发现AuthService导入'
    },
    {
      pattern: /import.*ApiService/g,
      message: '✅ 发现ApiService导入'
    },
    {
      pattern: /useAuth\(\)/g,
      message: '✅ 发现useAuth Hook使用'
    },
    {
      pattern: /useUser\(\)/g,
      message: '✅ 发现useUser Hook使用'
    },
    {
      pattern: /useCheckin\(\)/g,
      message: '✅ 发现useCheckin Hook使用'
    },
    {
      pattern: /ApiService\./g,
      message: '✅ 发现ApiService方法调用'
    },
    {
      pattern: /AuthService\./g,
      message: '✅ 发现AuthService方法调用'
    },
    {
      pattern: /SELECT checkinday FROM user WHERE id/g,
      message: '✅ 发现优化的签到检查'
    }
  ];
  
  let correctUsages = 0;
  
  // 扫描前端文件
  const frontendFiles = getAllFiles('frontend/src', ['.ts', '.tsx', '.js', '.jsx']);
  
  frontendFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    
    correctPatterns.forEach(({ pattern, message }) => {
      const matches = content.match(pattern);
      if (matches) {
        console.log(`${message}`);
        console.log(`   文件: ${file}`);
        correctUsages++;
      }
    });
  });
  
  // 扫描后端文件
  const backendFiles = getAllFiles('backend', ['.js']);
  
  backendFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    
    // 检查后端特定的正确模式
    const backendCorrectPatterns = [
      {
        pattern: /SELECT checkinday FROM user WHERE id/g,
        message: '✅ 发现优化的签到检查'
      }
    ];
    
    backendCorrectPatterns.forEach(({ pattern, message }) => {
      const matches = content.match(pattern);
      if (matches) {
        console.log(`${message}`);
        console.log(`   文件: ${file}`);
        correctUsages++;
      }
    });
  });
  
  return correctUsages;
}

// 检查认证服务文件是否存在
function checkAuthServiceFiles() {
  console.log('\n📁 检查认证服务文件...');
  
  const requiredFiles = [
    'frontend/src/services/AuthService.ts',
    'frontend/src/services/ApiService.ts',
    'frontend/src/hooks/useAuth.ts'
  ];
  
  let missingFiles = 0;
  
  requiredFiles.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(`✅ 文件存在: ${file}`);
    } else {
      console.log(`❌ 文件缺失: ${file}`);
      missingFiles++;
    }
  });
  
  return missingFiles;
}

// 检查数据库字段
function checkDatabaseFields() {
  console.log('\n🗄️ 检查数据库字段...');
  
  const checkindayScript = 'backend/add_checkinday_field.js';
  const optimizedCheckin = 'backend/optimized_checkin_api.js';
  
  let missingFiles = 0;
  
  if (fs.existsSync(checkindayScript)) {
    console.log(`✅ 数据库升级脚本存在: ${checkindayScript}`);
  } else {
    console.log(`❌ 数据库升级脚本缺失: ${checkindayScript}`);
    missingFiles++;
  }
  
  if (fs.existsSync(optimizedCheckin)) {
    console.log(`✅ 优化签到API存在: ${optimizedCheckin}`);
  } else {
    console.log(`❌ 优化签到API缺失: ${optimizedCheckin}`);
    missingFiles++;
  }
  
  return missingFiles;
}

// 获取所有文件
function getAllFiles(dir, extensions) {
  let files = [];
  
  if (!fs.existsSync(dir)) {
    return files;
  }
  
  const items = fs.readdirSync(dir);
  
  items.forEach(item => {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      files = files.concat(getAllFiles(fullPath, extensions));
    } else if (stat.isFile()) {
      const ext = path.extname(item);
      if (extensions.includes(ext)) {
        files.push(fullPath);
      }
    }
  });
  
  return files;
}

// 主检查函数
function runAuthStandardsCheck() {
  console.log('🎯 开始认证系统开发规范检查...\n');
  
  const violations = checkForbiddenPatterns();
  const correctUsages = checkCorrectPatterns();
  const missingAuthFiles = checkAuthServiceFiles();
  const missingDbFiles = checkDatabaseFields();
  
  console.log('\n📊 检查结果总结:');
  console.log(`🚫 违规模式: ${violations}`);
  console.log(`✅ 正确使用: ${correctUsages}`);
  console.log(`📁 缺失认证文件: ${missingAuthFiles}`);
  console.log(`🗄️ 缺失数据库文件: ${missingDbFiles}`);
  
  if (violations === 0 && missingAuthFiles === 0 && missingDbFiles === 0) {
    console.log('\n🎉 认证系统开发规范检查通过！');
    console.log('✅ 所有文件都遵循了认证系统开发规范');
    console.log('✅ 没有发现禁止的认证模式');
    console.log('✅ 认证服务文件完整');
    console.log('✅ 数据库优化文件完整');
  } else {
    console.log('\n⚠️ 认证系统开发规范检查发现问题！');
    if (violations > 0) {
      console.log(`❌ 发现 ${violations} 个违规模式，请修复后重新检查`);
    }
    if (missingAuthFiles > 0) {
      console.log(`❌ 缺失 ${missingAuthFiles} 个认证服务文件，请创建后重新检查`);
    }
    if (missingDbFiles > 0) {
      console.log(`❌ 缺失 ${missingDbFiles} 个数据库文件，请创建后重新检查`);
    }
  }
  
  return violations === 0 && missingAuthFiles === 0 && missingDbFiles === 0;
}

// 如果直接运行此脚本
if (require.main === module) {
  runAuthStandardsCheck();
}

module.exports = { runAuthStandardsCheck };
