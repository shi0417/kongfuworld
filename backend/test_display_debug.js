// 测试显示调试
console.log('🔧 测试显示调试...\n');

console.log('📋 从截图分析:');
console.log('✅ API调用成功 (状态码: 200)');
console.log('✅ 后端返回数据正确 (recommendation_rate: 50)');
console.log('✅ 前端成功获取数据 (stats状态正确)');
console.log('❌ 但网页仍显示"0%"');

console.log('\n🎯 问题定位:');
console.log('问题不在数据获取，而在前端显示逻辑');
console.log('可能的原因:');
console.log('1. stats状态没有正确更新');
console.log('2. 渲染时stats为undefined或null');
console.log('3. 有其他地方覆盖了stats值');
console.log('4. 组件重新渲染时stats被重置');

console.log('\n🔧 调试方案:');
console.log('✅ 1. 添加渲染时的调试信息');
console.log('✅ 2. 检查stats状态是否正确');
console.log('✅ 3. 检查recommendation_rate值');

console.log('\n📝 请刷新页面查看新的调试信息:');
console.log('🔍 渲染时的stats状态: {...}');
console.log('🔍 渲染时的recommendation_rate: 50');

console.log('\n✅ 调试信息已添加！请刷新页面查看效果！');
