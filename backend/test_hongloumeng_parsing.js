const fs = require('fs');
const path = require('path');

// 模拟《红楼梦》的章节解析函数
function splitChapters(text) {
  console.log('开始分割章节...');
  
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
    '第十五回 王凤姐弄权铁槛寺 秦鲸卿得趣馒头庵'
  ];
  
  const lines = text.split('\n');
  const chapters = [];
  let currentChapterIndex = 0;
  let currentContent = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line === '') continue;
    
    // 检查当前行是否匹配目录中的章节标题
    let matchedTitle = null;
    let matchedIndex = -1;
    
    // 遍历所有目录标题，找到匹配的
    for (let j = 0; j < hongloumengDirectory.length; j++) {
      const directoryTitle = hongloumengDirectory[j];
      const titleStart = directoryTitle.split(' ')[0]; // 如 "第一回"
      
      // 检查是否完全匹配或包含章节号
      if (line === directoryTitle || line.startsWith(titleStart)) {
        matchedTitle = directoryTitle;
        matchedIndex = j;
        break;
      }
    }
    
    if (matchedTitle && matchedIndex >= 0) {
      // 保存前一章节
      if (currentContent.length > 0) {
        chapters.push({
          title: hongloumengDirectory[chapters.length],
          content: currentContent.join('\n').trim()
        });
      }
      
      // 更新当前章节索引
      currentChapterIndex = matchedIndex;
      currentContent = [];
    } else {
      // 添加内容到当前章节
      if (chapters.length > 0 || currentContent.length > 0) {
        currentContent.push(line);
      }
    }
  }
  
  // 添加最后一章节
  if (currentContent.length > 0 && chapters.length < hongloumengDirectory.length) {
    chapters.push({
      title: hongloumengDirectory[chapters.length],
      content: currentContent.join('\n').trim()
    });
  }
  
  // 如果没有找到任何章节，将整个文本作为一个章节
  if (chapters.length === 0) {
    chapters.push({
      title: '第一回 甄士隐梦幻识通灵 贾雨村风尘怀闺秀',
      content: text.trim()
    });
  }
  
  console.log(`分割完成，共找到 ${chapters.length} 个章节`);
  console.log(`预期章节数: ${hongloumengDirectory.length} 个`);
  
  return chapters;
}

// 测试文本
const testText = `第一回 甄士隐梦幻识通灵 贾雨村风尘怀闺秀
此开卷第一回也。作者自云：因曾历过一番梦幻之后，故将真事隐去，而借"通灵"之说，撰此《石头记》一书也。故曰"甄士隐"云云。

第二回 贾夫人仙逝扬州城 冷子兴演说荣国府
却说封肃因听见公差传唤，忙出来陪笑启道：小人姓封，并不姓甄。只有当日小婿姓甄，今已出家一二年了，不知可是问他？

第三回 贾雨村夤缘复旧职 林黛玉抛父进京都
却说雨村忙回头看时，不是别人，乃是当日同僚一案参革的号张如圭者。他本系此地人，革后家居，今打听得都中奏准起复旧员之信，他便四下里寻情找门路，忽遇见雨村，故忙道喜。

第四回 薄命女偏逢薄命郎 葫芦僧乱判葫芦案
却说黛玉同姊妹们至王夫人处，见王夫人与兄嫂处的来使计议家务，又说姨母家遭人命官司等语。因见王夫人事情冗杂，姊妹们遂出来，至寡嫂李氏房中来了。

第五回 游幻境指迷十二钗 饮仙醪曲演红楼梦
第四回中既将薛家母子在荣府内寄居等事略已表明，此回则暂不能写矣。如今且说林黛玉自在荣府以来，贾母万般怜爱，寝食起居，一如宝玉，迎春，探春，惜春三个亲孙女倒且靠后。`;

console.log('测试《红楼梦》章节解析...');
const chapters = splitChapters(testText);

console.log('\n解析结果:');
chapters.forEach((chapter, index) => {
  console.log(`${index + 1}. ${chapter.title}`);
  console.log(`   内容长度: ${chapter.content.length} 字符`);
  console.log(`   内容预览: ${chapter.content.substring(0, 50)}...`);
  console.log('');
}); 