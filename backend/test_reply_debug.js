// 测试回复功能调试
console.log('🔍 回复功能调试指南...\n');

console.log('📋 调试步骤:');
console.log('1. 打开浏览器开发者工具 (F12)');
console.log('2. 切换到Console标签页');
console.log('3. 尝试提交回复');
console.log('4. 查看控制台输出');

console.log('\n🔍 前端调试日志:');
console.log('✅ handleReply called with commentId: [评论ID]');
console.log('✅ replyContent: [回复内容]');
console.log('✅ user: [用户对象]');
console.log('✅ Starting reply submission...');
console.log('✅ 📡 Calling replyToComment API...');

console.log('\n🔍 服务调试日志:');
console.log('✅ replyToComment called with: {commentId, content}');
console.log('✅ token exists: true/false');
console.log('✅ 📡 API URL: http://localhost:5000/api/comment/[ID]/reply');
console.log('✅ 📡 Response status: 200/400/500');
console.log('✅ 📡 Response ok: true/false');

console.log('\n🔍 后端调试日志:');
console.log('✅ 🔍 回复API被调用');
console.log('✅ 🔍 参数: {commentId, content, userId}');
console.log('✅ 数据库操作结果');

console.log('\n🎯 可能的问题:');
console.log('❌ 如果看不到前端日志 - 按钮点击事件未触发');
console.log('❌ 如果看不到服务日志 - API调用失败');
console.log('❌ 如果看不到后端日志 - 请求未到达后端');
console.log('❌ 如果看到错误日志 - 具体错误信息');

console.log('\n✅ 请按照步骤调试，并告诉我看到了什么日志！');
