const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

// 尝试加载环境变量
try {
  require('dotenv').config();
} catch (error) {
  console.log('dotenv not available, using default values');
}

const app = express();
app.use(cors());
app.use(bodyParser.json());

// 导入支付路由
const paymentRoutes = require('./routes/payment');

// 支付路由
app.use('/api/payment', paymentRoutes);

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Payment server is running',
    timestamp: new Date().toISOString()
  });
});

// 根路径
app.get('/', (req, res) => {
  res.json({ 
    message: 'WuxiaWorld Payment API Server',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      paypal: '/api/payment/paypal',
      stripe: '/api/payment/stripe'
    }
  });
});

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`🚀 Payment server is running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`💳 PayPal endpoints: http://localhost:${PORT}/api/payment/paypal`);
  console.log(`💳 Stripe endpoints: http://localhost:${PORT}/api/payment/stripe`);
});

module.exports = app;
