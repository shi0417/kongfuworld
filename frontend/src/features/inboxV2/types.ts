export type InboxV2SenderType = 'author' | 'editor' | 'system';

export interface InboxV2ConversationSummary {
  id: number;
  subject: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  unreadCount: number;
  updatedAt: string; // ISO string (from conversations.updated_at)
}

export interface InboxV2Message {
  id: number;
  conversationId: number;
  senderType: InboxV2SenderType;
  senderDisplayName?: string; // system 可为空
  content: string;
  createdAt: string; // ISO string

  // Stage 3A: author read state only (system message excluded -> undefined/null)
  isRead?: boolean | null;
  readAt?: string | null;
}

export interface InboxV2ConversationDetail {
  id: number;
  subject: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
}


