const alipaySdk = require('../config/alipay');

class AlipayService {
  /**
   * 单笔转账到支付宝账户（使用 alipay.fund.trans.uni.transfer 接口）
   * @param {string} payeeAccount - 收款方支付宝账号（手机号或邮箱）
   * @param {string} payeeRealName - 收款方真实姓名（可选，但建议提供）
   * @param {number} amount - 转账金额（元）
   * @param {string} remark - 转账备注
   * @param {string} outBizNo - 商户转账唯一订单号（用于幂等性）
   */
  async transferToAccount(payeeAccount, amount, remark = '', outBizNo = null, payeeRealName = '') {
    try {
      // 生成商户订单号（如果未提供）
      const merchantOrderNo = outBizNo || `ALIPAY_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      const bizContent = {
        out_biz_no: merchantOrderNo,
        trans_amount: amount.toFixed(2), // 保留两位小数
        product_code: 'TRANS_ACCOUNT_NO_PWD', // 单笔无密转账到支付宝账户
        biz_scene: 'DIRECT_TRANSFER', // 直接转账
        order_title: remark || `转账 - ${merchantOrderNo}`,
        payee_info: {
          identity_type: 'ALIPAY_LOGON_ID', // 支付宝登录账号
          identity: payeeAccount
        }
      };

      // 如果提供了真实姓名，添加到收款方信息中（可选，但建议提供以提高成功率）
      if (payeeRealName) {
        bizContent.payee_info.name = payeeRealName;
      }

      console.log('[支付宝转账] 请求参数:', JSON.stringify(bizContent, null, 2));

      const result = await alipaySdk.exec('alipay.fund.trans.uni.transfer', {
        bizContent
      });

      console.log('[支付宝转账] 响应结果:', JSON.stringify(result, null, 2));

      // 检查响应
      if (result.code === '10000') {
        return {
          success: true,
          order_id: result.orderId || result.order_id || result.payFundOrderId || result.out_biz_no,
          orderId: result.orderId || result.order_id, // 支付宝返回的字段名是 orderId
          payFundOrderId: result.payFundOrderId, // 支付宝资金订单号
          out_biz_no: result.outBizNo || result.out_biz_no || merchantOrderNo,
          pay_date: result.transDate || result.pay_date || new Date().toISOString(),
          status: result.status || 'SUCCESS',
          message: '转账成功',
          response: result
        };
      } else {
        return {
          success: false,
          code: result.code,
          sub_code: result.sub_code,
          message: result.msg || result.sub_msg || '转账失败',
          error: result
        };
      }
    } catch (error) {
      console.error('[支付宝转账] 错误:', error);
      return {
        success: false,
        message: error.message || '支付宝转账失败',
        error: error
      };
    }
  }

  /**
   * 查询转账订单状态
   * @param {string} outBizNo - 商户转账唯一订单号
   * @param {string} orderId - 支付宝转账单据号（可选）
   */
  async queryTransferStatus(outBizNo, orderId = null) {
    try {
      const bizContent = {
        out_biz_no: outBizNo
      };

      if (orderId) {
        bizContent.order_id = orderId;
      }

      const result = await alipaySdk.exec('alipay.fund.trans.order.query', {
        bizContent
      });

      if (result.code === '10000') {
        return {
          success: true,
          order_id: result.order_id,
          out_biz_no: result.out_biz_no,
          status: result.status, // SUCCESS, FAIL, DEALING, REFUND
          pay_date: result.pay_date,
          pay_amount: result.pay_amount,
          message: '查询成功',
          response: result
        };
      } else {
        return {
          success: false,
          code: result.code,
          message: result.msg || '查询失败',
          error: result
        };
      }
    } catch (error) {
      console.error('[支付宝查询] 错误:', error);
      return {
        success: false,
        message: error.message || '查询失败',
        error: error
      };
    }
  }
}

module.exports = AlipayService;
