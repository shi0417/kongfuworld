/**
 * 章节分割服务
 * 从整本文本中切分出章节列表
 */

/**
 * 中文数字转阿拉伯数字
 * @param {string} chineseNumber - 中文数字字符串
 * @returns {number} 阿拉伯数字，如果无法转换则返回null
 */
function chineseToNumber(chineseNumber) {
  console.log(`[chineseToNumber] 输入: "${chineseNumber}", 类型: ${typeof chineseNumber}, 长度: ${chineseNumber ? chineseNumber.length : 0}`);
  
  if (!chineseNumber) {
    console.log(`[chineseToNumber] ✗ 输入为空，返回null`);
    return null;
  }
  
  const originalInput = chineseNumber;
  
  // 清理字符串：去除空格、全角空格、不可见字符等
  chineseNumber = chineseNumber.trim().replace(/[\s\u3000\u00A0\u2000-\u200B\uFEFF]/g, '');
  
  console.log(`[chineseToNumber] 清理后: "${chineseNumber}", 长度: ${chineseNumber.length}, 字符码: [${Array.from(chineseNumber).map(c => c.charCodeAt(0)).join(', ')}]`);
  
  // 如果是纯数字，直接转换
  if (/^\d+$/.test(chineseNumber)) {
    const result = parseInt(chineseNumber);
    console.log(`[chineseToNumber] ✓ 纯数字，直接转换: ${result}`);
    return result;
  }

  // 扩展的中文数字映射表（支持到3000，作为快速查找）
  const chineseToNumberMap = {
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

  // 先尝试快速查找
  if (chineseToNumberMap[chineseNumber] !== undefined) {
    const result = chineseToNumberMap[chineseNumber];
    console.log(`[chineseToNumber] ✓ 映射表查找成功: "${chineseNumber}" -> ${result}`);
    return result;
  }

  console.log(`[chineseToNumber] 映射表中未找到，尝试通用解析算法`);
  // 如果快速查找失败，使用通用解析算法（支持任意大的数字）
  const result = parseChineseNumber(chineseNumber);
  console.log(`[chineseToNumber] 通用解析结果: ${result}`);
  return result;
}

/**
 * 通用中文数字解析算法（支持任意大的数字）
 * 正确处理"零"的占位作用，支持：一千七百三十三、一百零一等格式
 * @param {string} chineseNumber - 中文数字字符串
 * @returns {number|null} 阿拉伯数字，如果无法转换则返回null
 */
function parseChineseNumber(chineseNumber) {
  console.log(`[parseChineseNumber] 开始解析: "${chineseNumber}", 长度: ${chineseNumber.length}`);
  
  if (!chineseNumber || chineseNumber.length === 0) {
    console.log(`[parseChineseNumber] ✗ 输入为空，返回null`);
    return null;
  }

  // 基础数字映射
  const digitMap = {
    '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
    '六': 6, '七': 7, '八': 8, '九': 9,
    '两': 2, '壹': 1, '贰': 2, '叁': 3, '肆': 4, '伍': 5,
    '陆': 6, '柒': 7, '捌': 8, '玖': 9,
    '〇': 0
  };

  // 单位映射（按从大到小排序）
  const unitMap = {
    '亿': 100000000,
    '万': 10000,
    '千': 1000, '仟': 1000,
    '百': 100, '佰': 100,
    '十': 10, '拾': 10
  };
  
  console.log(`[parseChineseNumber] 字符分解: [${Array.from(chineseNumber).map((c, i) => `位置${i}: '${c}' (码:${c.charCodeAt(0)})`).join(', ')}]`);

  // 解析函数：解析一个数字段（如"一千七百三十三"或"一百零一"）
  // 使用标准的中文数字解析规则
  function parseSegment(segment) {
    console.log(`[parseSegment] 开始解析段: "${segment}"`);
    
    if (!segment || segment.length === 0) {
      console.log(`[parseSegment] 段为空，返回0`);
      return 0;
    }

    let result = 0;
    let temp = 0; // 临时值，用于累加当前段的数字
    let i = 0;

    while (i < segment.length) {
      const char = segment[i];
      console.log(`[parseSegment] 位置${i}: 字符='${char}', 码=${char.charCodeAt(0)}, 当前result=${result}, temp=${temp}`);
      
      // 如果是"零"或"〇"，跳过（它们只是占位符）
      if (char === '零' || char === '〇') {
        console.log(`[parseSegment]   跳过"零"`);
        i++;
        continue;
      }
      
      // 如果是数字
      if (digitMap[char] !== undefined && char !== '零' && char !== '〇') {
        const digit = digitMap[char];
        const oldTemp = temp;
        temp = temp * 10 + digit;
        console.log(`[parseSegment]   数字: '${char}' -> ${digit}, temp: ${oldTemp} -> ${temp}`);
      }
      // 如果是单位
      else if (unitMap[char] !== undefined) {
        const unitValue = unitMap[char];
        console.log(`[parseSegment]   单位: '${char}' -> ${unitValue}`);
        
        // 如果temp为0，说明单位前没有数字，默认为1（如"十"表示10）
        if (temp === 0) {
          console.log(`[parseSegment]     单位前无数字，设置temp=1`);
          temp = 1;
        }
        
        const oldResult = result;
        // 根据单位的大小决定如何处理
        if (unitValue >= 10000) {
          // 万、亿等大单位：将当前结果和temp一起乘以单位
          result = (result + temp) * unitValue;
          console.log(`[parseSegment]     大单位处理: (${oldResult} + ${temp}) * ${unitValue} = ${result}`);
          temp = 0;
        } else {
          // 千、百、十等小单位：temp乘以单位后累加到result
          result = result + temp * unitValue;
          console.log(`[parseSegment]     小单位处理: ${oldResult} + ${temp} * ${unitValue} = ${result}`);
          temp = 0;
        }
      } else {
        console.log(`[parseSegment]   ⚠️ 未知字符: '${char}' (码:${char.charCodeAt(0)})`);
      }
      
      i++;
    }

    // 添加剩余的数字（个位数）
    const finalResult = result + temp;
    console.log(`[parseSegment] 最终结果: ${result} + ${temp} = ${finalResult}`);
    return finalResult;
  }

  // 先处理"亿"和"万"这两个大单位
  let result = 0;
  let remaining = chineseNumber;
  
  // 按"亿"分割
  if (remaining.includes('亿')) {
    console.log(`[parseChineseNumber] 发现"亿"，开始分割`);
    const parts = remaining.split('亿');
    if (parts.length === 2) {
      const beforeYi = parseSegment(parts[0]);
      result = beforeYi * 100000000;
      remaining = parts[1];
      console.log(`[parseChineseNumber] "亿"前部分: "${parts[0]}" -> ${beforeYi}, result = ${result}, 剩余: "${remaining}"`);
    } else {
      // 多个"亿"，只处理第一个
      const idx = remaining.indexOf('亿');
      const beforeYi = parseSegment(remaining.substring(0, idx));
      result = beforeYi * 100000000;
      remaining = remaining.substring(idx + 1);
      console.log(`[parseChineseNumber] "亿"前部分: "${remaining.substring(0, idx)}" -> ${beforeYi}, result = ${result}, 剩余: "${remaining}"`);
    }
  }
  
  // 按"万"分割
  if (remaining.includes('万')) {
    console.log(`[parseChineseNumber] 发现"万"，开始分割`);
    const parts = remaining.split('万');
    if (parts.length === 2) {
      const beforeWan = parseSegment(parts[0]);
      result = result + beforeWan * 10000;
      remaining = parts[1];
      console.log(`[parseChineseNumber] "万"前部分: "${parts[0]}" -> ${beforeWan}, result = ${result}, 剩余: "${remaining}"`);
    } else {
      // 多个"万"，只处理第一个
      const idx = remaining.indexOf('万');
      const beforeWan = parseSegment(remaining.substring(0, idx));
      result = result + beforeWan * 10000;
      remaining = remaining.substring(idx + 1);
      console.log(`[parseChineseNumber] "万"前部分: "${remaining.substring(0, idx)}" -> ${beforeWan}, result = ${result}, 剩余: "${remaining}"`);
    }
  }
  
  // 处理剩余部分（万以下）
  const belowWan = parseSegment(remaining);
  result = result + belowWan;
  console.log(`[parseChineseNumber] 万以下部分: "${remaining}" -> ${belowWan}, 最终result = ${result}`);

  // 如果结果为0，可能是解析失败
  if (result === 0 && chineseNumber !== '零' && chineseNumber !== '〇') {
    console.log(`[parseChineseNumber] ⚠️ 结果为0但输入不是"零"，可能解析失败`);
    return null;
  }

  console.log(`[parseChineseNumber] ✓ 解析成功: "${chineseNumber}" -> ${result}`);
  return result;
}

/**
 * 将阿拉伯数字转换为中文数字（简化版，支持1-9999）
 * @param {number} num - 阿拉伯数字
 * @returns {string} 中文数字
 */
function numberToChinese(num) {
  if (num < 1 || num > 9999) {
    return String(num);
  }
  
  const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  const units = ['', '十', '百', '千'];
  
  if (num < 10) {
    return digits[num];
  }
  
  if (num < 20) {
    if (num === 10) return '十';
    return '十' + digits[num % 10];
  }
  
  if (num < 100) {
    const tens = Math.floor(num / 10);
    const ones = num % 10;
    if (ones === 0) {
      return digits[tens] + '十';
    }
    return digits[tens] + '十' + digits[ones];
  }
  
  if (num < 1000) {
    const hundreds = Math.floor(num / 100);
    const remainder = num % 100;
    let result = digits[hundreds] + '百';
    
    if (remainder === 0) {
      return result;
    }
    
    if (remainder < 10) {
      result += '零' + digits[remainder];
    } else if (remainder < 20) {
      if (remainder === 10) {
        result += '一十';
      } else {
        result += '一十' + digits[remainder % 10];
      }
    } else {
      const tens = Math.floor(remainder / 10);
      const ones = remainder % 10;
      result += digits[tens] + '十';
      if (ones > 0) {
        result += digits[ones];
      }
    }
    
    return result;
  }
  
  if (num < 10000) {
    const thousands = Math.floor(num / 1000);
    const remainder = num % 1000;
    let result = digits[thousands] + '千';
    
    if (remainder === 0) {
      return result;
    }
    
    if (remainder < 100) {
      result += '零';
      if (remainder < 10) {
        result += digits[remainder];
      } else if (remainder < 20) {
        if (remainder === 10) {
          result += '一十';
        } else {
          result += '一十' + digits[remainder % 10];
        }
      } else {
        const tens = Math.floor(remainder / 10);
        const ones = remainder % 10;
        result += digits[tens] + '十';
        if (ones > 0) {
          result += digits[ones];
        }
      }
    } else {
      const hundreds = Math.floor(remainder / 100);
      const remainder2 = remainder % 100;
      result += digits[hundreds] + '百';
      
      if (remainder2 === 0) {
        // 不做处理
      } else if (remainder2 < 10) {
        result += '零' + digits[remainder2];
      } else if (remainder2 < 20) {
        if (remainder2 === 10) {
          result += '一十';
        } else {
          result += '一十' + digits[remainder2 % 10];
        }
      } else {
        const tens = Math.floor(remainder2 / 10);
        const ones = remainder2 % 10;
        result += digits[tens] + '十';
        if (ones > 0) {
          result += digits[ones];
        }
      }
    }
    
    return result;
  }
  
  return String(num);
}

/**
 * 从章节标题中提取章节号
 * @param {string} title - 章节标题
 * @returns {number|null} 章节号，如果无法提取则返回null
 */
function extractChapterNumber(title) {
  if (!title) return null;

  console.log(`[extractChapterNumber] 开始提取章节号，标题: "${title}"`);

  // 匹配各种章节格式
  // 注意：字符类中必须包含"零"字，否则无法匹配"第一百零一章"这样的格式
  // 兼容错误格式：
  // 1. "弟"（错误的"第"字，Unicode码：24351）
  // 2. 没有"章"字的情况（如"第三百零五"）
  // 3. 标准格式（"第X章"、"第X回"）
  const patterns = [
    /[第弟]([一二三四五六七八九十百千万零0-9]+)章/,  // 匹配"第X章"或"弟X章"
    /[第弟]([一二三四五六七八九十百千万零0-9]+)回/,  // 匹配"第X回"或"弟X回"
    /[第弟]([一二三四五六七八九十百千万零0-9]+)(?:\s|$|[^\u4e00-\u9fa5])/,  // 匹配"第X"或"弟X"（没有章/回字，后面是空格、结尾或非中文字符）
    /Chapter\s+(\d+)/i,
    /第\s*(\d+)\s*章/,
  ];

  for (let patternIndex = 0; patternIndex < patterns.length; patternIndex++) {
    const pattern = patterns[patternIndex];
    console.log(`[extractChapterNumber] 尝试模式${patternIndex}: ${pattern}`);
    const match = title.match(pattern);
    if (match) {
      const numberStr = match[1];
      console.log(`[extractChapterNumber] 模式${patternIndex}匹配成功，提取的字符串: "${numberStr}", 长度: ${numberStr.length}, 字符码: [${Array.from(numberStr).map(c => c.charCodeAt(0)).join(', ')}]`);
      
      const number = chineseToNumber(numberStr);
      
      console.log(`[extractChapterNumber] chineseToNumber("${numberStr}") = ${number}`);
      
      // 调试：如果无法转换，记录详细信息
      if (number === null && numberStr) {
        console.log(`[extractChapterNumber] ⚠️ 警告：无法转换中文数字 "${numberStr}" (来自标题: "${title.substring(0, 50)}")`);
      }
      if (number !== null) {
        console.log(`[extractChapterNumber] ✓ 成功提取章节号: ${number}`);
        return number;
      }
    } else {
      console.log(`[extractChapterNumber] 模式${patternIndex}未匹配，标题: "${title}"`);
      // 详细调试：检查为什么未匹配
      if (patternIndex === 0) {
        const testPattern = /[第弟]([一二三四五六七八九十百千万零0-9]+)章/;
        const testMatch = title.match(testPattern);
        if (!testMatch) {
          // 检查是否包含"第"、"弟"和"章"
          const hasDi = title.includes('第');
          const hasDi2 = title.includes('弟');  // 错误的"第"字
          const hasZhang = title.includes('章');
          console.log(`[extractChapterNumber] 调试：标题包含"第": ${hasDi}, 包含"弟": ${hasDi2}, 包含"章": ${hasZhang}`);
          
          // 检查"第"或"弟"的情况
          const diChar = hasDi ? '第' : (hasDi2 ? '弟' : null);
          if (diChar) {
            if (hasZhang) {
              // 尝试找到"第"/"弟"和"章"之间的内容
              const diIndex = title.indexOf(diChar);
              const zhangIndex = title.indexOf('章');
              if (diIndex >= 0 && zhangIndex > diIndex) {
                const between = title.substring(diIndex + 1, zhangIndex);
                console.log(`[extractChapterNumber] 调试："${diChar}"和"章"之间的内容: "${between}", 长度: ${between.length}, 字符码: [${Array.from(between).map(c => c.charCodeAt(0)).join(', ')}]`);
                // 检查每个字符是否在字符类中
                const validChars = '一二三四五六七八九十百千万零0-9';
                const invalidChars = Array.from(between).filter(c => !validChars.includes(c));
                if (invalidChars.length > 0) {
                  console.log(`[extractChapterNumber] 调试：发现无效字符: [${invalidChars.map(c => `'${c}' (码:${c.charCodeAt(0)})`).join(', ')}]`);
                }
              }
            } else {
              // 没有"章"字，检查是否有数字部分
              const diIndex = title.indexOf(diChar);
              if (diIndex >= 0) {
                // 尝试提取"第"/"弟"后面的内容（直到遇到非数字字符或空格）
                const afterDi = title.substring(diIndex + 1);
                const numberMatch = afterDi.match(/^([一二三四五六七八九十百千万零0-9]+)/);
                if (numberMatch) {
                  const numberStr = numberMatch[1];
                  console.log(`[extractChapterNumber] 调试：没有"章"字，但找到数字部分: "${numberStr}"`);
                  // 尝试转换
                  const number = chineseToNumber(numberStr);
                  if (number !== null) {
                    console.log(`[extractChapterNumber] 调试：成功转换数字: ${number}`);
                    return number;
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  console.log(`[extractChapterNumber] ✗ 所有模式都未匹配或无法转换`);
  return null;
}

/**
 * 从整本文本中分割章节
 * @param {string} sourceText - 源文本
 * @returns {Array<{chapterNumber: number, title: string, content: string}>} 章节列表
 */
function segmentChapters(sourceText) {
  if (!sourceText || !sourceText.trim()) {
    return [];
  }

  // 章节分割正则表达式
  // 匹配：第X章、Chapter X、第X回 等格式
  // 注意：顺序很重要，更具体的模式应该放在前面
  // 重要：字符类中必须包含"零"字，否则无法匹配"第一百零一章"这样的格式
  const chapterPatterns = [
    /[第弟][一二三四五六七八九十百千万零0-9]+章[^\n]*/g,  // 匹配"第一百章"、"弟一百章"、"第100章"、"第一百零一章"等
    /[第弟][一二三四五六七八九十百千万零0-9]+回[^\n]*/g,  // 匹配"第一百回"、"弟一百回"
    /[第弟]\s*\d+\s*章[^\n]*/g,  // 匹配"第 100 章"（带空格）
    /Chapter\s+\d+[^\n]*/gi,  // 匹配"Chapter 100"
    /[第弟][一二三四五六七八九十百千万零0-9]+(?:\s|$)/g,  // 匹配"第X"或"弟X"（没有章/回字，后面是空格或结尾）
  ];

  // 找到所有章节标题的位置
  const chapterMarkers = [];
  const seenIndices = new Set(); // 用于去重，避免同一位置被匹配多次
  
  for (const pattern of chapterPatterns) {
    let match;
    // 重置正则表达式的lastIndex，避免全局匹配的问题
    pattern.lastIndex = 0;
    while ((match = pattern.exec(sourceText)) !== null) {
      const index = match.index;
      // 如果这个位置已经被匹配过，跳过（避免重复匹配）
      if (seenIndices.has(index)) {
        continue;
      }
      
      const title = match[0].trim();
      const chapterNumber = extractChapterNumber(title);
      
      // 调试：如果无法提取章节号，记录详细信息
      if (chapterNumber === null && /第[一二三四五六七八九十百千万零0-9]+章/.test(title)) {
        console.log(`[segmentChapters] 警告：匹配到章节标题但无法提取章节号: 位置=${index}, 标题="${title.substring(0, 80)}"`);
        console.log(`[segmentChapters] 调试：标题字符码: [${Array.from(title).map(c => c.charCodeAt(0)).join(', ')}]`);
      }
      
      // 添加所有匹配到的章节标记（即使无法提取章节号，也可能是有效的章节标题）
      // 这样可以确保不会遗漏任何章节
      chapterMarkers.push({
        index: index,
        title: title,
        chapterNumber: chapterNumber, // 提取的章节号，可能为null
      });
      seenIndices.add(index);
    }
  }

  // 如果没有找到章节标记，将整个文本作为一章
  if (chapterMarkers.length === 0) {
    const lines = sourceText.trim().split('\n');
    const firstLine = lines[0] || 'Chapter 1';
    const content = lines.slice(1).join('\n').trim() || sourceText.trim();
    
    return [{
      chapterNumber: 1,
      title: firstLine.substring(0, 255), // 限制标题长度
      content: content,
    }];
  }

  // 按位置排序（用于去重）
  chapterMarkers.sort((a, b) => a.index - b.index);
  
  // 去重：如果相邻的标记位置非常接近（可能是同一个章节标题被多个正则匹配），只保留第一个
  const deduplicatedMarkers = [];
  for (let i = 0; i < chapterMarkers.length; i++) {
    const current = chapterMarkers[i];
    const next = chapterMarkers[i + 1];
    
    // 如果下一个标记与当前标记位置非常接近（小于10个字符），可能是重复匹配
    // 保留章节号更明确的那个，或者保留第一个
    if (next && next.index - current.index < 10) {
      // 如果当前标记有章节号，优先保留当前标记
      if (current.chapterNumber !== null) {
        deduplicatedMarkers.push(current);
        i++; // 跳过下一个标记
        continue;
      }
      // 如果下一个标记有章节号，保留下一个标记
      if (next.chapterNumber !== null) {
        i++; // 跳过当前标记
        deduplicatedMarkers.push(next);
        continue;
      }
    }
    
    deduplicatedMarkers.push(current);
  }
  
  // 使用去重后的标记列表
  let allMarkers = deduplicatedMarkers.length > 0 ? deduplicatedMarkers : chapterMarkers;
  
  // 先计算有效的章节标记（有章节号的）
  let validMarkers = allMarkers.filter(m => m.chapterNumber !== null);
  
  // 检查章节连续性：如果发现跳章节，尝试重新扫描找到缺失的章节
  if (validMarkers.length > 0) {
    validMarkers.sort((a, b) => a.chapterNumber - b.chapterNumber);
    
    // 检查是否有跳章节
    const missingChapters = [];
    for (let i = 0; i < validMarkers.length - 1; i++) {
      const current = validMarkers[i].chapterNumber;
      const next = validMarkers[i + 1].chapterNumber;
      if (next - current > 1) {
        // 发现跳章节，记录缺失的章节号
        for (let missing = current + 1; missing < next; missing++) {
          missingChapters.push(missing);
        }
      }
    }
    
    // 如果有缺失的章节，尝试在文件中查找
    if (missingChapters.length > 0) {
      console.log(`[segmentChapters] 发现跳章节，缺失章节号: ${missingChapters.join(', ')}，尝试重新扫描...`);
      
      // 对于每个缺失的章节号，尝试在文件中查找对应的中文数字格式
      for (const missingChapterNumber of missingChapters) {
        // 将章节号转换为中文数字
        const chineseNumber = numberToChinese(missingChapterNumber);
        console.log(`[segmentChapters] 查找章节 ${missingChapterNumber}，转换后的中文数字: "${chineseNumber}"`);
        
        // 尝试多种格式匹配（包括可能的变体）
        // 注意：需要转义特殊字符，并且支持可能的前缀（如"☆、"等）
        const escapedChineseNumber = chineseNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const searchPatterns = [
          // 标准格式：第X章
          new RegExp(`第${escapedChineseNumber}章[^\\n]*`, 'g'),
          new RegExp(`第${missingChapterNumber}章[^\\n]*`, 'g'),
          // 带前缀的格式：☆、第X章 或 其他符号+第X章
          new RegExp(`[☆★●○◆◇■□▲△]\\s*[、，,]?\\s*第${escapedChineseNumber}章[^\\n]*`, 'g'),
          new RegExp(`[☆★●○◆◇■□▲△]\\s*[、，,]?\\s*第${missingChapterNumber}章[^\\n]*`, 'g'),
          // 更宽泛的匹配：允许前面有任意字符（但不超过50个字符）
          new RegExp(`.{0,50}第${escapedChineseNumber}章[^\\n]*`, 'g'),
          new RegExp(`.{0,50}第${missingChapterNumber}章[^\\n]*`, 'g'),
        ];
        
        let found = false;
        for (let patternIndex = 0; patternIndex < searchPatterns.length; patternIndex++) {
          const pattern = searchPatterns[patternIndex];
          pattern.lastIndex = 0;
          let match;
          let matchCount = 0;
          while ((match = pattern.exec(sourceText)) !== null) {
            matchCount++;
            const index = match.index;
            const matchedText = match[0];
            
            // 检查这个位置是否已经被匹配过（允许相近位置，因为可能有前缀）
            let isDuplicate = false;
            for (const seenIndex of seenIndices) {
              if (Math.abs(index - seenIndex) < 10) {
                isDuplicate = true;
                break;
              }
            }
            
            if (!isDuplicate) {
              const title = matchedText.trim();
              const extractedNumber = extractChapterNumber(title);
              
              console.log(`[segmentChapters] 模式${patternIndex}匹配到: 位置=${index}, 文本="${title.substring(0, 80)}", 提取的章节号=${extractedNumber}`);
              
              // 如果提取的章节号匹配，添加到标记列表
              if (extractedNumber === missingChapterNumber) {
                console.log(`[segmentChapters] ✓ 找到缺失章节 ${missingChapterNumber}: 位置=${index}, 标题="${title.substring(0, 50)}"`);
                allMarkers.push({
                  index: index,
                  title: title,
                  chapterNumber: extractedNumber,
                });
                seenIndices.add(index);
                found = true;
                break; // 找到后跳出循环
              }
            }
          }
          
          if (found) break;
          
          if (matchCount > 0 && patternIndex === 0) {
            console.log(`[segmentChapters] 模式${patternIndex}匹配到${matchCount}个结果，但提取章节号不匹配`);
          }
        }
        
        if (!found) {
          console.log(`[segmentChapters] ✗ 警告：未找到章节 ${missingChapterNumber}，可能该章节在文件中不存在或格式特殊`);
          // 尝试直接搜索包含该数字的文本
          const directSearch = sourceText.indexOf(`第${chineseNumber}章`);
          if (directSearch >= 0) {
            const context = sourceText.substring(Math.max(0, directSearch - 20), Math.min(sourceText.length, directSearch + 100));
            console.log(`[segmentChapters] 但在位置${directSearch}附近找到文本: "${context}"`);
          }
        }
      }
      
      // 重新按位置排序
      allMarkers.sort((a, b) => a.index - b.index);
      
      // 重新计算 validMarkers（因为可能添加了新的标记）
      validMarkers = allMarkers.filter(m => m.chapterNumber !== null);
      validMarkers.sort((a, b) => a.chapterNumber - b.chapterNumber);
    }
  }

  // 调试：输出找到的章节标记
  console.log(`[segmentChapters] 找到 ${allMarkers.length} 个章节标记`);
  if (allMarkers.length > 0 && allMarkers.length <= 50) {
    allMarkers.forEach((marker, idx) => {
      console.log(`[segmentChapters] 标记 ${idx}: 位置=${marker.index}, 章节号=${marker.chapterNumber}, 标题="${marker.title.substring(0, 50)}"`);
    });
  }

  // 关键修改：按章节号排序，而不是按位置排序
  // 只处理能够提取章节号的标记
  // validMarkers 已经在上面计算过了，这里直接使用
  
  if (validMarkers.length === 0) {
    // 如果没有有效的章节号，回退到按位置切分
    console.log(`[segmentChapters] 警告：没有找到有效的章节号，使用位置顺序切分`);
    const chapters = [];
    for (let i = 0; i < allMarkers.length; i++) {
      const startIndex = allMarkers[i].index;
      const endIndex = i < allMarkers.length - 1 
        ? allMarkers[i + 1].index 
        : sourceText.length;
      const chapterText = sourceText.substring(startIndex, endIndex).trim();
      const lines = chapterText.split('\n');
      const title = lines[0]?.trim() || allMarkers[i].title || '';
      const content = lines.slice(1).join('\n').trim() || chapterText;
      
      chapters.push({
        chapterNumber: i + 1,
        title: title.substring(0, 255),
        content: content,
      });
    }
    return chapters;
  }

  // 按章节号排序
  validMarkers.sort((a, b) => a.chapterNumber - b.chapterNumber);

  // 创建一个映射：章节号 -> 在文件中的位置
  const chapterNumberToIndex = new Map();
  const chapterNumberToTitle = new Map();
  validMarkers.forEach(marker => {
    chapterNumberToIndex.set(marker.chapterNumber, marker.index);
    chapterNumberToTitle.set(marker.chapterNumber, marker.title);
  });

  // 分割章节：按照章节号顺序，找到对应的位置，然后切分
  // 重要：需要同时考虑所有标记（包括章节号为null的），按位置排序来找到正确的结束位置
  // 将所有标记按位置排序（包括章节号为null的）
  allMarkers.sort((a, b) => a.index - b.index);
  
  // 计算平均字数（用于检测异常）
  let avgWordCount = 0;
  if (validMarkers.length > 0) {
    // 先粗略计算每个章节的字数（基于位置差）
    const wordCounts = [];
    for (let i = 0; i < validMarkers.length - 1; i++) {
      const startIdx = validMarkers[i].index;
      const endIdx = validMarkers[i + 1].index;
      const text = sourceText.substring(startIdx, endIdx);
      const wordCount = text.replace(/\s/g, '').length;
      wordCounts.push(wordCount);
    }
    if (wordCounts.length > 0) {
      avgWordCount = Math.floor(wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length);
      console.log(`[segmentChapters] 计算平均字数: ${avgWordCount} (基于 ${wordCounts.length} 个章节)`);
    }
  }
  
  const chapters = [];
  for (let i = 0; i < validMarkers.length; i++) {
    const currentChapterNumber = validMarkers[i].chapterNumber;
    const startIndex = validMarkers[i].index;
    
    // 找到下一个章节的位置
    // 策略1：优先找章节号相邻的下一个章节（如1000找1001）
    let endIndex = sourceText.length;
    let nextChapterNumber = null;
    let foundByStrategy = 'none';
    
    // 策略1：从validMarkers中找下一个章节号更大的章节
    for (let j = i + 1; j < validMarkers.length; j++) {
      if (validMarkers[j].chapterNumber > currentChapterNumber && 
          validMarkers[j].index > startIndex) {
        endIndex = validMarkers[j].index;
        nextChapterNumber = validMarkers[j].chapterNumber;
        foundByStrategy = 'next_valid_chapter';
        break;
      }
    }
    
    // 策略2：如果策略1失败，从所有标记（包括章节号为null的）中找位置在后面的第一个标记
    // 这样可以避免因为下一个章节的章节号提取失败而导致切分错误
    if (endIndex === sourceText.length) {
      for (let j = 0; j < allMarkers.length; j++) {
        if (allMarkers[j].index > startIndex) {
          // 找到第一个位置在后面的标记（不管是否有章节号）
          endIndex = allMarkers[j].index;
          nextChapterNumber = allMarkers[j].chapterNumber;
          foundByStrategy = 'next_marker_by_position';
          console.log(`[segmentChapters] 章节 ${currentChapterNumber}: 使用策略2，找到位置在后面的标记: 位置=${endIndex}, 章节号=${nextChapterNumber || 'null'}, 标题="${allMarkers[j].title.substring(0, 50)}"`);
          break;
        }
      }
    }
    
    // 调试：输出章节切分信息（特别关注1000、800、900、1247等章节）
    const shouldLog = currentChapterNumber === 1000 || currentChapterNumber === 800 || 
                      currentChapterNumber === 900 || currentChapterNumber === 1247 ||
                      currentChapterNumber === 100 || currentChapterNumber === 101;
    
    if (shouldLog) {
      console.log(`[segmentChapters] ========== 章节 ${currentChapterNumber} 切分详情 ==========`);
      console.log(`[segmentChapters] 起始位置: ${startIndex}`);
      console.log(`[segmentChapters] 结束位置: ${endIndex}`);
      console.log(`[segmentChapters] 下一个章节号: ${nextChapterNumber || '无'}`);
      console.log(`[segmentChapters] 查找策略: ${foundByStrategy}`);
      console.log(`[segmentChapters] 当前位置的文本片段: "${sourceText.substring(startIndex, Math.min(startIndex + 100, sourceText.length))}"`);
      if (endIndex < sourceText.length) {
        console.log(`[segmentChapters] 结束位置的文本片段: "${sourceText.substring(Math.max(0, endIndex - 50), endIndex + 50)}"`);
      }
    }

    const chapterText = sourceText.substring(startIndex, endIndex).trim();
    const wordCount = chapterText.replace(/\s/g, '').length;
    
    // 检测字数异常：如果字数超过平均字数的2倍，认为可能有问题
    let wordCountWarning = null;
    if (avgWordCount > 0 && wordCount > avgWordCount * 2) {
      wordCountWarning = `字数异常：${wordCount} 字，超过平均字数 ${avgWordCount} 的2倍，可能包含了下一章的内容`;
      console.log(`[segmentChapters] ⚠️ 章节 ${currentChapterNumber} ${wordCountWarning}`);
    }
    
    if (shouldLog) {
      console.log(`[segmentChapters] 章节文本长度: ${chapterText.length} 字符`);
      console.log(`[segmentChapters] 章节字数: ${wordCount} 字`);
      if (wordCountWarning) {
        console.log(`[segmentChapters] ⚠️ ${wordCountWarning}`);
      }
    }
    
    // 提取标题（第一行）
    const lines = chapterText.split('\n');
    let title = validMarkers[i].title;
    let content = chapterText;

    // 如果标题在文本中，尝试提取更完整的标题
    if (lines.length > 0) {
      const firstLine = lines[0].trim();
      if (firstLine.length > 0 && firstLine.length <= 255) {
        title = firstLine;
        content = lines.slice(1).join('\n').trim();
      }
    }

    // 如果内容为空，使用整个章节文本
    if (!content || content.length === 0) {
      content = chapterText;
    }
    
    if (shouldLog) {
      console.log(`[segmentChapters] 最终标题: "${title.substring(0, 80)}"`);
      console.log(`[segmentChapters] 最终内容长度: ${content.length} 字符`);
      console.log(`[segmentChapters] ==========================================`);
    }

    chapters.push({
      chapterNumber: currentChapterNumber,
      title: title.substring(0, 255), // 限制标题长度
      content: content,
      _wordCount: wordCount, // 临时字段，用于调试
      _wordCountWarning: wordCountWarning, // 临时字段，用于调试
    });
  }

  // 章节已经按章节号排序，不需要再次排序

  return chapters;
}

module.exports = {
  segmentChapters,
  extractChapterNumber,
  chineseToNumber,
  numberToChinese,
};

