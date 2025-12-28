require('dotenv').config({path: 'backend/kongfuworld.env'});
const key = process.env.OPENAI_API_KEY;
console.log('API Key 长度:', key ? key.length : 0);
console.log('API Key 前缀:', key ? key.substring(0, 20) + '...' : '未设置');
console.log('API Key 后缀:', key && key.length > 20 ? '...' + key.substring(key.length - 10) : '未设置');
console.log('API Key 是否以 sk- 开头:', key ? key.startsWith('sk-') : false);

