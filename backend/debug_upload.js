const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mammoth = require('mammoth');

const app = express();

// 启用CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// 配置multer用于文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // 将文件保存到novel目录
    const uploadDir = path.join(__dirname, '../novel');
    console.log('上传目录:', uploadDir);
    
    if (!fs.existsSync(uploadDir)) {
      console.log('创建目录:', uploadDir);
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // 保持原文件名，添加时间戳避免冲突
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    const filename = `${name}_${timestamp}${ext}`;
    console.log('文件名:', filename);
    cb(null, filename);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    console.log('文件类型:', file.mimetype);
    console.log('原始文件名:', file.originalname);
    
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      cb(null, true);
    } else {
      console.log('文件类型不支持:', file.mimetype);
      cb(new Error('只支持.docx文件'), false);
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB限制
  }
});

// 测试上传接口
app.post('/api/novel/parse-chapters', upload.single('file'), async (req, res) => {
  try {
    console.log('收到文件上传请求');
    
    if (!req.file) {
      console.log('没有文件');
      return res.status(400).json({ error: '请上传文件' });
    }

    console.log('文件信息:', {
      originalname: req.file.originalname,
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    // 检查文件是否存在
    if (!fs.existsSync(req.file.path)) {
      console.log('文件保存失败');
      return res.status(500).json({ error: '文件保存失败' });
    }

    console.log('文件保存成功:', req.file.path);

    // 解析Word文档
    console.log('开始解析Word文档...');
    const result = await mammoth.extractRawText({ path: req.file.path });
    const text = result.value;
    console.log('文档解析成功，总字符数:', text.length);

    // 分割章节
    console.log('开始分割章节...');
    const chapterRegex = /第[一二三四五六七八九十百千万\d]+[章节回]/g;
    const lines = text.split('\n');
    
    const chapters = [];
    let currentChapter = null;
    let currentContent = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line === '') continue;
      
      // 检查是否是章节标题
      if (chapterRegex.test(line)) {
        // 保存前一章节
        if (currentChapter && currentContent.length > 0) {
          chapters.push({
            title: currentChapter,
            content: currentContent.join('\n').trim()
          });
        }
        
        // 开始新章节
        currentChapter = line;
        currentContent = [];
      } else if (currentChapter) {
        // 添加内容到当前章节
        currentContent.push(line);
      }
    }
    
    // 添加最后一章节
    if (currentChapter && currentContent.length > 0) {
      chapters.push({
        title: currentChapter,
        content: currentContent.join('\n').trim()
      });
    }
    
    console.log(`分割完成，共找到 ${chapters.length} 个章节`);

    if (chapters.length === 0) {
      return res.status(400).json({ error: '未找到任何章节' });
    }

    // 转换为前端需要的格式
    const novelConfig = JSON.parse(req.body.config || '{}');
    const formattedChapters = chapters.map((chapter, index) => {
      const chapterNumber = index + 1;
      const isFree = chapterNumber <= (novelConfig.freeChapters || 3);
      
      return {
        id: index + 1,
        title: chapter.title,
        content: chapter.content,
        wordCount: chapter.content.replace(/\s+/g, '').length,
        isLocked: !isFree,
        isVipOnly: false,
        isAdvance: false,
        isVisible: true,
        unlockCost: isFree ? 0 : Math.floor(Math.random() * 53) + 10,
        translatorNote: ''
      };
    });

    console.log('章节解析完成，共解析', formattedChapters.length, '个章节');
    
    res.json({ 
      success: true, 
      chapters: formattedChapters,
      totalChapters: formattedChapters.length,
      filePath: req.file.path
    });
    
  } catch (error) {
    console.error('解析章节失败:', error);
    res.status(500).json({ error: '解析章节失败: ' + error.message });
  }
});

// 错误处理中间件
app.use((error, req, res, next) => {
  console.error('Multer错误:', error);
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: '文件太大，最大支持50MB' });
    }
  }
  res.status(500).json({ error: error.message });
});

// 启动调试服务器
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`调试服务器运行在 http://localhost:${PORT}`);
  console.log('测试上传接口: POST /api/novel/parse-chapters');
  console.log('请确保前端配置了代理: "proxy": "http://localhost:5000"');
}); 