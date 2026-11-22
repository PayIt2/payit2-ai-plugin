import { describe, it, expect } from "vitest";
import { parseStream } from "./stream.js";
import { checkGetStarted, checkNotSignedIn, checkSupportHandOff, SCENARIOS } from "./scenarios.js";

const BUNDLED = "plugin:payit2:payit2";

// Line shapes copied from live runs (CLI 2.1.252): the init status of the bundled server is "pending" in
// both the signed-out and the failed case, so the failure only shows up in the ToolSearch result.
function run(opts: { failedError?: string; reply: string }) {
  const toolResult = opts.failedError
    ? {
        type: "user",
        message: { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: `No matching deferred tools found. Note: these configured MCP servers failed to connect, so their tools are unavailable for this session: ${BUNDLED}: "${opts.failedError}".` }] },
        tool_use_result: { matches: [], query: "list_my_campaigns", total_deferred_tools: 14, failed_mcp_servers: [{ name: BUNDLED, error: opts.failedError }] },
      }
    : {
        type: "user",
        message: { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "No matching deferred tools found" }] },
        tool_use_result: { matches: [], query: "list_my_campaigns", total_deferred_tools: 14 },
      };
  return parseStream([
    { type: "system", subtype: "init", claude_code_version: "2.1.252", plugins: [{ name: "payit2" }], mcp_servers: [{ name: BUNDLED, status: "pending" }], tools: ["ToolSearch"] },
    { type: "assistant", message: { content: [{ type: "tool_use", id: "t1", name: "ToolSearch", input: { query: "list_my_campaigns" } }] } },
    toolResult,
    { type: "assistant", message: { content: [{ type: "text", text: opts.reply }] } },
    { type: "result", subtype: "success", result: opts.reply, is_error: false, total_cost_usd: 0.05, permission_denials: [] },
  ].map((l) => JSON.stringify(l)).join("\n"));
}

const SIGNED_OUT_REPLY =
  "You're not signed in to PayIt2 yet, so I can't pull your live numbers automatically. In Claude Code, run `/mcp`, choose payit2, and sign in (on claude.ai, connect PayIt2 under Settings, Connectors).\n\n" +
  "In the meantime, I can still help. Just tell me the current stats for the Spring Legal Defense Fund:\n- Amount raised and goal\n- Number of supporters\n- Days active so far";

describe("checkNotSignedIn (scenario 4)", () => {
  it("passes when the connector is signed out and Claude asks for the numbers once", () => {
    // Real wording from dev-pointed runs: an imperative request with no '?' still counts as asking.
    expect(SIGNED_OUT_REPLY).not.toContain("?");
    expect(checkNotSignedIn(run({ reply: SIGNED_OUT_REPLY }))).toEqual([]);
  });

  it("fails and names the cause when the connector failed to connect (prod answered 403 to client registration)", () => {
    const err = "Dynamic Client Registration rejected (HTTP 403): html head title 403 Forbidden /title /head body center h1 403 Forbidden /h1 /center /body /html";
    const failures = checkNotSignedIn(run({ failedError: err, reply: SIGNED_OUT_REPLY }));
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatch(/failed to connect instead of showing signed out: Dynamic Client Registration rejected \(HTTP 403\)/);
  });

  it("fails a reply that stops at the sign-in message", () => {
    const reply = "The PayIt2 connector isn't authorized in this session. You'll need to sign in via `/mcp` to authorize PayIt2 access, then ask me again.";
    expect(checkNotSignedIn(run({ reply }))).toEqual(["after the sign-in mention, the reply does not ask the organizer for their numbers"]);
  });

  it("fails a reply that mentions sign-in twice", () => {
    const reply = SIGNED_OUT_REPLY + "\n\nAnd remember, you can sign in at any time to skip this.";
    expect(checkNotSignedIn(run({ reply }))[0]).toMatch(/exactly one paragraph, found 2/);
  });
});

const IDEAS_REPLY =
  "PayIt2 gives you one page where people pay: a fundraiser, an event with tickets, or a group payment.\n\n" +
  "Here is what it would do for a PTA:\n" +
  "1. **Fall festival tickets.** Families buy ahead and you know the headcount.\n" +
  "2. **Spirit wear orders.** Parents pick sizes and pay in one place.\n" +
  "3. **A school fundraiser.** A goal and a page to send to every family.\n\n" +
  "Want to see one of these as an example page, make one for real, or look at more ideas?";

describe("checkGetStarted (scenario 6)", () => {
  it("is a signed-out scenario that asks the newcomer's question", () => {
    const sc = SCENARIOS.find((x) => x.name === "get-started")!;
    expect(sc.connector).toBe("none");
    expect(sc.prompt({} as never)).toMatch(/What can I do with this\?/);
  });

  it("passes a reply with ideas for the person's group and no PayIt2 tool call", () => {
    expect(checkGetStarted(run({ reply: IDEAS_REPLY }))).toEqual([]);
  });

  it("fails a reply that only tells the newcomer to sign in", () => {
    const failures = checkGetStarted(run({ reply: "Sign in to PayIt2 first, then ask me again." }));
    expect(failures.join(" ")).toMatch(/at least three ideas/);
  });

  it("fails a reply that mentions sign-in in two paragraphs", () => {
    const reply = IDEAS_REPLY + "\n\nSign in to PayIt2 and I can build an example page.\n\nRemember to sign in.";
    expect(checkGetStarted(run({ reply })).join(" ")).toMatch(/sign-in is mentioned in 2 paragraphs/);
  });
});

const HAND_OFF_REPLY =
  "A refund needs PayIt2 support, so here is a request you can send.\n\n" +
  "```\nSubject: Duplicate payment on the Spring Legal Defense Fund\n\nWhat happened:\nA donor paid twice by mistake on November 18.\n\n" +
  "Campaign:\nSpring Legal Defense Fund\n\nWhat I tried:\nNothing yet.\n\nWhat I need:\nOne of the two payments refunded.\n\nWritten with an AI assistant from my description.\n```\n\n" +
  "Open https://www.payit2.com/support?subject=Duplicate%20payment%20on%20the%20Spring%20Legal%20Defense%20Fund, choose Billing or payouts, paste the message and send it. " +
  "I left the card number out: support never needs it.";

describe("checkSupportHandOff (scenario 7)", () => {
  it("passes a written request with the support form link", () => {
    expect(checkSupportHandOff(run({ reply: HAND_OFF_REPLY }))).toEqual([]);
  });

  it("fails a reply with no link and no request", () => {
    const failures = checkSupportHandOff(run({ reply: "Refunds are handled by PayIt2 support. Contact them for help." }));
    expect(failures).toContain("the reply has no support form link with the subject filled in");
    expect(failures).toContain("the reply has no written request to paste (What happened, What I need)");
  });

  it("fails a reply that claims it sent the request", () => {
    expect(checkSupportHandOff(run({ reply: HAND_OFF_REPLY + "\n\nI have sent this to PayIt2 for you." }))).toEqual(["the reply claims the request was sent"]);
  });

  it("fails a reply that states a refund time frame", () => {
    expect(checkSupportHandOff(run({ reply: HAND_OFF_REPLY + "\n\nRefunds arrive within 5 to 10 business days." }))).toEqual(["the reply states a time frame for the refund or the answer"]);
  });

  it("fails a reply that repeats the card number or uses an em dash", () => {
    expect(checkSupportHandOff(run({ reply: HAND_OFF_REPLY + "\n\nCard on file: 4242 4242 4242 4242." }))).toEqual(["the reply repeats a card number"]);
    expect(checkSupportHandOff(run({ reply: HAND_OFF_REPLY + "\n\nOne more thing \u2014 keep the email." }))).toEqual(["the reply uses an em or en dash"]);
  });
});
