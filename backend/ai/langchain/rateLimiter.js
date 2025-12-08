/**
 * 速率限制器
 * 控制 API 调用频率和并发数
 */

const aiTranslationConfig = require('../../config/aiTranslationConfig');

class RateLimiter {
  constructor({ rpmLimit, maxConcurrent }) {
    this.rpmLimit = rpmLimit || aiTranslationConfig.rpmLimit;
    this.maxConcurrent = maxConcurrent || aiTranslationConfig.maxConcurrent;
    this.requestTimestamps = [];
    this.activeRequests = 0;
    this.waitingQueue = [];
  }

  /**
   * 调度一个任务，确保不超过速率限制和并发限制
   * @param {Function} taskFn - 要执行的任务函数
   * @returns {Promise<any>} 任务执行结果
   */
  async schedule(taskFn) {
    return new Promise((resolve, reject) => {
      this.waitingQueue.push({ taskFn, resolve, reject });
      this.processQueue();
    });
  }

  /**
   * 处理等待队列
   */
  async processQueue() {
    // 如果已达到最大并发数，等待
    if (this.activeRequests >= this.maxConcurrent) {
      return;
    }

    // 如果没有等待的任务，返回
    if (this.waitingQueue.length === 0) {
      return;
    }

    // 检查速率限制
    const now = Date.now();
    const WINDOW_MS = 60000; // 1分钟窗口

    // 清理1分钟前的请求记录
    while (this.requestTimestamps.length > 0 && now - this.requestTimestamps[0] > WINDOW_MS) {
      this.requestTimestamps.shift();
    }

    // 如果已经达到速率限制，等待
    if (this.requestTimestamps.length >= this.rpmLimit) {
      const oldestRequest = this.requestTimestamps[0];
      const waitTime = WINDOW_MS - (now - oldestRequest) + 1000; // 额外等待1秒确保安全
      
      console.log(`[RateLimiter] Rate limit reached, waiting ${Math.ceil(waitTime / 1000)}s...`);
      
      setTimeout(() => {
        this.processQueue();
      }, waitTime);
      
      return;
    }

    // 从队列中取出一个任务
    const { taskFn, resolve, reject } = this.waitingQueue.shift();
    this.activeRequests++;
    this.requestTimestamps.push(Date.now());

    // 执行任务
    taskFn()
      .then((result) => {
        this.activeRequests--;
        resolve(result);
        // 继续处理队列
        this.processQueue();
      })
      .catch((error) => {
        this.activeRequests--;
        reject(error);
        // 继续处理队列
        this.processQueue();
      });
  }
}

// 创建全局单例
let globalRateLimiter = null;

/**
 * 获取全局速率限制器实例
 * @returns {RateLimiter}
 */
function getGlobalRateLimiter() {
  if (!globalRateLimiter) {
    globalRateLimiter = new RateLimiter({
      rpmLimit: aiTranslationConfig.rpmLimit,
      maxConcurrent: aiTranslationConfig.maxConcurrent,
    });
  }
  return globalRateLimiter;
}

module.exports = {
  RateLimiter,
  getGlobalRateLimiter,
};

