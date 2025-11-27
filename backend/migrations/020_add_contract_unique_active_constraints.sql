-- 为 novel_editor_contract 表添加唯一活跃合同约束
-- 确保同一本小说 novel_id + 同一个 role 角色，同一时间只能有一个 status='active' 的合同

-- 1. 删除已存在的触发器（如果存在）
DROP TRIGGER IF EXISTS `trg_contract_before_insert_check_active`;
DROP TRIGGER IF EXISTS `trg_contract_before_update_check_active`;

-- 2. 创建 BEFORE INSERT 触发器：检查是否已有 active 合同
CREATE TRIGGER `trg_contract_before_insert_check_active`
BEFORE INSERT ON `novel_editor_contract`
FOR EACH ROW
BEGIN
  -- 如果新插入的合同状态为 'active'，检查是否已存在相同 novel_id + role 的 active 合同
  IF NEW.status = 'active' THEN
    IF EXISTS (
      SELECT 1 FROM `novel_editor_contract`
      WHERE `novel_id` = NEW.novel_id
        AND `role` = NEW.role
        AND `status` = 'active'
        AND `id` != NEW.id
    ) THEN
      SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = '同一本小说的同一角色只能有一个活跃合同，请先结束旧合同';
    END IF;
  END IF;
END;

-- 3. 创建 BEFORE UPDATE 触发器：禁止将另一个记录设置为 active
CREATE TRIGGER `trg_contract_before_update_check_active`
BEFORE UPDATE ON `novel_editor_contract`
FOR EACH ROW
BEGIN
  -- 如果更新后的状态为 'active'，且与更新前不同，检查是否已存在相同 novel_id + role 的 active 合同
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
    IF EXISTS (
      SELECT 1 FROM `novel_editor_contract`
      WHERE `novel_id` = NEW.novel_id
        AND `role` = NEW.role
        AND `status` = 'active'
        AND `id` != NEW.id
    ) THEN
      SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = '同一本小说的同一角色只能有一个活跃合同，请先结束旧合同';
    END IF;
  END IF;
  
  -- 如果更新了 novel_id 或 role，且状态为 active，检查新组合是否冲突
  IF NEW.status = 'active' AND (NEW.novel_id != OLD.novel_id OR NEW.role != OLD.role) THEN
    IF EXISTS (
      SELECT 1 FROM `novel_editor_contract`
      WHERE `novel_id` = NEW.novel_id
        AND `role` = NEW.role
        AND `status` = 'active'
        AND `id` != NEW.id
    ) THEN
      SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = '同一本小说的同一角色只能有一个活跃合同，请先结束旧合同';
    END IF;
  END IF;
END;

