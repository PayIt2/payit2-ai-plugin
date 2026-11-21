---
title: "Get started: a front door for people new to PayIt2 in Claude: design"
type: spec
doc_status: active
owner: claude-maintained
---
# Get started: a front door for people new to PayIt2 in Claude: design

**Date:** 2026-11-21. **Author:** Claude, for Brian. **Status:** Brian answered decisions 1 to 4 on 2026-11-21; decisions 5 to 8 are built to the recommendation and wait for his confirmation (section 10).

## 1. The idea, in Brian's words

"Having a 'Get Started' where we can set up an example page or give people ideas on how to use
PayIt2. That might be part of support, or it could be part of another skill, or just part of the
campaign skill, or any of the skills. How do I get started with this? What can I do with this?"

## 2. Where it should live

**Answer: its own small skill, `get-started`, plus one line in three other places.**

| Option | Verdict | Why |
|---|---|---|
| Its own skill | **Yes** | A skill is found by its description. No skill today has a description that matches "what can I do with this?", so the question lands on nothing. A separate skill gets its own trigger and its own pace. |
| Inside `campaign` | No | `campaign` is built to move fast once someone has decided. Its rules say: never offer a menu before the campaign exists, never ask what a default can answer. A newcomer needs the opposite: a short menu of ideas and room to look. Putting both in one skill weakens the fast path, and the fast path is the thing we just fixed in 2.1.1. |
| Inside support | No | Support starts from a problem. A newcomer has no problem, only a question about what is possible. Support is also not built yet. |
| Spread across every skill | No | Four copies of the same answer drift apart, and none of the four would be the one that triggers on the newcomer's question. |

What does get spread, in one line each:

- **The greeting** (session-start hook and `campaign-context`): someone with no campaigns is told they can ask what PayIt2 can do for them, or go straight to `/campaign`.
- **`campaign-context`**: the one sign-in mention may also be used when a newcomer asks for an example page.
- **`campaign`**: nothing changes in its flow. `get-started` hands off to it, not the other way round.

The skill ships in the ChatGPT package too, because that package copies `plugin/skills` whole.

## 3. What a newcomer asks, and what the skill says

| They ask | The skill does |
|---|---|
| "How do I get started with this?" | One sentence on what PayIt2 is (a page that collects money: a fundraiser, an event with tickets, or a group payment). Then one question: "What do you run or organize?" |
| "What can I do with this?" | The same one sentence, three short examples (one per page type), then the same one question. If they already said what they run, skip the question and go to ideas. |
| "Show me an example" | Offer the example page (section 5) for the idea that fits them best, or for a common one if they have said nothing. |
| "I'm not sure PayIt2 fits what I do" | An honest fit check. It fits when many people each pay toward one shared thing: a cause, an event, a shared cost. It says so plainly when it does not fit, and does not push. |
| "Create a fundraiser for X" | Not this skill. That is a decision already made, and it goes to `campaign`. |

## 4. How ideas are chosen without a long interview

One question, then ideas. No second question before the ideas appear.

1. Read what the person runs from their answer (a PTA, a youth soccer league, a church, a group of friends, a small nonprofit, one family in need).
2. Look up that kind of organizer in `references/ideas.md`. It maps ten kinds of organizer to three or four concrete uses each, all drawn from the real template catalog (108 templates on 2026-11-21: 42 fundraiser, 42 event, 24 group payment).
3. When PayIt2 is connected, call `list_templates` and keep only ideas whose template is really there. The catalog in the app repo is ahead of what production serves on some days, so the skill never names a template it did not get back from the tool.
4. Show three or four ideas. Each is one line: what the page is called, what people do on it, what the organizer gets. Mix the page types when the organizer's world has more than one (a PTA has a fall festival, a spirit wear order and a classroom fund).
5. End with one choice: see one of these as an example page, make one for real, or look at more ideas.

When the person will not say what they run, show one idea per page type from the most common templates instead of asking again.

## 5. What "set up an example page" means in version one

**Both: a draft in their account when connected, and a link to a real page on payit2.com either way.**

**The draft.**

- Made with `create_campaign` from a real template (`templateSlug`), with `publish` left off. It is never published by this skill, under any wording.
- The title starts with `Example: `. The description opens with one line saying this is an example and nothing on it is real.
- Content is made up but plausible, built around what the person runs ("Example: Lincoln PTA Fall Festival"). A fundraiser example never names a real person or a real hardship: it uses a made-up cause.
- The skill asks one yes or no question before creating it, because it writes to their account.
- The link works for them while they are signed in to PayIt2. Nobody else can open a draft.
- The page has no donations or sign-ups on it. The skill says so, so the empty page is not a surprise.

**The website link.** Every idea carries the address of the matching use-case section on payit2.com (for example `payit2.com/use-cases/schools-clubs/`). All 16 payit2.com addresses in `references/ideas.md` were checked on 2026-11-21 and answered. The skill uses only addresses from that file.

**Afterwards, three choices, always offered together:**

1. **Make it real.** Hand to `campaign` with the same template and the person's real facts. `campaign` builds a fresh page and puts it live. The example stays behind as a draft.
2. **Change it.** Try a different theme, or see a different idea as an example.
3. **Leave it.** Nothing else happens. It stays a private draft.

Why "make it real" builds a fresh page instead of converting the example: the connector can change a page's title, description, goal, end date and theme, but not an event's date, venue or ticket prices, and it has no tool that publishes a draft. Converting in place would leave events half real and would still send the person to the dashboard to publish.

**Keeping examples from piling up** (there is no delete tool):

- One example page per conversation, unless the person asks for another.
- Before creating one, the skill calls `list_my_campaigns`. If a draft whose title starts with "Example:" is already there, it points to that one and asks before making another.
- Every time it creates one, and again after "make it real", it tells the person how to remove it: open the campaign in PayIt2 and delete it from its settings.

## 6. When PayIt2 is not connected

The ideas need no connection, so the skill gives them straight away. For "show me an example" it does three things, in this order:

1. Describes the example page in words: title, what is on it, the ticket or giving options the template comes with.
2. Gives the payit2.com use-case link.
3. Says once, in one or two sentences, that connecting PayIt2 lets it build an example page they can click through, with the steps from `campaign-context/references/connect.md`.

That third step is the conversation's one sign-in mention. `campaign-context` gains this as a third allowed case, next to `/campaign` and live numbers. The skill never stops at the sign-in message.

## 7. Where it hands off

| The person now wants | Goes to |
|---|---|
| To make a page for real | `campaign`, with the type, the template and anything they already said |
| Help with a page they already have | `check-in` (how is it doing), `promote` (get the word out), `engage` (thank or remind people) |
| A problem with an account, a payment or a payout | Not this skill. Until a support skill exists: help with what can be answered, and point to payit2.com/support |

Someone who already has campaigns and asks "what else can I do with this?" still gets ideas, and the ideas lean toward page types they have not used.

## 8. How the greeting changes

Today, for a signed-in organizer with no campaigns: "greet them and suggest /campaign".

New: greet them, and say in one line that they can ask what PayIt2 can do for them, or run `/campaign` if they already know what they want to make. The change is one sentence in `scripts/session-start.sh` and the matching sentence in `campaign-context`. Nothing changes for organizers who have campaigns, or for people who are not signed in (still no greeting).

## 9. What needs server work later (not built here)

| Need | Why | Where |
|---|---|---|
| Sample activity on an example page | An example with no donors or sign-ups does not show what a working page feels like. Needs made-up participants that never touch Stripe, and a clear "Example" banner on the page. | app-v2 backend and public page |
| An "example" flag on a campaign | Lets the server refuse to publish an example, hide it from reports, and clear it out after 30 days. Today the only marker is the word in the title. | app-v2 backend |
| A delete (or archive) tool on the connector | So the skill can clean up its own examples instead of sending the person to the dashboard. | app-v2 mcp-server |
| A publish tool on the connector | So an example, or any draft, can be put live from the chat. Would let "make it real" convert the example in place for fundraisers and group payments. | app-v2 mcp-server |
| A public preview address per template | So "show me an example" works with no account and no draft at all. | app-v2 frontend or payit2-website |

## 10. Decisions that are Brian's

| # | Question | Recommendation | Brian's answer |
|---|---|---|---|
| 1 | Own skill, part of support, part of `campaign`, or spread across all? | Own skill, `get-started`, with one line in the greeting and in `campaign-context` | Own skill (2026-11-21) |
| 2 | What is an "example page" in version one? | A private draft with "Example:" in the title, plus a payit2.com link | Draft plus link (2026-11-21) |
| 3 | What does "make it real" do? | `campaign` builds a fresh live page from the same template; the example stays a draft to delete | Fresh live page (2026-11-21) |
| 4 | What does the greeting say to someone with no campaigns? | Offer both: ask what PayIt2 can do, or `/campaign` | Offer both (2026-11-21) |
| 5 | The skill's name | `get-started`, so the command is `/get-started` | Decided by default, Brian to confirm |
| 6 | How many example pages | One per conversation, and reuse an existing "Example:" draft before making another | Decided by default, Brian to confirm |
| 7 | What the skill says PayIt2 is not for | A store with inventory and shipping, invoices to clients, payroll, and paying one friend back. It says this only when asked about fit. | Decided by default, Brian to confirm |
| 8 | ChatGPT's onboarding skill | Leave it as `campaign-context` for now | Decided by default, Brian to confirm |

## 11. What is built, and how it is tested

- `plugin/skills/get-started/SKILL.md` and `references/ideas.md`.
- One sentence each in `scripts/session-start.sh`, `skills/campaign-context/SKILL.md` (greeting, sign-in mention, the command list).
- README and CLAUDE.md skill lists, CHANGELOG under Unreleased, the rebuilt zip.
- Offline tests in `tests/plugin/plugin.unit.test.ts`: the description triggers on the newcomer questions and leaves create requests to `campaign`; the example is always a draft with "Example:" in the title; the one-example rule and the delete instruction are present; every payit2.com address in the skill is on the checked list; the greeting names both paths; no em dashes; nothing names Claude or its menus.
- One new live scenario in `tests/live/scenarios.ts` (signed out, "what can I do with this?"): no PayIt2 tool is called, ideas come back, and `create_campaign` is not called. It runs with `npm run live`, which needs the dev key.

**Not verified by this work:** a live run in the Claude desktop app, whether the description wins the trigger against `campaign` in real chats, and how the example draft looks on a real account. Those are Brian's to run, on a dev or test account first.
