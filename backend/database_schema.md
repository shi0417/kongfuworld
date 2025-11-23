# 数据库表结构信息
数据库名: kongfuworld
导出时间: 2025/7/16 14:32:34

## 表列表
- chapter
- chapter_unlock
- comment
- favorite
- notifications
- novel
- payment_record
- reading_log
- review
- subscription
- user
- volume


## 表: chapter
- 记录数: 42
- 引擎: InnoDB
- 字符集: utf8mb4_unicode_ci
- 注释: 无

### 字段结构
| 字段名 | 类型 | 是否为空 | 键 | 默认值 | 额外 |
|--------|------|----------|----|--------|------|
| id | int | NO | PRI | NULL | auto_increment |
| novel_id | int | NO | MUL | NULL |  |
| volume_id | int | NO | MUL | NULL |  |
| chapter_number | int | NO |  | NULL |  |
| title | varchar(255) | NO |  | NULL |  |
| content | text | YES |  | NULL |  |
| created_at | datetime | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| translator_note | text | YES |  | NULL |  |
| is_locked | tinyint(1) | YES |  | 0 |  |
| is_vip_only | tinyint(1) | YES |  | 0 |  |
| is_advance | tinyint(1) | YES |  | 0 |  |
| is_visible | tinyint(1) | YES |  | 1 |  |
| prev_chapter_id | int | YES |  | NULL |  |
| unlock_price | int | YES |  | 0 |  |

### 索引信息
- PRIMARY: 唯一索引 (id)
- novel_id: 普通索引 (novel_id)
- volume_id: 普通索引 (volume_id)

### 示例数据
```json
[
  {
    "id": 1,
    "novel_id": 1,
    "volume_id": 1,
    "chapter_number": 1,
    "title": "第二十九回  施恩重霸孟州道      武松醉打蒋门神  \t 325",
    "content": "第 三 十 回  施恩三入死囚牢      武松大闹飞云浦  \t 333",
    "created_at": "2025-07-15T14:14:19.000Z",
    "translator_note": null,
    "is_locked": 0,
    "is_vip_only": 0,
    "is_advance": 0,
    "is_visible": 1,
    "prev_chapter_id": null,
    "unlock_price": 0
  },
  {
    "id": 2,
    "novel_id": 1,
    "volume_id": 1,
    "chapter_number": 2,
    "title": "第三十一回  张都监血溅鸳鸯楼    武行者夜走蜈蚣岭  \t 344",
    "content": "第三十二回  武行者醉打孔亮      锦毛虎义释宋江  \t 355",
    "created_at": "2025-07-15T14:14:19.000Z",
    "translator_note": null,
    "is_locked": 0,
    "is_vip_only": 0,
    "is_advance": 0,
    "is_visible": 1,
    "prev_chapter_id": null,
    "unlock_price": 0
  },
  {
    "id": 3,
    "novel_id": 1,
    "volume_id": 1,
    "chapter_number": 3,
    "title": "第三十三回  宋江夜看小鳌山      花荣大闹清风寨  \t 371",
    "content": "第三十四回  镇三山大闹青州道    霹雳火夜走瓦砾场  \t 382",
    "created_at": "2025-07-15T14:14:19.000Z",
    "translator_note": null,
    "is_locked": 0,
    "is_vip_only": 0,
    "is_advance": 0,
    "is_visible": 1,
    "prev_chapter_id": null,
    "unlock_price": 0
  }
]
```

---

## 表: chapter_unlock
- 记录数: 0
- 引擎: InnoDB
- 字符集: utf8mb4_unicode_ci
- 注释: 无

### 字段结构
| 字段名 | 类型 | 是否为空 | 键 | 默认值 | 额外 |
|--------|------|----------|----|--------|------|
| id | int | NO | PRI | NULL | auto_increment |
| user_id | int | NO | MUL | NULL |  |
| chapter_id | int | NO |  | NULL |  |
| unlock_type | enum('key','karma','wtu') | NO |  | NULL |  |
| unlocked_at | datetime | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |

### 索引信息
- PRIMARY: 唯一索引 (id)
- user_id: 唯一索引 (user_id, chapter_id)

---

## 表: comment
- 记录数: 0
- 引擎: InnoDB
- 字符集: utf8mb4_unicode_ci
- 注释: 无

### 字段结构
| 字段名 | 类型 | 是否为空 | 键 | 默认值 | 额外 |
|--------|------|----------|----|--------|------|
| id | int | NO | PRI | NULL | auto_increment |
| user_id | int | NO |  | NULL |  |
| target_type | enum('novel','chapter','paragraph') | NO |  | NULL |  |
| target_id | int | NO |  | NULL |  |
| parent_comment_id | int | YES |  | NULL |  |
| content | text | NO |  | NULL |  |
| created_at | datetime | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| likes | int | YES |  | 0 |  |

### 索引信息
- PRIMARY: 唯一索引 (id)

---

## 表: favorite
- 记录数: 0
- 引擎: InnoDB
- 字符集: utf8mb4_unicode_ci
- 注释: 无

### 字段结构
| 字段名 | 类型 | 是否为空 | 键 | 默认值 | 额外 |
|--------|------|----------|----|--------|------|
| id | int | NO | PRI | NULL | auto_increment |
| user_id | int | NO |  | NULL |  |
| novel_id | int | NO |  | NULL |  |
| created_at | datetime | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |

### 索引信息
- PRIMARY: 唯一索引 (id)

---

## 表: notifications
- 记录数: 1
- 引擎: InnoDB
- 字符集: utf8mb4_unicode_ci
- 注释: 无

### 字段结构
| 字段名 | 类型 | 是否为空 | 键 | 默认值 | 额外 |
|--------|------|----------|----|--------|------|
| id | int | NO | PRI | NULL | auto_increment |
| user_id | int | NO |  | NULL |  |
| novel_id | int | YES |  | NULL |  |
| chapter_id | int | YES |  | NULL |  |
| title | varchar(255) | NO |  | NULL |  |
| message | text | NO |  | NULL |  |
| type | enum('news','unlock','chapter','comment','system') | NO |  | NULL |  |
| link | varchar(255) | YES |  | NULL |  |
| is_read | tinyint(1) | YES |  | 0 |  |
| created_at | datetime | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |

### 索引信息
- PRIMARY: 唯一索引 (id)

### 示例数据
```json
[
  {
    "id": 1,
    "user_id": 1,
    "novel_id": 101,
    "chapter_id": 6642,
    "title": "Emperor's Domination",
    "message": "\"Chapter 6642: One Hand\" has been released!",
    "type": "chapter",
    "link": "/novel/101/chapter/6642",
    "is_read": 1,
    "created_at": "2025-07-15T02:49:49.000Z"
  }
]
```

---

## 表: novel
- 记录数: 1
- 引擎: InnoDB
- 字符集: utf8mb4_unicode_ci
- 注释: 无

### 字段结构
| 字段名 | 类型 | 是否为空 | 键 | 默认值 | 额外 |
|--------|------|----------|----|--------|------|
| id | int | NO | PRI | NULL | auto_increment |
| title | varchar(255) | NO |  | NULL |  |
| status | varchar(50) | YES |  | NULL |  |
| cover | varchar(255) | YES |  | NULL |  |
| rating | int | YES |  | 0 |  |
| reviews | int | YES |  | 0 |  |
| author | varchar(100) | YES |  | NULL |  |
| translator | varchar(100) | YES |  | NULL |  |
| description | text | YES |  | NULL |  |
| chapters | int | YES |  | 0 |  |
| licensed_from | varchar(100) | YES |  | NULL |  |

### 索引信息
- PRIMARY: 唯一索引 (id)

### 示例数据
```json
[
  {
    "id": 1,
    "title": "水浒全传",
    "status": "ongoing",
    "cover": "https://static.wuxiaworld.com/bookcover/worlds-no-1-swordsman.png",
    "rating": 74,
    "reviews": 15,
    "author": "施耐庵",
    "translator": "r4gequ1t_cy@",
    "description": "《水浒传》是中国古典四大名著之一，描写了北宋末年以宋江为首的108位好汉在梁山泊聚义的故事。",
    "chapters": 42,
    "licensed_from": "Yuewen"
  }
]
```

---

## 表: payment_record
- 记录数: 0
- 引擎: InnoDB
- 字符集: utf8mb4_unicode_ci
- 注释: 无

### 字段结构
| 字段名 | 类型 | 是否为空 | 键 | 默认值 | 额外 |
|--------|------|----------|----|--------|------|
| id | int | NO | PRI | NULL | auto_increment |
| user_id | int | NO | MUL | NULL |  |
| amount | decimal(10,2) | NO |  | NULL |  |
| payment_method | enum('alipay','wechat','paypal','stripe') | YES |  | NULL |  |
| status | enum('pending','completed','failed') | YES |  | NULL |  |
| created_at | datetime | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| type | enum('recharge','chapter_purchase','champion_subscribe','karma_reward') | NO |  | recharge |  |
| description | text | YES |  | NULL |  |

### 索引信息
- PRIMARY: 唯一索引 (id)
- user_id: 普通索引 (user_id)

---

## 表: reading_log
- 记录数: 0
- 引擎: InnoDB
- 字符集: utf8mb4_unicode_ci
- 注释: 无

### 字段结构
| 字段名 | 类型 | 是否为空 | 键 | 默认值 | 额外 |
|--------|------|----------|----|--------|------|
| id | int | NO | PRI | NULL | auto_increment |
| user_id | int | NO |  | NULL |  |
| chapter_id | int | NO |  | NULL |  |
| read_at | datetime | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |

### 索引信息
- PRIMARY: 唯一索引 (id)

---

## 表: review
- 记录数: 0
- 引擎: InnoDB
- 字符集: utf8mb4_unicode_ci
- 注释: 无

### 字段结构
| 字段名 | 类型 | 是否为空 | 键 | 默认值 | 额外 |
|--------|------|----------|----|--------|------|
| id | int | NO | PRI | NULL | auto_increment |
| novel_id | int | NO | MUL | NULL |  |
| user_id | int | NO | MUL | NULL |  |
| content | text | YES |  | NULL |  |
| rating | int | YES |  | NULL |  |
| created_at | datetime | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| likes | int | YES |  | 0 |  |
| comments | int | YES |  | 0 |  |
| views | int | YES |  | 0 |  |
| is_recommended | tinyint(1) | YES |  | 0 |  |

### 索引信息
- PRIMARY: 唯一索引 (id)
- novel_id: 普通索引 (novel_id)
- user_id: 普通索引 (user_id)

---

## 表: subscription
- 记录数: 0
- 引擎: InnoDB
- 字符集: utf8mb4_unicode_ci
- 注释: 无

### 字段结构
| 字段名 | 类型 | 是否为空 | 键 | 默认值 | 额外 |
|--------|------|----------|----|--------|------|
| id | int | NO | PRI | NULL | auto_increment |
| user_id | int | NO |  | NULL |  |
| novel_id | int | NO |  | NULL |  |
| start_date | datetime | YES |  | NULL |  |
| end_date | datetime | YES |  | NULL |  |
| is_active | tinyint(1) | YES |  | 1 |  |

### 索引信息
- PRIMARY: 唯一索引 (id)

---

## 表: user
- 记录数: 2
- 引擎: InnoDB
- 字符集: utf8mb4_unicode_ci
- 注释: 无

### 字段结构
| 字段名 | 类型 | 是否为空 | 键 | 默认值 | 额外 |
|--------|------|----------|----|--------|------|
| id | int | NO | PRI | NULL | auto_increment |
| username | varchar(50) | NO | UNI | NULL |  |
| avatar | varchar(255) | YES |  | NULL |  |
| is_vip | tinyint(1) | YES |  | 0 |  |
| email | varchar(100) | YES | UNI | NULL |  |
| password_hash | varchar(255) | YES |  | NULL |  |
| balance | decimal(10,2) | YES |  | 0.00 |  |
| points | int | YES |  | 0 |  |
| vip_expire_at | datetime | YES |  | NULL |  |
| karma | int | YES |  | 0 |  |
| created_at | datetime | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| last_login_at | datetime | YES |  | NULL |  |
| status | enum('active','banned') | YES |  | active |  |
| settings_json | json | YES |  | NULL |  |

### 索引信息
- PRIMARY: 唯一索引 (id)
- username: 唯一索引 (username)
- email: 唯一索引 (email)

### 示例数据
```json
[
  {
    "id": 1,
    "username": "shi yi xian",
    "avatar": "/avatars/user_1_1752549681696.jpeg",
    "is_vip": 0,
    "email": "5921163@qq.com",
    "password_hash": "$2b$10$vwkVGGeUhOG7K2DlMonmOODqpt45GWTB20Pe3jypowYJuBrjdg2J.",
    "balance": "0.00",
    "points": 0,
    "vip_expire_at": null,
    "karma": 0,
    "created_at": "2025-07-14T10:33:10.000Z",
    "last_login_at": null,
    "status": "active",
    "settings_json": {
      "auto_unlock": false,
      "accept_marketing": true,
      "paragraph_comments": true,
      "notify_unlock_updates": true,
      "notify_chapter_updates": true
    }
  },
  {
    "id": 2,
    "username": "shi",
    "avatar": "/avatars/user_2_1752494251389.jpeg",
    "is_vip": 0,
    "email": "1@qq.com",
    "password_hash": "$2b$10$QzVrjI5D7uTcVwU521m1yO.lMi8Z.zD3ARjKnchDVnTFwY.8dLzwy",
    "balance": "0.00",
    "points": 0,
    "vip_expire_at": null,
    "karma": 0,
    "created_at": "2025-07-14T10:33:10.000Z",
    "last_login_at": null,
    "status": "active",
    "settings_json": {
      "auto_unlock": true,
      "accept_marketing": true,
      "paragraph_comments": true,
      "notify_unlock_updates": true,
      "notify_chapter_updates": true
    }
  }
]
```

---

## 表: volume
- 记录数: 1
- 引擎: InnoDB
- 字符集: utf8mb4_unicode_ci
- 注释: 无

### 字段结构
| 字段名 | 类型 | 是否为空 | 键 | 默认值 | 额外 |
|--------|------|----------|----|--------|------|
| id | int | NO | PRI | NULL | auto_increment |
| novel_id | int | NO | MUL | NULL |  |
| volume_id | int | NO |  | NULL |  |
| title | varchar(255) | YES |  | NULL |  |

### 索引信息
- PRIMARY: 唯一索引 (id)
- novel_id: 普通索引 (novel_id)

### 示例数据
```json
[
  {
    "id": 1,
    "novel_id": 1,
    "volume_id": 1,
    "title": "第一卷"
  }
]
```

---
