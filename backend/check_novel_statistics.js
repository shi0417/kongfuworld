const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').join(__dirname, 'kongfuworld.env') });

(async () => {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'wuxiaworld'
    });

    const [rows] = await connection.execute(
      'SELECT novel_id, date, views, `reads`, favorites, comments, shares FROM novel_statistics ORDER BY date DESC, views DESC LIMIT 10'
    );

    console.log('最近10条统计数据:');
    console.log('小说ID\t日期\t\t浏览量\t阅读量\t收藏量\t评论量\t分享量');
    console.log('─'.repeat(70));
    rows.forEach(r => {
      console.log(
        `${r.novel_id}\t${r.date}\t${r.views || 0}\t${r.reads || 0}\t${r.favorites || 0}\t${r.comments || 0}\t${r.shares || 0}`
      );
    });

    // 统计各字段的使用情况
    const [stats] = await connection.execute(
      `SELECT 
        COUNT(*) as total_records,
        SUM(CASE WHEN views > 0 THEN 1 ELSE 0 END) as has_views,
        SUM(CASE WHEN \`reads\` > 0 THEN 1 ELSE 0 END) as has_reads,
        SUM(CASE WHEN favorites > 0 THEN 1 ELSE 0 END) as has_favorites,
        SUM(CASE WHEN comments > 0 THEN 1 ELSE 0 END) as has_comments,
        SUM(CASE WHEN shares > 0 THEN 1 ELSE 0 END) as has_shares,
        SUM(views) as total_views,
        SUM(\`reads\`) as total_reads
      FROM novel_statistics`
    );

    if (stats.length > 0) {
      const s = stats[0];
      console.log('\n统计汇总:');
      console.log(`总记录数: ${s.total_records}`);
      console.log(`有浏览量记录: ${s.has_views} (${((s.has_views / s.total_records) * 100).toFixed(1)}%)`);
      console.log(`有阅读量记录: ${s.has_reads} (${((s.has_reads / s.total_records) * 100).toFixed(1)}%)`);
      console.log(`有收藏量记录: ${s.has_favorites} (${((s.has_favorites / s.total_records) * 100).toFixed(1)}%)`);
      console.log(`有评论量记录: ${s.has_comments} (${((s.has_comments / s.total_records) * 100).toFixed(1)}%)`);
      console.log(`有分享量记录: ${s.has_shares} (${((s.has_shares / s.total_records) * 100).toFixed(1)}%)`);
      console.log(`总浏览量: ${s.total_views || 0}`);
      console.log(`总阅读量: ${s.total_reads || 0}`);
    }

    await connection.end();
  } catch (error) {
    console.error('错误:', error.message);
    if (connection) await connection.end();
  }
})();

