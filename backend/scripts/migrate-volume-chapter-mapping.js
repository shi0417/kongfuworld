/**
 * 用途：把 novel_id IN (1,10,11,13) 的章节，从旧设计
 *   chapter.volume_id = volume.volume_id
 * 迁移为新设计
 *   chapter.volume_id = volume.id
 *
 * 使用方法：
 *   cd backend
 *   node scripts/migrate-volume-chapter-mapping.js
 *
 * 注意：
 *   - 脚本会开启事务，执行过程中如有错误会自动回滚。
 *   - 已经是新设计的小说（比如 7、14）不会被修改。
 */

const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

const TARGET_NOVEL_IDS = [1, 10, 11, 13];

async function migrateMapping() {
  let pool;
  let connection;

  try {
    console.log('🔌 正在连接数据库...');
    pool = mysql.createPool(dbConfig);
    connection = await pool.getConnection();
    console.log('✅ 数据库连接成功\n');

    // 开启事务
    await connection.beginTransaction();
    console.log('📦 事务已开启\n');

    // ==================== 迁移前统计 ====================
    console.log('📊 迁移前统计...\n');

    // 1. 每本小说总章节数
    const placeholders = TARGET_NOVEL_IDS.map(() => '?').join(',');
    const [totalChaptersBefore] = await connection.execute(`
      SELECT novel_id, COUNT(*) AS chapter_count
      FROM chapter
      WHERE novel_id IN (${placeholders})
      GROUP BY novel_id
      ORDER BY novel_id
    `, TARGET_NOVEL_IDS);

    // 2. 每本小说中已经是新设计的章节数
    const [newMappingBefore] = await connection.execute(`
      SELECT c.novel_id, COUNT(*) AS new_mapping_chapter_count
      FROM chapter c
      JOIN volume v
        ON v.id = c.volume_id
       AND v.novel_id = c.novel_id
      WHERE c.novel_id IN (${placeholders})
      GROUP BY c.novel_id
      ORDER BY c.novel_id
    `, TARGET_NOVEL_IDS);

    // 3. 每本小说中仍是旧设计的章节数
    const [oldMappingBefore] = await connection.execute(`
      SELECT c.novel_id, COUNT(*) AS old_mapping_chapter_count
      FROM chapter c
      JOIN volume v
        ON v.volume_id = c.volume_id
       AND v.novel_id = c.novel_id
      WHERE c.novel_id IN (${placeholders})
      GROUP BY c.novel_id
      ORDER BY c.novel_id
    `, TARGET_NOVEL_IDS);

    const statsBefore = {
      totalChapters: totalChaptersBefore,
      newMapping: newMappingBefore,
      oldMapping: oldMappingBefore
    };

    console.log('迁移前统计：');
    console.log(JSON.stringify(statsBefore, null, 2));
    console.log('');

    // ==================== 执行核心 UPDATE ====================
    console.log('🔄 开始执行迁移...\n');

    const [updateResult] = await connection.execute(`
      UPDATE chapter c
      JOIN volume v_old
        ON v_old.novel_id = c.novel_id
       AND v_old.volume_id = c.volume_id
      SET c.volume_id = v_old.id
      WHERE c.novel_id IN (${placeholders})
        AND c.volume_id <> v_old.id
    `, TARGET_NOVEL_IDS);

    const affectedRows = updateResult.affectedRows;
    console.log(`✅ UPDATE 执行完成，影响行数：${affectedRows}\n`);

    // ==================== 迁移后统计 & 校验 ====================
    console.log('📊 迁移后统计与校验...\n');

    // 1. 每本小说总章节数（应该不变）
    const [totalChaptersAfter] = await connection.execute(`
      SELECT novel_id, COUNT(*) AS chapter_count
      FROM chapter
      WHERE novel_id IN (${placeholders})
      GROUP BY novel_id
      ORDER BY novel_id
    `, TARGET_NOVEL_IDS);

    // 2. 每本小说中已经是新设计的章节数（应该等于总章节数）
    const [newMappingAfter] = await connection.execute(`
      SELECT c.novel_id, COUNT(*) AS new_mapping_chapter_count
      FROM chapter c
      JOIN volume v
        ON v.id = c.volume_id
       AND v.novel_id = c.novel_id
      WHERE c.novel_id IN (${placeholders})
      GROUP BY c.novel_id
      ORDER BY c.novel_id
    `, TARGET_NOVEL_IDS);

    // 3. 每本小说中仍是旧设计的章节数（应该为 0）
    const [oldMappingAfter] = await connection.execute(`
      SELECT c.novel_id, COUNT(*) AS old_mapping_chapter_count
      FROM chapter c
      JOIN volume v
        ON v.volume_id = c.volume_id
       AND v.novel_id = c.novel_id
      WHERE c.novel_id IN (${placeholders})
      GROUP BY c.novel_id
      ORDER BY c.novel_id
    `, TARGET_NOVEL_IDS);

    // 4. 检查孤立章节
    const [orphanCheck] = await connection.execute(`
      SELECT COUNT(*) AS orphan_count
      FROM chapter c
      LEFT JOIN volume v_id
        ON v_id.id = c.volume_id
       AND v_id.novel_id = c.novel_id
      LEFT JOIN volume v_old
        ON v_old.volume_id = c.volume_id
       AND v_old.novel_id = c.novel_id
      WHERE c.novel_id IN (${placeholders})
        AND v_id.id IS NULL
        AND v_old.id IS NULL
    `, TARGET_NOVEL_IDS);

    const statsAfter = {
      totalChapters: totalChaptersAfter,
      newMapping: newMappingAfter,
      oldMapping: oldMappingAfter,
      orphanCount: orphanCheck[0].orphan_count
    };

    console.log('迁移后统计：');
    console.log(JSON.stringify(statsAfter, null, 2));
    console.log('');

    // ==================== 校验 ====================
    console.log('🔍 执行校验...\n');

    let validationPassed = true;
    const errors = [];

    // 校验1：总章节数应该不变
    const totalBefore = totalChaptersBefore.reduce((sum, row) => sum + row.chapter_count, 0);
    const totalAfter = totalChaptersAfter.reduce((sum, row) => sum + row.chapter_count, 0);
    if (totalBefore !== totalAfter) {
      validationPassed = false;
      errors.push(`总章节数不匹配：迁移前 ${totalBefore}，迁移后 ${totalAfter}`);
    }

    // 校验2：每本小说的旧设计章节数应该为 0
    if (oldMappingAfter.length > 0) {
      validationPassed = false;
      errors.push(`仍有使用旧设计的章节：${JSON.stringify(oldMappingAfter)}`);
    }

    // 校验3：每本小说的新设计章节数应该等于总章节数
    for (const totalRow of totalChaptersAfter) {
      const newMappingRow = newMappingAfter.find(row => row.novel_id === totalRow.novel_id);
      if (!newMappingRow || newMappingRow.new_mapping_chapter_count !== totalRow.chapter_count) {
        validationPassed = false;
        errors.push(`小说 ${totalRow.novel_id} 的新设计章节数不匹配：期望 ${totalRow.chapter_count}，实际 ${newMappingRow?.new_mapping_chapter_count || 0}`);
      }
    }

    // 校验4：不应该有孤立章节
    if (orphanCheck[0].orphan_count > 0) {
      validationPassed = false;
      errors.push(`发现 ${orphanCheck[0].orphan_count} 个孤立章节`);
    }

    if (!validationPassed) {
      console.error('❌ 校验失败：');
      errors.forEach(err => console.error(`  - ${err}`));
      await connection.rollback();
      console.error('\n❌ 迁移失败，已回滚');
      process.exit(1);
    }

    console.log('✅ 所有校验通过\n');

    // ==================== 提交事务 ====================
    await connection.commit();
    console.log('✅ Volume-Chapter 映射迁移成功完成');
    console.log(`📊 总计更新 ${affectedRows} 个章节的 volume_id\n`);

    // 打印对比摘要
    console.log('📋 迁移对比摘要：');
    console.log('小说ID | 迁移前旧设计章节数 | 迁移后新设计章节数');
    console.log('-------|-------------------|-------------------');
    for (const totalRow of totalChaptersAfter) {
      const oldBefore = oldMappingBefore.find(row => row.novel_id === totalRow.novel_id);
      const newAfter = newMappingAfter.find(row => row.novel_id === totalRow.novel_id);
      const oldCount = oldBefore ? oldBefore.old_mapping_chapter_count : 0;
      const newCount = newAfter ? newAfter.new_mapping_chapter_count : 0;
      console.log(`  ${totalRow.novel_id}   |        ${oldCount}          |        ${newCount}`);
    }

  } catch (error) {
    console.error('❌ 迁移过程中出错:', error);
    if (connection) {
      try {
        await connection.rollback();
        console.error('❌ 迁移失败，已回滚');
      } catch (rollbackError) {
        console.error('❌ 回滚失败:', rollbackError);
      }
    }
    process.exit(1);
  } finally {
    if (connection) {
      connection.release();
      console.log('\n🔌 数据库连接已释放');
    }
    if (pool) {
      await pool.end();
    }
    process.exit(0);
  }
}

// 运行迁移
migrateMapping().catch(error => {
  console.error('❌ 脚本执行失败:', error);
  process.exit(1);
});

