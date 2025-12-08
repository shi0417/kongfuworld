const mysql = require('mysql2');
const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const express = require('express');
const OpenAI = require('openai');

// 数据库连接 - 将在server.js中传入
let db = null;

// OpenAI API 配置
let openai = null;

// 设置数据库连接
function setDatabase(database) {
  db = database;
}

// 设置OpenAI API Key
function setOpenAIApiKey(apiKey) {
  if (apiKey) {
    openai = new OpenAI({
      apiKey: apiKey,
    });
    console.log('OpenAI API 配置成功');
  } else {
    console.warn('OpenAI API Key 未提供，将使用传统解析方法');
  }
}

// 检查数据库连接是否有效
function checkConnection() {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('数据库连接未初始化'));
      return;
    }
    
    db.getConnection((err, connection) => {
      if (err) {
        console.error('数据库连接检查失败:', err);
        reject(err);
        return;
      }
      
      connection.ping((pingErr) => {
        connection.release();
        if (pingErr) {
          console.error('数据库ping失败:', pingErr);
          reject(pingErr);
        } else {
          resolve();
        }
      });
    });
  });
}

// 执行数据库查询，带重试机制
async function executeQuery(sql, params = []) {
  const maxRetries = 3;
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return new Promise((resolve, reject) => {
        db.getConnection((err, connection) => {
          if (err) {
            console.error(`获取数据库连接失败 (尝试 ${attempt}/${maxRetries}):`, err);
            reject(err);
            return;
          }
          
          connection.query(sql, params, (queryErr, result) => {
            connection.release();
            
            if (queryErr) {
              console.error(`查询失败 (尝试 ${attempt}/${maxRetries}):`, queryErr);
              reject(queryErr);
            } else {
              resolve(result);
            }
          });
        });
      });
    } catch (error) {
      lastError = error;
      console.warn(`数据库操作失败，尝试重连 (${attempt}/${maxRetries}):`, error.message);
      
      if (attempt < maxRetries) {
        // 等待一段时间后重试
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
  
  throw lastError;
}

// 配置multer用于文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // 将文件保存到novel目录
    const uploadDir = path.join(__dirname, '../novel');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // 保持原文件名，添加时间戳避免冲突
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}_${timestamp}${ext}`);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/pdf', // .pdf
      'text/plain', // .txt
      'application/msword' // .doc
    ];
    
    if (validTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('只支持Word文档(.docx/.doc)、PDF(.pdf)和文本文件(.txt)'), false);
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB限制
  }
});

// 查询相似小说
async function findSimilarNovels(title) {
  // 提取小说名称的基础部分（去掉数字后缀）
  const baseTitle = title.replace(/\d+$/, '').trim();
  
  const sql = `
    SELECT n.id, n.title, n.author, n.description, n.chapters,
           v.id as volume_id, v.title as volume_title
    FROM novel n
    LEFT JOIN volume v ON n.id = v.novel_id
    WHERE n.title LIKE ? OR n.title LIKE ?
    ORDER BY n.id DESC, v.volume_id ASC
  `;
  
  const patterns = [`%${baseTitle}%`, `${baseTitle}%`];
  
  const results = await executeQuery(sql, patterns);
  console.log('找到相似小说:', results.length, '个');
  return results;
}

// 获取所有小说列表
async function getAllNovels() {
  const sql = `
    SELECT id, title, author, description, chapters
    FROM novel 
    ORDER BY id DESC
  `;
  
  const results = await executeQuery(sql);
  console.log('获取小说列表:', results.length, '个');
  return results;
}

// 根据名称搜索小说
async function searchNovels(title) {
  const sql = `
    SELECT id, title, author, description, chapters
    FROM novel 
    WHERE title LIKE ?
    ORDER BY id DESC
  `;
  
  const searchPattern = `%${title.trim()}%`;
  
  const results = await executeQuery(sql, [searchPattern]);
  console.log('搜索结果:', results.length, '个');
  return results;
}

// 获取小说的最大章节号
async function getMaxChapterNumber(novelId) {
  const sql = 'SELECT MAX(chapter_number) as maxChapter FROM chapter WHERE novel_id = ?';
  
  const results = await executeQuery(sql, [novelId]);
  const maxChapter = results[0].maxChapter || 0;
  console.log('最大章节号:', maxChapter);
  return maxChapter;
}

// 获取小说的卷信息
async function getNovelVolumes(novelId) {
  const sql = `
    SELECT id, title, volume_id
    FROM volume 
    WHERE novel_id = ?
    ORDER BY volume_id ASC
  `;
  
  const results = await executeQuery(sql, [novelId]);
  console.log('获取卷信息:', results);
  return results;
}

// 获取小说章节信息
async function getNovelChapters(novelId, userId = null) {
  // 使用mysql2/promise进行异步查询
  const mysql = require('mysql2/promise');
  let db;
  try {
    db = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'kongfuworld',
      charset: 'utf8mb4'
    });

    // 调用 championService 获取可见性信息
    const ChampionService = require('./services/championService');
    const championService = new ChampionService();
    const visibility = await championService.getUserChapterVisibility(db, novelId, userId);

    // 构建可见性过滤条件
    let visibilityCondition = 'c.is_released = 1 AND c.review_status = \'approved\'';
    const queryParams = [novelId];

    if (!visibility.championEnabled || !visibility.isChampion) {
      // 未启用 Champion 或非 Champion 用户：只显示 is_advance=0 的章节
      visibilityCondition += ' AND c.is_advance = 0';
    } else {
      // Champion 用户：显示 chapter_number <= visibleMaxChapterNumber 的章节
      visibilityCondition += ' AND c.chapter_number <= ?';
      queryParams.push(visibility.visibleMaxChapterNumber);
    }

    const sql = `
      SELECT c.id, c.chapter_number, c.title, c.volume_id, c.is_advance, 
             v.title as volume_title, v.volume_id
      FROM chapter c
      LEFT JOIN volume v ON c.volume_id = v.id AND v.novel_id = c.novel_id
      WHERE c.novel_id = ? AND ${visibilityCondition}
      ORDER BY c.chapter_number
    `;
    
    const [results] = await db.execute(sql, queryParams);
    console.log('获取章节信息:', results.length, '个章节');
    return results;
  } finally {
    if (db) await db.end();
  }
}

// 解析文档（支持多种格式）
async function parseDocument(filePath) {
  try {
    console.log('开始解析文档:', filePath);
    
    const ext = path.extname(filePath).toLowerCase();
    let text = '';
    
    switch (ext) {
      case '.docx':
      case '.doc':
        // 使用mammoth解析Word文档
        const result = await mammoth.extractRawText({ path: filePath });
        text = result.value;
        break;
        
      case '.pdf':
        // 对于PDF文件，暂时返回错误提示
        // 可以后续集成pdf-parse库来支持PDF解析
        throw new Error('PDF文件解析功能暂未实现，请转换为Word文档后上传');
        
      case '.txt':
        // 直接读取文本文件
        text = fs.readFileSync(filePath, 'utf8');
        break;
        
      default:
        throw new Error(`不支持的文件格式: ${ext}`);
    }
    
    console.log('文档解析成功，总字符数:', text.length);
    return {
      text: text,
      fileName: path.basename(filePath, ext)
    };
  } catch (error) {
    console.error('解析文档失败:', error);
    throw error;
  }
}

// 封装一个带自动重试的ChatGPT调用函数
async function safeChatGPTCall(prompt, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`ChatGPT API 调用尝试 ${i + 1}/${retries}`);
      
      // 使用 Promise.race 实现超时控制
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('请求超时')), 60000); // 60秒超时
      });
      
      const apiPromise = openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 2000,
      });
      
      const response = await Promise.race([apiPromise, timeoutPromise]);
      
      const text = response.choices[0].message.content.trim();
      console.log(`ChatGPT API 调用成功 (尝试 ${i + 1})`);
      return text;
      
    } catch (err) {
      console.error(`ChatGPT API 调用失败 (尝试 ${i + 1}/${retries}):`, err.message || err);
      
      // 如果是配额超限，直接抛出错误
      if (err.code === 'insufficient_quota' || err.status === 429) {
        throw err;
      }
      
      // 如果是最后一次尝试，抛出错误
      if (i === retries - 1) {
        throw err;
      }
      
      // 等待后重试，使用指数退避
      const waitTime = delay * Math.pow(2, i);
      console.log(`等待 ${waitTime}ms 后重试...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

// 使用ChatGPT分析章节（快速回退到传统方法）
async function analyzeChaptersWithGPT(fileName, fileContent) {
  console.log('使用传统解析方法（更稳定快速）:', fileName);
  console.log('文件总字符数:', fileContent.length);
  
  // 直接使用传统解析方法，避免ChatGPT API的复杂性和延迟
  return splitChapters(fileContent);
}

// 获取当前段落相关的章节目录
function getRelevantTitles(segment) {
  // 完整的《红楼梦》目录
  const hongloumengDirectory = [
    '第一回 甄士隐梦幻识通灵 贾雨村风尘怀闺秀',
    '第二回 贾夫人仙逝扬州城 冷子兴演说荣国府',
    '第三回 贾雨村夤缘复旧职 林黛玉抛父进京都',
    '第四回 薄命女偏逢薄命郎 葫芦僧乱判葫芦案',
    '第五回 游幻境指迷十二钗 饮仙醪曲演红楼梦',
    '第六回 贾宝玉初试云雨情 刘姥姥一进荣国府',
    '第七回 送宫花贾琏戏熙凤 宴宁府宝玉会秦钟',
    '第八回 比通灵金莺微露意 探宝钗黛玉半含酸',
    '第九回 恋风流情友入家塾 起嫌疑顽童闹学堂',
    '第十回 金寡妇贪利权受辱 张太医论病细穷源',
    '第十一回 庆寿辰宁府排家宴 见熙凤贾瑞起淫心',
    '第十二回 王熙凤毒设相思局 贾天祥正照风月鉴',
    '第十三回 秦可卿死封龙禁尉 王熙凤协理宁国府',
    '第十四回 林如海捐馆扬州城 贾宝玉路谒北静王',
    '第十五回 王凤姐弄权铁槛寺 秦鲸卿得趣馒头庵',
    '第十六回 贾元春才选凤藻宫 秦鲸卿夭逝黄泉路',
    '第十七回 大观园试才题对额 荣国府归省庆元宵',
    '第十八回 隔珠帘父女勉忠勤 搦湘管姊弟裁题咏',
    '第十九回 情切切良宵花解语 意绵绵静日玉生香',
    '第二十回 王熙凤正言弹妒意 林黛玉俏语谑娇音',
    '第二十一回 贤袭人娇嗔箴宝玉 俏平儿软语救贾琏',
    '第二十二回 听曲文宝玉悟禅机 制灯迷贾政悲谶语',
    '第二十三回 西厢记妙词通戏语 牡丹亭艳曲警芳心',
    '第二十四回 醉金刚轻财尚义侠 痴女儿遗帕惹相思',
    '第二十五回 魇魔法姊弟逢五鬼 红楼梦通灵遇双真',
    '第二十六回 蜂腰桥设言传心事 潇湘馆春困发幽情',
    '第二十七回 滴翠亭杨妃戏彩蝶 埋香冢飞燕泣残红',
    '第二十八回 蒋玉菡情赠茜香罗 薛宝钗羞笼红麝串',
    '第二十九回 享福人福深还祷福 痴情女情重愈斟情',
    '第三十回 宝钗借扇机带双敲 龄官划蔷痴及局外',
    '第三十一回 撕扇子作千金一笑 因麒麟伏白首双星',
    '第三十二回 诉肺腑心迷活宝玉 含耻辱情烈死金钏',
    '第三十三回 手足耽耽小动唇舌 不肖种种大承笞挞',
    '第三十四回 情中情因情感妹妹 错里错以错劝哥哥',
    '第三十五回 白玉钏亲尝莲叶羹 黄金莺巧结梅花络',
    '第三十六回 绣鸳鸯梦兆绛芸轩 识分定情悟梨香院',
    '第三十七回 秋爽斋偶结海棠社 蘅芜苑夜拟菊花题',
    '第三十八回 林潇湘魁夺菊花诗 薛蘅芜讽和螃蟹咏',
    '第三十九回 村姥姥是信口开合 情哥哥偏寻根究底',
    '第四十回 史太君两宴大观园 金鸳鸯三宣牙牌令',
    '第四十一回 栊翠庵茶品梅花雪 怡红院劫遇母蝗虫',
    '第四十二回 蘅芜君兰言解疑癖 潇湘子雅谑补余香',
    '第四十三回 闲取乐偶攒金庆寿 不了情暂撮土为香',
    '第四十四回 变生不测凤姐泼醋 喜出望外平儿理妆',
    '第四十五回 金兰契互剖金兰语 风雨夕闷制风雨词',
    '第四十六回 尴尬人难免尴尬事 鸳鸯女誓绝鸳鸯偶',
    '第四十七回 呆霸王调情遭苦打 冷郎君惧祸走他乡',
    '第四十八回 滥情人情误思游艺 慕雅女雅集苦吟诗',
    '第四十九回 琉璃世界白雪红梅 脂粉香娃割腥啖膻',
    '第五十回 芦雪庵争联即景诗 暖香坞雅制春灯谜',
    '第五十一回 薛小妹新编怀古诗 胡庸医乱用虎狼药',
    '第五十二回 俏平儿情掩虾须镯 勇晴雯病补雀金裘',
    '第五十三回 宁国府除夕祭宗祠 荣国府元宵开夜宴',
    '第五十四回 史太君破陈腐旧套 王熙凤效戏彩斑衣',
    '第五十五回 辱亲女愚妾争闲气 欺幼主刁奴蓄险心',
    '第五十六回 敏探春兴利除宿弊 时宝钗小惠全大体',
    '第五十七回 慧紫鹃情辞试忙玉 慈姨妈爱语慰痴颦',
    '第五十八回 杏子阴假凤泣虚凰 茜纱窗真情揆痴理',
    '第五十九回 柳叶渚边嗔莺咤燕 绛云轩里召将飞符',
    '第六十回 茉莉粉替去蔷薇硝 玫瑰露引来茯苓霜',
    '第六十一回 投鼠忌器宝玉瞒赃 判冤决狱平儿行权',
    '第六十二回 憨湘云醉眠芍药茵 呆香菱情解石榴裙',
    '第六十三回 寿怡红群芳开夜宴 死金丹独艳理亲丧',
    '第六十四回 幽淑女悲题五美吟 浪荡子情遗九龙佩',
    '第六十五回 贾二舍偷娶尤二姨 尤三姐思嫁柳二郎',
    '第六十六回 情小妹耻情归地府 冷二郎一冷入空门',
    '第六十七回 见土仪颦卿思故里 闻秘事凤姐讯家童',
    '第六十八回 苦尤娘赚入大观园 酸凤姐大闹宁国府',
    '第六十九回 弄小巧用借剑杀人 觉大限吞生金自逝',
    '第七十回 林黛玉重建桃花社 史湘云偶填柳絮词',
    '第七十一回 嫌隙人有心生嫌隙 鸳鸯女无意遇鸳鸯',
    '第七十二回 王熙凤恃强羞说病 来旺妇倚势霸成亲',
    '第七十三回 痴丫头误拾绣春囊 懦小姐不问累金凤',
    '第七十四回 惑奸谗抄检大观园 矢孤介杜绝宁国府',
    '第七十五回 开夜宴异兆发悲音 赏中秋新词得佳谶',
    '第七十六回 凸碧堂品笛感凄清 凹晶馆联诗悲寂寞',
    '第七十七回 俏丫鬟抱屈夭风流 美优伶斩情归水月',
    '第七十八回 老学士闲征诡画词 痴公子杜撰芙蓉诔',
    '第七十九回 薛文龙悔娶河东狮 贾迎春误嫁中山狼',
    '第八十回 美香菱屈受贪夫棒 王道士胡诌妒妇方',
    '第八十一回 占旺相四美钓游鱼 奉严词两番入家塾',
    '第八十二回 老学究讲义警顽心 病潇湘痴魂惊恶梦',
    '第八十三回 省宫闱贾元妃染恙 闹闺阃薛宝钗吞声',
    '第八十四回 试文字宝玉始提亲 探惊风贾环重结怨',
    '第八十五回 贾存周报升郎中任 薛文起复惹放流刑',
    '第八十六回 受私贿老官翻案牍 寄闲情淑女解琴书',
    '第八十七回 感深秋抚琴悲往事 坐禅寂走火入邪魔',
    '第八十八回 博庭欢宝玉赞孤儿 正家法贾珍鞭悍仆',
    '第八十九回 人亡物在公子填词 蛇影杯弓颦卿绝粒',
    '第九十回 失绵衣贫女耐嗷嘈 送果品小郎惊叵测',
    '第九十一回 纵淫心宝蟾工设计 布疑阵宝玉妄谈禅',
    '第九十二回 评女传巧姐慕贤良 玩母珠贾政参聚散',
    '第九十三回 甄家仆投靠贾家门 水月庵掀翻风月案',
    '第九十四回 宴海棠贾母赏花妖 失宝玉通灵知奇祸',
    '第九十五回 因讹成实元妃薨逝 以假混真宝玉疯颠',
    '第九十六回 瞒消息凤姐设奇谋 泄机关颦儿迷本性',
    '第九十七回 林黛玉焚稿断痴情 薛宝钗出闺成大礼',
    '第九十八回 苦绛珠魂归离恨天 病神瑛泪洒相思地',
    '第九十九回 守官箴恶奴同破例 阅邸报老舅自担惊',
    '第一零零回 破好事香菱结深恨 悲远嫁宝玉感离情',
    '第一零一回 大观园月夜感幽魂 散花寺神签惊异兆',
    '第一零二回 宁国府骨肉病灾襟 大观园符水驱妖孽',
    '第一零三回 施毒计金桂自焚身 昧真禅雨村空遇旧',
    '第一零四回 醉金刚小鳅生大浪 痴公子余痛触前情',
    '第一零五回 锦衣军查抄宁国府 骢马使弹劾平安州',
    '第一零六回 王熙凤致祸抱羞惭 贾太君祷天消祸患',
    '第一零七回 散余资贾母明大义 复世职政老沐天恩',
    '第一零八回 强欢笑蘅芜庆生辰 死缠绵潇湘闻鬼哭',
    '第一零九回 候芳魂五儿承错爱 还孽债迎女返真元',
    '第一一零回 史太君寿终归地府 王凤姐力诎失人心',
    '第一一一回 鸳鸯女殉主登太虚 狗彘奴欺天招伙盗',
    '第一一二回 活冤孽妙尼遭大劫 死雠仇赵妾赴冥曹',
    '第一一三回 忏宿冤凤姐托村妪 释旧憾情婢感痴郎',
    '第一一四回 王熙凤历幻返金陵 甄应嘉蒙恩还玉阙',
    '第一一五回 惑偏私惜春矢素志 证同类宝玉失相知',
    '第一一六回 得通灵幻境悟仙缘 送慈柩故乡全孝道',
    '第一一七回 阻超凡佳人双护玉 欣聚党恶子独承家',
    '第一一八回 记微嫌舅兄欺弱女 惊谜语妻妾谏痴人',
    '第一一九回 中乡魁宝玉却尘缘 沐皇恩贾家延世泽',
    '第一二零回 甄士隐详说太虚情 贾雨村归结红楼梦'
  ];
  
  // 检测当前段落中包含的章节标题
  const foundTitles = [];
  
  for (const title of hongloumengDirectory) {
    if (segment.includes(title)) {
      foundTitles.push(title);
    }
  }
  
  // 如果找到了章节标题，返回找到的标题（限制最多10个）
  if (foundTitles.length > 0) {
    const limitedTitles = foundTitles.slice(0, 10); // 最多返回10个标题
    console.log(`当前段落找到 ${foundTitles.length} 个章节标题，使用前 ${limitedTitles.length} 个:`, limitedTitles.slice(0, 3).join(', ') + (limitedTitles.length > 3 ? '...' : ''));
    return limitedTitles;
  }
  
  // 如果没有找到，返回前10个标题作为默认
  console.log('当前段落未找到章节标题，使用默认前10个标题');
  return hongloumengDirectory.slice(0, 10);
}

// 合并和去重章节
function mergeChapters(chapters) {
  if (!Array.isArray(chapters) || chapters.length === 0) {
    return [];
  }
  
  // 按章节标题去重
  const uniqueChapters = new Map();
  
  chapters.forEach(chapter => {
    if (chapter && chapter.title && chapter.content) {
      // 如果已存在相同标题的章节，选择内容更长的
      if (uniqueChapters.has(chapter.title)) {
        const existing = uniqueChapters.get(chapter.title);
        if (chapter.content.length > existing.content.length) {
          uniqueChapters.set(chapter.title, chapter);
        }
      } else {
        uniqueChapters.set(chapter.title, chapter);
      }
    }
  });
  
  // 转换为数组并按章节顺序排序
  const sortedChapters = Array.from(uniqueChapters.values()).sort((a, b) => {
    // 提取章节号进行比较
    const aMatch = a.title.match(/第([一二三四五六七八九十百千万\d]+)[章节回]/);
    const bMatch = b.title.match(/第([一二三四五六七八九十百千万\d]+)[章节回]/);
    
    if (aMatch && bMatch) {
      const aNum = parseInt(aMatch[1]) || 0;
      const bNum = parseInt(bMatch[1]) || 0;
      return aNum - bNum;
    }
    
    return a.title.localeCompare(b.title);
  });
  
  return sortedChapters;
}

// 分割章节
function splitChapters(text) {
  const lines = text.split('\n');
  const chapters = [];
  let currentTitle = '';
  let currentContent = [];

  // 支持"第X回"、"第X章"、"第X节"
  const chapterPattern = /^第[一二三四五六七八九十百千万\d]+[章节回]/;

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    if (chapterPattern.test(line)) {
      // 新章节开始
      if (currentTitle && currentContent.length > 0) {
        chapters.push({
          title: currentTitle,
          content: currentContent.join('\n').trim()
        });
      }
      currentTitle = line;
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  // 最后一章
  if (currentTitle && currentContent.length > 0) {
    chapters.push({
      title: currentTitle,
      content: currentContent.join('\n').trim()
    });
  }

  // 如果没分出来，兜底整个文本为一章
  if (chapters.length === 0) {
    chapters.push({
      title: '第一回',
      content: text.trim()
    });
  }

  console.log(`分割完成，共找到 ${chapters.length} 个章节`);
  return chapters;
}

// 计算字数
function countWords(text) {
  return text.replace(/\s+/g, '').length;
}

// 生成解锁金币
function generateUnlockCost(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 创建小说记录
async function createNovel(novelConfig) {
  const sql = `
    INSERT INTO novel (title, author, description, status, chapters) 
    VALUES (?, ?, ?, ?, ?)
  `;
  
  const result = await executeQuery(sql, [
    novelConfig.title, 
    novelConfig.author, 
    novelConfig.description, 
    'ongoing', 
    0
  ]);
  
  console.log('小说记录创建成功，ID:', result.insertId);
  return result.insertId;
}

// 创建卷记录
async function createVolume(novelId, volumeTitle, volumeNumber) {
  const sql = `
    INSERT INTO volume (novel_id, volume_id, title)
    VALUES (?, ?, ?)
  `;
  
  const values = [novelId, volumeNumber, volumeTitle];
  
  const result = await executeQuery(sql, values);
  console.log('卷创建成功，ID:', result.insertId);
  return result.insertId;
}

// 更新章节数
async function updateChapterCounts(novelId, volumeId, chapterCount) {
  // 更新小说的总章节数
  const novelSql = `
    UPDATE novel 
    SET chapters = chapters + ? 
    WHERE id = ?
  `;
  
  // 更新卷的章节数
  const volumeSql = `
    UPDATE volume 
    SET chapter_count = chapter_count + ? 
    WHERE id = ?
  `;
  
  await executeQuery(novelSql, [chapterCount, novelId]);
  await executeQuery(volumeSql, [chapterCount, volumeId]);
  console.log('章节数更新成功');
}



// 上传章节
async function uploadChapters(novelId, volumeId, chapters, novelConfig, startChapterNumber = 1) {
  console.log('开始上传章节...');
  console.log('起始章节号:', startChapterNumber);
  
  // 检查是否有章节需要上传
  if (!chapters || chapters.length === 0) {
    console.log('没有章节需要上传');
    return { affectedRows: 0 };
  }
  
  // 批量插入章节
  const values = chapters.map((chapter, index) => {
    // 使用用户调整的章节编号，如果没有则使用默认计算
    const chapterNumber = chapter.chapterNumber || (startChapterNumber + index);
    const isFree = chapterNumber <= novelConfig.freeChapters;
    
    // 使用章节各自的volumeId，如果没有设置则使用默认的volumeId
    const chapterVolumeId = chapter.volumeId || volumeId;
    
    return [
      novelId,
      chapterVolumeId,
      chapterNumber,
      chapter.title,
      chapter.content,
      chapter.isLocked || !isFree,  // 根据免费章节数自动设置
      chapter.isVipOnly || false,
      chapter.isAdvance || false,
      chapter.isVisible !== false,  // 默认可见
      chapter.unlockCost || generateUnlockCost(novelConfig.minCost || 10, novelConfig.maxCost || 63),
      chapter.translatorNote || null,
      null  // prev_chapter_id 设置为 null
    ];
  });
  
  const sql = `
    INSERT INTO chapter (
      novel_id, volume_id, chapter_number, title, content,
      is_locked, is_vip_only, is_advance, is_visible, unlock_price, translator_note, prev_chapter_id
    ) VALUES ?
  `;
  
  const result = await executeQuery(sql, [values]);
  console.log(`章节上传成功，共上传 ${result.affectedRows} 个章节`);
  return result;
}



// API路由：查询相似小说
async function findSimilarNovelsAPI(req, res) {
  try {
    const { title } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: '请提供小说标题' });
    }
    
    const similarNovels = await findSimilarNovels(title);
    
    res.json({ 
      success: true, 
      similarNovels: similarNovels
    });
    
  } catch (error) {
    console.error('查询相似小说失败:', error);
    res.status(500).json({ error: '查询相似小说失败: ' + error.message });
  }
}

// API路由：获取小说信息
async function getNovelInfoAPI(req, res) {
  try {
    const { novelId } = req.params;
    
    if (!novelId) {
      return res.status(400).json({ error: '请提供小说ID' });
    }
    
    const [maxChapter, volumes] = await Promise.all([
      getMaxChapterNumber(novelId),
      getNovelVolumes(novelId)
    ]);
    
    res.json({ 
      success: true, 
      maxChapterNumber: maxChapter,
      volumes: volumes
    });
    
  } catch (error) {
    console.error('获取小说信息失败:', error);
    res.status(500).json({ error: '获取小说信息失败: ' + error.message });
  }
}

// API路由：获取小说章节信息
async function getNovelChaptersAPI(req, res) {
  try {
    const { novelId } = req.params;
    const userId = req.query.userId ? parseInt(req.query.userId, 10) : null;
    
    if (!novelId) {
      return res.status(400).json({ error: '请提供小说ID' });
    }
    
    const chapters = await getNovelChapters(novelId, userId);
    
    res.json({ 
      success: true, 
      chapters: chapters
    });
    
  } catch (error) {
    console.error('获取小说章节信息失败:', error);
    res.status(500).json({ error: '获取小说章节信息失败: ' + error.message });
  }
}

// API路由：解析章节
async function parseChaptersAPI(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传文件' });
    }

    const novelConfig = JSON.parse(req.body.config || '{}');
    const filePath = req.file.path;
    
    console.log('收到文件上传请求:', req.file.originalname);
    console.log('文件保存路径:', filePath);
    
    // 解析文档
    const documentData = await parseDocument(filePath);
    const { text, fileName } = documentData;
    
    // 使用ChatGPT分析章节
    const rawChapters = await analyzeChaptersWithGPT(fileName, text);
    
    if (rawChapters.length === 0) {
      return res.status(400).json({ error: '未找到任何章节' });
    }
    
    // 转换为前端需要的格式
    const chapters = rawChapters.map((chapter, index) => {
      const chapterNumber = index + 1;
      const isFree = chapterNumber <= novelConfig.freeChapters;
      
      // 尝试从章节标题中提取章节号
      let extractedChapterNumber = chapterNumber;
      
      // 支持多种章节标题格式
      const patterns = [
        /第([一二三四五六七八九十百千万\d]+)[章节回]/, // 第X章、第X回、第X节
        /([一二三四五六七八九十百千万\d]+)[章节回]/, // X章、X回、X节（没有"第"字）
        /第([一二三四五六七八九十百千万\d]+)回/, // 第X回
        /([一二三四五六七八九十百千万\d]+)回/, // X回（没有"第"字）
        /第([一二三四五六七八九十百千万\d]+)章/, // 第X章
        /([一二三四五六七八九十百千万\d]+)章/, // X章（没有"第"字）
        /第([一二三四五六七八九十百千万\d]+)节/, // 第X节
        /([一二三四五六七八九十百千万\d]+)节/ // X节（没有"第"字）
      ];
      
      let titleMatch = null;
      for (const pattern of patterns) {
        titleMatch = chapter.title.match(pattern);
        if (titleMatch) break;
      }
      
      if (titleMatch) {
        const chineseNumber = titleMatch[1];
        if (/^\d+$/.test(chineseNumber)) {
          extractedChapterNumber = parseInt(chineseNumber);
        } else {
          // 扩展的中文数字映射表（支持到3000）
          const chineseToNumber = {
            // 基础数字
            '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
            '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
            
            // 十几
            '十一': 11, '十二': 12, '十三': 13, '十四': 14, '十五': 15,
            '十六': 16, '十七': 17, '十八': 18, '十九': 19,
            
            // 几十
            '二十': 20, '二十一': 21, '二十二': 22, '二十三': 23, '二十四': 24, '二十五': 25,
            '二十六': 26, '二十七': 27, '二十八': 28, '二十九': 29,
            '三十': 30, '三十一': 31, '三十二': 32, '三十三': 33, '三十四': 34, '三十五': 35,
            '三十六': 36, '三十七': 37, '三十八': 38, '三十九': 39,
            '四十': 40, '四十一': 41, '四十二': 42, '四十三': 43, '四十四': 44, '四十五': 45,
            '四十六': 46, '四十七': 47, '四十八': 48, '四十九': 49,
            '五十': 50, '五十一': 51, '五十二': 52, '五十三': 53, '五十四': 54, '五十五': 55,
            '五十六': 56, '五十七': 57, '五十八': 58, '五十九': 59,
            '六十': 60, '六十一': 61, '六十二': 62, '六十三': 63, '六十四': 64, '六十五': 65,
            '六十六': 66, '六十七': 67, '六十八': 68, '六十九': 69,
            '七十': 70, '七十一': 71, '七十二': 72, '七十三': 73, '七十四': 74, '七十五': 75,
            '七十六': 76, '七十七': 77, '七十八': 78, '七十九': 79,
            '八十': 80, '八十一': 81, '八十二': 82, '八十三': 83, '八十四': 84, '八十五': 85,
            '八十六': 86, '八十七': 87, '八十八': 88, '八十九': 89,
            '九十': 90, '九十一': 91, '九十二': 92, '九十三': 93, '九十四': 94, '九十五': 95,
            '九十六': 96, '九十七': 97, '九十八': 98, '九十九': 99,
            
            // 一百多
            '一百': 100, '一百零一': 101, '一百零二': 102, '一百零三': 103, '一百零四': 104, '一百零五': 105,
            '一百零六': 106, '一百零七': 107, '一百零八': 108, '一百零九': 109,
            '一百一十': 110, '一百一十一': 111, '一百一十二': 112, '一百一十三': 113, '一百一十四': 114, '一百一十五': 115,
            '一百一十六': 116, '一百一十七': 117, '一百一十八': 118, '一百一十九': 119,
            '一百二十': 120, '一百二十一': 121, '一百二十二': 122, '一百二十三': 123, '一百二十四': 124, '一百二十五': 125,
            '一百二十六': 126, '一百二十七': 127, '一百二十八': 128, '一百二十九': 129,
            '一百三十': 130, '一百三十一': 131, '一百三十二': 132, '一百三十三': 133, '一百三十四': 134, '一百三十五': 135,
            '一百三十六': 136, '一百三十七': 137, '一百三十八': 138, '一百三十九': 139,
            '一百四十': 140, '一百四十一': 141, '一百四十二': 142, '一百四十三': 143, '一百四十四': 144, '一百四十五': 145,
            '一百四十六': 146, '一百四十七': 147, '一百四十八': 148, '一百四十九': 149,
            '一百五十': 150, '一百五十一': 151, '一百五十二': 152, '一百五十三': 153, '一百五十四': 154, '一百五十五': 155,
            '一百五十六': 156, '一百五十七': 157, '一百五十八': 158, '一百五十九': 159,
            '一百六十': 160, '一百六十一': 161, '一百六十二': 162, '一百六十三': 163, '一百六十四': 164, '一百六十五': 165,
            '一百六十六': 166, '一百六十七': 167, '一百六十八': 168, '一百六十九': 169,
            '一百七十': 170, '一百七十一': 171, '一百七十二': 172, '一百七十三': 173, '一百七十四': 174, '一百七十五': 175,
            '一百七十六': 176, '一百七十七': 177, '一百七十八': 178, '一百七十九': 179,
            '一百八十': 180, '一百八十一': 181, '一百八十二': 182, '一百八十三': 183, '一百八十四': 184, '一百八十五': 185,
            '一百八十六': 186, '一百八十七': 187, '一百八十八': 188, '一百八十九': 189,
            '一百九十': 190, '一百九十一': 191, '一百九十二': 192, '一百九十三': 193, '一百九十四': 194, '一百九十五': 195,
            '一百九十六': 196, '一百九十七': 197, '一百九十八': 198, '一百九十九': 199,
            
            // 二百多
            '二百': 200, '二百零一': 201, '二百零二': 202, '二百零三': 203, '二百零四': 204, '二百零五': 205,
            '二百零六': 206, '二百零七': 207, '二百零八': 208, '二百零九': 209,
            '二百一十': 210, '二百一十一': 211, '二百一十二': 212, '二百一十三': 213, '二百一十四': 214, '二百一十五': 215,
            '二百一十六': 216, '二百一十七': 217, '二百一十八': 218, '二百一十九': 219,
            '二百二十': 220, '二百二十一': 221, '二百二十二': 222, '二百二十三': 223, '二百二十四': 224, '二百二十五': 225,
            '二百二十六': 226, '二百二十七': 227, '二百二十八': 228, '二百二十九': 229,
            '二百三十': 230, '二百三十一': 231, '二百三十二': 232, '二百三十三': 233, '二百三十四': 234, '二百三十五': 235,
            '二百三十六': 236, '二百三十七': 237, '二百三十八': 238, '二百三十九': 239,
            '二百四十': 240, '二百四十一': 241, '二百四十二': 242, '二百四十三': 243, '二百四十四': 244, '二百四十五': 245,
            '二百四十六': 246, '二百四十七': 247, '二百四十八': 248, '二百四十九': 249,
            '二百五十': 250, '二百五十一': 251, '二百五十二': 252, '二百五十三': 253, '二百五十四': 254, '二百五十五': 255,
            '二百五十六': 256, '二百五十七': 257, '二百五十八': 258, '二百五十九': 259,
            '二百六十': 260, '二百六十一': 261, '二百六十二': 262, '二百六十三': 263, '二百六十四': 264, '二百六十五': 265,
            '二百六十六': 266, '二百六十七': 267, '二百六十八': 268, '二百六十九': 269,
            '二百七十': 270, '二百七十一': 271, '二百七十二': 272, '二百七十三': 273, '二百七十四': 274, '二百七十五': 275,
            '二百七十六': 276, '二百七十七': 277, '二百七十八': 278, '二百七十九': 279,
            '二百八十': 280, '二百八十一': 281, '二百八十二': 282, '二百八十三': 283, '二百八十四': 284, '二百八十五': 285,
            '二百八十六': 286, '二百八十七': 287, '二百八十八': 288, '二百八十九': 289,
            '二百九十': 290, '二百九十一': 291, '二百九十二': 292, '二百九十三': 293, '二百九十四': 294, '二百九十五': 295,
            '二百九十六': 296, '二百九十七': 297, '二百九十八': 298, '二百九十九': 299,
            
            // 三百多
            '三百': 300, '三百零一': 301, '三百零二': 302, '三百零三': 303, '三百零四': 304, '三百零五': 305,
            '三百零六': 306, '三百零七': 307, '三百零八': 308, '三百零九': 309,
            '三百一十': 310, '三百一十一': 311, '三百一十二': 312, '三百一十三': 313, '三百一十四': 314, '三百一十五': 315,
            '三百一十六': 316, '三百一十七': 317, '三百一十八': 318, '三百一十九': 319,
            '三百二十': 320, '三百二十一': 321, '三百二十二': 322, '三百二十三': 323, '三百二十四': 324, '三百二十五': 325,
            '三百二十六': 326, '三百二十七': 327, '三百二十八': 328, '三百二十九': 329,
            '三百三十': 330, '三百三十一': 331, '三百三十二': 332, '三百三十三': 333, '三百三十四': 334, '三百三十五': 335,
            '三百三十六': 336, '三百三十七': 337, '三百三十八': 338, '三百三十九': 339,
            '三百四十': 340, '三百四十一': 341, '三百四十二': 342, '三百四十三': 343, '三百四十四': 344, '三百四十五': 345,
            '三百四十六': 346, '三百四十七': 347, '三百四十八': 348, '三百四十九': 349,
            '三百五十': 350, '三百五十一': 351, '三百五十二': 352, '三百五十三': 353, '三百五十四': 354, '三百五十五': 355,
            '三百五十六': 356, '三百五十七': 357, '三百五十八': 358, '三百五十九': 359,
            '三百六十': 360, '三百六十一': 361, '三百六十二': 362, '三百六十三': 363, '三百六十四': 364, '三百六十五': 365,
            '三百六十六': 366, '三百六十七': 367, '三百六十八': 368, '三百六十九': 369,
            '三百七十': 370, '三百七十一': 371, '三百七十二': 372, '三百七十三': 373, '三百七十四': 374, '三百七十五': 375,
            '三百七十六': 376, '三百七十七': 377, '三百七十八': 378, '三百七十九': 379,
            '三百八十': 380, '三百八十一': 381, '三百八十二': 382, '三百八十三': 383, '三百八十四': 384, '三百八十五': 385,
            '三百八十六': 386, '三百八十七': 387, '三百八十八': 388, '三百八十九': 389,
            '三百九十': 390, '三百九十一': 391, '三百九十二': 392, '三百九十三': 393, '三百九十四': 394, '三百九十五': 395,
            '三百九十六': 396, '三百九十七': 397, '三百九十八': 398, '三百九十九': 399,
            
            // 四百多到九百多（简化，只列出一些关键数字）
            '四百': 400, '四百一十': 410, '四百二十': 420, '四百三十': 430, '四百四十': 440, '四百五十': 450,
            '四百六十': 460, '四百七十': 470, '四百八十': 480, '四百九十': 490,
            '五百': 500, '五百一十': 510, '五百二十': 520, '五百三十': 530, '五百四十': 540, '五百五十': 550,
            '五百六十': 560, '五百七十': 570, '五百八十': 580, '五百九十': 590,
            '六百': 600, '六百一十': 610, '六百二十': 620, '六百三十': 630, '六百四十': 640, '六百五十': 650,
            '六百六十': 660, '六百七十': 670, '六百八十': 680, '六百九十': 690,
            '七百': 700, '七百一十': 710, '七百二十': 720, '七百三十': 730, '七百四十': 740, '七百五十': 750,
            '七百六十': 760, '七百七十': 770, '七百八十': 780, '七百九十': 790,
            '八百': 800, '八百一十': 810, '八百二十': 820, '八百三十': 830, '八百四十': 840, '八百五十': 850,
            '八百六十': 860, '八百七十': 870, '八百八十': 880, '八百九十': 890,
            '九百': 900, '九百一十': 910, '九百二十': 920, '九百三十': 930, '九百四十': 940, '九百五十': 950,
            '九百六十': 960, '九百七十': 970, '九百八十': 980, '九百九十': 990,
            
            // 一千多
            '一千': 1000, '一千零一': 1001, '一千零一十': 1010, '一千零一十一': 1011, '一千一百': 1100, '一千一百一十一': 1111,
            
            // 二千多
            '二千': 2000, '二千零一': 2001, '二千零一十': 2010, '二千零一十一': 2011, '二千一百': 2100, '二千一百一十一': 2111,
            
            // 三千多
            '三千': 3000, '三千零一': 3001, '三千零一十': 3010, '三千零一十一': 3011, '三千一百': 3100, '三千一百一十一': 3111
          };
          
          extractedChapterNumber = chineseToNumber[chineseNumber] || chapterNumber;
        }
      }
      
      return {
        id: index + 1,
        title: chapter.title,
        content: chapter.content,
        wordCount: countWords(chapter.content),
        chapterNumber: extractedChapterNumber, // 使用提取的章节号
        volumeId: undefined, // 添加volumeId字段，初始为undefined
        isLocked: !isFree,
        isVipOnly: false,
        isAdvance: false,
        isVisible: true,
        unlockCost: isFree ? 0 : generateUnlockCost(novelConfig.minCost || 10, novelConfig.maxCost || 63),
        translatorNote: ''
      };
    });
    
    // 注意：这里不删除文件，因为后续上传还需要使用
    console.log('章节解析完成，共解析', chapters.length, '个章节');
    
    res.json({ 
      success: true, 
      chapters: chapters,
      totalChapters: chapters.length,
      filePath: filePath // 返回文件路径供后续使用
    });
    
  } catch (error) {
    console.error('解析章节失败:', error);
    res.status(500).json({ error: '解析章节失败: ' + error.message });
  }
}

// API路由：获取所有小说
async function getAllNovelsAPI(req, res) {
  try {
    const novels = await getAllNovels();
    
    res.json({ 
      success: true, 
      novels: novels 
    });
    
  } catch (error) {
    console.error('获取小说列表失败:', error);
    res.status(500).json({ error: '获取小说列表失败: ' + error.message });
  }
}

// API路由：搜索小说
async function searchNovelsAPI(req, res) {
  try {
    const { title } = req.body;
    
    if (!title || title.trim() === '') {
      return res.status(400).json({ error: '请输入搜索关键词' });
    }
    
    const novels = await searchNovels(title);
    
    res.json({ 
      success: true, 
      novels: novels 
    });
    
  } catch (error) {
    console.error('搜索小说失败:', error);
    res.status(500).json({ error: '搜索小说失败: ' + error.message });
  }
}

// API路由：上传小说
// 多文件上传时的ChatGPT分析API
async function parseMultipleFilesWithGPTAPI(req, res) {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: '请上传文件' });
    }

    console.log(`收到 ${req.files.length} 个文件上传请求`);
    
    const allChapters = [];
    let globalChapterId = 1;

    // 按文件名排序
    const sortedFiles = req.files.sort((a, b) => a.originalname.localeCompare(b.originalname));

    for (let i = 0; i < sortedFiles.length; i++) {
      const file = sortedFiles[i];
      console.log(`处理文件 ${i + 1}/${sortedFiles.length}: ${file.originalname}`);
      
      try {
        // 解析文档
        const documentData = await parseDocument(file.path);
        const { text, fileName } = documentData;
        
        // 使用ChatGPT分析章节
        const fileChapters = await analyzeChaptersWithGPT(fileName, text);
        
        // 为每个章节添加文件信息
        const chaptersWithFileInfo = fileChapters.map(chapter => ({
          ...chapter,
          id: globalChapterId++,
          fileName: file.originalname,
          fileIndex: i
        }));
        
        allChapters.push(...chaptersWithFileInfo);
        
        console.log(`文件 ${file.originalname} 解析完成，找到 ${fileChapters.length} 个章节`);
        
      } catch (fileError) {
        console.error(`文件 ${file.originalname} 解析失败:`, fileError);
        // 继续处理其他文件
      }
    }

    if (allChapters.length === 0) {
      return res.status(400).json({ error: '所有文件都解析失败，未找到任何章节' });
    }

    // 按章节号排序
    allChapters.sort((a, b) => {
      // 首先按文件索引排序
      if (a.fileIndex !== b.fileIndex) {
        return a.fileIndex - b.fileIndex;
      }
      // 然后按章节ID排序
      return a.id - b.id;
    });

    // 重新分配章节号
    allChapters.forEach((chapter, index) => {
      chapter.chapterNumber = index + 1;
    });

    console.log(`所有文件解析完成，总共找到 ${allChapters.length} 个章节`);

    // 转换为前端需要的格式
    const formattedChapters = allChapters.map((chapter, index) => {
      const chapterNumber = chapter.chapterNumber || (index + 1);
      
      return {
        id: chapter.id,
        title: chapter.title,
        content: chapter.content,
        chapterNumber: chapterNumber,
        fileName: chapter.fileName,
        isLocked: false,
        isVipOnly: false,
        isAdvance: false,
        isVisible: true,
        unlockCost: 0,
        translatorNote: '',
        volumeId: null
      };
    });

    res.json({
      success: true,
      chapters: formattedChapters,
      totalChapters: formattedChapters.length,
      message: `成功解析 ${req.files.length} 个文件，共找到 ${formattedChapters.length} 个章节`
    });

  } catch (error) {
    console.error('多文件解析失败:', error);
    
    // 检查是否是 Multer 错误
    if (error.code === 'LIMIT_FIELD_SIZE') {
      res.status(413).json({ 
        error: '数据量过大，请尝试上传较小的文件或减少文件数量',
        details: '字段大小超过了服务器限制'
      });
    } else if (error.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ 
        error: '文件过大，请上传较小的文件',
        details: '文件大小超过了服务器限制'
      });
    } else {
      res.status(500).json({ error: '多文件解析失败: ' + error.message });
    }
  }
}

async function uploadNovelAPI(req, res) {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: '请上传文件' });
    }

    const novelConfig = JSON.parse(req.body.config || '{}');
    const chapters = JSON.parse(req.body.chapters || '[]');
    const isNewNovel = req.body.isNewNovel === 'true';
    const selectedNovelId = req.body.selectedNovelId;
    const startChapterNumber = parseInt(req.body.startChapterNumber) || 1;
    const fileCount = parseInt(req.body.fileCount) || req.files.length;
    
    console.log('开始上传小说到数据库...');
    console.log('是否新小说:', isNewNovel);
    console.log('小说标题:', novelConfig.title);
    console.log('章节数量:', chapters.length);
    console.log('起始章节号:', startChapterNumber);
    console.log('文件数量:', fileCount);
    
    if (chapters.length === 0) {
      return res.status(400).json({ error: '没有章节数据' });
    }
    
    let novelId;
    
    if (isNewNovel) {
      // 新建小说
      novelId = await createNovel(novelConfig);
      console.log('新建小说 - 小说ID:', novelId);
    } else {
      // 续写小说
      if (!selectedNovelId) {
        return res.status(400).json({ error: '请选择要续写的小说' });
      }
      novelId = selectedNovelId;
      console.log('续写小说 - 小说ID:', novelId);
    }
    
    // 使用默认卷配置
    const volumeId = await createVolume(novelId, novelConfig.volumeTitle || '第一卷', 1);
    console.log('使用默认卷配置 - 卷ID:', volumeId);
    
    // 为所有章节设置正确的volumeId（如果用户没有设置的话）
    chapters.forEach((chapter) => {
      if (!chapter.volumeId) {
        chapter.volumeId = volumeId;
      }
    });
    
    // 上传所有章节到默认卷
    await uploadChapters(novelId, volumeId, chapters, novelConfig, startChapterNumber);
    
    // 更新章节数
    await updateChapterCounts(novelId, volumeId, chapters.length);
    
    // 上传完成后删除所有临时文件
    req.files.forEach((file) => {
      try {
        fs.unlinkSync(file.path);
        console.log('临时文件已删除:', file.path);
      } catch (deleteError) {
        console.warn('删除临时文件失败:', deleteError.message);
      }
    });
    
    console.log('小说上传完成');
    
    res.json({ 
      success: true, 
      novelId: novelId,
      totalChapters: chapters.length,
      isNewNovel: isNewNovel
    });
    
  } catch (error) {
    console.error('上传小说失败:', error);
    
    // 检查是否是 Multer 错误
    if (error.code === 'LIMIT_FIELD_SIZE') {
      res.status(413).json({ 
        error: '数据量过大，请尝试上传较小的文件或减少文件数量',
        details: '字段大小超过了服务器限制'
      });
    } else if (error.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ 
        error: '文件过大，请上传较小的文件',
        details: '文件大小超过了服务器限制'
      });
    } else {
      res.status(500).json({ error: '上传小说失败: ' + error.message });
    }
  }
}



// 主函数（保持原有功能）
async function uploadNovel() {
  try {
    const filePath = path.join(__dirname, '../novel/水浒全传2.docx');
    
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      console.error('文件不存在:', filePath);
      return;
    }
    
    // 小说配置
    const NOVEL_CONFIG = {
      title: '水浒全传',
      author: '施耐庵',
      description: '《水浒传》是中国古典四大名著之一，描写了北宋末年以宋江为首的108位好汉在梁山泊聚义的故事。',
      freeChapters: 3,
      minCost: 10,
      maxCost: 63
    };
    
    // 解析文档
    const text = await parseDocument(filePath);
    
    // 分割章节
    const chapters = splitChapters(text);
    
    if (chapters.length === 0) {
      console.error('未找到任何章节');
      return;
    }
    
    // 创建小说记录
    const novelId = await createNovel(NOVEL_CONFIG);
    
    // 转换章节格式
    const formattedChapters = chapters.map((chapter, index) => ({
      ...chapter,
      isLocked: index >= NOVEL_CONFIG.freeChapters,
      isVipOnly: false,
      isAdvance: false,
      isVisible: true,
      unlockCost: index >= NOVEL_CONFIG.freeChapters ? generateUnlockCost(NOVEL_CONFIG.minCost, NOVEL_CONFIG.maxCost) : 0,
      translatorNote: ''
    }));
    
    // 上传章节，不涉及volume表
    await uploadChapters(novelId, null, formattedChapters, NOVEL_CONFIG);
    
    // 显示统计信息
    console.log('\n=== 上传完成 ===');
    console.log(`小说标题: ${NOVEL_CONFIG.title}`);
    console.log(`总章节数: ${chapters.length}`);
    console.log(`免费章节: ${Math.min(chapters.length, NOVEL_CONFIG.freeChapters)}`);
    console.log(`付费章节: ${Math.max(0, chapters.length - NOVEL_CONFIG.freeChapters)}`);
    
    // 显示前几个章节的标题
    console.log('\n前5个章节:');
    chapters.slice(0, 5).forEach((chapter, index) => {
      console.log(`${index + 1}. ${chapter.title}`);
    });
    
  } catch (error) {
    console.error('上传失败:', error);
  } finally {
    if (db) {
    db.end();
    }
  }
}

// 导出API函数
module.exports = {
  findSimilarNovelsAPI,
  getAllNovelsAPI,
  searchNovelsAPI,
  getNovelInfoAPI,
  getNovelChaptersAPI,
  parseChaptersAPI,
  parseMultipleFilesWithGPTAPI,
  uploadNovelAPI, 
  upload, 
  setDatabase,
  setOpenAIApiKey
};

// 如果直接运行此文件，执行原有的上传逻辑
if (require.main === module) {
uploadNovel(); 
} 