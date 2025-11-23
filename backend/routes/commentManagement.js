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

// 中间件：验证作者身份
const authenticateAuthor = async (req, res, next) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: '请先登录' });
    }

    // 检查用户是否是作者
    const db = await mysql.createConnection(dbConfig);
    const [users] = await db.execute(
      'SELECT is_author FROM user WHERE id = ?',
      [userId]
    );
    await db.end();

    if (users.length === 0 || !users[0].is_author) {
      return res.status(403).json({ success: false, message: '您不是作者，无权访问' });
    }

    req.authorId = userId;
    next();
  } catch (error) {
    console.error('验证作者身份失败:', error);
    res.status(500).json({ success: false, message: '验证失败' });
  }
};

// 获取作者的所有作品列表（用于筛选）
router.get('/novels', authenticateAuthor, async (req, res) => {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    // 尝试使用created_at排序，如果字段不存在则使用id排序
    let novels;
    try {
      [novels] = await db.execute(
        `SELECT id, title, cover 
         FROM novel 
         WHERE user_id = ? 
         ORDER BY created_at DESC, id DESC`,
        [req.authorId]
      );
    } catch (error) {
      // 如果created_at字段不存在，使用id排序
      if (error.code === 'ER_BAD_FIELD_ERROR') {
        [novels] = await db.execute(
          `SELECT id, title, cover 
           FROM novel 
           WHERE user_id = ? 
           ORDER BY id DESC`,
          [req.authorId]
        );
      } else {
        throw error;
      }
    }

    res.json({ success: true, data: novels });
  } catch (error) {
    console.error('获取作品列表失败:', error);
    res.status(500).json({ success: false, message: '获取作品列表失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// 获取评论列表（支持多种筛选和排序）
router.get('/comments', authenticateAuthor, async (req, res) => {
  let db;
  try {
    const {
      novelId,           // 作品ID筛选
      commentType,       // 评论类型：'review'(评价), 'discussion'(讨论), 'chapter'(章评), 'paragraph'(段评)
      startDate,         // 开始日期
      endDate,           // 结束日期
      sortBy = 'newest', // 排序：'newest'(最新), 'hottest'(最热)
      page = 1,          // 页码
      limit = 20,        // 每页数量
      reportReason       // 举报原因筛选
    } = req.query;

    db = await mysql.createConnection(dbConfig);
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // 构建查询条件
    const conditions = [];
    const params = [];

    // 只查询作者作品的评论
    conditions.push(`n.user_id = ?`);
    params.push(req.authorId);

    // 作品筛选
    if (novelId) {
      conditions.push(`n.id = ?`);
      params.push(novelId);
    }

    // 评论类型筛选
    let unionQueries = [];
    
    // 如果指定了举报原因，先查询report表获取被举报的remark_id列表和举报数量
    // 需要确保这些remark_id对应的评论属于该作者的作品
    let reportedRemarkIds = new Map(); // key: "type_remarkId", value: { remarkId, type, reportCount }
    if (reportReason) {
      try {
        // 构建查询条件：根据commentType筛选
        let reportQuery = `SELECT type, remark_id, COUNT(*) as report_count
           FROM report
           WHERE report = ?`;
        let reportParams = [reportReason];
        
        // 如果指定了commentType，只查询对应类型的举报
        if (commentType) {
          reportQuery += ` AND type = ?`;
          reportParams.push(commentType === 'chapter' ? 'comment' : commentType);
        } else {
          // 如果没有指定commentType，查询所有类型
          reportQuery += ` AND type IN ('review', 'comment', 'paragraph_comment')`;
        }
        
        reportQuery += ` GROUP BY type, remark_id`;
        
        const [reportResults] = await db.execute(reportQuery, reportParams);
        
        // 验证这些remark_id对应的评论是否属于该作者的作品
        for (const row of reportResults) {
          let isValid = false;
          
          if (row.type === 'review') {
            // 验证review是否属于该作者
            const [reviewCheck] = await db.execute(
              `SELECT r.id FROM review r 
               JOIN novel n ON r.novel_id = n.id 
               WHERE r.id = ? AND n.user_id = ?`,
              [row.remark_id, req.authorId]
            );
            isValid = reviewCheck.length > 0;
          } else if (row.type === 'comment') {
            // 验证comment是否属于该作者
            const [commentCheck] = await db.execute(
              `SELECT c.id FROM comment c 
               JOIN chapter ch ON c.target_id = ch.id 
               JOIN novel n ON ch.novel_id = n.id 
               WHERE c.id = ? AND n.user_id = ?`,
              [row.remark_id, req.authorId]
            );
            isValid = commentCheck.length > 0;
          } else if (row.type === 'paragraph_comment') {
            // 验证paragraph_comment是否属于该作者
            const [paragraphCheck] = await db.execute(
              `SELECT pc.id FROM paragraph_comment pc 
               JOIN chapter ch ON pc.chapter_id = ch.id 
               JOIN novel n ON ch.novel_id = n.id 
               WHERE pc.id = ? AND n.user_id = ?`,
              [row.remark_id, req.authorId]
            );
            isValid = paragraphCheck.length > 0;
          }
          
          if (isValid) {
            reportedRemarkIds.set(`${row.type}_${row.remark_id}`, {
              remarkId: row.remark_id,
              type: row.type,
              reportCount: parseInt(row.report_count)
            });
          }
        }
      } catch (error) {
        console.error('查询举报记录失败:', error);
      }
    }
    
    if (!commentType || commentType === 'review') {
      // 评价（review表）
      let reviewConditions = ['n.user_id = ?'];
      let reviewParams = [req.authorId];
      
      if (novelId) {
        reviewConditions.push('r.novel_id = ?');
        reviewParams.push(novelId);
      }
      
      if (startDate) {
        reviewConditions.push('r.created_at >= ?');
        reviewParams.push(startDate);
      }
      
      if (endDate) {
        reviewConditions.push('r.created_at <= ?');
        reviewParams.push(endDate + ' 23:59:59');
      }

      // 如果指定了举报原因，只查询被举报的评论
      let reviewRemarkIds = [];
      if (reportReason) {
        reviewRemarkIds = Array.from(reportedRemarkIds.values())
          .filter(item => item.type === 'review')
          .map(item => item.remarkId);
        
        if (reviewRemarkIds.length === 0) {
          // 没有符合条件的举报记录，跳过这个查询
        } else {
          reviewConditions.push(`r.id IN (${reviewRemarkIds.map(() => '?').join(',')})`);
          reviewParams.push(...reviewRemarkIds);
        }
      }

      // 如果没有选择举报原因，只查询父评论（parent_id IS NULL）
      if (!reportReason) {
        reviewConditions.push('r.parent_id IS NULL');
      }

      // 只有当有查询条件时才添加查询
      if (!reportReason || (reportReason && reviewRemarkIds.length > 0)) {
        unionQueries.push({
          query: `
            SELECT 
              r.id,
              'review' as comment_type,
              r.content,
              r.rating,
              r.created_at,
              r.likes,
              r.comments as reply_count,
              r.views,
              r.is_recommended,
              u.id as user_id,
              u.username,
              u.pen_name,
              u.is_author,
              u.avatar,
              u.is_vip,
              n.id as novel_id,
              n.title as novel_title,
              NULL as chapter_id,
              NULL as chapter_title,
              r.parent_id as parent_comment_id,
              ${reportReason ? `COALESCE(rep_counts.report_count, 0) as report_count` : '0 as report_count'}
            FROM review r
            JOIN novel n ON r.novel_id = n.id
            JOIN user u ON r.user_id = u.id
            ${reportReason ? `
            LEFT JOIN (
              SELECT remark_id, COUNT(*) as report_count
              FROM report
              WHERE type = 'review' AND report = ?
              GROUP BY remark_id
            ) rep_counts ON rep_counts.remark_id = r.id
            ` : ''}
            WHERE ${reviewConditions.join(' AND ')}
          `,
          params: reportReason ? [reportReason, ...reviewParams] : reviewParams,
          reportCountMap: reportReason ? new Map(
            Array.from(reportedRemarkIds.values())
              .filter(item => item.type === 'review')
              .map(item => [item.remarkId, item.reportCount])
          ) : null
        });
      }
    }

    // 注意：讨论功能已移除，comment表现在只存储章节评论
    // 如果需要讨论功能，应该使用其他表或重新设计

    if (!commentType || commentType === 'chapter') {
      // 章评（comment表，现在只存储章节评论，target_id就是chapter_id，不再使用target_type字段）
      // 只查询主评论，排除回复（parent_comment_id IS NULL）
      let chapterConditions = ['n.user_id = ?', 'c.parent_comment_id IS NULL'];
      let chapterParams = [req.authorId];
      
      if (novelId) {
        chapterConditions.push('ch.novel_id = ?');
        chapterParams.push(novelId);
      }
      
      if (startDate) {
        chapterConditions.push('c.created_at >= ?');
        chapterParams.push(startDate);
      }
      
      if (endDate) {
        chapterConditions.push('c.created_at <= ?');
        chapterParams.push(endDate + ' 23:59:59');
      }

      // 如果指定了举报原因，只查询被举报的评论
      let chapterRemarkIds = [];
      if (reportReason) {
        chapterRemarkIds = Array.from(reportedRemarkIds.values())
          .filter(item => item.type === 'comment')
          .map(item => item.remarkId);
        
        if (chapterRemarkIds.length === 0) {
          // 没有符合条件的举报记录，跳过这个查询
        } else {
          chapterConditions.push(`c.id IN (${chapterRemarkIds.map(() => '?').join(',')})`);
          chapterParams.push(...chapterRemarkIds);
        }
      }

      // 只有当有查询条件时才添加查询
      if (!reportReason || (reportReason && chapterRemarkIds.length > 0)) {
        unionQueries.push({
          query: `
            SELECT 
              c.id,
              'chapter' as comment_type,
              c.content,
              NULL as rating,
              c.created_at,
              c.likes,
              (SELECT COUNT(*) FROM comment WHERE parent_comment_id = c.id) as reply_count,
              0 as views,
              NULL as is_recommended,
              u.id as user_id,
              u.username,
              u.pen_name,
              u.is_author,
              u.avatar,
              u.is_vip,
              n.id as novel_id,
              n.title as novel_title,
              ch.id as chapter_id,
              ch.title as chapter_title,
              c.parent_comment_id,
              ${reportReason ? `COALESCE(rep_counts.report_count, 0) as report_count` : '0 as report_count'}
            FROM comment c
            JOIN chapter ch ON c.target_id = ch.id
            JOIN novel n ON ch.novel_id = n.id
            JOIN user u ON c.user_id = u.id
            ${reportReason ? `
            LEFT JOIN (
              SELECT remark_id, COUNT(*) as report_count
              FROM report
              WHERE type = 'comment' AND report = ?
              GROUP BY remark_id
            ) rep_counts ON rep_counts.remark_id = c.id
            ` : ''}
            WHERE ${chapterConditions.join(' AND ')}
          `,
          params: reportReason ? [reportReason, ...chapterParams] : chapterParams,
          reportCountMap: reportReason ? new Map(
            Array.from(reportedRemarkIds.values())
              .filter(item => item.type === 'comment')
              .map(item => [item.remarkId, item.reportCount])
          ) : null
        });
      }
    }

    if (!commentType || commentType === 'paragraph') {
      // 段评（paragraph_comment表）
      let paragraphConditions = ['n.user_id = ?'];
      let paragraphParams = [req.authorId];
      
      if (novelId) {
        paragraphConditions.push('ch.novel_id = ?');
        paragraphParams.push(novelId);
      }
      
      if (startDate) {
        paragraphConditions.push('pc.created_at >= ?');
        paragraphParams.push(startDate);
      }
      
      if (endDate) {
        paragraphConditions.push('pc.created_at <= ?');
        paragraphParams.push(endDate + ' 23:59:59');
      }

      // 如果指定了举报原因，只查询被举报的评论
      let paragraphRemarkIds = [];
      if (reportReason) {
        paragraphRemarkIds = Array.from(reportedRemarkIds.values())
          .filter(item => item.type === 'paragraph_comment')
          .map(item => item.remarkId);
        
        if (paragraphRemarkIds.length === 0) {
          // 没有符合条件的举报记录，跳过这个查询
        } else {
          paragraphConditions.push(`pc.id IN (${paragraphRemarkIds.map(() => '?').join(',')})`);
          paragraphParams.push(...paragraphRemarkIds);
        }
      }

      // 如果没有选择举报原因，只查询父评论（parent_id IS NULL）
      if (!reportReason) {
        paragraphConditions.push('pc.parent_id IS NULL');
      }

      // 只有当有查询条件时才添加查询
      if (!reportReason || (reportReason && paragraphRemarkIds.length > 0)) {
        unionQueries.push({
          query: `
            SELECT 
              pc.id,
              'paragraph' as comment_type,
              pc.content,
              NULL as rating,
              pc.created_at,
              pc.like_count as likes,
              COALESCE(pc.dislike_count, 0) as dislikes,
              (SELECT COUNT(*) FROM paragraph_comment WHERE parent_id = pc.id) as reply_count,
              0 as views,
              NULL as is_recommended,
              u.id as user_id,
              u.username,
              u.pen_name,
              u.is_author,
              u.avatar,
              u.is_vip,
              n.id as novel_id,
              n.title as novel_title,
              ch.id as chapter_id,
              ch.title as chapter_title,
              pc.paragraph_index,
              pc.parent_id as parent_comment_id,
              ${reportReason ? `COALESCE(rep_counts.report_count, 0) as report_count` : '0 as report_count'}
            FROM paragraph_comment pc
            JOIN chapter ch ON pc.chapter_id = ch.id
            JOIN novel n ON ch.novel_id = n.id
            JOIN user u ON pc.user_id = u.id
            ${reportReason ? `
            LEFT JOIN (
              SELECT remark_id, COUNT(*) as report_count
              FROM report
              WHERE type = 'paragraph_comment' AND report = ?
              GROUP BY remark_id
            ) rep_counts ON rep_counts.remark_id = pc.id
            ` : ''}
            WHERE ${paragraphConditions.join(' AND ')}
          `,
          params: reportReason ? [reportReason, ...paragraphParams] : paragraphParams,
          reportCountMap: reportReason ? new Map(
            Array.from(reportedRemarkIds.values())
              .filter(item => item.type === 'paragraph_comment')
              .map(item => [item.remarkId, item.reportCount])
          ) : null
        });
      }
    }

    if (unionQueries.length === 0) {
      return res.json({ success: true, data: { comments: [], total: 0, page: parseInt(page), limit: parseInt(limit) } });
    }

    // 分别执行每个查询，然后在内存中合并
    let allComments = [];
    
    for (const queryItem of unionQueries) {
      try {
        const [results] = await db.execute(queryItem.query, queryItem.params);
        allComments = allComments.concat(results);
      } catch (error) {
        console.error('执行查询失败:', queryItem.query, error);
        // 继续执行其他查询
      }
    }

    // 如果是review/chapter/paragraph类型且没有选择举报原因，需要加载嵌套回复
    if ((commentType === 'review' || commentType === 'chapter' || commentType === 'paragraph') && !reportReason) {
      // 只获取父评论
      let parentComments;
      if (commentType === 'review') {
        parentComments = allComments.filter(c => !c.parent_comment_id);
      } else if (commentType === 'chapter') {
        parentComments = allComments.filter(c => !c.parent_comment_id);
      } else if (commentType === 'paragraph') {
        parentComments = allComments.filter(c => !c.parent_comment_id);
      } else {
        parentComments = allComments;
      }
      
      // 为每个父评论加载子评论
      for (const parentComment of parentComments) {
        try {
          let childComments = [];
          
          if (commentType === 'review') {
            // review表的嵌套查询
            const [reviewChildComments] = await db.execute(
              `SELECT 
                r.id,
                'review' as comment_type,
                r.content,
                r.rating,
                r.created_at,
                r.likes,
                r.comments as reply_count,
                r.views,
                r.is_recommended,
                u.id as user_id,
                u.username,
                u.pen_name,
                u.is_author,
                u.avatar,
                u.is_vip,
                n.id as novel_id,
                n.title as novel_title,
                NULL as chapter_id,
                NULL as chapter_title,
                r.parent_id as parent_comment_id
              FROM review r
              JOIN novel n ON r.novel_id = n.id
              JOIN user u ON r.user_id = u.id
              WHERE r.parent_id = ? AND n.user_id = ?
              ORDER BY r.created_at ASC`,
              [parentComment.id, req.authorId]
            );
            childComments = reviewChildComments;
            
            // 递归加载嵌套回复
            const loadNestedReplies = async (parentId) => {
              const [nested] = await db.execute(
                `SELECT 
                  r.id,
                  'review' as comment_type,
                  r.content,
                  r.rating,
                  r.created_at,
                  r.likes,
                  r.comments as reply_count,
                  r.views,
                  r.is_recommended,
                  u.id as user_id,
                  u.username,
                  u.pen_name,
                  u.is_author,
                  u.avatar,
                  u.is_vip,
                  n.id as novel_id,
                  n.title as novel_title,
                  NULL as chapter_id,
                  NULL as chapter_title,
                  r.parent_id as parent_comment_id
                FROM review r
                JOIN novel n ON r.novel_id = n.id
                JOIN user u ON r.user_id = u.id
                WHERE r.parent_id = ? AND n.user_id = ?
                ORDER BY r.created_at ASC`,
                [parentId, req.authorId]
              );
              
              for (const nestedReply of nested) {
                nestedReply.replies = await loadNestedReplies(nestedReply.id);
              }
              
              return nested;
            };
            
            // 为每个子评论加载嵌套回复
            for (const childComment of childComments) {
              childComment.replies = await loadNestedReplies(childComment.id);
            }
          } else if (commentType === 'chapter') {
            // comment表的嵌套查询（章评）
            const [chapterChildComments] = await db.execute(
              `SELECT 
                c.id,
                'chapter' as comment_type,
                c.content,
                NULL as rating,
                c.created_at,
                c.likes,
                (SELECT COUNT(*) FROM comment WHERE parent_comment_id = c.id) as reply_count,
                0 as views,
                NULL as is_recommended,
                u.id as user_id,
                u.username,
                u.pen_name,
                u.is_author,
                u.avatar,
                u.is_vip,
                n.id as novel_id,
                n.title as novel_title,
                ch.id as chapter_id,
                ch.title as chapter_title,
                c.parent_comment_id
              FROM comment c
              JOIN chapter ch ON c.target_id = ch.id
              JOIN novel n ON ch.novel_id = n.id
              JOIN user u ON c.user_id = u.id
              WHERE c.parent_comment_id = ? AND n.user_id = ?
              ORDER BY c.created_at ASC`,
              [parentComment.id, req.authorId]
            );
            childComments = chapterChildComments;
            
            // 递归加载嵌套回复
            const loadNestedReplies = async (parentId) => {
              const [nested] = await db.execute(
                `SELECT 
                  c.id,
                  'chapter' as comment_type,
                  c.content,
                  NULL as rating,
                  c.created_at,
                  c.likes,
                  (SELECT COUNT(*) FROM comment WHERE parent_comment_id = c.id) as reply_count,
                  0 as views,
                  NULL as is_recommended,
                  u.id as user_id,
                  u.username,
                  u.pen_name,
                  u.is_author,
                  u.avatar,
                  u.is_vip,
                  n.id as novel_id,
                  n.title as novel_title,
                  ch.id as chapter_id,
                  ch.title as chapter_title,
                  c.parent_comment_id
                FROM comment c
                JOIN chapter ch ON c.target_id = ch.id
                JOIN novel n ON ch.novel_id = n.id
                JOIN user u ON c.user_id = u.id
                WHERE c.parent_comment_id = ? AND n.user_id = ?
                ORDER BY c.created_at ASC`,
                [parentId, req.authorId]
              );
              
              for (const nestedReply of nested) {
                nestedReply.replies = await loadNestedReplies(nestedReply.id);
              }
              
              return nested;
            };
            
            // 为每个子评论加载嵌套回复
            for (const childComment of childComments) {
              childComment.replies = await loadNestedReplies(childComment.id);
            }
          } else if (commentType === 'paragraph') {
            // paragraph_comment表的嵌套查询（段评）
            const [paragraphChildComments] = await db.execute(
              `SELECT 
                pc.id,
                'paragraph' as comment_type,
                pc.content,
                NULL as rating,
                pc.created_at,
                pc.like_count as likes,
                COALESCE(pc.dislike_count, 0) as dislikes,
                (SELECT COUNT(*) FROM paragraph_comment WHERE parent_id = pc.id) as reply_count,
                0 as views,
                NULL as is_recommended,
                u.id as user_id,
                u.username,
                u.pen_name,
                u.is_author,
                u.avatar,
                u.is_vip,
                n.id as novel_id,
                n.title as novel_title,
                ch.id as chapter_id,
                ch.title as chapter_title,
                pc.paragraph_index,
                pc.parent_id as parent_comment_id
              FROM paragraph_comment pc
              JOIN chapter ch ON pc.chapter_id = ch.id
              JOIN novel n ON ch.novel_id = n.id
              JOIN user u ON pc.user_id = u.id
              WHERE pc.parent_id = ? AND n.user_id = ?
              ORDER BY pc.created_at ASC`,
              [parentComment.id, req.authorId]
            );
            childComments = paragraphChildComments;
            
            // 递归加载嵌套回复
            const loadNestedReplies = async (parentId) => {
              const [nested] = await db.execute(
                `SELECT 
                  pc.id,
                  'paragraph' as comment_type,
                  pc.content,
                  NULL as rating,
                  pc.created_at,
                  pc.like_count as likes,
                  COALESCE(pc.dislike_count, 0) as dislikes,
                  (SELECT COUNT(*) FROM paragraph_comment WHERE parent_id = pc.id) as reply_count,
                  0 as views,
                  NULL as is_recommended,
                  u.id as user_id,
                  u.username,
                  u.pen_name,
                  u.is_author,
                  u.avatar,
                  u.is_vip,
                  n.id as novel_id,
                  n.title as novel_title,
                  ch.id as chapter_id,
                  ch.title as chapter_title,
                  pc.paragraph_index,
                  pc.parent_id as parent_comment_id
                FROM paragraph_comment pc
                JOIN chapter ch ON pc.chapter_id = ch.id
                JOIN novel n ON ch.novel_id = n.id
                JOIN user u ON pc.user_id = u.id
                WHERE pc.parent_id = ? AND n.user_id = ?
                ORDER BY pc.created_at ASC`,
                [parentId, req.authorId]
              );
              
              for (const nestedReply of nested) {
                nestedReply.replies = await loadNestedReplies(nestedReply.id);
              }
              
              return nested;
            };
            
            // 为每个子评论加载嵌套回复
            for (const childComment of childComments) {
              childComment.replies = await loadNestedReplies(childComment.id);
            }
          }
          
          parentComment.replies = childComments;
        } catch (error) {
          console.error('加载子评论失败:', error);
          parentComment.replies = [];
        }
      }
      
      // 排序父评论
      if (sortBy === 'hottest') {
        parentComments.sort((a, b) => {
          if (b.likes !== a.likes) return b.likes - a.likes;
          if (b.reply_count !== a.reply_count) return b.reply_count - a.reply_count;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
      } else {
        parentComments.sort((a, b) => {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
      }
      
      // 获取总数（只计算父评论）
      const total = parentComments.length;
      
      // 分页
      const paginatedComments = parentComments.slice(offset, offset + parseInt(limit));
      
      return res.json({
        success: true,
        data: {
          comments: paginatedComments,
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit))
        }
      });
    }

    // 其他情况（非review类型或选择了举报原因）：不嵌套，直接返回
    // 排序
    if (sortBy === 'hottest') {
      allComments.sort((a, b) => {
        if (b.likes !== a.likes) return b.likes - a.likes;
        if (b.reply_count !== a.reply_count) return b.reply_count - a.reply_count;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    } else {
      allComments.sort((a, b) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }

    // 获取总数
    const total = allComments.length;

    // 分页
    const paginatedComments = allComments.slice(offset, offset + parseInt(limit));

    res.json({
      success: true,
      data: {
        comments: paginatedComments,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('获取评论列表失败:', error);
    res.status(500).json({ success: false, message: '获取评论列表失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// 作者回复评论
router.post('/comments/:commentId/reply', authenticateAuthor, async (req, res) => {
  let db;
  try {
    const { commentId } = req.params;
    const { content, commentType } = req.body; // commentType: 'review', 'discussion', 'chapter', 'paragraph'

    if (!content || content.trim().length < 1) {
      return res.status(400).json({ success: false, message: '回复内容不能为空' });
    }

    db = await mysql.createConnection(dbConfig);

    // 根据评论类型确定target_id和novel_id
    let targetId, novelId;

    if (commentType === 'review') {
      // 回复评价：将回复保存到review表，使用parent_id关联
      const [reviews] = await db.execute(
        'SELECT id, novel_id FROM review WHERE id = ?',
        [commentId]
      );
      
      if (reviews.length === 0) {
        return res.status(404).json({ success: false, message: '评价不存在' });
      }

      // 验证是否是作者的作品
      const [novels] = await db.execute(
        'SELECT id FROM novel WHERE id = ? AND user_id = ?',
        [reviews[0].novel_id, req.authorId]
      );

      if (novels.length === 0) {
        return res.status(403).json({ success: false, message: '无权回复此评价' });
      }

      // 将回复保存到review表，使用parent_id关联
      const [result] = await db.execute(
        `INSERT INTO review (parent_id, novel_id, user_id, content, created_at, rating, likes, comments, views, is_recommended)
         VALUES (?, ?, ?, ?, NOW(), NULL, 0, 0, 0, 0)`,
        [commentId, reviews[0].novel_id, req.authorId, content.trim()]
      );

      // 更新父评论的回复数
      await db.execute(
        'UPDATE review SET comments = comments + 1 WHERE id = ?',
        [commentId]
      );

      return res.json({
        success: true,
        message: '回复成功',
        data: {
          comment_id: result.insertId
        }
      });
    } else {
      // 回复其他类型的评论（章节评论）：在comment表中，parent_comment_id指向原评论
      // comment表现在只存储章节评论，target_id就是chapter_id
      const [comments] = await db.execute(
        `SELECT c.id, c.target_id, c.parent_comment_id, c.novel_id, ch.novel_id as chapter_novel_id
         FROM comment c
         LEFT JOIN chapter ch ON c.target_id = ch.id
         WHERE c.id = ?`,
        [commentId]
      );

      if (comments.length === 0) {
        return res.status(404).json({ success: false, message: '评论不存在' });
      }

      // 获取novel_id（优先使用comment表的novel_id，如果没有则从chapter表获取）
      novelId = comments[0].novel_id || comments[0].chapter_novel_id;

      if (!novelId) {
        return res.status(404).json({ success: false, message: '无法确定小说ID' });
      }

      // 验证是否是作者的作品
      const [novels] = await db.execute(
        'SELECT id FROM novel WHERE id = ? AND user_id = ?',
        [novelId, req.authorId]
      );

      if (novels.length === 0) {
        return res.status(403).json({ success: false, message: '无权回复此评论' });
      }

      targetId = comments[0].target_id; // chapter_id
    }

    // 插入回复到comment表（非review类型的评论）
    const [result] = await db.execute(
      `INSERT INTO comment (user_id, target_id, novel_id, parent_comment_id, content, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [req.authorId, targetId, novelId, commentId, content.trim()]
    );

    res.json({
      success: true,
      message: '回复成功',
      data: {
        comment_id: result.insertId
      }
    });
  } catch (error) {
    console.error('回复评论失败:', error);
    res.status(500).json({ success: false, message: '回复评论失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// 获取评论的回复列表
router.get('/comments/:commentId/replies', authenticateAuthor, async (req, res) => {
  let db;
  try {
    const { commentId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    // 验证参数
    const commentIdNum = parseInt(commentId);
    if (isNaN(commentIdNum)) {
      return res.status(400).json({ success: false, message: '无效的评论ID' });
    }

    if (isNaN(page) || isNaN(limit) || isNaN(offset)) {
      return res.status(400).json({ success: false, message: '无效的分页参数' });
    }

    db = await mysql.createConnection(dbConfig);

    // 确保所有参数都是数字类型
    const commentIdParam = Number(commentIdNum);
    const limitParam = Number(limit);
    const offsetParam = Number(offset);

    console.log('获取回复列表参数:', { commentIdParam, limitParam, offsetParam });

    const [replies] = await db.query(
      `SELECT 
        c.id,
        c.content,
        c.created_at,
        c.likes,
        u.id as user_id,
        u.username,
        u.pen_name,
        u.avatar,
        u.is_vip,
        u.is_author
       FROM comment c
       JOIN user u ON c.user_id = u.id
       WHERE c.parent_comment_id = ?
       ORDER BY c.created_at ASC
       LIMIT ? OFFSET ?`,
      [commentIdParam, limitParam, offsetParam]
    );

    const [countResult] = await db.query(
      'SELECT COUNT(*) as total FROM comment WHERE parent_comment_id = ?',
      [commentIdParam]
    );

    res.json({
      success: true,
      data: {
        replies,
        total: countResult[0].total,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('获取回复列表失败:', error);
    res.status(500).json({ success: false, message: '获取回复列表失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

module.exports = router;

