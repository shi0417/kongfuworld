-- 创建小说编辑合同表（如果不存在）
CREATE TABLE IF NOT EXISTS `novel_editor_contract` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `novel_id` INT NOT NULL,
  `editor_admin_id` INT NOT NULL,
  `role` ENUM('chief_editor', 'editor', 'proofreader') DEFAULT 'editor',
  `share_type` ENUM('percent_of_book', 'percent_of_author') DEFAULT 'percent_of_book',
  `share_percent` DECIMAL(8,4) DEFAULT NULL,
  `start_chapter_id` INT DEFAULT NULL,
  `end_chapter_id` INT DEFAULT NULL,
  `start_date` DATETIME NOT NULL,
  `end_date` DATETIME DEFAULT NULL,
  `status` ENUM('active','ended','cancelled') DEFAULT 'active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_editor_contract_novel` FOREIGN KEY (`novel_id`) REFERENCES `novel`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_editor_contract_admin` FOREIGN KEY (`editor_admin_id`) REFERENCES `admin`(`id`) ON DELETE CASCADE,
  INDEX `idx_novel_id` (`novel_id`),
  INDEX `idx_editor_admin_id` (`editor_admin_id`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 创建编辑收入月度表（如果不存在）
CREATE TABLE IF NOT EXISTS `editor_income_monthly` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `editor_admin_id` INT NOT NULL,
  `novel_id` INT NOT NULL,
  `month` DATE NOT NULL,
  `gross_book_income_usd` DECIMAL(18,6) DEFAULT 0,
  `editor_share_percent` DECIMAL(8,4) DEFAULT 0,
  `editor_income_usd` DECIMAL(18,6) DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_editor_month_novel` (`editor_admin_id`, `novel_id`, `month`),
  CONSTRAINT `fk_editor_income_admin` FOREIGN KEY (`editor_admin_id`) REFERENCES `admin`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_editor_income_novel` FOREIGN KEY (`novel_id`) REFERENCES `novel`(`id`) ON DELETE CASCADE,
  INDEX `idx_editor_admin_id` (`editor_admin_id`),
  INDEX `idx_novel_id` (`novel_id`),
  INDEX `idx_month` (`month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

