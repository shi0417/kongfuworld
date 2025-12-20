const express = require('express');

/**
 * Public Series/Novels list routes
 *
 * - GET /api/series
 * - GET /api/genres (optional helper for filters)
 *
 * Notes:
 * - MUST enforce: n.review_status IN ('published','approved')
 * - db should be mysql2 Promise Pool/Connection (e.g. db.promise())
 */
module.exports = function createPublicSeriesRouter(db) {
  const router = express.Router();

  const MAX_PAGE_SIZE = 48;
  const DEFAULT_PAGE_SIZE = 24;

  const SORT_ORDER_BY = {
    latest: 'n.id DESC',
    rating: 'n.rating DESC, n.reviews DESC, n.id DESC',
    chapters: 'n.chapters DESC, n.id DESC',
    alpha: 'n.title ASC, n.id DESC'
  };

  const normalizeInt = (value, defaultValue) => {
    const n = parseInt(String(value ?? ''), 10);
    return Number.isFinite(n) ? n : defaultValue;
  };

  const normalizeSort = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return 'latest';
    // 兼容 HomeV2: /series?sort=trending|new|popular_week|based_on_you 等
    const aliases = {
      trending: 'latest',
      new: 'latest',
      popular_week: 'latest',
      based_on_you: 'latest'
    };
    const mapped = aliases[raw] || raw;
    return SORT_ORDER_BY[mapped] ? mapped : 'latest';
  };

  const normalizeLang = (value) => {
    // language token（例如 "English" / "Chinese" / "Portuguese-BR"）
    // 规则：trim -> 压缩中间多空格为单空格 -> 长度 1~30 -> /^[A-Za-z0-9][A-Za-z0-9 _-]{0,29}$/
    const raw = String(value || '').trim().replace(/\s+/g, ' ');
    if (!raw) return null;
    if (raw.length < 1 || raw.length > 30) return null;
    if (!/^[A-Za-z0-9][A-Za-z0-9 _-]{0,29}$/.test(raw)) return null;
    return raw;
  };

  const normalizeStatus = (value) => {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return null;
    // 仅允许常见状态，防止注入/脏值
    const allowed = new Set(['ongoing', 'completed', 'hiatus']);
    if (!allowed.has(raw)) return null;
    return raw;
  };

  const normalizeGenres = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return [];
    const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
    const ids = parts
      .map(s => parseInt(s, 10))
      .filter(n => Number.isFinite(n) && n > 0);
    // 去重
    return Array.from(new Set(ids));
  };

  const buildWhere = ({ query, genres, status, lang }) => {
    const where = [];
    const params = [];

    // 强制只返回已发布/已通过
    where.push(`n.review_status IN ('published','approved')`);

    const q = String(query || '').trim();
    if (q) {
      where.push(`(n.title LIKE ? OR n.author LIKE ?)`);
      params.push(`%${q}%`, `%${q}%`);
    }

    const st = normalizeStatus(status);
    if (st) {
      where.push(`LOWER(n.status) = ?`);
      params.push(st);
    }

    const lg = normalizeLang(lang);
    if (lg) {
      // languages 大小写不敏感 + 忽略空格：把入参与 DB 都转为 lower，并删除空格后再 FIND_IN_SET
      where.push(`FIND_IN_SET(LOWER(?), LOWER(REPLACE(IFNULL(n.languages,''),' ',''))) > 0`);
      // 入参保持 token 原样，但匹配时等价于 lower(去空格) 的 token
      params.push(lg.replace(/\s+/g, '').toLowerCase());
    }

    const gids = normalizeGenres(genres);
    if (gids.length > 0) {
      // 只要命中任一 genre 即通过
      where.push(`g.id IN (${gids.map(() => '?').join(',')})`);
      params.push(...gids);
    }

    return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
  };

  // GET /api/series/languages
  router.get('/series/languages', async (req, res) => {
    try {
      // 直接从 languages 表查询所有语言选项
      const [rows] = await db.query(
        `SELECT id, language
         FROM languages
         ORDER BY language ASC`
      );

      const languages = (rows || []).map(r => String(r.language || '').trim()).filter(Boolean);

      res.set('Cache-Control', 'public, max-age=300'); // 5min
      return res.json({ success: true, data: { languages } });
    } catch (error) {
      console.error('public series languages error:', error);
      return res.status(500).json({ success: false, message: '获取 languages 失败', error: error.message });
    }
  });

  // GET /api/genres (optional)
  router.get('/genres', async (req, res) => {
    try {
      const [rows] = await db.query(
        `SELECT id, name, slug, chinese_name
         FROM genre
         WHERE is_active = 1
         ORDER BY id ASC`
      );
      res.set('Cache-Control', 'public, max-age=300'); // 5min
      return res.json({ success: true, data: { items: rows } });
    } catch (error) {
      console.error('public genres error:', error);
      return res.status(500).json({ success: false, message: '获取 genres 失败', error: error.message });
    }
  });

  // GET /api/series
  router.get('/series', async (req, res) => {
    try {
      const page = Math.max(1, normalizeInt(req.query.page, 1));
      const pageSizeRaw = normalizeInt(req.query.pageSize, DEFAULT_PAGE_SIZE);
      const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, pageSizeRaw));
      const offset = (page - 1) * pageSize;

      const sortKey = normalizeSort(req.query.sort);
      const orderBy = SORT_ORDER_BY[sortKey] || SORT_ORDER_BY.latest;

      const { whereSql, params } = buildWhere({
        query: req.query.query,
        genres: req.query.genres,
        status: req.query.status,
        lang: req.query.lang
      });

      const dataSql = `
        SELECT
          n.id, n.title, n.author, n.cover, n.status, n.rating, n.reviews, n.chapters, n.languages, n.review_status,
          GROUP_CONCAT(DISTINCT g.chinese_name ORDER BY g.id SEPARATOR ',') AS genre_names
        FROM novel n
        LEFT JOIN novel_genre_relation ngr ON n.id = ngr.novel_id
        LEFT JOIN genre g ON (ngr.genre_id_1 = g.id OR ngr.genre_id_2 = g.id)
        ${whereSql}
        GROUP BY n.id
        ORDER BY ${orderBy}
        LIMIT ? OFFSET ?
      `;

      const countSql = `
        SELECT COUNT(DISTINCT n.id) AS total
        FROM novel n
        LEFT JOIN novel_genre_relation ngr ON n.id = ngr.novel_id
        LEFT JOIN genre g ON (ngr.genre_id_1 = g.id OR ngr.genre_id_2 = g.id)
        ${whereSql}
      `;

      const [countRows] = await db.query(countSql, params);
      const total = Number(countRows?.[0]?.total || 0);
      const totalPages = Math.max(1, Math.ceil(total / pageSize));

      const [rows] = await db.query(dataSql, [...params, pageSize, offset]);

      return res.json({
        success: true,
        data: {
          items: rows,
          page,
          pageSize,
          total,
          totalPages
        }
      });
    } catch (error) {
      console.error('public series error:', error);
      return res.status(500).json({ success: false, message: '获取 series 失败', error: error.message });
    }
  });

  return router;
};


