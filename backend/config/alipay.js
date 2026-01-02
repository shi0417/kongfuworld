const AlipaySdk = require('alipay-sdk').default;

// NOTE: env is already loaded by server.js via config/loadEnv.js

const isSandbox = process.env.ALIPAY_MODE === 'sandbox';

// 处理私钥和公钥中的 \n 转义字符（dotenv会将\n作为字符串，需要转换为实际换行符）
const processKey = (key) => {
  if (!key) return key;
  // 移除首尾的引号（如果存在）
  let processedKey = key.trim();
  if ((processedKey.startsWith('"') && processedKey.endsWith('"')) ||
      (processedKey.startsWith("'") && processedKey.endsWith("'"))) {
    processedKey = processedKey.slice(1, -1);
  }
  // 将 \n 转义字符转换为实际换行符（处理多种情况）
  // dotenv 可能已经转换了，也可能还是字符串形式
  if (processedKey.includes('\\n') && !processedKey.includes('\n')) {
    // 如果包含字面的 \n 但没有实际换行符，则替换
    processedKey = processedKey.replace(/\\n/g, '\n');
  }
  
  // 格式化私钥/公钥：确保 base64 内容每 64 个字符一行
  const lines = processedKey.split('\n');
  if (lines.length === 3 && lines[1] && lines[1].length > 64) {
    // 如果中间行（base64内容）超过64字符，需要分割
    const header = lines[0]; // -----BEGIN ...
    const footer = lines[lines.length - 1]; // -----END ...
    const base64Content = lines.slice(1, -1).join('').replace(/\s/g, ''); // 移除所有空白字符
    
    // 将 base64 内容按 64 字符分割
    const formattedBase64 = base64Content.match(/.{1,64}/g).join('\n');
    processedKey = `${header}\n${formattedBase64}\n${footer}`;
  }
  
  return processedKey;
};

// 获取并处理私钥和公钥
const privateKey = processKey(isSandbox
  ? process.env.ALIPAY_SANDBOX_APP_PRIVATE_KEY
  : process.env.ALIPAY_APP_PRIVATE_KEY);
const alipayPublicKey = processKey(isSandbox
  ? process.env.ALIPAY_SANDBOX_PUBLIC_KEY
  : process.env.ALIPAY_PUBLIC_KEY);

// 调试：检查私钥格式（仅显示前50个字符）
if (privateKey) {
  const keyLines = privateKey.split('\n');
  console.log('[支付宝配置] 私钥格式检查:', {
    startsWithBegin: privateKey.includes('-----BEGIN PRIVATE KEY-----'),
    endsWithEnd: privateKey.includes('-----END PRIVATE KEY-----'),
    hasNewlines: privateKey.includes('\n'),
    lineCount: keyLines.length,
    firstLine: keyLines[0],
    lastLine: keyLines[keyLines.length - 1],
    length: privateKey.length
  });
  
  // 验证私钥格式
  if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
    console.error('[支付宝配置] 警告：私钥缺少 BEGIN 标记');
  }
  if (!privateKey.includes('-----END PRIVATE KEY-----')) {
    console.error('[支付宝配置] 警告：私钥缺少 END 标记');
  }
}

const alipaySdk = new AlipaySdk({
  appId: isSandbox
    ? process.env.ALIPAY_SANDBOX_APP_ID
    : process.env.ALIPAY_APP_ID,
  privateKey: privateKey,
  alipayPublicKey: alipayPublicKey,
  gateway: isSandbox
    ? process.env.ALIPAY_SANDBOX_GATEWAY
    : process.env.ALIPAY_GATEWAY,
  signType: 'RSA2',
  timeout: 6000,
});

// 注意：已修改 node_modules/alipay-sdk/lib/util.js 以支持 node-forge
// 用于解决 Node.js 22+ OpenSSL 3.0 兼容性问题

console.log('支付宝SDK初始化:', {
  mode: isSandbox ? 'sandbox' : 'production',
  appId: isSandbox
    ? (process.env.ALIPAY_SANDBOX_APP_ID ? '已设置' : '未设置')
    : (process.env.ALIPAY_APP_ID ? '已设置' : '未设置'),
  privateKey: isSandbox
    ? (process.env.ALIPAY_SANDBOX_APP_PRIVATE_KEY ? '已设置' : '未设置')
    : (process.env.ALIPAY_APP_PRIVATE_KEY ? '已设置' : '未设置'),
  publicKey: isSandbox
    ? (process.env.ALIPAY_SANDBOX_PUBLIC_KEY ? '已设置' : '未设置')
    : (process.env.ALIPAY_PUBLIC_KEY ? '已设置' : '未设置'),
  gateway: isSandbox
    ? process.env.ALIPAY_SANDBOX_GATEWAY
    : process.env.ALIPAY_GATEWAY
});

module.exports = alipaySdk;

