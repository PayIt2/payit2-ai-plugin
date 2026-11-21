---
title: "A support skill for the PayIt2 plugin: design"
type: spec
doc_status: active
owner: claude-maintained
---
# A support skill for the PayIt2 plugin: design

**Date:** 2026-11-21. **Author:** Brian, with Claude. **Status:** decisions 1 to 4 made by Brian on 2026-11-21 (section 13). Step one is built; step two waits on app-v2.

## 1. Goal

An organizer who hits a problem while working with Claude can get help without leaving the chat. Claude first tries to solve it from the campaign's real state. If it cannot, it writes a clear support request, shows it, and sends it to PayIt2 support only after a clear yes. Replies from support can be read and answered in the same chat.

Brian's words: "adding a support skill where it integrates with the new PayIt2 support system, and people and agents can ask for support through PayIt2."

## 2. What the code says today

Checked on 2026-11-21 against `origin/master` of `payit2-app-v2` (05c69fca7) and the local branch `local/integration-2026-11-13`.

### On master (what a new PR can build on)

- A ticket has a requester (account or guest email), subject, message, category (`question`, `bug`, `billing`, `account`, `other`), status (`open`, `pending`, `resolved`, `closed`), an optional page link (`context_url`) and an owner. There is no `source` column. `backend/prisma/schema.prisma` 2403-2463.
- One way to open a ticket by API: `POST /api/v1/public/support/tickets` (`backend/src/routes/support.ts` 24). It sits behind the Turnstile bot check (`backend/src/app.ts` 206). A connector cannot pass a bot check, so this route is closed to the MCP server on production.
- A signed-in person has no API to list their tickets or to reply. A requester can only reply by email: support's answer carries the reply address `ticket-<id>@reply.payit2.com`, and an email sent there joins the thread (`backend/src/lib/support-reply-address.ts`, `support-service.ts` 129-172).
- Email on a new ticket: staff get a notice, and the requester gets "We got your message", capped at 3 an hour per address (`routes/support.ts` 11-13, 60-90).
- The web form takes a prefilled subject and page link: `payit2.com/support?subject=...&from=...` (`frontend/src/app/support/page.tsx` 21-50). The person still types the message and passes the bot check.
- The MCP server calls the backend as the signed-in organizer, with a short-lived token it mints itself (`mcp-server/src/lib/api-client.ts` 9-45). The backend cannot tell such a call from a web session.
- The scopes `mcp:read` and `mcp:write` are announced and granted together, but no tool checks them (`mcp-server/src/index.ts` 97, `oauth/interactions.ts` 20).
- Every tool must have an entry in `TOOL_ANNOTATIONS` or it will not register (`mcp-server/src/tools/annotations.ts` 13-56).
- House pattern for a tool that changes something: `update_campaign_settings` saves nothing without `confirm: true` and returns a preview instead (`tools/campaign.ts` 1379-1391). House pattern for sending to people: `send_participant_message` does not send; it saves a draft the organizer sends from PayIt2 (`tools/participant.ts` 226-275).

### Not on master yet

- **The inbox (B-461).** Its PR #1969 was closed. The work lives in the integration PR #1971, which is open.
- **The feedback schema (B-543).** PR #2015 is open, has merge conflicts and no passing review verdict. It adds `source`, `client_context`, `requester_last_read_at` and `support_attachments`. A database rule allows only three sources: `web`, `ios`, `email`.
- **The feedback code (B-543).** It has no PR. It exists only on the local integration branch. It is the part this feature needs most: `/api/v1/support/threads` lets a signed-in person list their requests, read one, open one and reply, with hourly caps per person of 10 new requests and 60 replies (`backend/src/routes/support-threads.ts` 119-185 on that branch). Opening one there always writes `source: "ios"` (`support-service.ts` 622-651).

### In the plugin

- Skills work in two modes: connected (PayIt2 tools present) and standalone (no tools). Both are first class (`plugin/skills/campaign-context/SKILL.md`).
- A hook asks the organizer before a confirmed settings change and denies it when nobody can answer (`plugin/scripts/confirm-settings-change.sh`).
- A test fails if the plugin names a tool the dev server does not have (`tests/connector/drift.connector.test.ts`). So a skill cannot mention a tool before that tool is deployed to dev.

## 3. What this changes in the first plan

The first plan was three server tools plus a skill, built now. Five facts change it:

1. The "new support system" is not on master. A governed PR must stand on master alone, and master has no way for a connector to open, list or answer a request.
2. The routes the tools need already exist in unmerged B-543 code. Writing a second set on master would copy that work and collide with it.
3. Marking a request as coming from Claude needs a database change (the allowed-sources rule). A database change is its own PR, one release ahead of the code.
4. The same server serves ChatGPT. A source named "claude" would be wrong for part of the traffic.
5. A useful first version needs no server change at all: the web form link works on production today.

## 4. Who can ask for support through this

| Who | Version one | Later |
|---|---|---|
| Organizer in a chat (Claude or ChatGPT), signed in to PayIt2 | Yes | |
| Organizer in a chat, not signed in | Yes, by the web form link | |
| An agent working for an organizer, with the organizer watching | Yes, same path and same yes | |
| An agent with nobody watching | No. The send is refused | Decide after real use |
| A payer (donor, attendee, member) | Pointed to the web form only | Decide after real use |

## 5. The organizer's path

"Something is wrong with my page" in chat:

1. **Listen.** The skill asks what happened, one question at a time, and which campaign.
2. **Look.** If connected, it reads the campaign's real state with the tools it already has (overview, health, payments, options, questions). It never guesses at state.
3. **Try to solve it.** If the answer is in the data or in the skill's reference of known answers, it explains the fix in plain steps. Many requests end here.
4. **Do not make up policy.** For refunds, fees, payouts, disputes, account access or anything it cannot see, it says so and offers to ask support.
5. **Check for an open request.** (Step two.) If the organizer already has one on this topic, it offers to add to it.
6. **Draft.** It writes the request: what happened, which campaign, what was tried, what the organizer wants. Short and plain. No card numbers, passwords or codes, ever.
7. **Show it.** The organizer sees the exact text and everything that will go with it.
8. **Send.**
   - Step one: the skill gives the text to copy and a link that opens the PayIt2 support form with the subject and campaign filled in. The organizer pastes and presses send.
   - Step two: after a clear yes, the skill sends it and says what happens next: a confirmation email, and replies by email and in chat.
9. **Follow up.** (Step two.) "Any word from support?" lists the organizer's requests, shows unread replies, and can send an answer after a yes.

## 6. The server tools (step two)

All three act as the signed-in organizer. Identity comes from the sign-in, never from tool input.

| Tool | Input | Output | Kind | Confirmation |
|---|---|---|---|---|
| `list_support_requests` | `requestId` (optional) | Without an id: each request's subject, status in plain words (sent, replied, resolved), last message preview and whether a reply is unread. With an id: the full conversation | Read | None |
| `open_support_request` | `kind` (`problem`, `question`, `idea`), `message` (up to 5,000 characters), `campaignId` (optional), `confirm` (optional) | Without `confirm: true`: saves nothing and returns the request exactly as it would be sent. With it: the request id and what happens next | Adds | Preview, then a clear yes |
| `reply_to_support_request` | `requestId`, `message`, `confirm` (optional) | Same preview rule; then the updated conversation | Adds | Preview, then a clear yes |

- **Scopes.** Reads need `mcp:read`; the two writes need `mcp:write`. Today both are always granted together and nothing checks them, so this is a label until the server enforces scopes for every tool. That is a separate piece of work.
- **How the backend knows it is an assistant.** The MCP server adds a signed mark to the token it already mints. The backend sets the source from that mark. Tool input cannot set it.
- **Routes.** The tools call B-543's `/api/v1/support/threads` routes. No second set of routes.
- **The plugin hook.** A PreToolUse hook on the two write tools asks the organizer on the `confirm: true` call. In a run with nobody to answer, it denies the call. Same shape as the settings hook.

## 7. What a request carries

Always, and all of it shown in the preview:

- the organizer's message, as approved;
- the kind (problem, question or idea);
- the campaign, if one was named;
- "what was tried", as part of the message text;
- source `assistant` and the app's name (Claude or ChatGPT);
- the organizer's account name and email, from their sign-in.

Never without the organizer seeing and approving it:

- any part of the chat beyond the approved message;
- participant names, emails or payment details;
- files or screenshots (not in version one at all).

Never at all: card numbers, bank details, passwords, sign-in codes. The skill refuses to include them and says why.

Rule of thumb for review: **the request holds what the preview showed, plus the account and source the server adds. Nothing else.**

## 8. How replies come back

- **By email, always.** This works today. Support's answer goes to the account's email, and a reply to that email joins the conversation.
- **In chat, when asked.** `list_support_requests` shows unread replies. The skill reads them out and offers to answer.
- **At the start of a conversation?** Not in version one. The opening greeting stays about campaigns. See decision 6.
- Chat does not get pushed a reply. Claude only sees one when the organizer asks or a skill looks.

## 9. Abuse and limits

- **Confirmation.** Nothing is sent without a preview and a yes. The server enforces the preview; the hook enforces the ask.
- **Caps per person for assistant requests.** 3 new requests an hour and 10 a day; 20 replies an hour. These are tighter than the iPhone app's 10 and 60, because an assistant can loop.
- **Repeats.** The same person sending the same message within 10 minutes gets the first request back, not a second one. The inbound email path already works this way.
- **Size.** 5,000 characters, the same as the form. Production refuses bodies over 8 KB at the edge.
- **Signed out.** No tool. The web form and its bot check are the only door.
- **Email.** Staff notice and requester confirmation are the same as for the iPhone app. No new email.

## 10. What the admin sees

- **Step one (web form link).** A normal web ticket. The campaign's link is on it, because the form link carries it. Nothing marks it as written with Claude; the skill adds one line at the end of the draft: "Written with Claude from the organizer's description."
- **Step two, once the inbox and feedback work are live.** The queue row and the "Sent from" box read "Claude" or "ChatGPT" where an iPhone ticket shows the phone. The campaign is linked. The message already says what was tried, so the first reply can be an answer, not a question. This needs a small change to the inbox's source label, with before and after screenshots.

## 11. How it is tested

Plugin (`payit2-ai-plugin`):

- Unit: the skill's frontmatter and references load; the hook script asks on `confirm: true`, passes a preview call, and asks on input it cannot read.
- Live scenarios (`tests/live`): a problem the data answers ends with no request; a refund question ends with a draft and the form link, never an invented policy; a card number in the description is refused.
- Drift test: stays green in step one because the skill names no new tool. In step two it proves the three tools exist on dev before the plugin ships.
- Desktop gate from `CLAUDE.md` before any release.

Server (`payit2-app-v2`, step two):

- MCP tool tests: preview saves nothing; `confirm: true` sends once; errors read plainly; each tool has its annotation.
- Backend tests: the signed mark sets the source and tool input cannot; another person's request returns "not found"; caps and the repeat guard hold.
- Every changed line covered, as SDLC-1 requires.

Not testable by a session: a live run in the Claude desktop app with a real sign-in. Brian does that.

## 12. What ships where, in what order

**Step one, now. Plugin only (Brian's own repo).**
PR in `payit2-ai-plugin`: the `support` skill in its hand-off form, a reference of known answers, tests, the rebuilt zip, version 2.3.0. It works on production today and for people who are not signed in.

**Step two, when B-543 is on master. Three PRs, in order.**

1. `payit2-app-v2`, database only: allow the source `assistant`. Additive, one release ahead.
2. `payit2-app-v2`, code: the three tools, the signed mark, the caps, the inbox label. One feature, one B-id.
3. `payit2-ai-plugin`: the skill uses the tools when they are present, the hook, the drift test. Released after PR 2 is on production.

Step two cannot start until PR #2015 and the B-543 code are merged by Thomas's side. That is outside this work.

## 13. Decisions for Brian

Brian chose the recommended answer for 1 to 4 on 2026-11-21. Decisions 5 to 8 belong to step two and stay open until it is built; the recommendation stands in until then. Decision 9 is built as recommended, worded "Written with an AI assistant", because the same skills ship to ChatGPT.

1. **Order.** Recommended: step one now, step two when B-543 lands. Other choices: write separate routes on master now (copies B-543, will collide), or wait and ship it all at once.
2. **Who, in version one.** Recommended: signed-in organizers send from chat (step two); everyone else gets the web form link. No unattended agents, no payer tools.
3. **Name of the source.** Recommended: `assistant`, with the app's name beside it, because the same server serves ChatGPT. Other choice: `claude`.
4. **The yes.** Recommended: a preview and a clear yes for every new request and every reply, enforced by the server and the hook. Other choice: let a reply inside an open conversation go without a preview.
5. **Caps.** Recommended: 3 new an hour, 10 a day, 20 replies an hour.
6. **Mention unread replies in the opening greeting.** Recommended: not in version one.
7. **Kinds.** Recommended: problem, question, idea, the same three as the iPhone app. Support re-files money and account issues.
8. **Attachments.** Recommended: none in version one.
9. **The "Written with Claude" line in step one's draft.** Recommended: keep it, so support knows how the text was made.

## 14. Left out on purpose

- Payers opening requests from chat.
- Agents filing with nobody watching.
- Screenshots and files.
- Enforcing scopes per tool across the whole server.
- Any answer about refunds, fees or payout timing that is not read from live data.
