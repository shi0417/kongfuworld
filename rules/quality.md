# Code Quality Skill (Repo-wide)

## Before writing code (mandatory checklist)

* Identify the exact behavior change (or confirm no behavior change).
* Identify data flow: UI -> API -> DB -> response.
* Identify auth boundary: who can call this? what roles?
* Identify validation boundary: what input must be validated and where?
* Identify failure modes: nulls, missing rows, timeouts, partial updates.

## Implementation constraints

* Add strong typing on frontend requests/responses.
* Backend routes must:

  * validate inputs
  * return consistent JSON shape: { ok: boolean, data?: any, error?: { code, message } }
  * use parameterized queries (no string concat SQL)
  * never leak internal stack traces to users

## Review checklist (mandatory after code)

* Security: XSS (rendered HTML), SQLi, auth bypass, unsafe file ops
* Correctness: edge cases, timezone/date handling, idempotency
* Performance: pagination, indexes for new queries, avoid loading whole tables
* Consistency: naming, endpoints, error codes, status codes
* Tests: at least one happy path + one failure path (or manual steps if no test infra)



\## Audit output requirements (mandatory gate)

When producing an audit/review report, the response MUST include:



\### Evidence

Provide concrete, verifiable observations from the actual code that justify severity levels.

\- Point to specific functions/branches/patterns (e.g., "no dangerouslySetInnerHTML usage", "null is handled before rendering")

\- Avoid vague statements like "seems safe" or "looks fine"

\- If you cannot confirm something from the code, state the uncertainty explicitly



\### Invariants

Explicitly list what is guaranteed NOT to change in this work:

\- API endpoints and response shapes (unless explicitly approved)

\- Routes and navigation behavior (unless explicitly approved)

\- Database schema/migrations (unless explicitly approved)

\- Business logic and user-visible behavior (unless explicitly approved)

\- Dependency footprint (no new deps unless explicitly approved)



\### Minimal Patch Policy

\- Provide diffs ONLY for P0/P1 items by default.

\- P2 items must be listed as recommendations only (no code changes) unless the user explicitly requests them.

\- Any change that could alter timing/UX semantics (e.g., debounce, caching) is treated as behavior change and must be excluded unless explicitly approved.



\### Audit severity guidance

\- P0: Security, auth bypass, data loss, crash on common path, or high probability production incident

\- P1: Incorrect user-facing output, broken i18n, major maintainability hazards, risky edge cases

\- P2: Performance polish, refactors, style consistency, minor edge case improvements



\## Audit Evidence Checklist (Mandatory)



For any Stage 4 Audit, the Evidence section MUST explicitly include at least one concrete observation for EACH of the following categories:



\### 1. Injection \& XSS

\- Whether raw HTML rendering (e.g. dangerouslySetInnerHTML) is used

\- If not used, explicitly state that rendering is via React text nodes

\- Cite the exact render location



\### 2. Crash \& Nullability

\- How nullable values are handled (e.g. null/undefined API fields)

\- Whether array `.map()` calls are protected by type guarantees or guards

\- How date parsing or number conversion failures are handled (e.g. Invalid Date)



\### 3. Side Effects \& Requests

\- List all useEffect hooks in scope

\- For each, state:

&nbsp; - Dependency array

&nbsp; - Whether it triggers network requests

&nbsp; - Whether it can amplify requests unintentionally



\### 4. Type Guarantees

\- Reference the concrete interface/type definitions used

\- State whether key fields are required or optional

\- If types do not fully guarantee safety, explicitly note the gap



Failure to cover any category must be explicitly acknowledged as an uncertainty.



---



\## Audit Invariants Checklist (Mandatory)



The Invariants section MUST list concrete, diff-detectable guarantees.

At minimum, include statements for ALL of the following:



1\. State invariants

&nbsp;  - No new React state variables added

&nbsp;  - No existing state variables removed or repurposed



2\. Side-effect invariants

&nbsp;  - No changes to useEffect dependency arrays

&nbsp;  - No new network requests introduced

&nbsp;  - No change in request trigger conditions



3\. Rendering invariants

&nbsp;  - No changes to conditional rendering branches

&nbsp;  - No changes to routing or navigation logic



4\. API invariants

&nbsp;  - No changes to API endpoints, payloads, or response shapes



5\. Data \& persistence invariants

&nbsp;  - No database schema or backend logic changes



6\. Dependency \& scope invariants

&nbsp;  - No new dependencies introduced

&nbsp;  - No global CSS or cross-module style impact



High-level claims like "business logic unchanged" are insufficient unless backed by these concrete guarantees.





