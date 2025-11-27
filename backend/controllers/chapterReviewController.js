const ChapterReviewService = require('../services/chapterReviewService');
const { checkNovelPermission } = require('../middleware/permissionMiddleware');

/**
 * 章节审核控制器
 * 处理章节审核相关的HTTP请求
 */
class ChapterReviewController {
  constructor(dbConfig) {
    this.service = new ChapterReviewService(dbConfig);
  }

  /**
   * 审核章节（统一接口，支持主编终审流程）
   * POST /admin/chapter/review
   */
  async reviewChapter(req, res) {
    let db;
    try {
      const { chapter_id, result, comment } = req.body;
      const adminId = req.admin.adminId;
      const role = req.admin.role;

      // 参数验证
      if (!chapter_id || !result) {
        return res.status(400).json({
          success: false,
          message: '章节ID和审核结果必填'
        });
      }

      if (!['approved', 'rejected', 'reviewing'].includes(result)) {
        return res.status(400).json({
          success: false,
          message: '审核结果必须是 approved/rejected/reviewing'
        });
      }

      // 权限验证：只有 editor、chief_editor 或 super_admin 可以审核
      if (role !== 'editor' && role !== 'chief_editor' && role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: '只有编辑和主编可以审核章节'
        });
      }

      // 检查章节是否存在
      const chapter = await this.service.getChapterById(chapter_id);
      if (!chapter) {
        return res.status(404).json({ success: false, message: '章节不存在' });
      }

      // 检查权限
      db = await this.service.createConnection();
      const hasPermission = await checkNovelPermission(
        db,
        adminId,
        role,
        chapter.novel_id
      );
      await db.end();

      if (!hasPermission) {
        return res.status(403).json({ success: false, message: '无权限审核此章节' });
      }

      // 执行审核（使用新的统一接口）
      const currentAdmin = {
        id: adminId,
        role: role
      };

      const reviewResult = await this.service.reviewChapter(currentAdmin, {
        chapter_id,
        result,
        comment
      });

      res.json({
        success: true,
        message: '审核操作成功',
        data: reviewResult
      });
    } catch (error) {
      console.error('章节审核失败:', error);
      res.status(500).json({
        success: false,
        message: '审核失败',
        error: error.message
      });
    }
  }

  /**
   * 批量审核章节
   * POST /admin/chapters/batch-review
   */
  async batchReviewChapters(req, res) {
    let db;
    try {
      const { chapter_ids, result, comment } = req.body;
      const adminId = req.admin.adminId;
      const role = req.admin.role;

      // 参数验证
      if (!chapter_ids || !Array.isArray(chapter_ids) || chapter_ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: '章节ID列表必填'
        });
      }

      if (!result || !['approved', 'rejected'].includes(result)) {
        return res.status(400).json({
          success: false,
          message: '审核结果必须是 approved 或 rejected'
        });
      }

      // 权限验证
      if (role !== 'editor' && role !== 'chief_editor' && role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: '只有编辑和主编可以审核章节'
        });
      }

      // 检查所有章节的权限
      db = await this.service.createConnection();
      const placeholders = chapter_ids.map(() => '?').join(',');
      const [chapters] = await db.execute(
        `SELECT id, novel_id FROM chapter WHERE id IN (${placeholders})`,
        chapter_ids
      );

      if (chapters.length === 0) {
        await db.end();
        return res.status(404).json({ success: false, message: '未找到任何章节' });
      }

      // 检查每个章节的权限
      for (const chapter of chapters) {
        const hasPermission = await checkNovelPermission(
          db,
          adminId,
          role,
          chapter.novel_id
        );

        if (!hasPermission) {
          await db.end();
          return res.status(403).json({
            success: false,
            message: `无权限审核章节 ${chapter.id}`
          });
        }
      }
      await db.end();

      // 执行批量审核
      const reviewResult = await this.service.batchReviewChapters({
        chapterIds: chapter_ids,
        result,
        reviewAdminId: adminId,
        comment
      });

      res.json({
        success: true,
        message: `成功批量审核 ${reviewResult.count} 个章节`,
        data: reviewResult
      });
    } catch (error) {
      console.error('批量审核章节失败:', error);
      res.status(500).json({
        success: false,
        message: '批量审核失败',
        error: error.message
      });
    }
  }
}

module.exports = ChapterReviewController;

