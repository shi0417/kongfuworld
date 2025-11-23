// 用户登录日志记录工具
const mysql = require('mysql2');

/**
 * 规范化IP地址，将IPv6回环地址转换为IPv4格式以便阅读
 * @param {string} ip - IP地址
 * @returns {string} 规范化后的IP地址
 */
function normalizeIP(ip) {
  if (!ip) return 'unknown';
  
  // 将IPv6回环地址转换为IPv4格式
  if (ip === '::1' || ip === '::ffff:127.0.0.1') {
    return '127.0.0.1 (localhost)';
  }
  
  // 处理IPv6映射的IPv4地址 (::ffff:192.168.1.1)
  if (ip.startsWith('::ffff:')) {
    return ip.substring(7);
  }
  
  return ip;
}

/**
 * 从请求中获取客户端IP地址
 * @param {Object} req - Express请求对象
 * @returns {string} IP地址
 */
function getClientIP(req) {
  // 优先级：x-forwarded-for > x-real-ip > req.ip > connection.remoteAddress
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    // x-forwarded-for可能包含多个IP，取第一个（最接近客户端的IP）
    const ips = forwarded.split(',');
    const firstIP = ips[0].trim();
    return normalizeIP(firstIP);
  }
  
  const realIP = req.headers['x-real-ip'];
  if (realIP) {
    return normalizeIP(realIP);
  }
  
  // Express的req.ip（需要设置trust proxy）
  if (req.ip) {
    return normalizeIP(req.ip);
  }
  
  // 从socket连接获取
  if (req.connection && req.connection.remoteAddress) {
    return normalizeIP(req.connection.remoteAddress);
  }
  
  // 从socket获取（Express 4.x+）
  if (req.socket && req.socket.remoteAddress) {
    return normalizeIP(req.socket.remoteAddress);
  }
  
  return 'unknown';
}

/**
 * 从User-Agent中提取设备类型
 * @param {string} userAgent - User-Agent字符串
 * @returns {string} 设备类型
 */
function getDeviceType(userAgent) {
  if (!userAgent) return 'unknown';
  
  const ua = userAgent.toLowerCase();
  
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    return 'mobile';
  }
  
  if (ua.includes('tablet') || ua.includes('ipad')) {
    return 'tablet';
  }
  
  return 'desktop';
}

/**
 * 记录用户登录日志
 * @param {Object} db - 数据库连接池或连接对象
 * @param {number} userId - 用户ID
 * @param {Object} req - Express请求对象
 * @param {string} loginMethod - 登录方式（'password', 'google', 'facebook', 'apple', 'register'）
 * @param {string} loginStatus - 登录状态（'success', 'failed'），默认为'success'
 * @param {Function} callback - 回调函数（可选）
 */
function logUserLogin(db, userId, req, loginMethod = 'password', loginStatus = 'success', callback) {
  try {
    const ipAddress = getClientIP(req);
    const userAgent = req.headers['user-agent'] || null;
    const deviceType = getDeviceType(userAgent);
    const loginTime = new Date();
    
    // 异步记录，不阻塞主流程
    const query = `
      INSERT INTO user_login_logs 
      (user_id, ip_address, login_time, login_method, user_agent, device_type, login_status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    const values = [userId, ipAddress, loginTime, loginMethod, userAgent, deviceType, loginStatus];
    
    db.query(query, values, (err, result) => {
      if (err) {
        // 记录失败不应该影响登录流程，只记录错误
        console.error('记录用户登录日志失败:', err);
      } else {
        console.log(`✅ 已记录用户 ${userId} 的登录日志，IP: ${ipAddress}, 方式: ${loginMethod}`);
      }
      
      if (callback) {
        callback(err, result);
      }
    });
  } catch (error) {
    console.error('记录用户登录日志时发生错误:', error);
    if (callback) {
      callback(error, null);
    }
  }
}

/**
 * 记录用户登录日志（Promise版本，用于async/await）
 * @param {Object} db - 数据库连接池或连接对象（支持mysql2和mysql2/promise）
 * @param {number} userId - 用户ID
 * @param {Object} req - Express请求对象
 * @param {string} loginMethod - 登录方式
 * @param {string} loginStatus - 登录状态
 * @returns {Promise}
 */
async function logUserLoginAsync(db, userId, req, loginMethod = 'password', loginStatus = 'success') {
  try {
    const ipAddress = getClientIP(req);
    const userAgent = req.headers['user-agent'] || null;
    const deviceType = getDeviceType(userAgent);
    const loginTime = new Date();
    
    const query = `
      INSERT INTO user_login_logs 
      (user_id, ip_address, login_time, login_method, user_agent, device_type, login_status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    const values = [userId, ipAddress, loginTime, loginMethod, userAgent, deviceType, loginStatus];
    
    // 检查是否是Promise版本的连接（mysql2/promise）
    if (db && typeof db.execute === 'function') {
      // Promise版本
      const [result] = await db.execute(query, values);
      console.log(`✅ 已记录用户 ${userId} 的登录日志，IP: ${ipAddress}, 方式: ${loginMethod}`);
      return result;
    } else if (db && typeof db.query === 'function') {
      // 回调版本
      return new Promise((resolve, reject) => {
        logUserLogin(db, userId, req, loginMethod, loginStatus, (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
    } else {
      throw new Error('不支持的数据库连接类型');
    }
  } catch (error) {
    console.error('记录用户登录日志时发生错误:', error);
    throw error;
  }
}

module.exports = {
  getClientIP,
  getDeviceType,
  logUserLogin,
  logUserLoginAsync
};

