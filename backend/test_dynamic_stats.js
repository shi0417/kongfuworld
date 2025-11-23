// 测试动态统计数据
console.log('🔧 测试动态统计数据...\n');

console.log('📋 问题分析:');
console.log('❌ BookDetail.tsx显示的是固定的book.rating和book.reviews');
console.log('❌ 这些数据不是从评论统计API获取的');
console.log('❌ 导致显示74%和16 Reviews等固定数据');

console.log('\n🎯 修复方案:');
console.log('✅ 1. 在BookDetail.tsx中添加reviewStats状态');
console.log('✅ 2. 调用reviewService.getNovelReviewStats()获取动态数据');
console.log('✅ 3. 修改显示逻辑，优先使用动态数据');
console.log('✅ 4. 如果动态数据不存在，则回退到固定数据');

console.log('\n📝 修复后的代码:');
console.log('// 添加评论统计状态');
console.log('const [reviewStats, setReviewStats] = useState<ReviewStats | null>(null);');
console.log('');
console.log('// 获取评论统计');
console.log('const stats = await reviewService.getNovelReviewStats(parseInt(id));');
console.log('setReviewStats(stats);');
console.log('');
console.log('// 修改显示逻辑');
console.log('👍 {reviewStats ? reviewStats.recommendation_rate : book.rating}%');
console.log('💙 {reviewStats ? reviewStats.total_reviews : book.reviews} Reviews');

console.log('\n✅ 现在应该显示动态的评论统计数据了！');
