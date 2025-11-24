import ApiService from './ApiService';

export interface ReportData {
  commentId: number;
  commentType: 'review' | 'comment' | 'paragraph_comment';
  reportReason: string;
}

class ReportService {
  /**
   * 提交举报
   */
  async submitReport(data: ReportData): Promise<any> {
    const response = await ApiService.post('/report', {
      type: data.commentType,
      remark_id: data.commentId,
      report: data.reportReason
    });
    return response;
  }
}

const reportService = new ReportService();
export default reportService;

