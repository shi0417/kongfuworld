/**
 * 执行 editor_income_monthly 表结构调整迁移
 * 
 * 使用方法：
 * node backend/migrations/execute_fix_editor_income_monthly_unique_constraint.js
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4',
  multipleStatements: true
};

async function executeMigration() {
  let db;
  
  try {
    console.log('🔌 正在连接数据库...');
    db = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');
    
    // 1. 检查并删除旧的唯一约束
    console.log('📊 检查当前索引...');
    const [indexes] = await db.execute('SHOW INDEX FROM editor_income_monthly');
    const uniqueIndexes = indexes.filter(idx => idx.Key_name === 'uniq_editor_month_novel');
    
    if (uniqueIndexes.length > 0) {
      console.log('✅ 找到唯一约束 uniq_editor_month_novel，准备删除...');
      await db.execute('ALTER TABLE editor_income_monthly DROP INDEX `uniq_editor_month_novel`');
      console.log('✅ 唯一约束已删除\n');
    } else {
      console.log('⚠️  唯一约束 uniq_editor_month_novel 不存在，跳过删除\n');
    }
    
    // 2. 检查并添加新字段
    const [columns] = await db.execute('SHOW COLUMNS FROM editor_income_monthly');
    const existingColumns = columns.map(c => c.Field);
    
    console.log('📊 当前表字段:', existingColumns.join(', '));
    console.log('');
    
    const fieldsToAdd = [
      { 
        name: 'source_spend_id', 
        sql: "ADD COLUMN `source_spend_id` bigint DEFAULT NULL COMMENT '对应 reader_spending.id' AFTER `month`" 
      },
      { 
        name: 'chapter_id', 
        sql: "ADD COLUMN `chapter_id` int DEFAULT NULL COMMENT '对应章节ID（source_type = chapter_unlock 时使用）' AFTER `source_type`" 
      },
      { 
        name: 'total_word_count', 
        sql: "ADD COLUMN `total_word_count` int NOT NULL DEFAULT '0' COMMENT '本次分配使用的总字数（subscription 为小说所有已审核章节的字数之和；chapter_unlock 为该章节字数）' AFTER `chapter_count_editor`" 
      },
      { 
        name: 'editor_word_count', 
        sql: "ADD COLUMN `editor_word_count` int NOT NULL DEFAULT '0' COMMENT '本次分配中该编辑负责的字数' AFTER `total_word_count`" 
      }
    ];
    
    const fieldsToAddSql = [];
    for (const field of fieldsToAdd) {
      if (!existingColumns.includes(field.name)) {
        fieldsToAddSql.push(field.sql);
        console.log(`✅ 将添加字段: ${field.name}`);
      } else {
        console.log(`⚠️  字段已存在，跳过: ${field.name}`);
      }
    }
    
    if (fieldsToAddSql.length > 0) {
      const alterSql = `ALTER TABLE editor_income_monthly\n  ${fieldsToAddSql.join(',\n  ')}`;
      console.log('\n执行 ALTER TABLE 添加字段...');
      await db.execute(alterSql);
      console.log('✅ 字段添加成功！');
    } else {
      console.log('\n✅ 所有字段都已存在，无需添加');
    }
    
    // 3. 检查并添加新索引
    const existingIndexes = indexes.map(idx => idx.Key_name);
    const indexesToAdd = [
      { name: 'idx_month_source_spend', sql: 'ADD INDEX `idx_month_source_spend` (`month`, `source_spend_id`)' },
      { name: 'idx_source_spend_id', sql: 'ADD INDEX `idx_source_spend_id` (`source_spend_id`)' },
      { name: 'idx_chapter_id', sql: 'ADD INDEX `idx_chapter_id` (`chapter_id`)' }
    ];
    
    const indexesToAddSql = [];
    for (const idx of indexesToAdd) {
      if (!existingIndexes.includes(idx.name)) {
        indexesToAddSql.push(idx.sql);
        console.log(`✅ 将添加索引: ${idx.name}`);
      } else {
        console.log(`⚠️  索引已存在，跳过: ${idx.name}`);
      }
    }
    
    if (indexesToAddSql.length > 0) {
      const alterSql = `ALTER TABLE editor_income_monthly\n  ${indexesToAddSql.join(',\n  ')}`;
      console.log('\n执行 ALTER TABLE 添加索引...');
      await db.execute(alterSql);
      console.log('✅ 索引添加成功！');
    } else {
      console.log('\n✅ 所有索引都已存在，无需添加');
    }
    
    // 验证最终结构
    const [newColumns] = await db.execute('SHOW COLUMNS FROM editor_income_monthly');
    const [newIndexes] = await db.execute('SHOW INDEX FROM editor_income_monthly');
    
    console.log('\n📊 更新后的表字段:');
    newColumns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type})`);
    });
    
    console.log('\n📊 更新后的索引:');
    const indexMap = new Map();
    newIndexes.forEach(idx => {
      if (!indexMap.has(idx.Key_name)) {
        indexMap.set(idx.Key_name, []);
      }
      indexMap.get(idx.Key_name).push(idx.Column_name);
    });
    indexMap.forEach((columns, keyName) => {
      const unique = newIndexes.find(idx => idx.Key_name === keyName && idx.Non_unique === 0);
      const type = unique ? 'UNIQUE' : 'INDEX';
      console.log(`  - ${keyName}: ${columns.join(', ')} (${type})`);
    });
    
    console.log('\n✅ 迁移执行成功！');
    
  } catch (error) {
    console.error('\n❌ 迁移失败:', error.message);
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.error('字段已存在，请检查表结构');
    } else if (error.code === 'ER_DUP_KEYNAME') {
      console.error('索引已存在，请检查表结构');
    } else if (error.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
      console.error('无法删除索引，可能不存在');
    }
    process.exit(1);
  } finally {
    if (db) {
      await db.end();
      console.log('\n🔌 数据库连接已关闭');
    }
  }
}

executeMigration();

