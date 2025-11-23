// 时区处理工具
const moment = require('moment-timezone');

class TimezoneHandler {
  constructor() {
    // 支持的时区列表（按用户数量排序）
    this.supportedTimezones = [
      'Asia/Shanghai',      // 中国
      'America/New_York',    // 美国东部
      'America/Los_Angeles', // 美国西部
      'Europe/London',      // 英国
      'Europe/Paris',       // 法国
      'Asia/Tokyo',         // 日本
      'Asia/Seoul',         // 韩国
      'Asia/Singapore',     // 新加坡
      'Australia/Sydney',   // 澳大利亚
      'America/Toronto',    // 加拿大
      'America/Sao_Paulo',  // 巴西
      'Asia/Kolkata',       // 印度
      'Europe/Moscow',      // 俄罗斯
      'Africa/Cairo',       // 埃及
      'UTC'                 // UTC时间
    ];
  }

  /**
   * 获取用户当前时区的"今天"日期
   * @param {string} userTimezone - 用户时区
   * @returns {string} - YYYY-MM-DD格式的日期
   */
  getUserToday(userTimezone = 'UTC') {
    const validTimezone = this.supportedTimezones.includes(userTimezone) 
      ? userTimezone 
      : 'UTC';
    
    return moment().tz(validTimezone).format('YYYY-MM-DD');
  }

  /**
   * 获取用户当前时区的"现在"时间
   * @param {string} userTimezone - 用户时区
   * @returns {Date} - 当前时间
   */
  getUserNow(userTimezone = 'UTC') {
    const validTimezone = this.supportedTimezones.includes(userTimezone) 
      ? userTimezone 
      : 'UTC';
    
    return moment().tz(validTimezone).toDate();
  }

  /**
   * 将UTC时间转换为用户时区时间
   * @param {Date} utcDate - UTC时间
   * @param {string} userTimezone - 用户时区
   * @returns {string} - 格式化的本地时间
   */
  formatToUserTimezone(utcDate, userTimezone = 'UTC') {
    const validTimezone = this.supportedTimezones.includes(userTimezone) 
      ? userTimezone 
      : 'UTC';
    
    return moment(utcDate).tz(validTimezone).format('YYYY-MM-DD HH:mm:ss');
  }

  /**
   * 获取用户时区的签到重置时间
   * @param {string} userTimezone - 用户时区
   * @returns {Date} - 下一个重置时间
   */
  getNextResetTime(userTimezone = 'UTC') {
    const validTimezone = this.supportedTimezones.includes(userTimezone) 
      ? userTimezone 
      : 'UTC';
    
    const now = moment().tz(validTimezone);
    const tomorrow = now.clone().add(1, 'day').startOf('day');
    return tomorrow.toDate();
  }

  /**
   * 计算距离下次重置的时间
   * @param {string} userTimezone - 用户时区
   * @returns {string} - 格式化的时间差
   */
  getTimeUntilReset(userTimezone = 'UTC') {
    const validTimezone = this.supportedTimezones.includes(userTimezone) 
      ? userTimezone 
      : 'UTC';
    
    const now = moment().tz(validTimezone);
    const nextReset = this.getNextResetTime(validTimezone);
    const diff = moment(nextReset).diff(now);
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  }

  /**
   * 检查用户是否在指定日期签到过
   * @param {string} userId - 用户ID
   * @param {string} checkinDate - 签到日期 (YYYY-MM-DD)
   * @param {string} userTimezone - 用户时区
   * @returns {Promise<boolean>} - 是否已签到
   */
  async hasCheckedInOnDate(userId, checkinDate, userTimezone = 'UTC') {
    // 这里需要数据库连接，暂时返回false
    // 实际实现中需要查询数据库
    return false;
  }

  /**
   * 获取用户时区信息
   * @param {string} userTimezone - 用户时区
   * @returns {Object} - 时区信息
   */
  getTimezoneInfo(userTimezone = 'UTC') {
    const validTimezone = this.supportedTimezones.includes(userTimezone) 
      ? userTimezone 
      : 'UTC';
    
    const now = moment().tz(validTimezone);
    
    return {
      timezone: validTimezone,
      currentTime: now.format('YYYY-MM-DD HH:mm:ss'),
      utcOffset: now.format('Z'),
      isDST: now.isDST(),
      today: now.format('YYYY-MM-DD'),
      tomorrow: now.clone().add(1, 'day').format('YYYY-MM-DD')
    };
  }

  /**
   * 获取所有支持的时区列表
   * @returns {Array} - 时区列表
   */
  getSupportedTimezones() {
    return this.supportedTimezones.map(tz => ({
      value: tz,
      label: tz.replace('_', ' '),
      offset: moment().tz(tz).format('Z')
    }));
  }
}

module.exports = new TimezoneHandler();
