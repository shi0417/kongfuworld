Stage 1 Blueprint 最终锁定
Writers Zone · Inbox v2（消息级已读 + 多编辑介入 + 作者可见介入提示 + Admin-only 审计）
1) Scope（锁定）
In Scope（最终）

消息级已读（Message-level Read State）

每条消息可记录 read_at（或等效字段）

未读计数可从消息级聚合得出

允许多个编辑同时介入

同一会话可存在多个 Editor 参与者

作者可见“编辑已介入”系统提示

以“系统消息/事件”形式显示在会话时间线中（非弹窗强打扰）

审计日志 Admin-only

审计日志仅 Admin/Chief Editor/Super Admin 可查看

Editor 不可查看审计日志（但其介入/发送行为仍被记录）

Out of Scope（保持不变）

不做实时推送/WebSocket

不做外部通知（邮件/短信）

不做全文搜索

不改既有消息内容结构（除非新增系统消息类型）

不引入新依赖/新权限体系

2) Roles & Authorization Matrix（更新）
Action	Author	Editor	Admin	Notes
View own conversations	Allow	Allow	Allow	Author 仅限自己
View others’ conversations	Deny	Allow	Allow	
Send message	Allow	Allow	Allow	sender_type 区分
Mark message as read	Allow (own)	Allow	Allow	消息级
Join conversation	Deny	Allow	Allow	允许多人同时加入
Leave conversation	Deny	Allow	Allow	
View audit log	Deny	Deny	Allow	Admin-only
3) Data Model（概念层最终版）
Entities / Concepts

Conversation

Message

包含 sender_type：author | editor | system

支持 system message：用于“编辑已介入”提示

ConversationParticipant

允许一条会话关联多个 editor participant

MessageReadState（消息级）

message_id + reader_id + read_at

或 Message.read_at（若只需要单方读状态，需后续确认读者维度；建议 ReadState 表支持多读者）

说明：你要求“消息级已读”，且存在“多编辑参与”。
为避免未来扩展困难，Blueprint 推荐 ReadState 独立结构（能支持多读者：author / 多 editor / admin）。

4) Data Flow（更新）
4.1 作者打开会话（消息级已读）
UI: Open Conversation
 → GET /api/inbox/conversation/:id
   → AuthZ (author owns conversation)
     → Fetch messages
       → Compute which messages become read for this viewer
         → Persist read state (message_id, reader_id, read_at)
           → Response
             → UI render (unread badges cleared)

4.2 编辑加入会话（多编辑 + 系统提示）
UI: Editor clicks "Join Conversation"
 → POST /api/inbox/conversation/:id/join
   → AuthZ (editor role)
     → Upsert participant (allow multiple editors)
       → Insert system message: "Editor <name> joined"
         → Write audit log
           → Response
             → UI render (participants updated)

5) API Contract（更新后的最小集合）
Endpoints（概念）

POST /api/inbox/conversation/:id/join

幂等：重复 join 不产生重复 participant

但系统提示是否重复：约束为“同一 editor 再次 join 不重复插 system message”

POST /api/inbox/conversation/:id/leave

POST /api/inbox/message/read

支持批量 message_ids

GET /api/inbox/conversation/:id

响应需能表达：

消息列表

sender_type（含 system）

当前读者的 read state（或由前端根据 read_at 推断）

GET /api/inbox/audit?...（Admin-only）

可按 conversation_id 过滤

必须分页

6) Edge Cases（新增/强化）

新增关键边界（在原 ≥10 基础上强化）：

多个编辑同时 join：参与者列表一致性

同一 editor 重复 join：participant 不重复、system message 不重复

作者是否可屏蔽系统提示：不在本阶段

历史消息没有 read state：默认未读还是默认已读？（建议：历史默认已读，仅新消息参与未读计数；需产品确认，先作为 Assumption）

7) Assumptions（更新）

允许多个编辑同时介入（已确认）

作者需要在会话流中看到“编辑已介入”的系统提示（已确认）

审计日志仅 Admin 可见（已确认）

已读为消息级（已确认）

待确认但不阻塞 Stage 2（可在 Scaffold 阶段用占位）：

历史消息的默认 read 状态策略（建议：迁移时将历史标记为已读，避免一上线全未读爆炸）

8) Stage 1 Exit Criteria（你已满足）

Scope / Out of Scope：已锁定

权限矩阵：无歧义（Editor 无审计权限）

关键决策点：已全部确认（4/4）

Edge cases：覆盖充分

Rollback：可通过 feature flag 关闭入口并停用 join/read 写入