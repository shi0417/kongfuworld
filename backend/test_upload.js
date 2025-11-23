const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

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
app.post('/api/test-upload', upload.single('file'), (req, res) => {
  try {
    console.log('收到上传请求');
    
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
    if (fs.existsSync(req.file.path)) {
      console.log('文件保存成功:', req.file.path);
      res.json({ 
        success: true, 
        message: '文件上传成功',
        file: {
          originalname: req.file.originalname,
          filename: req.file.filename,
          path: req.file.path,
          size: req.file.size
        }
      });
    } else {
      console.log('文件保存失败');
      res.status(500).json({ error: '文件保存失败' });
    }
    
  } catch (error) {
    console.error('上传处理失败:', error);
    res.status(500).json({ error: '上传处理失败: ' + error.message });
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

// 启动测试服务器
const PORT = 5001;
app.listen(PORT, () => {
  console.log(`测试服务器运行在 http://localhost:${PORT}`);
  console.log('测试上传接口: POST /api/test-upload');
}); 