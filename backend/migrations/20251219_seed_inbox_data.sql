-- 站内信系统 Seed 数据
-- 执行时间：2025-12-19
-- 说明：创建3个作者会话（签约/推荐/结算）+ 每个会话5条消息（含system消息与internal_note）

-- 假设：
-- 1. 存在至少一个作者用户（user.id = 1）
-- 2. 存在至少一个管理员（admin.id = 1）
-- 3. 存在至少一本小说（novel.id = 1）

-- 会话1：签约相关
INSERT INTO `conversations` (`subject`, `category`, `status`, `priority`, `created_by`, `related_novel_id`, `created_at`, `updated_at`) VALUES
('签约申请咨询', 'contract', 'in_progress', 'high', 1, 1, NOW() - INTERVAL 5 DAY, NOW() - INTERVAL 1 HOUR);

SET @conv1_id = LAST_INSERT_ID();

INSERT INTO `conversation_participants` (`conversation_id`, `user_id`, `admin_id`, `role`) VALUES
(@conv1_id, 1, NULL, 'author'),
(@conv1_id, NULL, 1, 'admin');

-- 会话1的消息
INSERT INTO `messages` (`conversation_id`, `sender_id`, `sender_admin_id`, `sender_type`, `content`, `internal_note`, `created_at`) VALUES
(@conv1_id, 1, NULL, 'author', '您好，我想咨询一下签约流程，需要准备哪些材料？', 0, NOW() - INTERVAL 5 DAY),
(@conv1_id, NULL, 1, 'admin', '您好！签约需要准备身份证、银行卡信息以及作品大纲。', 0, NOW() - INTERVAL 4 DAY),
(@conv1_id, NULL, 1, 'admin', '【内部备注】该作者作品质量不错，建议优先处理', 1, NOW() - INTERVAL 4 DAY + INTERVAL 1 HOUR),
(@conv1_id, NULL, NULL, 'system', '系统消息：会话状态已更新为"进行中"', 0, NOW() - INTERVAL 3 DAY),
(@conv1_id, 1, NULL, 'author', '好的，我已经准备好了材料，请问如何提交？', 0, NOW() - INTERVAL 2 DAY),
(@conv1_id, NULL, 1, 'admin', '您可以在"我的合同"页面提交签约申请，我们会尽快审核。', 0, NOW() - INTERVAL 1 HOUR);

SET @msg1_last = LAST_INSERT_ID();

-- 会话1的已读状态（作者未读最后2条）
INSERT INTO `conversation_reads` (`conversation_id`, `user_id`, `admin_id`, `last_read_message_id`, `unread_count`, `last_read_at`) VALUES
(@conv1_id, 1, NULL, (SELECT id FROM messages WHERE conversation_id = @conv1_id AND sender_type = 'admin' AND internal_note = 0 ORDER BY created_at ASC LIMIT 1 OFFSET 1), 2, NOW() - INTERVAL 2 DAY),
(@conv1_id, NULL, 1, @msg1_last, 0, NOW());

-- 会话2：推荐相关
INSERT INTO `conversations` (`subject`, `category`, `status`, `priority`, `created_by`, `related_novel_id`, `created_at`, `updated_at`) VALUES
('作品推荐申请', 'recommendation', 'open', 'normal', 1, 1, NOW() - INTERVAL 3 DAY, NOW() - INTERVAL 2 DAY);

SET @conv2_id = LAST_INSERT_ID();

INSERT INTO `conversation_participants` (`conversation_id`, `user_id`, `admin_id`, `role`) VALUES
(@conv2_id, 1, NULL, 'author'),
(@conv2_id, NULL, 1, 'admin');

INSERT INTO `messages` (`conversation_id`, `sender_id`, `sender_admin_id`, `sender_type`, `content`, `internal_note`, `created_at`) VALUES
(@conv2_id, 1, NULL, 'author', '我的作品《正道宏图》已经更新到50万字了，可以申请推荐吗？', 0, NOW() - INTERVAL 3 DAY),
(@conv2_id, NULL, NULL, 'system', '系统消息：新会话已创建', 0, NOW() - INTERVAL 3 DAY),
(@conv2_id, NULL, 1, 'admin', '【内部备注】该作品数据一般，暂不建议推荐', 1, NOW() - INTERVAL 2 DAY + INTERVAL 1 HOUR),
(@conv2_id, NULL, 1, 'admin', '您好，推荐申请需要作品达到一定标准，我们会进行评估。', 0, NOW() - INTERVAL 2 DAY),
(@conv2_id, 1, NULL, 'author', '好的，我会继续努力更新，谢谢！', 0, NOW() - INTERVAL 1 DAY);

SET @msg2_last = LAST_INSERT_ID();

INSERT INTO `conversation_reads` (`conversation_id`, `user_id`, `admin_id`, `last_read_message_id`, `unread_count`, `last_read_at`) VALUES
(@conv2_id, 1, NULL, @msg2_last, 0, NOW() - INTERVAL 1 DAY),
(@conv2_id, NULL, 1, @msg2_last, 0, NOW() - INTERVAL 1 DAY);

-- 会话3：结算相关
INSERT INTO `conversations` (`subject`, `category`, `status`, `priority`, `created_by`, `related_novel_id`, `created_at`, `updated_at`) VALUES
('收入结算问题', 'settlement', 'resolved', 'normal', 1, 1, NOW() - INTERVAL 7 DAY, NOW() - INTERVAL 1 DAY);

SET @conv3_id = LAST_INSERT_ID();

INSERT INTO `conversation_participants` (`conversation_id`, `user_id`, `admin_id`, `role`) VALUES
(@conv3_id, 1, NULL, 'author'),
(@conv3_id, NULL, 1, 'admin');

INSERT INTO `messages` (`conversation_id`, `sender_id`, `sender_admin_id`, `sender_type`, `content`, `internal_note`, `created_at`) VALUES
(@conv3_id, 1, NULL, 'author', '请问上个月的收入什么时候结算？', 0, NOW() - INTERVAL 7 DAY),
(@conv3_id, NULL, 1, 'admin', '每月15号结算上个月收入，请耐心等待。', 0, NOW() - INTERVAL 6 DAY),
(@conv3_id, NULL, 1, 'admin', '【内部备注】该用户收入正常，已确认', 1, NOW() - INTERVAL 6 DAY + INTERVAL 1 HOUR),
(@conv3_id, NULL, NULL, 'system', '系统消息：会话状态已更新为"已解决"', 0, NOW() - INTERVAL 1 DAY),
(@conv3_id, 1, NULL, 'author', '好的，谢谢！', 0, NOW() - INTERVAL 1 DAY);

SET @msg3_last = LAST_INSERT_ID();

INSERT INTO `conversation_reads` (`conversation_id`, `user_id`, `admin_id`, `last_read_message_id`, `unread_count`, `last_read_at`) VALUES
(@conv3_id, 1, NULL, @msg3_last, 0, NOW() - INTERVAL 1 DAY),
(@conv3_id, NULL, 1, @msg3_last, 0, NOW() - INTERVAL 1 DAY);

-- 更新会话的resolved_at时间
UPDATE `conversations` SET `resolved_at` = NOW() - INTERVAL 1 DAY WHERE `id` = @conv3_id;

