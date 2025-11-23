const mysql = require('mysql2/promise');

async function checkReadingLogStructure() {
  try {
    const db = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '123456',
      database: 'kongfuworld'
    });

    console.log('🔍 检查reading_log表结构...');
    const [rows] = await db.execute('DESCRIBE reading_log');
    
    console.log('\n📊 reading_log表结构:');
    console.log('字段名\t\t类型\t\t\t允许NULL\t默认值');
    console.log('─'.repeat(80));
    
    rows.forEach(row => {
      console.log(`${row.Field.padEnd(15)}\t${row.Type.padEnd(20)}\t${row.Null}\t\t${row.Default || 'NULL'}`);
    });

    // 检查是否有时间字段
    const timeFields = rows.filter(row => 
      row.Field.includes('time') || 
      row.Field.includes('enter') || 
      row.Field.includes('exit') ||
      row.Field.includes('duration')
    );

    console.log('\n🕐 时间相关字段:');
    if (timeFields.length > 0) {
      timeFields.forEach(field => {
        console.log(`- ${field.Field}: ${field.Type}`);
      });
    } else {
      console.log('❌ 没有找到时间相关字段！');
    }

    await db.end();
  } catch (error) {
    console.error('❌ 错误:', error.message);
  }
}

checkReadingLogStructure();