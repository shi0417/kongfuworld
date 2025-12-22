import ApiService from './ApiService';

export type BillingSource = 'karma' | 'champion';

export type BillingStatus = 'pending' | 'completed' | 'failed' | 'cancelled' | 'refunded';

export type BillingType =
  | 'karma_purchase'
  | 'karma_consumption'
  | 'karma_reward'
  | 'karma_refund'
  | 'champion_new'
  | 'champion_renew'
  | 'champion_upgrade'
  | 'champion_refund';

export type BillingRow = {
  row_id: string;
  source: BillingSource;
  occurred_at: string;
  type: BillingType;
  status: BillingStatus;
  description: string;
  currency: string | null;
  amount_paid: number | null;
  delta_label: string | null;
  before_label: string | null;
  after_label: string | null;
  provider: string | null;
  provider_ref: string | null;
  novel_id: number | null;
  novel_title: string | null;
  chapter_id: number | null;
};

export type BillingTransactionsResponse = {
  rows: BillingRow[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
};

export async function getBillingTransactions(params: {
  page?: number;
  pageSize?: number;
  type?: BillingType[];
  status?: BillingStatus[];
  q?: string;
  start?: string;
  end?: string;
}): Promise<BillingTransactionsResponse> {
  const sp = new URLSearchParams();
  if (params.page) sp.set('page', String(params.page));
  if (params.pageSize) sp.set('page_size', String(params.pageSize));
  if (params.q) sp.set('q', params.q);
  if (params.start) sp.set('start', params.start);
  if (params.end) sp.set('end', params.end);
  if (params.type?.length) sp.set('type', params.type.join(','));
  if (params.status?.length) sp.set('status', params.status.join(','));

  const res = await ApiService.get(`/billing/transactions?${sp.toString()}`);
  if (!res.success) throw new Error(res.message || '获取交易流水失败');
  return res.data as BillingTransactionsResponse;
}


