const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').join(__dirname, 'kongfuworld.env') });

// 需要检查的类型列表（英文名称 -> 中文描述）
const requiredGenres = {
  'Cheat Systems': '作弊系统',
  'Comedy': '喜剧小说',
  'Cultivation': '修仙小说',
  'Fantasy': '奇幻小说',
  'LitRPG': '游戏小说',
  'Mystery': '悬疑小说',
  'Romance': '言情小说',
  'Sci-fi': '科幻小说',
  'Slice of Life': '日常小说',
  'Sports': '体育小说',
  'Thriller': '惊悚小说'
};

async function checkAndInsertGenres() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'wuxiaworld'
    });

    console.log('✅ 已连接到数据库\n');

    // 1. 查询现有的类型
    console.log('📊 查询现有的小说类型...');
    const [existingGenres] = await connection.execute(
      'SELECT id, name, chinese_name FROM genre'
    );

    console.log(`\n现有类型 (${existingGenres.length} 个):`);
    existingGenres.forEach(genre => {
      console.log(`  - ${genre.name} (ID: ${genre.id}, 中文名: ${genre.chinese_name || '无'})`);
    });

    // 2. 找出缺失的类型
    const existingNames = existingGenres.map(g => g.name);
    const missingGenres = Object.keys(requiredGenres).filter(
      name => !existingNames.includes(name)
    );

    console.log(`\n🔍 缺失的类型 (${missingGenres.length} 个):`);
    missingGenres.forEach(name => {
      console.log(`  - ${name} (中文: ${requiredGenres[name]})`);
    });

    // 3. 插入缺失的类型
    if (missingGenres.length > 0) {
      console.log(`\n📝 开始插入缺失的类型...\n`);
      
      for (const name of missingGenres) {
        const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const chineseName = requiredGenres[name];
        
        try {
          await connection.execute(
            'INSERT INTO genre (name, slug, chinese_name, is_active) VALUES (?, ?, ?, 1)',
            [name, slug, chineseName]
          );
          console.log(`  ✅ 已插入: ${name} (${chineseName})`);
        } catch (error) {
          if (error.code === 'ER_DUP_ENTRY') {
            console.log(`  ⚠️  跳过: ${name} (已存在)`);
          } else {
            console.error(`  ❌ 插入失败: ${name}`, error.message);
          }
        }
      }

      console.log(`\n✅ 插入完成！`);
    } else {
      console.log(`\n✅ 所有需要的类型都已存在，无需插入。`);
    }

    // 4. 再次查询以确认
    console.log('\n📊 最终类型列表:');
    const [finalGenres] = await connection.execute(
      'SELECT id, name, slug, chinese_name, is_active FROM genre ORDER BY name'
    );
    
    console.log(`\n总共 ${finalGenres.length} 个类型:\n`);
    finalGenres.forEach(genre => {
      const status = genre.is_active ? '✓' : '✗';
      console.log(`  ${status} [${genre.id}] ${genre.name} (${genre.slug}) - ${genre.chinese_name || '无中文名'}`);
    });

  } catch (error) {
    console.error('❌ 错误:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✅ 数据库连接已关闭');
    }
  }
}

checkAndInsertGenres();

