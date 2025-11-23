const PayPalService = require('./services/paypalService');

async function checkPayPalStatus() {
  const paypalService = new PayPalService();
  
  // 批次ID列表（你可以添加多个批次ID）
  const batchIds = [
    'T86UVCNZZCY26',  // 最新的批次
    'YCXX9JF8FM6ZU',  // 之前的批次
    'YFPKJCMPVDMSL'   // 更早的批次
  ];
  
  console.log('========== 查询PayPal批次状态 ==========\n');
  
  for (const batchId of batchIds) {
    try {
      console.log(`\n查询批次ID: ${batchId}`);
      console.log('----------------------------------------');
      
      const status = await paypalService.getPayoutStatus(batchId);
      
      const batchHeader = status.batch_header || {};
      const batchStatus = batchHeader.batch_status || 'UNKNOWN';
      const payoutBatchId = batchHeader.payout_batch_id || 'N/A';
      const senderBatchHeader = batchHeader.sender_batch_header || {};
      
      console.log(`批次ID: ${payoutBatchId}`);
      console.log(`状态: ${batchStatus}`);
      console.log(`发送者批次ID: ${senderBatchHeader.sender_batch_id || 'N/A'}`);
      console.log(`创建时间: ${batchHeader.time_created || 'N/A'}`);
      console.log(`完成时间: ${batchHeader.time_completed || 'N/A'}`);
      
      // 显示支付项目详情
      const items = status.items || [];
      console.log(`\n支付项目数量: ${items.length}`);
      
      if (items.length > 0) {
        console.log('\n支付项目详情:');
        items.forEach((item, index) => {
          console.log(`\n  项目 ${index + 1}:`);
          console.log(`    项目ID: ${item.payout_item_id || 'N/A'}`);
          console.log(`    交易ID: ${item.transaction_id || 'N/A'}`);
          console.log(`    交易状态: ${item.transaction_status || 'N/A'}`);
          console.log(`    金额: ${item.payout_item?.amount?.value || 'N/A'} ${item.payout_item?.amount?.currency || 'N/A'}`);
          console.log(`    接收者: ${item.payout_item?.receiver || 'N/A'}`);
          console.log(`    处理时间: ${item.time_processed || 'N/A'}`);
          if (item.payout_item_fee) {
            console.log(`    手续费: ${item.payout_item_fee.value} ${item.payout_item_fee.currency}`);
          }
        });
      }
      
      // 显示链接
      if (status.links && status.links.length > 0) {
        console.log('\n相关链接:');
        status.links.forEach((link, index) => {
          console.log(`  ${index + 1}. ${link.rel}: ${link.href}`);
        });
      }
      
    } catch (error) {
      console.error(`\n查询批次 ${batchId} 失败:`);
      console.error(`  错误: ${error.message}`);
      if (error.response) {
        console.error(`  状态码: ${error.response.status}`);
        console.error(`  响应: ${JSON.stringify(error.response.data, null, 2)}`);
      }
    }
  }
  
  console.log('\n\n========== 查询完成 ==========');
}

checkPayPalStatus().catch(console.error);

