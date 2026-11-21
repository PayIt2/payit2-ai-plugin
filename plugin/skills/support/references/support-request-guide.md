---
title: "Writing a PayIt2 support request"
type: reference
doc_status: active
owner: claude-maintained
---
# Writing a PayIt2 support request

Use this when the `support` skill reaches the point of writing a request. It lists what only PayIt2 support can answer, what support needs for each kind of problem, and the template.

## What goes to support, and what support needs

| Problem | Pick under "What's this about?" | Put in the request |
|---|---|---|
| A refund, or a charge someone does not recognize | Billing or payouts | The campaign, the date of the payment, the email it was paid with, and what they want to happen. Never the card number |
| A payout that is late or missing | Billing or payouts | The campaign, the payout status the organizer sees, and the date they expected it |
| A dispute or chargeback | Billing or payouts | The campaign, the date of the payment, and what the organizer knows about it |
| A question about fees | Billing or payouts | The campaign, and the exact amounts the organizer sees |
| Cannot sign in, wrong email on the account, locked account | Account or login | The email they sign in with, how they sign in (Google or an emailed link), and what the screen says |
| An error page, a button that does nothing, wrong numbers on a page | Something's broken | What they did step by step, the exact words of any error, the page link, and the device and browser |
| How something works, when no skill in this plugin covers it | General question | The question, and what they are trying to get done |
| Anything else | Other | What happened and what they need |

## What you can often solve without a request

Read the campaign first. Then check the plain causes:

- **"My page is not taking payments."** Read the campaign's status and end date. A draft, a completed campaign or one past its end date reads differently from a live one. Say what you see. If the page is live and still fails, it goes to support as Something's broken.
- **"The numbers look wrong."** Read the payment summary and compare it with what the organizer expects. If they match what PayIt2 reports, explain the numbers. If they do not, it goes to support.
- **"I cannot find someone's payment."** Search participants by name or email. If you find it, say so. If not, it goes to support with the name, date and email the payer used.
- **"How do I change my title, goal, date or theme?"** That is a setting change. Use the confirm-before-changing rule in `campaign-context`.
- **"How do I thank people or send a reminder?"** That is the engage skill.

If the plain cause is not there, do not keep guessing. Write the request.

## Template

```
Subject: <one line, under 80 characters, no names, emails or amounts>

What happened:
<two or three sentences in the person's own words>

Campaign:
<title and link, or "not about one campaign">

What I tried:
<what the person did, and what was checked, with what it showed>

What I need:
<the outcome they want>

Written with an AI assistant from my description.
```

## Example

```
Subject: Payout for our band trip fundraiser has not arrived

What happened:
Our fundraiser ended on November 3. My PayIt2 page shows the payout as pending, and nothing has reached our bank account yet.

Campaign:
Band Trip 2027, https://www.payit2.com/fundraiser/abc1234

What I tried:
I checked the payment summary today. It shows the total raised and a payout status of pending. I have not changed my bank details.

What I need:
To know when the payout will arrive, or what I need to do to release it.

Written with an AI assistant from my description.
```

## The link

`https://www.payit2.com/support?subject=<subject>&from=<campaign link>`

- URL-encode both values. A space becomes `%20`.
- `subject` fills in the form's Subject box.
- `from` tells support which page the request is about. Leave it off when there is no campaign link.
- Nothing else goes in the link: no names, emails, amounts or message text.

## Never in a request

Card numbers, bank account numbers, passwords, sign-in codes. Support never needs them.
