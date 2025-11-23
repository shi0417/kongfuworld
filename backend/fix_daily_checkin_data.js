// 修复daily_checkin表中的total_keys数据
const mysql = require('mysql2');

// 数据库连接配置
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld',
  charset: 'utf8mb4'
});

async function fixDailyCheckinData() {
  try {
    console.log('开始修复daily_checkin表中的total_keys数据...\n');
    
    // 1. 获取所有用户
    const users = await new Promise((resolve, reject) => {
      db.query('SELECT id, points FROM user', (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    console.log(`找到 ${users.length} 个用户`);
    
    for (const user of users) {
      console.log(`\n处理用户 ${user.id}，当前钥匙数: ${user.points}`);
      
      // 2. 获取该用户的所有签到记录，按日期排序
      const checkins = await new Promise((resolve, reject) => {
        db.query(
          'SELECT * FROM daily_checkin WHERE user_id = ? ORDER BY checkin_date ASC',
          [user.id],
          (err, results) => {
            if (err) reject(err);
            else resolve(results);
          }
        );
      });
      
      if (checkins.length === 0) {
        console.log(`用户 ${user.id} 没有签到记录，跳过`);
        continue;
      }
      
      console.log(`用户 ${user.id} 有 ${checkins.length} 条签到记录`);
      
      // 3. 重新计算每条记录的total_keys
      let runningTotal = 0;
      
      for (let i = 0; i < checkins.length; i++) {
        const checkin = checkins[i];
        runningTotal += checkin.keys_earned;
        
        // 更新total_keys字段
        await new Promise((resolve, reject) => {
          db.query(
            'UPDATE daily_checkin SET total_keys = ? WHERE id = ?',
            [runningTotal, checkin.id],
            (err, result) => {
              if (err) reject(err);
              else resolve(result);
            }
          );
        });
        
        console.log(`  记录 ${checkin.id}: ${checkin.checkin_date}, 获得 ${checkin.keys_earned} 钥匙, 累计 ${runningTotal} 钥匙`);
      }
      
      // 4. 验证用户表中的points是否与最后一条记录的total_keys一致
      const lastCheckin = checkins[checkins.length - 1];
      const expectedPoints = lastCheckin.keys_earned + (checkins.length > 1 ? checkins[checkins.length - 2].total_keys : 0);
      
      if (user.points !== runningTotal) {
        console.log(`⚠️  用户 ${user.id} 的points (${user.points}) 与计算的总钥匙数 (${runningTotal}) 不一致`);
        console.log(`   建议手动调整用户表中的points字段`);
      } else {
        console.log(`✅ 用户 ${user.id} 的数据一致`);
      }
    }
    
    console.log('\n✅ 数据修复完成！');
    
    // 5. 显示修复后的数据统计
    console.log('\n修复后的数据统计:');
    const stats = await new Promise((resolve, reject) => {
      db.query(`
        SELECT 
          user_id,
          COUNT(*) as checkin_count,
          SUM(keys_earned) as total_keys_earned,
          MAX(total_keys) as max_total_keys,
          MAX(checkin_date) as last_checkin_date
        FROM daily_checkin 
        GROUP BY user_id 
        ORDER BY user_id
      `, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    console.table(stats);
    
  } catch (error) {
    console.error('修复数据时出错:', error);
  } finally {
    db.end();
  }
}

// 开始修复数据
fixDailyCheckinData();
