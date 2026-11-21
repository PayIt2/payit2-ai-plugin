---
name: get-started
description: Use whenever someone is new to PayIt2 or unsure what to do with it and asks things like "how do I get started?", "what can I do with this?", "what is PayIt2 for?", "give me ideas", "show me an example" or "would this work for my PTA, team, church, club or group?", even if they never say PayIt2. Asks one question about what they run, shows three or four real ways PayIt2 would help them, and can set up a private example page to look at. Not for someone who has already decided what to make ("create a fundraiser for X", "set up tickets for our 5K"): that goes to the campaign skill.
allowed-tools: Read
argument-hint: "[optional: what you run or organize, e.g. a PTA, a youth soccer league]"
---

# Get Started

Help someone who is new to PayIt2 see what it would do for them: $ARGUMENTS

This skill is the front door. The person has not decided anything yet. They want to know what is possible, see it, and then choose. Give them ideas that fit their world, show one as an example if they want, and hand them to the skill that does the next step.

**No em dashes in anything you write for the organizer.** Use a comma, colon or period instead; PayIt2's style forbids them.

**How this skill differs from `campaign`:** `campaign` is for someone who knows what they want, so it moves fast and asks almost nothing. This skill is for someone still looking, so it shows a short menu and lets them pick. If at any point they say what they want to make ("ok, let's do the 5K"), stop exploring and hand off to `campaign`.

**Keep it short.** A newcomer who gets a wall of text leaves. Each reply is a few lines and ends with one clear next step.

---

## What PayIt2 is, in one sentence

Use this, or words close to it, whenever you need to say what PayIt2 does:

> PayIt2 gives you one page where people pay: a fundraiser for a cause, an event with tickets or sign-ups, or a group payment for a shared cost like dues or a trip.

The three page types, with the plain name to use for each:

| Page type | What it is for | Examples |
|---|---|---|
| Fundraiser | Raising money toward a goal | A medical fund, a school fundraiser, a memorial, a building fund |
| Event | Tickets, registrations or free sign-ups | A 5K, a golf outing, a fall festival, a class, a reunion |
| Group payment | Everyone paying their share | Team dues, a group gift, a shared vacation house, spirit wear orders |

---

## Step 1: Answer the question they asked

| They ask | Do this |
|---|---|
| "How do I get started?" | Say the one sentence. Then ask the one question in Step 2. |
| "What can I do with this?" | Say the one sentence and give one example per page type. Then ask the one question. |
| "Would this work for my (PTA, team, church...)?" | They already told you what they run. Skip the question and go to Step 3. |
| "Show me an example" | If you know what they run, go to Step 4 with the idea that fits best. If not, ask the one question first. |
| "I'm not sure this fits what I do" | Go to "Is PayIt2 the right fit?" below. |

Never re-ask something already said in the conversation or the arguments.

---

## Step 2: Ask one question

> What do you run or organize? A school group, a team, a church, a club, a nonprofit, or something for family and friends? A rough answer is fine.

That is the only question before the ideas. Do not ask about dates, amounts, audience or goals here. Those belong to `campaign`, after the person has chosen something.

If they would rather not say, or say "just show me", skip ahead with the "Not sure yet" row in `references/ideas.md`.

---

## Step 3: Show three or four ideas that fit them

1. Find their kind of organizer in `references/ideas.md` and read its ideas.
2. If PayIt2 tools are available, call `list_templates` once. Keep only ideas whose template came back in that list, and use the names PayIt2 gives. Name no template that the tool did not return. If the tools are not available, use the ideas as written and name no template slugs.
3. Pick three or four. Mix the page types when their world has more than one. If they already have campaigns (you may know this from `list_my_campaigns`), lean toward page types they have not tried.
4. Write each idea as one line: what the page is, what people do on it, what the organizer gets. Use their own words for their group.

For example, for a PTA:

> Here is what PayIt2 would do for a PTA:
> 1. **Fall festival tickets.** Families buy wristbands ahead of time, adults and kids on one order, and you see the headcount before the day.
> 2. **Spirit wear orders.** Parents pick sizes and pay in one place. You get one list to send to the printer.
> 3. **A classroom or school fundraiser.** A goal, a progress bar and giving levels, with a page you can text to every family.
> 4. **Field trip money.** Each family pays their share by the deadline, and you can see who has not paid yet.
>
> Want to see one of these as an example page, make one for real, or look at more ideas?

End every ideas reply with that same three-way choice. When they want more ideas, show different ones from the file, or the section link from the file so they can browse on payit2.com.

---

## Step 4: The example page

An example page lets the person click through a real PayIt2 page before deciding anything. What you can do depends on whether PayIt2 is connected.

### When PayIt2 tools are available

**Check first.** Call `list_my_campaigns`. If a draft whose title starts with "Example:" is already there, tell them and offer that one instead of making another. Make a new one only if they ask for it. One example page per conversation is the limit unless they ask for more: there is no way to delete a page from this chat, so extra examples sit in their account until they remove them by hand.

**Ask once.** An example page is written to their PayIt2 account, so get a yes before creating it:

> I can set up an example page for the fall festival in your PayIt2 account. It is a private draft, so nobody else can see it, and you can delete it any time. Want me to?

**Create it** with `create_campaign`:

- `templateSlug`: the template for the idea they picked, from the `list_templates` reply.
- `title`: starts with `Example: `, then a believable name built on what they run, such as "Example: Lincoln PTA Fall Festival". Keep "Example: " at the front. It is the only thing that marks the page as an example.
- `description` (HTML, as the `campaign` skill's formatting rules describe): the first paragraph is exactly `<p><strong>This is an example page. Nothing on it is real.</strong></p>`, then two or three short paragraphs of made-up but believable detail.
- The other fields the page type needs (a goal, or an event date a few weeks out with a made-up venue). Keep the template's questions.
- `options`: always write the example's own options, in this same call. A page made from chat does not get the template's options: the website copies them in a separate step that this connection skips. Without your own, the page shows only an open "choose an amount" box, which tells the person nothing about how their page would work. Make them up, but price them the way a real organizer would:
  - **Group payment:** the shares people pay, in one required group, worked out the way `../campaign/references/cost-splitting-guide.md` (campaign/references/cost-splitting-guide.md) does: one per-person share, or two or three tiers when people take part differently. Add an optional "Add-ons" group (`pick_any`, `isRequired: false`) only when the idea has natural extras. For a ski trip: "Your Share" (`pick_one`) with "Full trip, 4 nights" at $650 and "Weekend only, 2 nights" at $350, then "Add-ons" with "Lift tickets, 3 days" at $450 and "Ski or snowboard rental" at $180.
  - **Event:** ticket tiers in a required "Tickets" group, `pick_any` when people come together (Adult $25, Kid $10), as the `campaign` skill sets event tickets.
  - **Fundraiser:** three or four amounts in an optional "Giving Levels" group (`pick_one`), or "What your gift covers" (`pick_any`) when each amount pays for a named thing in the made-up cause.
  - Every option gets a `groupTitle`, and the rules under "Option groups" in `../campaign/references/enrich-guide.md` apply. Use round dollar amounts. Option titles are plain text and name no real business or venue. Do not repeat the prices in the description: the page shows them.
- Leave `publish` off. An example page is a draft and stays a draft. Do not publish one, even if asked: if they want it live, that is "make it real" below.

For a fundraiser example, invent the cause ("a new playground", "the band's spring trip"). Do not write an example about a real person's illness, loss or legal trouble, even one the person mentioned. A made-up page about a real hardship reads badly if anyone sees it.

**Hand it over.** Lead with the link. Then say, in a few lines:

- It is a private draft. The link works for them while they are signed in to PayIt2.
- It has no donations or sign-ups on it yet, because it is new. A real page fills in as people pay.
- How to remove it: open it in PayIt2 and delete it from the campaign's settings.

Then offer the three choices in Step 5.

### When PayIt2 tools are not available

Do all three, in this order, in one reply:

1. **Describe the page in words:** the title it would have, what sits on it, and the made-up options it would carry, with prices, built the way the `options` rules above describe.
2. **Give the link** to the matching section on payit2.com from `references/ideas.md`, so they can see real pages of that kind.
3. **Say once** that connecting PayIt2 lets you build an example page they can click through, and give the connection steps for this chat from `../campaign-context/references/connect.md` (campaign-context/references/connect.md). This is the conversation's one sign-in mention (see `campaign-context`). If it was already used, leave this step out.

Then carry on. Do not stop at the sign-in message.

---

## Step 5: After the example

Offer these three together, every time:

> What would you like to do with it?
> 1. **Make it real.** Tell me your actual details and I will build your live page.
> 2. **Change it.** Try a different look, or see a different idea as an example.
> 3. **Leave it.** It stays a private draft. Nothing else happens.

**Make it real** hands off to the `campaign` skill. Pass along the page type, the template and everything they have told you, so `campaign` asks only for what is missing. `campaign` builds a fresh page with their real facts. It does not rename the example: an event's date, venue and tickets cannot be changed from this chat, so a converted example would be half made-up. After the real page exists, remind them once that the example draft is still in their account and how to delete it.

**Change it:** a different theme goes through `update_campaign_settings` with the confirm-before-changing rule in `campaign-context` (show the current and new value, wait for a clear yes). A different idea means another example page, so say that it adds a second draft and ask first.

**Leave it:** say that is fine, and stop. Do not follow up or nudge.

---

## Is PayIt2 the right fit?

Be honest. A person who hears a straight "this is not what PayIt2 is for" trusts the rest of what you say.

**It fits** when many people each pay toward one shared thing: a cause, an event, or a shared cost. A clear owner sets it up, shares one link, and wants to see who has paid.

**It is not built for:**

- An online store with a catalog, inventory and shipping.
- Sending invoices to clients or customers.
- Payroll or paying staff.
- Paying one friend back for lunch.

If what they describe is on that list, say so plainly and do not stretch a template to cover it. If part of what they do fits (a studio that sells classes also runs a recital with tickets), name the part that fits.

For questions about cost, give the link payit2.com/fees and do not quote numbers from memory. For how it works end to end, payit2.com/how-it-works.

---

## Where to hand off

| They now want | Go to |
|---|---|
| To make a page for real | `campaign` |
| To know how a page they already have is doing | `check-in` |
| To get the word out | `promote` |
| To thank, update or remind people | `engage` |
| Help with a problem (a sign-in, a payment, a payout) | Not this skill. Answer what you can and point them to payit2.com/support |

Hand off as soon as they choose. Do not finish the tour first.

---

## Additional Resources

- **`references/ideas.md`** - Ten kinds of organizer, with three or four real uses each, the template each one starts from, and the payit2.com section to browse
