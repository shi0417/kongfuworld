-- 迁移脚本：合并 review_dislike / comment_dislike 到 review_like / comment_like
-- 执行时间: 2025-12-01
-- 目标：使用单表 + is_like 字段统一管理点赞/点踩

-- ============================================
-- 第 1 步：为 review_like / comment_like 增加 is_like 字段
-- ============================================

-- 为 review_like 添加 is_like 字段，默认 1（点赞）
ALTER TABLE review_like 
  ADD COLUMN is_like TINYINT(1) NOT NULL DEFAULT 1 AFTER user_id;

-- 为 comment_like 添加 is_like 字段，默认 1（点赞）
ALTER TABLE comment_like 
  ADD COLUMN is_like TINYINT(1) NOT NULL DEFAULT 1 AFTER user_id;

-- ============================================
-- 第 2 步：迁移 review_dislike / comment_dislike 旧数据到 *_like
-- ============================================

-- 将 review_dislike 中的数据迁移到 review_like，并标记 is_like = 0
-- 如果同一用户既有点赞又有点踩，以点踩优先生效（is_like = 0）
INSERT INTO review_like (review_id, user_id, is_like, created_at)
SELECT review_id, user_id, 0 AS is_like, created_at
FROM review_dislike
ON DUPLICATE KEY UPDATE
  is_like = 0,
  created_at = LEAST(review_like.created_at, VALUES(created_at));

-- 将 comment_dislike 中的数据迁移到 comment_like，并标记 is_like = 0
-- 如果同一用户既有点赞又有点踩，以点踩优先生效（is_like = 0）
INSERT INTO comment_like (comment_id, user_id, is_like, created_at)
SELECT comment_id, user_id, 0 AS is_like, created_at
FROM comment_dislike
ON DUPLICATE KEY UPDATE
  is_like = 0,
  created_at = LEAST(comment_like.created_at, VALUES(created_at));

-- ============================================
-- 第 3 步：重新计算并回填 review / comment 的 likes / dislikes
-- ============================================

-- 确保 review 表有 dislikes 字段（如果还没有的话）
-- 注意：MySQL 5.7+ 不支持 ADD COLUMN IF NOT EXISTS，需要手动检查
-- 根据之前的检查，review 表已经有 dislikes 字段，所以这里注释掉
-- ALTER TABLE review ADD COLUMN dislikes INT NOT NULL DEFAULT 0 AFTER likes;

-- 确保 comment 表有 dislikes 字段（如果还没有的话）
-- 根据之前的检查，comment 表已经有 dislikes 字段，所以这里注释掉
-- ALTER TABLE comment ADD COLUMN dislikes INT NOT NULL DEFAULT 0 AFTER likes;

-- 用 review_like 聚合回写 review.likes / review.dislikes
UPDATE review r
LEFT JOIN (
  SELECT 
    review_id,
    SUM(CASE WHEN is_like = 1 THEN 1 ELSE 0 END) AS like_count,
    SUM(CASE WHEN is_like = 0 THEN 1 ELSE 0 END) AS dislike_count
  FROM review_like
  GROUP BY review_id
) rl ON rl.review_id = r.id
SET 
  r.likes    = COALESCE(rl.like_count, 0),
  r.dislikes = COALESCE(rl.dislike_count, 0);

-- 用 comment_like 聚合回写 comment.likes / comment.dislikes
UPDATE comment c
LEFT JOIN (
  SELECT 
    comment_id,
    SUM(CASE WHEN is_like = 1 THEN 1 ELSE 0 END) AS like_count,
    SUM(CASE WHEN is_like = 0 THEN 1 ELSE 0 END) AS dislike_count
  FROM comment_like
  GROUP BY comment_id
) cl ON cl.comment_id = c.id
SET 
  c.likes    = COALESCE(cl.like_count, 0),
  c.dislikes = COALESCE(cl.dislike_count, 0);

-- ============================================
-- 第 4 步：删除 review_dislike / comment_dislike 表
-- ============================================

-- 注意：只在确认数据成功迁移后再删除
DROP TABLE IF EXISTS review_dislike;
DROP TABLE IF EXISTS comment_dislike;

