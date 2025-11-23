// 改进的留存率计算API
const express = require('express');
const mysql = require('mysql2/promise');
const router = express.Router();

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

// 获取小说留存率分析
router.get('/analysis/:novelId', async (req, res) => {
  let db;
  try {
    const { novelId } = req.params;
    db = await mysql.createConnection(dbConfig);
    
    // 计算多层级留存率
    const [results] = await db.execute(`
      SELECT 
        c.novel_id,
        n.title as novel_title,
        COUNT(DISTINCT rl.user_id) as total_readers,
        
        -- 基础留存率 (5章+)
        COUNT(DISTINCT CASE 
          WHEN reader_sequence.chapter_sequence >= 5 
          THEN rl.user_id 
        END) as basic_retained_readers,
        ROUND(
          COUNT(DISTINCT CASE 
            WHEN reader_sequence.chapter_sequence >= 5 
            THEN rl.user_id 
          END) * 100.0 / COUNT(DISTINCT rl.user_id), 2
        ) as basic_retention_rate,
        
        -- 深度留存率 (10章+)
        COUNT(DISTINCT CASE 
          WHEN reader_sequence.chapter_sequence >= 10 
          THEN rl.user_id 
        END) as deep_retained_readers,
        ROUND(
          COUNT(DISTINCT CASE 
            WHEN reader_sequence.chapter_sequence >= 10 
            THEN rl.user_id 
          END) * 100.0 / COUNT(DISTINCT rl.user_id), 2
        ) as deep_retention_rate,
        
        -- 忠实留存率 (20章+)
        COUNT(DISTINCT CASE 
          WHEN reader_sequence.chapter_sequence >= 20 
          THEN rl.user_id 
        END) as loyal_retained_readers,
        ROUND(
          COUNT(DISTINCT CASE 
            WHEN reader_sequence.chapter_sequence >= 20 
            THEN rl.user_id 
          END) * 100.0 / COUNT(DISTINCT rl.user_id), 2
        ) as loyal_retention_rate,
        
        -- 综合留存率 (加权平均)
        ROUND(
          (COUNT(DISTINCT CASE WHEN reader_sequence.chapter_sequence >= 5 THEN rl.user_id END) * 0.3 +
           COUNT(DISTINCT CASE WHEN reader_sequence.chapter_sequence >= 10 THEN rl.user_id END) * 0.4 +
           COUNT(DISTINCT CASE WHEN reader_sequence.chapter_sequence >= 20 THEN rl.user_id END) * 0.3) * 100.0 / COUNT(DISTINCT rl.user_id), 2
        ) as overall_retention_rate
        
      FROM reading_log rl
      JOIN chapter c ON rl.chapter_id = c.id
      JOIN novel n ON c.novel_id = n.id
      LEFT JOIN (
        SELECT 
          user_id,
          chapter_id,
          ROW_NUMBER() OVER (
            PARTITION BY user_id, c2.novel_id 
            ORDER BY read_at
          ) as chapter_sequence
        FROM reading_log rl2
        JOIN chapter c2 ON rl2.chapter_id = c2.id
      ) reader_sequence ON rl.user_id = reader_sequence.user_id 
        AND rl.chapter_id = reader_sequence.chapter_id
      WHERE c.novel_id = ?
      GROUP BY c.novel_id, n.title
    `, [novelId]);
    
    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Novel not found'
      });
    }
    
    const novel = results[0];
    
    // 计算奖励等级
    const getRewardTier = (basicRate, deepRate, loyalRate) => {
      if (basicRate >= 30 && deepRate >= 20 && loyalRate >= 10) {
        return { tier: '最高等级', rate: 40, description: '40元/千字' };
      } else if (basicRate >= 25 && deepRate >= 15 && loyalRate >= 8) {
        return { tier: '高级', rate: 25, description: '25元/千字' };
      } else if (basicRate >= 20 && deepRate >= 10 && loyalRate >= 5) {
        return { tier: '中级', rate: 15, description: '15元/千字' };
      } else if (basicRate >= 15 && deepRate >= 8 && loyalRate >= 3) {
        return { tier: '初级', rate: 10, description: '10元/千字' };
      } else if (basicRate >= 10 && deepRate >= 5 && loyalRate >= 2) {
        return { tier: '基础', rate: 7, description: '7元/千字' };
      } else if (basicRate >= 5 && deepRate >= 3 && loyalRate >= 1) {
        return { tier: '入门', rate: 6, description: '6元/千字' };
      } else {
        return { tier: '无奖励', rate: 0, description: '无奖励' };
      }
    };
    
    const rewardInfo = getRewardTier(
      novel.basic_retention_rate,
      novel.deep_retention_rate,
      novel.loyal_retention_rate
    );
    
    res.json({
      success: true,
      data: {
        novel_id: novel.novel_id,
        novel_title: novel.novel_title,
        total_readers: novel.total_readers,
        
        // 多层级留存率
        retention_analysis: {
          basic_retention: {
            threshold: '5章+',
            retained_readers: novel.basic_retained_readers,
            retention_rate: novel.basic_retention_rate,
            description: '基础留存率 (反映初步兴趣)'
          },
          deep_retention: {
            threshold: '10章+',
            retained_readers: novel.deep_retained_readers,
            retention_rate: novel.deep_retention_rate,
            description: '深度留存率 (反映真实粘性)'
          },
          loyal_retention: {
            threshold: '20章+',
            retained_readers: novel.loyal_retained_readers,
            retention_rate: novel.loyal_retention_rate,
            description: '忠实留存率 (反映核心粉丝)'
          },
          overall_retention: {
            rate: novel.overall_retention_rate,
            description: '综合留存率 (加权平均)'
          }
        },
        
        // 奖励信息
        reward_info: {
          tier: rewardInfo.tier,
          rate_per_thousand: rewardInfo.rate,
          description: rewardInfo.description,
          requirements: {
            basic_retention: '≥ 30%',
            deep_retention: '≥ 20%',
            loyal_retention: '≥ 10%'
          }
        },
        
        // 建议
        recommendations: {
          strengths: [
            novel.basic_retention_rate >= 30 ? '基础留存率优秀' : null,
            novel.deep_retention_rate >= 20 ? '深度留存率优秀' : null,
            novel.loyal_retention_rate >= 10 ? '忠实留存率优秀' : null
          ].filter(Boolean),
          improvements: [
            novel.basic_retention_rate < 30 ? '提升基础留存率 (目标: ≥30%)' : null,
            novel.deep_retention_rate < 20 ? '提升深度留存率 (目标: ≥20%)' : null,
            novel.loyal_retention_rate < 10 ? '提升忠实留存率 (目标: ≥10%)' : null
          ].filter(Boolean)
        }
      }
    });
    
  } catch (error) {
    console.error('Retention analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Retention analysis failed',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 获取所有小说的留存率对比
router.get('/comparison', async (req, res) => {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    const [results] = await db.execute(`
      SELECT 
        c.novel_id,
        n.title as novel_title,
        COUNT(DISTINCT rl.user_id) as total_readers,
        
        -- 基础留存率 (5章+)
        ROUND(
          COUNT(DISTINCT CASE 
            WHEN reader_sequence.chapter_sequence >= 5 
            THEN rl.user_id 
          END) * 100.0 / COUNT(DISTINCT rl.user_id), 2
        ) as basic_retention_rate,
        
        -- 深度留存率 (10章+)
        ROUND(
          COUNT(DISTINCT CASE 
            WHEN reader_sequence.chapter_sequence >= 10 
            THEN rl.user_id 
          END) * 100.0 / COUNT(DISTINCT rl.user_id), 2
        ) as deep_retention_rate,
        
        -- 忠实留存率 (20章+)
        ROUND(
          COUNT(DISTINCT CASE 
            WHEN reader_sequence.chapter_sequence >= 20 
            THEN rl.user_id 
          END) * 100.0 / COUNT(DISTINCT rl.user_id), 2
        ) as loyal_retention_rate
        
      FROM reading_log rl
      JOIN chapter c ON rl.chapter_id = c.id
      JOIN novel n ON c.novel_id = n.id
      LEFT JOIN (
        SELECT 
          user_id,
          chapter_id,
          ROW_NUMBER() OVER (
            PARTITION BY user_id, c2.novel_id 
            ORDER BY read_at
          ) as chapter_sequence
        FROM reading_log rl2
        JOIN chapter c2 ON rl2.chapter_id = c2.id
      ) reader_sequence ON rl.user_id = reader_sequence.user_id 
        AND rl.chapter_id = reader_sequence.chapter_id
      GROUP BY c.novel_id, n.title
      ORDER BY basic_retention_rate DESC, deep_retention_rate DESC, loyal_retention_rate DESC
    `);
    
    res.json({
      success: true,
      data: {
        novels: results.map(novel => ({
          novel_id: novel.novel_id,
          novel_title: novel.novel_title,
          total_readers: novel.total_readers,
          basic_retention_rate: novel.basic_retention_rate,
          deep_retention_rate: novel.deep_retention_rate,
          loyal_retention_rate: novel.loyal_retention_rate,
          overall_score: Math.round(
            (novel.basic_retention_rate * 0.3 + 
             novel.deep_retention_rate * 0.4 + 
             novel.loyal_retention_rate * 0.3)
          )
        }))
      }
    });
    
  } catch (error) {
    console.error('Retention comparison error:', error);
    res.status(500).json({
      success: false,
      message: 'Retention comparison failed',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

module.exports = router;
