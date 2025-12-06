const { chromium } = require('playwright');

async function screenshotBaidu() {
  // 启动浏览器
  const browser = await chromium.launch({
    headless: false // 显示浏览器窗口
  });
  
  // 创建新页面
  const page = await browser.newPage();
  
  // 设置视口大小
  await page.setViewportSize({ width: 1920, height: 1080 });
  
  // 访问百度
  console.log('正在打开 https://www.baidu.com...');
  await page.goto('https://www.baidu.com', {
    waitUntil: 'networkidle' // 等待网络空闲
  });
  
  // 等待页面加载完成
  await page.waitForTimeout(2000);
  
  // 截图
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const screenshotPath = `baidu-screenshot-${timestamp}.png`;
  await page.screenshot({ 
    path: screenshotPath,
    fullPage: true // 截取整个页面
  });
  
  console.log(`截图已保存到: ${screenshotPath}`);
  
  // 关闭浏览器
  await browser.close();
}

screenshotBaidu().catch(console.error);

