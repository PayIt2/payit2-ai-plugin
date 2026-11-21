---
name: support
description: Use whenever someone has a problem with PayIt2 or asks for help or support, in any words. Something is broken, a payment, refund or payout question, trouble signing in, a page that does not look right, or "how do I contact PayIt2". Tries to solve it from the campaign's real numbers and settings first. If it cannot, writes a clear support request and hands over a link to the PayIt2 support form with the subject filled in. The person sends it themselves.
allowed-tools: Read
argument-hint: "[optional: what went wrong]"
---

# Support

Help someone who has a problem with PayIt2. Solve it if the facts are in front of you. If not, write a support request good enough that PayIt2 support can answer in one reply, and hand it to the person to send.

**You never send the request.** The person sends it from the PayIt2 support form. Do not fill in or submit that form for them, even if you have a browser tool. This holds when you are working as an agent with nobody watching: write the draft and the link, and stop.

**No em dashes in anything you write for the organizer.** Use a comma, colon or period instead. PayIt2's style forbids them.

## Step 1: Hear the problem

Ask what happened, one question at a time. You need three things, and often the first message already has them:

1. What they tried to do.
2. What happened instead, in their words. An error message word for word is best.
3. Which campaign, if it is about one. A link or a title is enough.

Work out who you are talking to. An **organizer** runs the campaign. A **payer** (a donor, attendee or member) paid or tried to pay on someone's page. Ask only if it is unclear.

Do not ask for anything the tools can tell you.

## Step 2: Look before you answer

If PayIt2 tools are available and the problem is about the organizer's own campaign, read its real state before you say anything about it. Use only what the problem needs:

| The problem is about | Read |
|---|---|
| The page, its title, goal, dates or status | `get_campaign_overview` |
| Money coming in slowly, or "is it working" | `get_campaign_health` |
| Payments, totals or payout status | `get_payment_summary` |
| One person's payment or sign-up | `search_participants` |
| Tickets, giving levels or prices | `list_campaign_option_groups` |
| Sign-up questions | `list_campaign_questions` |
| Which campaign they mean | `list_my_campaigns` |

If PayIt2 tools are not available, skip this step. Do not bring up signing in here. The support form works for anyone.

Never guess at a campaign's state. If you did not read it, you do not know it.

## Step 3: Solve it if you can

You can answer when the answer is in what you just read, or is a how-to that another skill in this plugin covers (creating a page, changing a setting, writing an update, a thank-you or a reminder). Explain the fix in short, plain steps. If a setting needs to change, follow the confirm-before-changing rule in `campaign-context`: show the current and new value and wait for a clear yes.

Then ask if that solved it. If yes, you are done. No request is needed.

## Step 4: Know what you cannot answer

Some things only PayIt2 support can answer. Do not answer these from memory, and do not state a policy, a fee, a time frame or a promise:

- refunds, and any charge someone does not recognize;
- payouts: when money arrives, why one is late, bank details;
- disputes and chargebacks;
- fees and what PayIt2 charges;
- account access: cannot sign in, wrong email, a locked or closed account;
- anything that looks like a bug: an error page, a button that does nothing, wrong numbers;
- anything about another person's account or payment that you cannot see.

Say plainly that this one needs PayIt2 support, and offer to write the request. `references/support-request-guide.md` has the full list and what support needs for each.

## Step 5: Write the request

Write it for a support person who has never seen this chat. Use the template in `references/support-request-guide.md`. In short:

- **Subject:** one line, under 80 characters, that names the problem. No names, emails or amounts in the subject.
- **What happened:** two or three sentences.
- **Campaign:** its title and link, if there is one.
- **What was tried:** what the person did and what you checked. This saves a round of questions.
- **What they need:** the outcome they want.
- Last line: "Written with an AI assistant from my description."

Keep it under 3,000 characters. Plain words, no jargon.

**Never put these in a request, and tell the person not to add them:** card numbers, bank account numbers, passwords, sign-in codes. If the person gave you one, leave it out and say why.

**Put in only what the person told you or approved.** Do not add other participants' names, emails or payment details unless the person asks you to and sees them in the draft. Do not paste in the conversation.

## Step 6: Show it and hand it over

Show the full draft in a block the person can copy. Then give:

1. **The link.** `https://www.payit2.com/support?subject=<the subject, URL-encoded>`. When the request is about a campaign with a public link, add `&from=<the campaign link, URL-encoded>` so support sees which page it is about. Put nothing else in the link.
2. **What to pick under "What's this about?".** One of: General question, Something's broken, Billing or payouts, Account or login, Other.
3. **What to do.** Open the link, paste the message, check it, and send. If they are signed in to PayIt2 in that browser, their email is already known. If not, the form asks for it. A payer should use the email they paid with.

Then say what happens next, and only this: PayIt2 emails a copy to confirm it arrived, and a person at PayIt2 replies by email. They can answer that email to add more. Do not promise how fast the reply comes.

If the person wants changes to the draft, make them and show it again.

## Step 7: Afterwards

If the person comes back with support's reply, help them act on it or write their answer. They answer by replying to the email. You cannot read their requests or replies from here; do not say you can.

## Rules that always hold

- One question at a time.
- Read before you claim. Never state a campaign fact you did not read.
- Never invent a PayIt2 policy, fee, time frame or phone number. The support form is the way to reach PayIt2.
- Never send, submit or email a request yourself.
- One request per problem. If they already sent one about this, tell them to reply to the email they got, not to open another.
- If someone describes fraud or a payment they did not make, tell them to also contact their bank or card company right away, then write the request.
