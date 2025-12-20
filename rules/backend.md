\# Backend Skill (Node/Express)



\- All routes must check authorization for admin/editor/author scopes.

\- Validate route params and body (types, ranges, presence).

\- Use transaction for multi-step writes.

\- Always return consistent response envelope.

\- Log errors with context (route, userId if available), but do not leak secrets.

\- Prefer small helper functions; avoid monolithic route handlers.



