/**
 * 清理重复的导入章节数据
 * 对于同一本小说（novel_id），只保留最后一次导入的数据（最新的 batch_id），删除其他旧批次的数据
 */

const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function cleanupDuplicateImportChapters(novelId = null) {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功');

    // 1. 查询所有 novel_id 及其对应的批次信息
    let query;
    let params;
    
    if (novelId) {
      query = `
        SELECT 
          novel_id,
          batch_id,
          COUNT(*) as chapter_count,
          MIN(created_at) as batch_created_at,
          MAX(created_at) as batch_updated_at
        FROM novel_import_chapter
        WHERE novel_id = ?
        GROUP BY novel_id, batch_id
        ORDER BY novel_id, batch_id DESC
      `;
      params = [novelId];
    } else {
      query = `
        SELECT 
          novel_id,
          batch_id,
          COUNT(*) as chapter_count,
          MIN(created_at) as batch_created_at,
          MAX(created_at) as batch_updated_at
        FROM novel_import_chapter
        GROUP BY novel_id, batch_id
        ORDER BY novel_id, batch_id DESC
      `;
      params = [];
    }

    const [batches] = await db.execute(query, params);
    console.log(`\n找到 ${batches.length} 个批次记录`);

    // 2. 按 novel_id 分组，找出每个小说最新的 batch_id
    const novelBatches = {};
    batches.forEach(batch => {
      const { novel_id, batch_id } = batch;
      if (!novelBatches[novel_id]) {
        novelBatches[novel_id] = [];
      }
      novelBatches[novel_id].push(batch);
    });

    // 3. 找出需要保留的批次（每个 novel_id 的最新 batch_id）
    const batchesToKeep = new Set();
    const batchesToDelete = [];

    Object.keys(novelBatches).forEach(novelId => {
      const batches = novelBatches[novelId];
      // 按 batch_id 降序排序，第一个就是最新的
      batches.sort((a, b) => b.batch_id - a.batch_id);
      
      const latestBatch = batches[0];
      batchesToKeep.add(latestBatch.batch_id);
      
      console.log(`\n小说 ID ${novelId}:`);
      console.log(`  最新批次: batch_id=${latestBatch.batch_id}, 章节数=${latestBatch.chapter_count}, 创建时间=${latestBatch.batch_created_at}`);
      
      // 其他批次标记为待删除
      for (let i = 1; i < batches.length; i++) {
        const oldBatch = batches[i];
        batchesToDelete.push({
          novel_id: parseInt(novelId),
          batch_id: oldBatch.batch_id,
          chapter_count: oldBatch.chapter_count,
          created_at: oldBatch.batch_created_at,
        });
        console.log(`  旧批次: batch_id=${oldBatch.batch_id}, 章节数=${oldBatch.chapter_count}, 创建时间=${oldBatch.batch_created_at} (将删除)`);
      }
    });

    if (batchesToDelete.length === 0) {
      console.log('\n✅ 没有需要删除的重复数据');
      return;
    }

    // 4. 显示删除统计
    console.log(`\n\n📊 删除统计:`);
    console.log(`  需要保留的批次: ${batchesToKeep.size} 个`);
    console.log(`  需要删除的批次: ${batchesToDelete.length} 个`);
    
    let totalChaptersToDelete = 0;
    batchesToDelete.forEach(b => {
      totalChaptersToDelete += b.chapter_count;
    });
    console.log(`  将删除的章节总数: ${totalChaptersToDelete} 个`);

    // 5. 确认删除（如果是 novel_id=16，直接执行；否则需要确认）
    if (novelId === 16) {
      console.log('\n⚠️  开始删除小说 ID=16 的旧批次数据...');
    } else {
      console.log('\n⚠️  准备删除旧批次数据...');
      // 这里可以添加确认逻辑，但为了自动化，我们直接执行
    }

    // 6. 删除旧批次的章节数据
    let deletedChapters = 0;
    let deletedBatches = 0;

    for (const batchInfo of batchesToDelete) {
      // 删除该批次的所有章节
      const [result] = await db.execute(
        'DELETE FROM novel_import_chapter WHERE batch_id = ?',
        [batchInfo.batch_id]
      );
      deletedChapters += result.affectedRows;
      console.log(`  已删除批次 ${batchInfo.batch_id} 的 ${result.affectedRows} 个章节`);

      // 检查并删除对应的 batch 记录（如果该批次没有其他章节了）
      const [batchCheck] = await db.execute(
        'SELECT COUNT(*) as count FROM novel_import_chapter WHERE batch_id = ?',
        [batchInfo.batch_id]
      );
      if (batchCheck[0].count === 0) {
        await db.execute(
          'DELETE FROM novel_import_batch WHERE id = ?',
          [batchInfo.batch_id]
        );
        deletedBatches++;
        console.log(`  已删除空的批次记录 batch_id=${batchInfo.batch_id}`);
      }
    }

    console.log(`\n✅ 清理完成:`);
    console.log(`  删除章节数: ${deletedChapters}`);
    console.log(`  删除批次记录数: ${deletedBatches}`);

  } catch (error) {
    console.error('❌ 清理过程中出错:', error);
    throw error;
  } finally {
    if (db) await db.end();
  }
}

// 执行清理
const novelId = process.argv[2] ? parseInt(process.argv[2]) : 16;

console.log(`开始清理小说 ID=${novelId} 的重复导入数据...\n`);

cleanupDuplicateImportChapters(novelId)
  .then(() => {
    console.log('\n✅ 脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 脚本执行失败:', error);
    process.exit(1);
  });

