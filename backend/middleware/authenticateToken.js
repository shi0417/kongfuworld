const jwt = require('jsonwebtoken');

/**
 * JWT 验证中间件（普通用户）
 * - 从 Authorization: Bearer <token> 读取 token
 * - secret：优先 process.env.JWT_SECRET，否则 'your-secret-key'
 * - 兼容：若使用 env secret 验证失败，且 env secret != fallback，则再尝试 fallback
 * - 成功：req.user = decoded
 */
module.exports = function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: 'Please login first' });
  }

  const primarySecret = process.env.JWT_SECRET || 'your-secret-key';
  const fallbackSecret = 'your-secret-key';

  const verifyWith = (secret) =>
    new Promise((resolve, reject) => {
      jwt.verify(token, secret, (err, decoded) => {
        if (err) return reject(err);
        return resolve(decoded);
      });
    });

  (async () => {
    try {
      const decoded = await verifyWith(primarySecret);
      req.user = decoded;
      return next();
    } catch (err1) {
      // 若 primary 已经是 fallback，则直接失败
      if (primarySecret === fallbackSecret) {
        return res.status(403).json({ message: 'Token invalid or expired' });
      }
      try {
        const decoded2 = await verifyWith(fallbackSecret);
        req.user = decoded2;
        return next();
      } catch (err2) {
        return res.status(403).json({ message: 'Token invalid or expired' });
      }
    }
  })();
};


