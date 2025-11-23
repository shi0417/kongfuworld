# 数据库表结构参考文档

## 概述
本文档记录了 `kongfuworld` 数据库的表结构信息，作为程序开发的参考。

## 核心表结构

### 1. novel 表（小说表）
| 字段名 | 类型 | 说明 | 默认值 |
|--------|------|------|--------|
| id | int | 主键，自增 | - |
| title | varchar(255) | 小说标题 | - |
| status | varchar(50) | 状态（ongoing/completed） | - |
| cover | varchar(255) | 封面图片URL | - |
| rating | int | 评分 | 0 |
| reviews | int | 评论数 | 0 |
| author | varchar(100) | 作者 | - |
| translator | varchar(100) | 翻译者 | - |
| description | text | 小说描述 | - |
| recommendation | text | 推荐语 | - |
| languages | varchar(255) | 支持的语言（如：en,zh,es，多个语言用逗号分隔） | - |
| chapters | int | 章节数 | 0 |
| licensed_from | varchar(100) | 版权来源 | - |
| review_status | enum | 审核状态（created=草稿/已创建, submitted=已提交, reviewing=审核中, approved=审核通过, published=已上架, unlisted=已下架, archived=已归档, locked=已锁定/违规锁定） | created |
| created_at | datetime | 创建时间 | CURRENT_TIMESTAMP |

### 2. volume 表（卷表）
| 字段名 | 类型 | 说明 | 默认值 |
|--------|------|------|--------|
| id | int | 主键，自增 | - |
| novel_id | int | 小说ID，外键 | - |
| volume_id | int | 卷ID（用于关联章节） | - |
| title | varchar(255) | 卷标题 | - |
| start_chapter | int | 起始章节号 | - |
| end_chapter | int | 结束章节号 | - |
| chapter_count | int | 章节数 | 0 |

### 3. chapter 表（章节表）
| 字段名 | 类型 | 说明 | 默认值 |
|--------|------|------|--------|
| id | int | 主键，自增 | - |
| novel_id | int | 小说ID，外键 | - |
| volume_id | int | 卷ID，外键 | - |
| chapter_number | int | 章节号 | - |
| title | varchar(255) | 章节标题 | - |
| content | text | 章节内容 | - |
| created_at | datetime | 创建时间 | CURRENT_TIMESTAMP |
| translator_note | text | 翻译注释 | - |
| is_locked | tinyint(1) | 是否锁定 | 0 |
| is_vip_only | tinyint(1) | 是否VIP专享 | 0 |
| is_advance | tinyint(1) | 是否抢先版 | 0 |
| is_visible | tinyint(1) | 是否可见 | 1 |
| prev_chapter_id | int | 上一章节ID | - |
| unlock_price | int | 解锁价格（旧字段） | 0 |
| unlock_cost | int | 解锁金币（新增） | 0 |
| word_count | int | 字数统计（新增） | 0 |
| review_status | enum | 审核状态（submitted=提交中, reviewing=审核中, approved=审核通过, rejected=审核不通过, draft=草稿） | submitted |

## 其他重要表

### 4. user 表（用户表）
| 字段名 | 类型 | 说明 | 默认值 |
|--------|------|------|--------|
| id | int | 主键，自增 | - |
| username | varchar(50) | 用户名，唯一 | - |
| email | varchar(100) | 邮箱，唯一 | - |
| confirmed_email | varchar(100) | 已验证的邮箱地址 | NULL |
| password_hash | varchar(255) | 密码哈希 | - |
| avatar | varchar(255) | 头像URL | - |
| is_vip | tinyint(1) | 是否VIP | 0 |
| is_author | tinyint(1) | 是否是作者 | 0 |
| pen_name | varchar(100) | 笔名 | NULL |
| bio | text | 作者简介 | NULL |
| balance | decimal(10,2) | 余额 | 0.00 |
| points | int | 积分 | 0 |
| karma | int | 功德值 | 0 |
| vip_expire_at | datetime | VIP过期时间 | - |
| status | enum | 状态（active/banned） | active |
| settings_json | json | 用户设置 | - |
| social_links | json | 社交媒体链接 | NULL |
| referrer_id | int | 推荐人用户ID | NULL |

### 5. chapter_unlock 表（章节解锁记录）
| 字段名 | 类型 | 说明 | 默认值 |
|--------|------|------|--------|
| id | int | 主键，自增 | - |
| user_id | int | 用户ID | - |
| chapter_id | int | 章节ID | - |
| unlock_type | enum | 解锁类型（key/karma/wtu） | - |
| unlocked_at | datetime | 解锁时间 | CURRENT_TIMESTAMP |

### 6. randomNotes 表（随记表）
| 字段名 | 类型 | 说明 | 默认值 |
|--------|------|------|--------|
| id | int | 主键，自增 | - |
| user_id | int | 用户ID | - |
| novel_id | int | 小说ID | - |
| random_note | text | 随记内容 | - |
| created_at | datetime | 创建时间 | CURRENT_TIMESTAMP |
| updated_at | datetime | 更新时间 | CURRENT_TIMESTAMP |

### 7. unlockprice 表（用户解锁章节费用设定表）
| 字段名 | 类型 | 说明 | 默认值 |
|--------|------|------|--------|
| id | int | 主键，自增 | - |
| user_id | int | 用户ID，外键 | - |
| novel_id | int | 小说ID，外键 | - |
| fixed_style | tinyint(1) | 费用模式（0=随机，1=固定） | 1 |
| fixed_cost | int | 固定费用值 | 20 |
| random_cost_min | int | 随机费用最小值 | NULL |
| random_cost_max | int | 随机费用最大值 | NULL |
| created_at | datetime | 创建时间 | CURRENT_TIMESTAMP |
| updated_at | datetime | 更新时间 | CURRENT_TIMESTAMP |

**索引**:
- PRIMARY (id) - 主键
- idx_user_id (user_id) - 普通索引，用于快速查询用户的费用设定
- idx_novel_id (novel_id) - 普通索引，用于快速查询小说的费用设定
- idx_user_novel (user_id, novel_id) - 复合索引，用于快速查询特定用户对特定小说的费用设定

**外键约束**:
- unlockprice_ibfk_1: user_id -> user.id (ON DELETE CASCADE)
- unlockprice_ibfk_2: novel_id -> novel.id (ON DELETE CASCADE)

**特点**:
- 支持为每个用户对每本小说设定不同的解锁费用
- fixed_style=1 时使用固定费用（fixed_cost）
- fixed_style=0 时使用随机费用（random_cost_min 到 random_cost_max 之间）
- 默认使用固定费用模式，固定费用为20

### 8. draft 表（草稿表）
| 字段名 | 类型 | 说明 | 默认值 |
|--------|------|------|--------|
| id | int | 主键，自增 | - |
| user_id | int | 用户ID | - |
| novel_id | int | 小说ID | - |
| chapter_id | int | 章节ID（编辑已有章节时关联，新建章节时为NULL） | NULL |
| chapter_number | int | 章节号 | - |
| title | varchar(255) | 章节标题 | - |
| content | text | 章节内容 | - |
| translator_note | text | 译者备注/作者有话说 | - |
| word_count | int | 字数统计 | 0 |
| created_at | datetime | 创建时间（定时保存时间） | CURRENT_TIMESTAMP |

## 索引信息

### novel 表索引
- PRIMARY (id)
- idx_user_id (user_id) - 普通索引，用于快速查询作者的小说
- idx_review_status (review_status) - 普通索引，用于快速查询审核状态

### volume 表索引
- PRIMARY (id)
- novel_id (普通索引)

### chapter 表索引
- PRIMARY (id)
- novel_id (普通索引)
- volume_id (普通索引)

### user 表索引
- PRIMARY (id)
- username (唯一索引)
- email (唯一索引)
- idx_pen_name (普通索引)

### randomNotes 表索引
- PRIMARY (id)
- idx_user_id (user_id) - 普通索引，用于快速查询用户的随记
- idx_novel_id (novel_id) - 普通索引，用于快速查询小说的随记
- idx_user_novel (user_id, novel_id) - 复合索引，用于快速查询特定用户对特定小说的随记

### unlockprice 表索引
- PRIMARY (id)
- idx_user_id (user_id) - 普通索引，用于快速查询用户的费用设定
- idx_novel_id (novel_id) - 普通索引，用于快速查询小说的费用设定
- idx_user_novel (user_id, novel_id) - 复合索引，用于快速查询特定用户对特定小说的费用设定

### draft 表索引
- PRIMARY (id)
- idx_user_id (user_id) - 普通索引，用于快速查询用户的草稿
- idx_novel_id (novel_id) - 普通索引，用于快速查询小说的草稿
- idx_chapter_id (chapter_id) - 普通索引，用于快速查询章节的草稿
- idx_user_novel_chapter (user_id, novel_id, chapter_number) - 复合索引，用于快速查询特定用户对特定小说的特定章节的草稿
- idx_created_at (created_at) - 普通索引，用于按时间排序

## 数据关系

1. **user** ←→ **novel** (1:N)
   - user.id = novel.user_id (外键约束，ON DELETE SET NULL)

2. **novel** ←→ **volume** (1:N)
   - novel.id = volume.novel_id

3. **volume** ←→ **chapter** (1:N)
   - volume.id = chapter.volume_id

4. **novel** ←→ **chapter** (1:N)
   - novel.id = chapter.novel_id

4. **user** ←→ **chapter_unlock** (1:N)
   - user.id = chapter_unlock.user_id

5. **user** ←→ **unlockprice** (1:N)
   - user.id = unlockprice.user_id

6. **novel** ←→ **unlockprice** (1:N)
   - novel.id = unlockprice.novel_id

## 字段映射说明

### 代码中的字段映射
- `novel.chapters` ← 对应数据库中的 `chapters` 字段
- `volume.chapter_count` ← 对应数据库中的 `chapter_count` 字段
- `chapter.unlock_cost` ← 对应数据库中的 `unlock_cost` 字段
- `chapter.word_count` ← 对应数据库中的 `word_count` 字段

### 兼容性字段
- `chapter.unlock_price` 和 `chapter.unlock_cost` 同时存在，保持向后兼容

## 注意事项

1. **新增字段**：`chapter_count`、`unlock_cost`、`word_count` 是新增字段
2. **数据同步**：程序会自动同步这些字段的数据
3. **向后兼容**：保留了原有字段，确保现有功能不受影响
4. **索引优化**：建议根据查询需求添加适当的索引

## 维护建议

1. 定期备份数据库
2. 监控表大小和查询性能
3. 根据业务需求调整索引
4. 定期清理无用数据

---
### 10. languages 表（语言表）
| 字段名 | 类型 | 说明 | 默认值 |
|--------|------|------|--------|
| id | int | 主键，自增 | - |
| language | varchar(100) | 语言名称 | - |
| created_at | datetime | 创建时间 | CURRENT_TIMESTAMP |

**索引**:
- PRIMARY (id) - 主键
- unique_language (language) - 唯一索引，确保语言名称不重复

**默认数据**:
- Chinese（中文）
- Korean（韩语）
- English（英语）

### 11. protagonist 表（主角名表）
| 字段名 | 类型 | 说明 | 默认值 |
|--------|------|------|--------|
| id | int | 主键，自增 | - |
| novel_id | int | 小说ID，外键关联novel表 | - |
| name | varchar(100) | 主角名 | - |
| created_at | datetime | 创建时间 | CURRENT_TIMESTAMP |

**索引**:
- PRIMARY (id) - 主键
- idx_novel_id (novel_id) - 普通索引，用于快速查询某小说的所有主角

**外键约束**:
- protagonist_ibfk_novel: novel_id -> novel.id (ON DELETE CASCADE)

**特点**:
- 支持一本小说有多个主角（novel_id 不唯一）
- 删除小说时，相关的主角记录会自动删除（级联删除）

**使用示例**:
```sql
-- 查询某小说的所有主角
SELECT * FROM protagonist WHERE novel_id = 1;

-- 为小说添加主角
INSERT INTO protagonist (novel_id, name) VALUES (1, '主角名');

-- 查询小说及其所有主角
SELECT n.title, p.name 
FROM novel n 
LEFT JOIN protagonist p ON n.id = p.novel_id 
WHERE n.id = 1;
```

---

*最后更新：2025-11-01*
*文档版本：v1.2* 