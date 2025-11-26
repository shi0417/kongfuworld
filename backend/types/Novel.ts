/**
 * Novel 模型类型定义
 * 对应数据库 novel 表
 */

export interface Novel {
  id: number;
  user_id?: number | null;
  current_editor_admin_id?: number | null;
  chief_editor_admin_id?: number | null;
  title: string;
  status?: string | null;
  cover?: string | null;
  rating?: number;
  reviews?: number;
  author?: string | null;
  translator?: string | null;
  description?: string | null;
  recommendation?: string | null;
  languages?: string | null;
  chapters?: number;
  licensed_from?: string | null;
  review_status?: string;
  requires_chief_edit?: number | boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Novel 数据库字段说明
 * 
 * current_editor_admin_id: 该小说当前责任编辑 admin_id（若无则为NULL）
 *   - 外键: fk_novel_current_editor → admin(id) ON DELETE SET NULL
 *   - 索引: fk_novel_current_editor
 * 
 * chief_editor_admin_id: 该小说当前主编 admin_id（若无则为NULL）
 *   - 外键: fk_novel_chief_editor → admin(id) ON DELETE SET NULL
 *   - 索引: idx_novel_chief_editor_admin_id
 */

