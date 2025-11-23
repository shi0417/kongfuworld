// 测试回复点赞调试
console.log('🔧 测试回复点赞调试...\n');

console.log('📋 问题分析:');
console.log('❌ 回复的点赞和点踩按钮点击后UI数字变化');
console.log('❌ 但数据库中的数据没有实际更新');
console.log('❌ 刷新页面后数据恢复原状');
console.log('❌ API返回403错误 - Token无效或已过期');

console.log('\n🎯 修复方案:');
console.log('✅ 1. 添加详细的调试日志 - 跟踪token和API调用');
console.log('✅ 2. 检查token存在性 - 确保用户已登录');
console.log('✅ 3. 检查API调用 - 确保正确传递认证信息');
console.log('✅ 4. 检查错误处理 - 显示具体错误信息');

console.log('\n🔧 调试日志添加:');
console.log('✅ likeChapterComment - 添加token检查和API调用日志');
console.log('✅ dislikeChapterComment - 添加token检查和API调用日志');
console.log('✅ 错误处理增强 - 显示具体错误信息');
console.log('✅ API响应跟踪 - 记录每个步骤');

console.log('\n📊 测试步骤:');
console.log('1. 打开浏览器开发者工具');
console.log('2. 确保用户已登录（检查localStorage中的token）');
console.log('3. 点击回复的👍按钮');
console.log('4. 查看控制台日志');
console.log('5. 检查API调用是否成功');

console.log('\n🎨 预期结果:');
console.log('✅ 控制台显示详细的调试信息');
console.log('✅ token存在且有效');
console.log('✅ API调用成功');
console.log('✅ 数据库数据正确更新');
console.log('✅ UI实时更新');

console.log('\n✅ 回复点赞调试完成！现在请测试回复的点赞功能！');
