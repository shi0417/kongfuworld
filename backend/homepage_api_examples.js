// 首页API实现示例
// 这些API应该添加到server.js中

// 1. 获取首页推荐小说
app.get('/api/homepage/featured-novels/:section', (req, res) => {
  const { section } = req.params;
  const { limit = 6 } = req.query;
  
  const query = `
    SELECT 
      n.id, n.title, n.author, n.cover, n.rating, n.reviews, n.status,
      hfn.display_order, hfn.section_type
    FROM homepage_featured_novels hfn
    JOIN novel n ON hfn.novel_id = n.id
    WHERE hfn.section_type = ? 
      AND hfn.is_active = 1 
      AND (hfn.start_date IS NULL OR hfn.start_date <= NOW())
      AND (hfn.end_date IS NULL OR hfn.end_date >= NOW())
    ORDER BY hfn.display_order ASC, n.rating DESC
    LIMIT ?
  `;
  
  db.query(query, [section, parseInt(limit)], (err, results) => {
    if (err) {
      console.error('获取推荐小说失败:', err);
      return res.status(500).json({ message: '获取推荐小说失败' });
    }
    
    res.json({ novels: results });
  });
});

// 2. 获取首页轮播图
app.get('/api/homepage/banners', (req, res) => {
  const query = `
    SELECT 
      hb.id, hb.title, hb.subtitle, hb.image_url, hb.link_url,
      n.id as novel_id, n.title as novel_title
    FROM homepage_banners hb
    LEFT JOIN novel n ON hb.novel_id = n.id
    WHERE hb.is_active = 1 
      AND (hb.start_date IS NULL OR hb.start_date <= NOW())
      AND (hb.end_date IS NULL OR hb.end_date >= NOW())
    ORDER BY hb.display_order ASC
  `;
  
  db.query(query, (err, results) => {
    if (err) {
      console.error('获取轮播图失败:', err);
      return res.status(500).json({ message: '获取轮播图失败' });
    }
    
    res.json({ banners: results });
  });
});

// 3. 获取本周热门小说（基于统计数据）
app.get('/api/homepage/popular-this-week', (req, res) => {
  const { limit = 6 } = req.query;
  
  const query = `
    SELECT 
      n.id, n.title, n.author, n.cover, n.rating, n.reviews, n.status,
      COALESCE(SUM(ns.views), 0) as weekly_views,
      COALESCE(SUM(ns.reads), 0) as weekly_reads
    FROM novel n
    LEFT JOIN novel_statistics ns ON n.id = ns.novel_id 
      AND ns.date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
    GROUP BY n.id
    HAVING weekly_views > 0
    ORDER BY weekly_views DESC, weekly_reads DESC
    LIMIT ?
  `;
  
  db.query(query, [parseInt(limit)], (err, results) => {
    if (err) {
      console.error('获取本周热门失败:', err);
      return res.status(500).json({ message: '获取本周热门失败' });
    }
    
    res.json({ novels: results });
  });
});

// 4. 获取最新发布的小说
app.get('/api/homepage/new-releases', (req, res) => {
  const { limit = 6 } = req.query;
  
  const query = `
    SELECT 
      n.id, n.title, n.author, n.cover, n.rating, n.reviews, n.status,
      MAX(c.created_at) as latest_chapter_date
    FROM novel n
    LEFT JOIN chapter c ON n.id = c.novel_id
    WHERE n.status = 'Ongoing'
    GROUP BY n.id
    ORDER BY latest_chapter_date DESC, n.id DESC
    LIMIT ?
  `;
  
  db.query(query, [parseInt(limit)], (err, results) => {
    if (err) {
      console.error('获取最新发布失败:', err);
      return res.status(500).json({ message: '获取最新发布失败' });
    }
    
    res.json({ novels: results });
  });
});

// 5. 获取评分最高的小说
app.get('/api/homepage/top-series', (req, res) => {
  const { limit = 6 } = req.query;
  
  const query = `
    SELECT 
      n.id, n.title, n.author, n.cover, n.rating, n.reviews, n.status,
      n.chapters
    FROM novel n
    WHERE n.rating > 0 AND n.reviews > 0
    ORDER BY n.rating DESC, n.reviews DESC
    LIMIT ?
  `;
  
  db.query(query, [parseInt(limit)], (err, results) => {
    if (err) {
      console.error('获取高分小说失败:', err);
      return res.status(500).json({ message: '获取高分小说失败' });
    }
    
    res.json({ novels: results });
  });
});

// 6. 记录小说访问统计
app.post('/api/novel/:id/view', (req, res) => {
  const { id } = req.params;
  const today = new Date().toISOString().split('T')[0];
  
  const query = `
    INSERT INTO novel_statistics (novel_id, date, views) 
    VALUES (?, ?, 1)
    ON DUPLICATE KEY UPDATE views = views + 1
  `;
  
  db.query(query, [id, today], (err, result) => {
    if (err) {
      console.error('记录访问统计失败:', err);
      return res.status(500).json({ message: '记录访问统计失败' });
    }
    
    res.json({ success: true });
  });
});

// 7. 管理首页推荐小说（管理员接口）
app.post('/api/admin/homepage/featured-novels', (req, res) => {
  const { novel_id, section_type, display_order, start_date, end_date } = req.body;
  
  const query = `
    INSERT INTO homepage_featured_novels 
    (novel_id, section_type, display_order, start_date, end_date)
    VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
    display_order = VALUES(display_order),
    start_date = VALUES(start_date),
    end_date = VALUES(end_date),
    is_active = 1
  `;
  
  db.query(query, [novel_id, section_type, display_order, start_date, end_date], (err, result) => {
    if (err) {
      console.error('添加推荐小说失败:', err);
      return res.status(500).json({ message: '添加推荐小说失败' });
    }
    
    res.json({ success: true, id: result.insertId });
  });
});

// 8. 获取首页配置
app.get('/api/homepage/config', (req, res) => {
  const query = `
    SELECT section_name, section_title, display_limit, sort_by, is_active, description
    FROM homepage_config
    WHERE is_active = 1
    ORDER BY id ASC
  `;
  
  db.query(query, (err, results) => {
    if (err) {
      console.error('获取首页配置失败:', err);
      return res.status(500).json({ message: '获取首页配置失败' });
    }
    
    res.json({ configs: results });
  });
});
