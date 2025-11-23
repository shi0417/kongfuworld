const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld'
};

async function modifyFavoriteTable() {
  let connection;
  
  try {
    // 连接数据库
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');

    // 检查当前favorite表结构
    console.log('\n📋 检查当前favorite表结构...');
    const [columns] = await connection.execute('DESCRIBE favorite');
    console.log('当前字段:', columns.map(col => col.Field));

    // 添加新字段
    console.log('\n🔧 开始添加新字段...');
    
    // 添加小说名称字段
    try {
      await connection.execute(`
        ALTER TABLE favorite 
        ADD COLUMN novel_name VARCHAR(255) COMMENT '小说名称'
      `);
      console.log('✅ 添加 novel_name 字段成功');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠️  novel_name 字段已存在');
      } else {
        console.error('❌ 添加 novel_name 字段失败:', error.message);
      }
    }

    // 添加章节ID字段
    try {
      await connection.execute(`
        ALTER TABLE favorite 
        ADD COLUMN chapter_id INT COMMENT '章节ID'
      `);
      console.log('✅ 添加 chapter_id 字段成功');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠️  chapter_id 字段已存在');
      } else {
        console.error('❌ 添加 chapter_id 字段失败:', error.message);
      }
    }

    // 添加章节名称字段
    try {
      await connection.execute(`
        ALTER TABLE favorite 
        ADD COLUMN chapter_name VARCHAR(255) COMMENT '章节名称'
      `);
      console.log('✅ 添加 chapter_name 字段成功');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠️  chapter_name 字段已存在');
      } else {
        console.error('❌ 添加 chapter_name 字段失败:', error.message);
      }
    }

    // 添加favorite状态字段
    try {
      await connection.execute(`
        ALTER TABLE favorite 
        ADD COLUMN favorite_status TINYINT(1) DEFAULT 0 COMMENT 'favorite状态(0或1)'
      `);
      console.log('✅ 添加 favorite_status 字段成功');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠️  favorite_status 字段已存在');
      } else {
        console.error('❌ 添加 favorite_status 字段失败:', error.message);
      }
    }

    // 创建索引以提高查询性能
    console.log('\n🔍 创建索引...');
    
    try {
      await connection.execute(`
        CREATE INDEX idx_favorite_chapter_id ON favorite(chapter_id)
      `);
      console.log('✅ 创建 chapter_id 索引成功');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('⚠️  chapter_id 索引已存在');
      } else {
        console.error('❌ 创建 chapter_id 索引失败:', error.message);
      }
    }

    try {
      await connection.execute(`
        CREATE INDEX idx_favorite_user_chapter ON favorite(user_id, chapter_id)
      `);
      console.log('✅ 创建 user_chapter 复合索引成功');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('⚠️  user_chapter 复合索引已存在');
      } else {
        console.error('❌ 创建 user_chapter 复合索引失败:', error.message);
      }
    }

    try {
      await connection.execute(`
        CREATE INDEX idx_favorite_status ON favorite(favorite_status)
      `);
      console.log('✅ 创建 favorite_status 索引成功');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('⚠️  favorite_status 索引已存在');
      } else {
        console.error('❌ 创建 favorite_status 索引失败:', error.message);
      }
    }

    // 检查修改后的表结构
    console.log('\n📊 修改后的favorite表结构:');
    const [newColumns] = await connection.execute('DESCRIBE favorite');
    newColumns.forEach(col => {
      console.log(`- ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Default ? `DEFAULT ${col.Default}` : ''} ${col.Comment ? `COMMENT '${col.Comment}'` : ''}`);
    });

    // 检查索引
    console.log('\n🔍 检查索引:');
    const [indexes] = await connection.execute('SHOW INDEX FROM favorite');
    const indexGroups = {};
    indexes.forEach(index => {
      if (!indexGroups[index.Key_name]) {
        indexGroups[index.Key_name] = [];
      }
      indexGroups[index.Key_name].push(index.Column_name);
    });
    
    Object.keys(indexGroups).forEach(keyName => {
      console.log(`- ${keyName}: ${indexGroups[keyName].join(', ')}`);
    });

    console.log('\n🎉 favorite表修改完成！');
    console.log('\n📋 新增字段说明:');
    console.log('- novel_name: 小说名称');
    console.log('- chapter_id: 章节ID');
    console.log('- chapter_name: 章节名称');
    console.log('- favorite_status: favorite状态(0或1)');

  } catch (error) {
    console.error('❌ 修改favorite表失败:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 数据库连接已关闭');
    }
  }
}

// 执行修改
modifyFavoriteTable();
