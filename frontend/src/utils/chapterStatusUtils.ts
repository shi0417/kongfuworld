// 章节状态工具函数

export interface Chapter {
  review_status: string;
  is_released: number | null;
  release_date: string | null;
}

/**
 * 获取发布状态（由 review_status, is_released, release_date 决定）
 */
export function getPublishStatus(ch: Chapter, now: Date = new Date()): string {
  // 草稿页面会用到，虽然章节管理默认不显示 draft
  if (ch.review_status === 'draft') {
    return '草稿';
  }

  if (ch.is_released === 1) {
    return '已发布';
  }

  if (ch.release_date) {
    const date = new Date(ch.release_date);
    if (date > now) {
      return '定时发布';
    }
  }

  return '未发布';
}

/**
 * 获取审核状态标签（直接映射 review_status）
 */
export function getReviewStatusLabel(ch: Chapter): string {
  switch (ch.review_status) {
    case 'draft':
      return '草稿';
    case 'submitted':
      return '待审核';
    case 'reviewing':
      return '审核中';
    case 'approved':
      return '审核通过';
    case 'rejected':
      return '审核不通过';
    default:
      return ch.review_status;
  }
}

/**
 * 根据筛选条件过滤章节
 */
export function filterChapterByStatus(
  ch: Chapter,
  filter: 'all' | 'published' | 'scheduled' | 'unreleased' | 'submitted' | 'reviewing' | 'approved' | 'rejected',
  now: Date = new Date()
): boolean {
  if (filter === 'all') return true;

  const publishStatus = getPublishStatus(ch, now);
  const reviewLabel = getReviewStatusLabel(ch);

  switch (filter) {
    case 'published':
      return publishStatus === '已发布';
    case 'scheduled':
      return publishStatus === '定时发布';
    case 'unreleased':
      return publishStatus === '未发布';
    case 'submitted':
      return ch.review_status === 'submitted';
    case 'reviewing':
      return ch.review_status === 'reviewing';
    case 'approved':
      return ch.review_status === 'approved';
    case 'rejected':
      return ch.review_status === 'rejected';
    default:
      return true;
  }
}

