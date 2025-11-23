// 测试签到逻辑
const mysql = require('mysql2');

// 数据库连接配置
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld',
  charset: 'utf8mb4'
});

async function testCheckinLogic() {
  try {
    console.log('🧪 测试签到逻辑...\n');
    
    // 1. 查看用户1的当前状态
    console.log('1. 查看用户1的当前状态:');
    const user1 = await new Promise((resolve, reject) => {
      db.query('SELECT id, points FROM user WHERE id = 1', (err, results) => {
        if (err) reject(err);
        else resolve(results[0]);
      });
    });
    console.log(`   用户1当前钥匙数: ${user1.points}`);
    
    // 2. 查看用户1的签到记录
    console.log('\n2. 查看用户1的签到记录:');
    const checkins = await new Promise((resolve, reject) => {
      db.query(`
        SELECT 
          id, 
          checkin_date, 
          keys_earned, 
          total_keys,
          streak_days,
          created_at
        FROM daily_checkin 
        WHERE user_id = 1 
        ORDER BY checkin_date DESC 
        LIMIT 5
      `, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    console.table(checkins);
    
    // 3. 验证数据一致性
    console.log('\n3. 验证数据一致性:');
    const lastCheckin = checkins[0];
    const userPoints = user1.points;
    const checkinTotalKeys = lastCheckin.total_keys;
    
    console.log(`   用户表中的points: ${userPoints}`);
    console.log(`   最后一条签到记录的total_keys: ${checkinTotalKeys}`);
    
    if (userPoints === checkinTotalKeys) {
      console.log('   ✅ 数据一致！');
    } else {
      console.log('   ❌ 数据不一致！');
    }
    
    // 4. 测试签到API
    console.log('\n4. 测试签到API:');
    const checkinAPI = require('./daily_checkin_api');
    
    // 模拟签到（注意：这会实际执行签到）
    console.log('   注意：以下测试会实际执行签到操作');
    console.log('   如果要测试，请取消下面的注释');
    
    /*
    const result = await checkinAPI.performCheckin(1);
    console.log('   签到结果:', result);
    */
    
    console.log('\n✅ 测试完成！');
    
  } catch (error) {
    console.error('测试过程中出错:', error);
  } finally {
    db.end();
  }
}

// 开始测试
testCheckinLogic();
