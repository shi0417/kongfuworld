/**
 * 批量翻译 chaper_copy 表中的 content_china 字段到 content_eng 字段
 * 
 * 使用方法：
 * node backend/scripts/translate_chapter_copy.js [options]
 * 
 * 选项：
 *   --limit N        限制翻译的记录数（默认：全部）
 *   --offset N       跳过前N条记录（默认：0）
 *   --batch-size N   每批处理的记录数（默认：10）
 *   --dry-run        仅显示将要翻译的记录，不实际执行翻译
 *   --where-clause   自定义 WHERE 条件（例如：--where-clause "id > 100 AND content_eng IS NULL")
 */

const path = require('path');
const fs = require('fs');

// 先加载环境变量（必须在 require 其他模块之前）
const envPaths = [
  path.join(__dirname, '../../.env'),
  path.join(__dirname, '../kongfuworld.env'),
  path.join(__dirname, '../../backend/kongfuworld.env')
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    console.log(`[环境变量] 从 ${envPath} 加载配置`);
    break;
  }
}

// 验证环境变量是否加载成功
if (!process.env.OPENAI_API_KEY) {
  console.error('错误: OPENAI_API_KEY 环境变量未设置');
  console.error('请检查环境变量文件或设置 OPENAI_API_KEY');
  process.exit(1);
}

const mysql = require('mysql2/promise');
const { translateChapterText } = require('../ai/translationModel');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

// 解析命令行参数
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    limit: null,
    offset: 0,
    batchSize: 10,
    dryRun: false,
    whereClause: null
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--limit' && i + 1 < args.length) {
      options.limit = parseInt(args[++i]);
    } else if (arg === '--offset' && i + 1 < args.length) {
      options.offset = parseInt(args[++i]);
    } else if (arg === '--batch-size' && i + 1 < args.length) {
      options.batchSize = parseInt(args[++i]);
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--where-clause' && i + 1 < args.length) {
      options.whereClause = args[++i];
    }
  }

  return options;
}

// 延迟函数
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 获取需要翻译的记录
 */
async function getRecordsToTranslate(db, options) {
  let whereClause = options.whereClause || 'content_china IS NOT NULL AND content_china != ""';
  
  // 如果用户没有指定 whereClause，默认只翻译 content_eng 为空的记录
  if (!options.whereClause) {
    whereClause += ' AND (content_eng IS NULL OR content_eng = "")';
  }

  let query = `SELECT id, content_china FROM chaper_copy WHERE ${whereClause}`;
  
  if (options.limit) {
    query += ` LIMIT ${parseInt(options.limit)} OFFSET ${parseInt(options.offset)}`;
  } else if (options.offset > 0) {
    query += ` LIMIT 999999 OFFSET ${parseInt(options.offset)}`;
  }

  const [rows] = await db.execute(query);
  return rows;
}

/**
 * 翻译单条记录
 */
async function translateRecord(db, recordId, chineseContent) {
  try {
    console.log(`[翻译中] ID: ${recordId}, 内容长度: ${chineseContent.length} 字符`);
    
    const englishContent = await translateChapterText(chineseContent);
    
    if (!englishContent || !englishContent.trim()) {
      throw new Error('翻译结果为空');
    }

    // 更新数据库
    await db.execute(
      'UPDATE chaper_copy SET content_eng = ? WHERE id = ?',
      [englishContent, recordId]
    );

    console.log(`[成功] ID: ${recordId}, 翻译后长度: ${englishContent.length} 字符`);
    return { success: true, recordId, translatedLength: englishContent.length };
  } catch (error) {
    console.error(`[失败] ID: ${recordId}, 错误: ${error.message}`);
    return { success: false, recordId, error: error.message };
  }
}

/**
 * 批量翻译
 */
async function batchTranslate(db, records, batchSize) {
  const results = {
    success: 0,
    failed: 0,
    errors: []
  };

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    console.log(`\n处理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(records.length / batchSize)} (${batch.length} 条记录)`);

    for (const record of batch) {
      const result = await translateRecord(db, record.id, record.content_china);
      
      if (result.success) {
        results.success++;
      } else {
        results.failed++;
        results.errors.push({ id: record.id, error: result.error });
      }

      // 添加延迟以避免 API 速率限制
      await sleep(1000); // 1秒延迟
    }

    // 批次之间的延迟
    if (i + batchSize < records.length) {
      console.log('批次完成，等待 2 秒后继续...');
      await sleep(2000);
    }
  }

  return results;
}

/**
 * 主函数
 */
async function main() {
  const options = parseArgs();
  
  console.log('=== Chapter Copy 批量翻译工具 ===');
  console.log('配置:');
  console.log(`  限制记录数: ${options.limit || '无限制'}`);
  console.log(`  偏移量: ${options.offset}`);
  console.log(`  批次大小: ${options.batchSize}`);
  console.log(`  试运行模式: ${options.dryRun ? '是' : '否'}`);
  console.log(`  WHERE 条件: ${options.whereClause || '默认（content_china 不为空且 content_eng 为空）'}`);
  console.log('');

  // 检查环境变量
  if (!process.env.OPENAI_API_KEY) {
    console.error('错误: OPENAI_API_KEY 环境变量未设置');
    process.exit(1);
  }

  let db;
  try {
    // 连接数据库
    console.log('正在连接数据库...');
    db = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功\n');

    // 检查表是否存在（注意：表名是 chaper_copy，不是 chapter_copy）
    const [tables] = await db.execute(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'chaper_copy'",
      [dbConfig.database]
    );

    if (tables[0].count === 0) {
      console.error('错误: chaper_copy 表不存在');
      process.exit(1);
    }

    // 检查字段是否存在
    const [columns] = await db.execute(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE table_schema = ? AND table_name = 'chaper_copy' AND COLUMN_NAME IN ('id', 'content_china', 'content_eng')",
      [dbConfig.database]
    );

    const columnNames = columns.map(c => c.COLUMN_NAME);
    if (!columnNames.includes('id') || !columnNames.includes('content_china') || !columnNames.includes('content_eng')) {
      console.error('错误: chaper_copy 表缺少必要字段 (id, content_china, content_eng)');
      console.error(`现有字段: ${columnNames.join(', ')}`);
      process.exit(1);
    }

    // 获取需要翻译的记录
    console.log('正在查询需要翻译的记录...');
    const records = await getRecordsToTranslate(db, options);
    console.log(`找到 ${records.length} 条需要翻译的记录\n`);

    if (records.length === 0) {
      console.log('没有需要翻译的记录');
      return;
    }

    // 试运行模式
    if (options.dryRun) {
      console.log('=== 试运行模式：以下记录将被翻译 ===');
      records.slice(0, 10).forEach((record, index) => {
        console.log(`${index + 1}. ID: ${record.id}, 内容长度: ${record.content_china?.length || 0} 字符`);
        if (record.content_china) {
          const preview = record.content_china.substring(0, 100).replace(/\n/g, ' ');
          console.log(`   预览: ${preview}...`);
        }
      });
      if (records.length > 10) {
        console.log(`... 还有 ${records.length - 10} 条记录`);
      }
      console.log('\n要实际执行翻译，请移除 --dry-run 参数');
      return;
    }

    // 确认执行
    console.log(`准备翻译 ${records.length} 条记录`);
    console.log('按 Ctrl+C 取消，或等待 5 秒后开始...');
    await sleep(5000);

    // 执行批量翻译
    const startTime = Date.now();
    const results = await batchTranslate(db, records, options.batchSize);
    const endTime = Date.now();
    const duration = Math.floor((endTime - startTime) / 1000);

    // 输出结果统计
    console.log('\n=== 翻译完成 ===');
    console.log(`总记录数: ${records.length}`);
    console.log(`成功: ${results.success}`);
    console.log(`失败: ${results.failed}`);
    console.log(`耗时: ${duration} 秒`);

    if (results.errors.length > 0) {
      console.log('\n失败的记录:');
      results.errors.forEach(({ id, error }) => {
        console.log(`  ID ${id}: ${error}`);
      });
    }

  } catch (error) {
    console.error('发生错误:', error);
    process.exit(1);
  } finally {
    if (db) {
      await db.end();
      console.log('\n数据库连接已关闭');
    }
  }
}

// 运行主函数
if (require.main === module) {
  main().catch(error => {
    console.error('未处理的错误:', error);
    process.exit(1);
  });
}

module.exports = { main };

