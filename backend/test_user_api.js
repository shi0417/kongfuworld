// 测试用户API是否返回正确的points数据
const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function testUserAPI() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    console.log('\n🧪 测试用户API数据\n');
    
    // 1. 直接查询数据库
    console.log('📊 直接查询数据库:');
    const [users] = await db.execute(`
      SELECT id, username, email, avatar, points, golden_karma, settings_json 
      FROM user 
      WHERE id = 1
    `);
    
    if (users.length > 0) {
      const user = users[0];
      console.log(`   用户ID: ${user.id}`);
      console.log(`   用户名: ${user.username}`);
      console.log(`   Points: ${user.points}`);
      console.log(`   Golden Karma: ${user.golden_karma}`);
      console.log(`   Email: ${user.email}`);
    } else {
      console.log('   用户不存在');
    }
    
    // 2. 模拟API响应格式
    console.log('\n📤 模拟API响应格式:');
    let settings_json = null;
    if (users[0].settings_json) {
      if (typeof users[0].settings_json === 'string') {
        try {
          settings_json = JSON.parse(users[0].settings_json);
        } catch (e) {
          console.log('   settings_json解析失败，使用原始值');
          settings_json = users[0].settings_json;
        }
      } else {
        settings_json = users[0].settings_json;
      }
    }
    
    const apiResponse = {
      success: true,
      data: {
        ...users[0],
        settings_json: settings_json
      }
    };
    
    console.log('   API响应:');
    console.log(`   - success: ${apiResponse.success}`);
    console.log(`   - data.points: ${apiResponse.data.points}`);
    console.log(`   - data.golden_karma: ${apiResponse.data.golden_karma}`);
    
    // 3. 检查前端如何解析数据
    console.log('\n🎯 前端解析逻辑:');
    console.log('   前端代码: setUserKeys(userData.data.points || 0)');
    console.log(`   解析结果: ${apiResponse.data.points || 0}`);
    
    if (apiResponse.data.points > 0) {
      console.log('   ✅ 前端应该显示正确的points值');
    } else {
      console.log('   ❌ 前端会显示0，因为points为0或null');
    }
    
    // 4. 建议解决方案
    console.log('\n💡 建议解决方案:');
    console.log('   1. 确保用户有足够的points值');
    console.log('   2. 检查前端是否正确解析API响应');
    console.log('   3. 验证API是否返回正确的数据格式');
    
  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    if (db) await db.end();
  }
}

// 运行测试
testUserAPI();
