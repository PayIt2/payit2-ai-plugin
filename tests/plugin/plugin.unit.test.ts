import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PLUGIN = fileURLToPath(new URL("../../plugin/", import.meta.url));
const json = (rel: string) => JSON.parse(readFileSync(PLUGIN + rel, "utf8"));

describe("shipped plugin files", () => {
  it("bundles the production connector with no credentials", () => {
    expect(json(".mcp.json")).toEqual({
      mcpServers: { payit2: { type: "http", url: "https://mcp.payit2.com/mcp" } },
    });
  });

  it("is the payit2 plugin, shown as PayIt2 (D6)", () => {
    const manifest = json(".claude-plugin/plugin.json");
    expect(manifest.name).toBe("payit2");
    expect(manifest.displayName).toBe("PayIt2");
  });

  it("carries what the Claude directory requires: README, license, icon and a privacy link", () => {
    const readme = readFileSync(PLUGIN + "README.md", "utf8");
    const prose = readme.replace(/```[\s\S]*?```/g, "");
    expect(prose.split(/\s+/).filter(Boolean).length).toBeGreaterThanOrEqual(40);
    expect(readme).toContain("/plugin install payit2 --marketplace PayIt2/payit2-plugins-marketplace");
    expect(readme).toContain("https://www.payit2.com/privacy");
    expect(readme).toContain("mcp.payit2.com");
    expect(readFileSync(PLUGIN + "LICENSE", "utf8")).toMatch(/^MIT License/);
    expect(existsSync(PLUGIN + ".claude-plugin/icon.png")).toBe(true);
    const manifest = json(".claude-plugin/plugin.json");
    expect(manifest.license).toBe("MIT");
    expect(manifest.homepage).toBe("https://www.payit2.com/ai-assistant");
  });

  it("asks for no API key", () => {
    expect(json(".claude-plugin/plugin.json").userConfig).toBeUndefined();
  });

  it("quotes every hook path, so a plugin folder with a space in it still runs", () => {
    const hooks = json("hooks/hooks.json").hooks as Record<string, Array<{ hooks: Array<{ command: string }> }>>;
    const commands = Object.values(hooks).flatMap((groups) => groups.flatMap((g) => g.hooks.map((h) => h.command)));
    expect(commands).toHaveLength(3);
    for (const c of commands) expect(c).toMatch(/^"\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/[a-z-]+\.sh"$/);
  });

  const detect = (prompt: string) =>
    execFileSync(PLUGIN + "scripts/detect-campaign-url.sh", {
      input: JSON.stringify({ hook_event_name: "UserPromptSubmit", prompt }),
      encoding: "utf8",
    });

  it("detect-campaign-url.sh names a campaign link's type and slug in plain shell, without jq", () => {
    expect(readFileSync(PLUGIN + "scripts/detect-campaign-url.sh", "utf8")).not.toMatch(/\bjq\b/);
    const out = detect("How is https://www.payit2.com/event/sw9gsvg doing?");
    expect(out).toContain("[PayIt2 Campaign Detected: https://payit2.com/event/sw9gsvg]");
    expect(out).toContain("Type: event");
    expect(out).toContain("Slug: sw9gsvg");
    expect(out).toMatch(/get_campaign_overview/);
    expect(detect("Help me plan a 5K")).toBe("");
    // The link create_campaign hands a fundraiser (seen live 2026-11-18); the hook never fired on it.
    const fund = detect("How is https://collect.payit2.com/fund/xkg5aqs doing?");
    expect(fund).toContain("[PayIt2 Campaign Detected: https://collect.payit2.com/fund/xkg5aqs]");
    expect(fund).toContain("Type: fundraiser");
    expect(fund).toContain("Slug: xkg5aqs");
  });

  it("uses no prompt-type hooks, which Claude Code rejects or cannot ground", () => {
    const hooks = json("hooks/hooks.json").hooks as Record<string, Array<{ hooks: Array<{ type: string }> }>>;
    const types = Object.values(hooks).flatMap((groups) => groups.flatMap((g) => g.hooks.map((h) => h.type)));
    expect(types).not.toContain("prompt");
    expect(Object.keys(hooks).sort()).toEqual(["PreToolUse", "SessionStart", "UserPromptSubmit"]);
  });

  it("matches update_campaign_settings from the bundled, hand-added and e2e servers only", () => {
    const pre = json("hooks/hooks.json").hooks.PreToolUse[0];
    const matcher = new RegExp(pre.matcher);
    expect(matcher.test("mcp__plugin_payit2_payit2__update_campaign_settings")).toBe(true);
    expect(matcher.test("mcp__payit2__update_campaign_settings")).toBe(true);
    expect(matcher.test("mcp__payit2__update_campaign_question")).toBe(false);
    // claude.ai and Cowork may name a connector's server by id rather than "payit2"; the tool name is PayIt2's alone.
    expect(matcher.test("mcp__1a59c906-04da-521d-bda7-7f71b9f9e01c__update_campaign_settings")).toBe(true);
    expect(matcher.test("mcp__payit2__get_campaign_overview")).toBe(false);
  });

  const hook = (toolInput: unknown) =>
    execFileSync(PLUGIN + "scripts/confirm-settings-change.sh", {
      input: JSON.stringify({ tool_name: "mcp__payit2__update_campaign_settings", tool_input: toolInput }),
      encoding: "utf8",
    });

  it("confirm-settings-change.sh asks for approval on the saving call (confirm: true)", () => {
    const parsed = JSON.parse(hook({ campaignId: "c1", title: "New title", confirm: true }));
    expect(parsed.hookSpecificOutput.hookEventName).toBe("PreToolUse");
    expect(parsed.hookSpecificOutput.permissionDecision).toBe("ask");
    expect(parsed.hookSpecificOutput.permissionDecisionReason).toMatch(/organizer/i);
  });

  it("confirm-settings-change.sh lets the preview call through, since the server saves nothing without confirm (2.1.0)", () => {
    // Asking on the preview too made the organizer approve the same change twice.
    for (const input of [
      { campaignId: "c1", title: "New title" },
      { campaignId: "c1", title: "New title", confirm: false },
      { campaignId: "c1", themeId: "school", themeAccentColor: "#112233" },
      { campaignId: "c1", description: "<p>{\"confirm\": true}</p>" },
    ]) {
      expect(hook(input), JSON.stringify(input)).toBe("");
    }
  });

  it("confirm-settings-change.sh lets a theme-only call through, since the creation summary already showed it", () => {
    expect(hook({ campaignId: "c1", themeId: "charity-walk" })).toBe("");
    expect(hook({ campaignId: "c1", themeId: "charity-walk", confirm: true })).toBe("");
  });

  it("confirm-settings-change.sh asks on every saving call that changes anything besides the theme preset", () => {
    for (const input of [
      { campaignId: "c1", title: "New title", confirm: true },
      { campaignId: "c1", themeId: "school", title: "New title", confirm: true },
      { confirm: true, campaignId: "c1", themeId: "school", themeAccentColor: "#112233" },
      { campaignId: "c1", themeId: null, confirm: true },
      { campaignId: "c1", description: "<p>{\"themeId\":\"school\"}</p>", confirm: true },
    ]) {
      expect(JSON.parse(hook(input)).hookSpecificOutput.permissionDecision, JSON.stringify(input)).toBe("ask");
    }
  });

  it("confirm-settings-change.sh asks when it cannot read the call, rather than letting a save through", () => {
    const out = execFileSync(PLUGIN + "scripts/confirm-settings-change.sh", { input: "not json", encoding: "utf8" });
    expect(JSON.parse(out).hookSpecificOutput.permissionDecision).toBe("ask");
  });

  it("session-start.sh prints context and does not greet a signed-out organizer", () => {
    const out = execFileSync(PLUGIN + "scripts/session-start.sh", { input: "{}", encoding: "utf8" });
    expect(out).toMatch(/list_my_campaigns/);
    expect(out).toMatch(/do not greet/i);
    expect(out).not.toMatch(/[—–]/);
  });

  it("session-start.sh offers an organizer with no campaigns both paths: ask what PayIt2 can do, or /campaign (get-started)", () => {
    const out = execFileSync(PLUGIN + "scripts/session-start.sh", { input: "{}", encoding: "utf8" });
    expect(out).toMatch(/If they have no campaigns, greet them and say in one line that they can ask what PayIt2 can do for them/);
    expect(out).toMatch(/get-started skill/);
    expect(out).toMatch(/or run \/campaign if they already know what they want to make/);
  });

  it("session-start.sh keeps Claude helping in standalone mode after the one sign-in mention", () => {
    // Without this, a signed-out organizer who asks 'how is my campaign doing?' got only 'sign in and ask again'.
    const out = execFileSync(PLUGIN + "scripts/session-start.sh", { input: "{}", encoding: "utf8" });
    expect(out).toMatch(/campaign-context skill/);
    expect(out).toMatch(/signing in to PayIt2 lets you pull those numbers/);
    expect(out).toMatch(/Customize > Plugins/);
    expect(out).toMatch(/Connectors tab/);
    // Prod accepts Claude Code's loopback sign-in since 2026-11-06 (app-v2 B-378 D).
    expect(out).toMatch(/in Claude Code, run \/mcp/);
    expect(out).not.toMatch(/not available yet/);
    expect(out).toMatch(/ask for their numbers/i);
    expect(out).toMatch(/never stop at the sign-in message/i);
  });

  it("names one hooks module, the page preview card, which makes no network request (2.2.0)", () => {
    expect(json("hooks/hooks.json").modules).toEqual(["./register.tsx"]);
    const source = readFileSync(PLUGIN + "hooks/register.tsx", "utf8");
    expect(source).not.toMatch(/\bfetch\(|\$\.(http|net|fs|process)\b/);
    expect(source).not.toMatch(/[—–]/);
    expect(readFileSync(PLUGIN + "hooks/register.test.tsx", "utf8")).toContain("plugin: 'payit2'");
  });

  it("drops the Stop hook's orphaned script", () => {
    expect(existsSync(PLUGIN + "scripts/save-summary.sh")).toBe(false);
  });

  it("keeps zip's temp files out of the repo root (2.1.0 shipped a broken zinHZLH5)", () => {
    const root = PLUGIN + "../";
    expect(readdirSync(root).filter((n) => /^zi[A-Za-z0-9]{6}$/.test(n))).toEqual([]);
  });
});

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function textFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return textFiles(path);
    return /\.(md|sh|json)$/.test(name) ? [path] : [];
  });
}
const allText = () => textFiles(PLUGIN).map((f) => ({ f, t: readFileSync(f, "utf8") }));

describe("plugin copy", () => {
  it("tells organizers to choose PayIt2, the plugin's display name since 2.0.0", () => {
    const hits = allText().filter(({ t }) => /choose \**PayIt2 Campaign Assistant/.test(t)).map(({ f }) => f.replace(PLUGIN, ""));
    expect(hits).toEqual([]);
  });

  it("never promises that saving posts, publishes or notifies anyone (D9)", () => {
    const bad = /(campaign(?:'s)? (?:update )?feed|show(?:s)? up in the organizer's dashboard|appear in the organizer's dashboard|notifies existing participants)/i;
    const hits = allText().filter(({ t }) => bad.test(t)).map(({ f }) => f.replace(PLUGIN, ""));
    expect(hits).toEqual([]);
  });

  it("no longer says saved content goes unseen, now that PayIt2 shows it to the organizer (D9, app-v2 #1844)", () => {
    const stale = /(not shown (?:on the campaign page|in their dashboard|in the organizer's account)|does not appear (?:on the campaign page|in their dashboard)|keep a record|kept as a record)/i;
    const hits = allText().filter(({ t }) => stale.test(t)).map(({ f }) => f.replace(PLUGIN, ""));
    expect(hits).toEqual([]);
    expect(readFileSync(PLUGIN + "skills/campaign-context/SKILL.md", "utf8")).toMatch(/`list_saved_content`/);
  });

  it("routes any create request to the campaign skill, not straight to create_campaign (2.1.1)", () => {
    // "Create a payit2 fundraiser" called create_campaign bare, skipping template, theme and giving levels.
    const skill = readFileSync(PLUGIN + "skills/campaign/SKILL.md", "utf8");
    const description = /^description: (.+)$/m.exec(skill)?.[1] ?? "";
    expect(description).toMatch(/^Use whenever/);
    expect(description).toMatch(/create/i);
    expect(description).toMatch(/fundraiser/i);
    expect(description).toMatch(/before calling create_campaign/);
    const ctx = readFileSync(PLUGIN + "skills/campaign-context/SKILL.md", "utf8");
    expect(ctx).toMatch(/Creating a campaign always goes through the `campaign` skill/);
  });

  it("writes saved drafts as plain paragraphs, as the save_* tools ask; only the description is HTML (2.1.1)", () => {
    for (const rel of ["skills/campaign/SKILL.md", "skills/campaign/references/enrich-guide.md"]) {
      const t = readFileSync(PLUGIN + rel, "utf8");
      const html = /HTML fields?[^\n]*\n(?:[^\n]+\n)*/.exec(t)?.[0] ?? "";
      expect(html, rel).not.toMatch(/save_(campaign_story|update_post|thank_you)/);
      expect(t, rel).toMatch(/Saved drafts \(plain paragraphs/);
    }
  });

  it("no longer asks for an API key", () => {
    const hits = allText().filter(({ t }) => /API key/i.test(t)).map(({ f }) => f.replace(PLUGIN, ""));
    expect(hits).toEqual([]);
  });

  it("tells the organizer how to sign in exactly where the light mention lives, from the connection steps for this chat", () => {
    const ctx = readFileSync(PLUGIN + "skills/campaign-context/SKILL.md", "utf8");
    expect(ctx).toMatch(/once per conversation/i);
    expect(ctx).toMatch(/references\/connect\.md/);
  });

  it("keeps the Claude connection steps in one file the ChatGPT package replaces (2.1.0)", () => {
    const connect = readFileSync(PLUGIN + "skills/campaign-context/references/connect.md", "utf8");
    expect(connect).toMatch(/Customize > Plugins/);
    expect(connect).toMatch(/Connectors/);
    expect(connect).toMatch(/Continue with Google/);
    expect(connect).toMatch(/Email me a sign-in link/);
    expect(connect).toMatch(/Claude Code/);
    expect(connect).toMatch(/\/mcp/);
    expect(connect).not.toMatch(/not available yet|coming soon/i);
  });

  it("no skill names Claude or its menus, so the same skills read right in ChatGPT (2.1.0)", () => {
    const skills = allText().filter(({ f }) => f.includes("/skills/") && !f.endsWith("references/connect.md"));
    const hits = skills
      .filter(({ t }) => /\bClaude\b|Customize > Plugins|Cowork|claude\.ai|\/mcp\b/.test(t.replace(/From Claude card/g, "")))
      .map(({ f }) => f.replace(PLUGIN, ""));
    expect(hits).toEqual([]);
  });

  it("states the confirm-before-changing rule in the skills, through the server's preview (hooks do not run in every chat)", () => {
    for (const rel of ["skills/campaign-context/SKILL.md", "skills/campaign/SKILL.md"]) {
      expect(readFileSync(PLUGIN + rel, "utf8")).toMatch(/current and new value/i);
    }
    const ctx = readFileSync(PLUGIN + "skills/campaign-context/SKILL.md", "utf8");
    expect(ctx).toMatch(/preview/i);
    expect(ctx).toMatch(/confirm: true/);
  });

  it("the shared skill opens a session and handles campaign links on its own, where hooks do not run (2.1.0)", () => {
    const ctx = readFileSync(PLUGIN + "skills/campaign-context/SKILL.md", "utf8");
    const description = ctx.match(/^description: (.*)$/m)?.[1] ?? "";
    expect(description).toMatch(/payit2\.com campaign link/i);
    expect(ctx).toMatch(/## Start of a conversation/);
    expect(ctx).toMatch(/call `list_my_campaigns` once/i);
    expect(ctx).toMatch(/payit2\.com\/fundraiser\//);
    expect(ctx).toMatch(/payit2\.com\/event\//);
    expect(ctx).toMatch(/payit2\.com\/group\//);
    expect(ctx).toMatch(/`get_campaign_overview`/);
  });

  it("has no em or en dashes, so the templates never teach Claude to write them for organizers (§16)", () => {
    const hits = allText().filter(({ t }) => /[—–]/.test(t)).map(({ f }) => f.replace(PLUGIN, ""));
    expect(hits).toEqual([]);
  });

  it("each skill an organizer runs carries the no-em-dash rule, since campaign-context may not load", () => {
    for (const skill of ["get-started", "campaign", "check-in", "promote", "engage", "support", "campaign-context"]) {
      expect(readFileSync(PLUGIN + `skills/${skill}/SKILL.md`, "utf8")).toMatch(/No em dashes in anything you write for the organizer/);
    }
  });

  it("the campaign skill gets a page up fast: basics in one message, one confirmation, publish, then the link (1.8.0)", () => {
    const skill = readFileSync(PLUGIN + "skills/campaign/SKILL.md", "utf8");
    expect(skill).toMatch(/basics in one message/i);
    expect(skill).toMatch(/Confirm once/i);
    expect(skill).toMatch(/publish: true/);
    expect(skill).toMatch(/Lead with the link/i);
    expect(skill).toMatch(/list_theme_presets/);
    // The page shows the date, venue and prices itself; the description must not repeat them.
    expect(skill).toMatch(/Do not repeat what the page already shows/);
    // No menus before the campaign exists.
    expect(skill).not.toMatch(/Generate 5 Title Options/i);
    expect(skill).not.toMatch(/present 3-5 options/i);
    expect(existsSync(PLUGIN + "skills/campaign/references/enrich-guide.md")).toBe(true);
  });

  it("puts tiers for different people (adult, kid, student) in a pick-any group, so a household registers together (2.1.0)", () => {
    // Brian 2026-11-09: a family RSVP for 2 adults and 3 kids was impossible when Adult and Kid
    // sat in a pick-one group; a pick-any group takes a quantity on each option.
    const skill = readFileSync(PLUGIN + "skills/campaign/SKILL.md", "utf8");
    const ticketsRow = skill.split("\n").find((l) => l.startsWith("| Event tickets")) ?? "";
    expect(ticketsRow).not.toMatch(/\(choose one\)/);
    expect(ticketsRow).toMatch(/groupMode: "pick_any"/);
    expect(ticketsRow).toMatch(/household/i);
    expect(ticketsRow).toMatch(/groupMode: "pick_one"/); // still right for mutually exclusive choices
    const enrich = readFileSync(PLUGIN + "skills/campaign/references/enrich-guide.md", "utf8");
    expect(enrich).toMatch(/pick_any/);
  });

  it("never sends Claude to Unsplash+ photos, which need a paid license", () => {
    const hits = allText().filter(({ t }) => /plus\.unsplash\.com\/premium|including plus\.unsplash/i.test(t)).map(({ f }) => f.replace(PLUGIN, ""));
    expect(hits).toEqual([]);
  });

  it("the campaign skill helps a new organizer connect, steering them to the sign-in choices that create an account", () => {
    const skill = readFileSync(PLUGIN + "skills/campaign/SKILL.md", "utf8");
    expect(skill).toMatch(/campaign-context\/references\/connect\.md/);
    expect(skill).toMatch(/Continue with Google/);
    expect(skill).toMatch(/Email me a sign-in link/);
  });

  describe("the support skill (2.4.0)", () => {
    const skill = () => readFileSync(PLUGIN + "skills/support/SKILL.md", "utf8");
    const guide = () => readFileSync(PLUGIN + "skills/support/references/support-request-guide.md", "utf8");

    it("triggers on any problem or request for help, and says the person sends the request", () => {
      const description = /^description: (.+)$/m.exec(skill())?.[1] ?? "";
      expect(description).toMatch(/^Use whenever/);
      expect(description).toMatch(/problem/i);
      expect(description).toMatch(/refund/i);
      expect(description).toMatch(/support/i);
      expect(description).toMatch(/sends it themselves/i);
      // claude.ai folds a skill description at 1,024 characters.
      expect(description.length).toBeLessThanOrEqual(1024);
    });

    it("never sends a request itself, with or without someone watching", () => {
      expect(skill()).toMatch(/You never send the request/);
      expect(skill()).toMatch(/Do not fill in or submit that form/);
      expect(skill()).toMatch(/nobody watching/);
    });

    it("reads the campaign before answering and never guesses its state", () => {
      for (const tool of ["get_campaign_overview", "get_campaign_health", "get_payment_summary", "search_participants"]) {
        expect(skill()).toContain("`" + tool + "`");
      }
      expect(skill()).toMatch(/Never guess at a campaign's state/);
    });

    it("sends refunds, payouts, disputes, fees and account access to support, with no policy from memory", () => {
      const s = skill();
      for (const word of [/refunds/, /payouts/, /disputes/i, /fees/, /account access/]) expect(s).toMatch(word);
      expect(s).toMatch(/do not state a policy, a fee, a time frame or a promise/);
      expect(s).toMatch(/Do not promise how fast/);
    });

    it("keeps secrets and other people's details out of a request", () => {
      for (const t of [skill(), guide()]) {
        expect(t).toMatch(/card numbers, bank account numbers, passwords, sign-in codes/i);
      }
      expect(skill()).toMatch(/Do not paste in the conversation/);
      expect(skill()).toMatch(/only what the person told you or approved/i);
    });

    it("hands over the production support form link, carrying only the subject and the campaign link", () => {
      for (const t of [skill(), guide()]) {
        expect(t).toContain("https://www.payit2.com/support?subject=");
        expect(t).toMatch(/&from=/);
      }
      expect(skill()).toMatch(/Put nothing else in the link/);
      // The form's own choices (app-v2 support-form.tsx), so the person finds the one named.
      for (const label of ["General question", "Something's broken", "Billing or payouts", "Account or login", "Other"]) {
        expect(skill()).toContain(label);
        expect(guide()).toContain(label);
      }
    });

    it("does not push sign-in, since the support form works for anyone", () => {
      expect(skill()).toMatch(/Do not bring up signing in here/);
      expect(skill()).not.toMatch(/connect\.md/);
    });

    it("names no server tool that does not exist yet (sending from chat waits on app-v2)", () => {
      for (const t of [skill(), guide()]) expect(t).not.toMatch(/support_request|open_support|list_support|reply_to_support/);
      expect(skill()).toMatch(/You cannot read their requests or replies from here/);
    });

    it("is where campaign-context sends problems and requests for help", () => {
      const ctx = readFileSync(PLUGIN + "skills/campaign-context/SKILL.md", "utf8");
      expect(ctx).toMatch(/Problems and requests for help go through the `support` skill/);
    });
  });

  it("no skill tells Claude to stay silent about signing in", () => {
    const hits = allText().filter(({ t }) => /without comment/i.test(t)).map(({ f }) => f.replace(PLUGIN, ""));
    expect(hits).toEqual([]);
  });
});

describe("get-started skill", () => {
  const skill = readFileSync(PLUGIN + "skills/get-started/SKILL.md", "utf8");
  const ideas = readFileSync(PLUGIN + "skills/get-started/references/ideas.md", "utf8");
  const description = /^description: (.+)$/m.exec(skill)?.[1] ?? "";

  it("triggers on the newcomer's questions, in Brian's words (2026-11-21)", () => {
    expect(/^name: (.+)$/m.exec(skill)?.[1]).toBe("get-started");
    expect(description).toMatch(/^Use whenever/);
    expect(description).toMatch(/how do I get started\?/i);
    expect(description).toMatch(/what can I do with this\?/i);
    expect(description).toMatch(/show me an example/i);
    expect(description).toMatch(/ideas/i);
    // The plugin directory caps a skill description at 1,024 characters.
    expect(description.length).toBeLessThanOrEqual(1024);
    expect(description).not.toMatch(/[<>]/);
  });

  it("leaves create requests to the campaign skill, and never claims create_campaign for itself", () => {
    expect(description).toMatch(/Not for someone who has already decided/);
    expect(description).toMatch(/goes to the campaign skill/);
    expect(description).not.toMatch(/create_campaign/);
    // The campaign skill keeps its own trigger; get-started must not weaken it.
    const campaign = /^description: (.+)$/m.exec(readFileSync(PLUGIN + "skills/campaign/SKILL.md", "utf8"))?.[1] ?? "";
    expect(campaign).toMatch(/always before calling create_campaign/);
    expect(campaign).not.toMatch(/get started|ideas|example/i);
    expect(skill).toMatch(/stop exploring and hand off to `campaign`/);
  });

  it("asks one question before the ideas, not an interview", () => {
    expect(skill).toMatch(/## Step 2: Ask one question/);
    expect(skill).toMatch(/What do you run or organize\?/);
    expect(skill).toMatch(/That is the only question before the ideas/);
    expect(skill).toMatch(/Never re-ask/);
  });

  it("names only templates PayIt2 returned, since the catalog in the repo can run ahead of production", () => {
    expect(skill).toMatch(/call `list_templates` once/);
    expect(skill).toMatch(/Name no template that the tool did not return/);
    expect(ideas).toMatch(/use a slug only if it came\s+back/);
  });

  it("makes an example page a private draft with Example in the title, after one yes, and never publishes it", () => {
    expect(skill).toMatch(/starts with `Example: `/);
    expect(skill).toMatch(/This is an example page\. Nothing on it is real\./);
    expect(skill).toMatch(/get a yes before creating it/);
    expect(skill).toMatch(/Leave `publish` off/);
    expect(skill).toMatch(/Do not publish one, even if asked/);
    expect(skill).not.toMatch(/publish: true/);
    expect(skill).toMatch(/no donations or sign-ups on it yet/);
  });

  it("gives an example page its own made-up options, since a page made from chat gets none of the template's (Brian, 2026-11-21)", () => {
    // create_campaign with templateSlug skips the website's separate clone-template-options step, so a
    // group-trip example made from the template alone showed only an open "choose an amount" box.
    expect(skill).toMatch(/`options`: always write the example's own options/);
    expect(skill).not.toMatch(/Keep what the template supplies for options/);
    for (const type of ["Group payment", "Event", "Fundraiser"]) expect(skill).toMatch(new RegExp(`\\*\\*${type}:\\*\\*`));
    expect(skill).toMatch(/Every option gets a `groupTitle`/);
    expect(skill).toMatch(/name no real business or venue/);
    expect(skill).toMatch(/Do not repeat the prices in the description/);
  });

  it("never builds an example around a real person's hardship", () => {
    expect(skill).toMatch(/Do not write an example about a real person's illness, loss or legal trouble/);
  });

  it("keeps example drafts from piling up, since the connector has no delete tool", () => {
    expect(skill).toMatch(/Call `list_my_campaigns`/);
    expect(skill).toMatch(/title starts with "Example:" is already there/);
    expect(skill).toMatch(/One example page per conversation/);
    expect(skill).toMatch(/delete it from the campaign's settings/);
    // No tool by that name exists; the skill must not send Claude looking for one.
    expect(skill).not.toMatch(/delete_campaign\b/);
  });

  it("offers make it real, change it or leave it, and make it real builds a fresh page through campaign", () => {
    expect(skill).toMatch(/\*\*Make it real\.\*\*/);
    expect(skill).toMatch(/\*\*Change it\.\*\*/);
    expect(skill).toMatch(/\*\*Leave it\.\*\*/);
    expect(skill).toMatch(/\*\*Make it real\*\* hands off to the `campaign` skill/);
    expect(skill).toMatch(/It does not rename the example/);
    expect(skill).toMatch(/current and new value/);
  });

  it("still helps when PayIt2 is not connected: describes the page, links to payit2.com, mentions sign-in once", () => {
    expect(skill).toMatch(/### When PayIt2 tools are not available/);
    expect(skill).toMatch(/campaign-context\/references\/connect\.md/);
    expect(skill).toMatch(/the conversation's one sign-in mention/);
    expect(skill).toMatch(/Do not stop at the sign-in message/);
    const ctx = readFileSync(PLUGIN + "skills/campaign-context/SKILL.md", "utf8");
    expect(ctx).toMatch(/asks the `get-started` skill for an example page/);
    expect(ctx).toMatch(/once per conversation/i);
  });

  it("says plainly what PayIt2 is not for, and quotes no fees from memory", () => {
    expect(skill).toMatch(/## Is PayIt2 the right fit\?/);
    expect(skill).toMatch(/It is not built for/);
    expect(skill).toMatch(/payit2\.com\/fees/);
    expect(skill).not.toMatch(/\d(?:\.\d+)?%/);
  });

  it("hands off to the four working skills and the support skill by name", () => {
    for (const name of ["campaign", "check-in", "promote", "engage", "support"]) expect(skill).toContain("| `" + name + "` |");
    const ctx = readFileSync(PLUGIN + "skills/campaign-context/SKILL.md", "utf8");
    expect(ctx).toMatch(/Someone new, or not sure what to make, goes to the `get-started` skill/);
    expect(ctx).toMatch(/they can ask what PayIt2 can do for them/);
  });

  // Each address answered 200 on 2026-11-21. A new one must be checked by hand and added here.
  const CHECKED = [
    "https://www.payit2.com/use-cases/",
    "https://www.payit2.com/use-cases/schools-clubs/",
    "https://www.payit2.com/use-cases/leagues-sports/",
    "https://www.payit2.com/use-cases/religious-groups/",
    "https://www.payit2.com/use-cases/fundraisers-causes/",
    "https://www.payit2.com/use-cases/group-payments/",
    "https://www.payit2.com/use-cases/group-gifts/",
    "https://www.payit2.com/use-cases/trips-travel/",
    "https://www.payit2.com/use-cases/medical-funds/",
    "https://www.payit2.com/use-cases/emergency-relief/",
    "https://www.payit2.com/use-cases/events-tickets/",
    "https://www.payit2.com/use-cases/arts-creative/",
    "https://www.payit2.com/use-cases/community-projects/",
    "https://www.payit2.com/how-it-works",
    "https://www.payit2.com/fees",
    "https://www.payit2.com/support",
  ];

  it("points only to payit2.com pages that were checked, so it never invents one", () => {
    const full = [...ideas.matchAll(/https:\/\/www\.payit2\.com[^\s)|]*/g)].map((m) => m[0]);
    expect(full.length).toBeGreaterThan(10);
    expect([...new Set(full)].sort()).toEqual([...CHECKED].sort());
    const bare = [...skill.matchAll(/payit2\.com\/[a-z-]+/g)].map((m) => "https://www." + m[0]);
    for (const url of bare) expect(CHECKED, url).toContain(url);
    expect(skill).toMatch(/Use only links from this\s+file|from `references\/ideas\.md`/);
  });

  it("covers ten kinds of organizer plus a fallback, each with three or more ideas across the page types", () => {
    const sections = ideas.split(/^## /m).slice(1).filter((s) => !s.startsWith("More payit2.com pages"));
    expect(sections).toHaveLength(11);
    for (const s of sections) {
      const rows = s.split("\n").filter((l) => /^\| .*`[a-z0-9-]+`/.test(l));
      expect(rows.length, s.split("\n")[0]).toBeGreaterThanOrEqual(3);
      for (const r of rows) expect(r.split("|")[2].trim(), r).toMatch(/^(Event|Fundraiser|Group payment)$/);
    }
    expect(ideas.split(/^## /m).find((s) => s.startsWith("Not sure yet"))).toMatch(/Event[\s\S]*Fundraiser[\s\S]*Group payment/);
  });

  it("ships in the README's skill list and in the zip's source folder", () => {
    expect(readFileSync(PLUGIN + "../README.md", "utf8")).toMatch(/\| `\/get-started` \|/);
    expect(existsSync(PLUGIN + "skills/get-started/references/ideas.md")).toBe(true);
  });
});
