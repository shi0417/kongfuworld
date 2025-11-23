// 测试调试日志
console.log('🔧 测试调试日志...\n');

console.log('📋 添加的调试信息:');
console.log('✅ 1. 在loadStats函数中添加了调试日志');
console.log('✅ 2. 在reviewService.getNovelReviewStats中添加了调试日志');
console.log('✅ 3. 显示API URL和响应状态');
console.log('✅ 4. 显示API返回的原始数据');
console.log('✅ 5. 显示解析后的数据');

console.log('\n🎯 调试步骤:');
console.log('1. 刷新页面 http://localhost:3000/book/11');
console.log('2. 打开浏览器开发者工具');
console.log('3. 查看Console标签中的调试信息');
console.log('4. 检查API调用是否成功');
console.log('5. 检查数据是否正确获取');

console.log('\n📝 预期的调试输出:');
console.log('🔍 开始加载统计数据，novelId: 11');
console.log('🔍 调用API获取统计数据，novelId: 11');
console.log('📡 API URL: http://localhost:5000/api/novel/11/review-stats');
console.log('📡 API响应状态: 200');
console.log('📊 API返回的原始数据: {success: true, data: {...}}');
console.log('📊 解析后的数据: {total_reviews: 2, recommendation_rate: 50, ...}');
console.log('📊 获取到的统计数据: {total_reviews: 2, recommendation_rate: 50, ...}');

console.log('\n✅ 调试日志已添加！请刷新页面查看效果！');
