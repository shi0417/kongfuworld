/**
 * 标题合理性检查器
 * 批量检查章节标题是否合理，并自动修复（截断标题+提取正文）
 */

const { getOpenAIClient } = require('./translationModel');
const { getGlobalRateLimiter } = require('./langchain/rateLimiter');
const { batchByLength } = require('./utils/batchByLength');

/**
 * @typedef {Object} TitleItem
 * @property {number} chapterNumber
 * @property {string} title
 */

/**
 * @typedef {Object} TitleCheckResult
 * @property {number} chapterNumber
 * @property {string} original_title       // 原始标题
 * @property {string} cleaned_title        // 清洗后的标题（如果未修改则等于 original_title）
 * @property {string} move_to_body_prefix  // 需要移动到正文开头的文本（可能为空字符串）
 * @property {boolean} is_reasonable       // 标题整体是否合理
 * @property {boolean} is_modified         // 是否对标题做了修改（cleaned_title != original_title 或 move_to_body_prefix 非空）
 * @property {string} reason               // 简要中文说明
 */

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

/**
 * 批量检查标题合理性并自动修复
 * @param {Array<TitleItem>} titleItems - 标题数组，每个元素包含 chapterNumber 和 title
 * @returns {Promise<Array<TitleCheckResult>>} 检查结果数组
 */
async function checkTitlesReasonableness(titleItems) {
  if (!titleItems || titleItems.length === 0) {
    return [];
  }

  const client = getOpenAIClient();
  const rateLimiter = getGlobalRateLimiter();

  // 一次性处理所有标题，不分批
  // 计算总字符数用于日志
  const totalChars = titleItems.reduce((sum, item) => sum + (item.title || '').length, 0);
  console.log(`[TitleReasonablenessChecker] 一次性处理 ${titleItems.length} 个标题，总字符数 ${totalChars}`);

  try {
    // 构造 payload
    const payload = titleItems.map(item => ({
      chapterNumber: item.chapterNumber,
      title: item.title || '',
    }));

    // 构造 system prompt
    const systemPrompt = [
        '你是一个网文小说章节标题的质检和修复助手。',
        '现在给你一整本小说的一批章节标题，请你逐条判断每一个标题是否"合理"，并在必要时帮忙修复标题。',
        '',
        '这里的"合理"指：',
        '1. 语义完整、像正常的章节标题，不是乱码、不全、不仅仅是标点或数字；',
        '2. 不应包含明显的广告、网址、站点名、作者宣言等（例如"爱小说，爱玉书堂：YSXS3.COM，十万本小说等着你"属于不合理）；',
        '3. 标题长度在一个合理区间内（比如 4~26 字左右），太短或太长且明显异常的可以判为不合理；',
        '4. 标题里不应该塞进整段正文内容。遇到这种情况时，要尽量把"真正的标题"部分留在 cleaned_title，把正文内容移到 move_to_body_prefix。',
        '',
        '特别重要的规则：',
        '—— 如果标题形如 "第一百三十三章 新版蛤蟆功王重阳的一阳指能破蛤蟆功，则是因为他有至阳内功……"，',
        '   你应该判断：真正的标题是 "第一百三十三章 新版蛤蟆功"，',
        '   后面的"王重阳的一阳指能破蛤蟆功，则是因为他有至阳内功……（整段说明）"属于正文内容，',
        '   需要放到 move_to_body_prefix 里，让程序把它插入到正文开头。',
        '',
        '输出要求：',
        '1. 对每一个标题，你必须返回：chapterNumber, original_title, cleaned_title, move_to_body_prefix, is_reasonable, is_modified, reason。',
        '2. cleaned_title 一定要是一个完整的标题；move_to_body_prefix 是应该移入正文的一小段文字（可以为空字符串）。',
        '3. 如果标题本身合理、没有正文混入，那么 cleaned_title = original_title, move_to_body_prefix = ""，is_modified = false。',
        '4. 请保守处理，不要乱删内容；只有在明显存在"标题 + 正文大段描述"混在一起的情况，才做截断和移动。',
        '',
        '最后：只需要返回 JSON 数据，不要有多余解释。'
      ].join('\n');

    // 构造 user prompt
    const userPrompt = [
        '下面是本次要检查的所有章节标题数据，是一个 JSON 数组，每一项包含 chapterNumber 和 title：',
        '',
        JSON.stringify(payload, null, 2),
        '',
        '请你返回一个 JSON 对象，结构如下：',
        '{ "results": [ { "chapterNumber": number, "original_title": string, "cleaned_title": string, "move_to_body_prefix": string, "is_reasonable": boolean, "is_modified": boolean, "reason": string }, ... ] }',
        '',
        '要求：',
        '1. 严格保证返回的是合法 JSON，不能有注释、不能有多余文字；',
        '2. results 数组长度要和输入标题数量完全一致，每个 chapterNumber 都要覆盖一次；',
        '3. reason 用简体中文，简短说明为什么合理或不合理、是否做了截断移动。'
      ].join('\n');

    // 调用 OpenAI API
    let response;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount <= maxRetries) {
      try {
        response = await rateLimiter.schedule(async () => {
          return await client.chat.completions.create({
            model: OPENAI_MODEL,
            messages: [
              {
                role: 'system',
                content: systemPrompt,
              },
              {
                role: 'user',
                content: userPrompt,
              },
            ],
            response_format: { type: 'json_object' },
            temperature: 0,
            max_tokens: 16000, // 增加 max_tokens 以支持一次性处理大量标题
          });
        });
        break; // 成功则跳出循环
      } catch (err) {
        // 如果是 429 错误，等待后重试
        if (err.message && err.message.includes('429') && retryCount < maxRetries) {
          const waitTime = 20000 + (retryCount * 5000); // 20秒 + 递增延迟
          console.log(`[TitleReasonablenessChecker] 遇到 429 错误，等待 ${waitTime / 1000} 秒后重试 (${retryCount + 1}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          retryCount++;
        } else {
          // 其他错误或重试次数用完，抛出错误
          throw err;
        }
      }
    }

    if (!response) {
      throw new Error(`在 ${maxRetries} 次重试后仍然失败`);
    }

    const text = response.choices[0]?.message?.content || '';

    // 解析 JSON
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (parseErr) {
      // 尝试提取 JSON 部分
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error(`AI response does not contain valid JSON: ${text.substring(0, 200)}`);
      }
    }

    // 提取 results 数组
    const resultsRaw = Array.isArray(parsed.results) ? parsed.results : Array.isArray(parsed) ? parsed : [];

    // 映射到标准结构，缺字段时用默认值兜底
    const allResults = resultsRaw.map((item) => {
      const originalItem = titleItems.find(b => b.chapterNumber === item.chapterNumber);
      const originalTitle = originalItem ? (originalItem.title || '') : '';

      return {
        chapterNumber: typeof item.chapterNumber === 'number' ? item.chapterNumber : (originalItem ? originalItem.chapterNumber : 0),
        original_title: item.original_title || originalTitle,
        cleaned_title: (item.cleaned_title || item.original_title || originalTitle).trim(),
        move_to_body_prefix: (item.move_to_body_prefix || '').trim(),
        is_reasonable: typeof item.is_reasonable === 'boolean' ? item.is_reasonable : true,
        is_modified: typeof item.is_modified === 'boolean' ? item.is_modified : false,
        reason: item.reason || '',
      };
    });

    // 对齐输入顺序：确保每个输入项都有对应的结果
    const resultsMap = new Map();
    allResults.forEach(r => resultsMap.set(r.chapterNumber, r));

    // 为缺失的项创建默认结果
    titleItems.forEach(item => {
      if (!resultsMap.has(item.chapterNumber)) {
        const defaultResult = {
          chapterNumber: item.chapterNumber,
          original_title: item.title || '',
          cleaned_title: (item.title || '').trim(),
          move_to_body_prefix: '',
          is_reasonable: true,
          is_modified: false,
          reason: '未处理（AI 返回缺失）',
        };
        resultsMap.set(item.chapterNumber, defaultResult);
      }
    });

    // 按原始顺序排序
    const sortedResults = titleItems.map(item => resultsMap.get(item.chapterNumber));

    console.log(`[TitleReasonablenessChecker] 处理完成，返回 ${sortedResults.length} 个结果`);

    return sortedResults;

  } catch (err) {
    console.error(`[TitleReasonablenessChecker] 处理失败:`, err.message);
    // 为失败的项创建默认结果
    return titleItems.map(item => ({
      chapterNumber: item.chapterNumber,
      original_title: item.title || '',
      cleaned_title: (item.title || '').trim(),
      move_to_body_prefix: '',
      is_reasonable: true,
      is_modified: false,
      reason: `处理失败: ${err.message}`,
    }));
  }
}

module.exports = {
  checkTitlesReasonableness,
};

