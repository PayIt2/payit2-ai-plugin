#!/usr/bin/env python3
"""Turn the plugin's skills into server-ready copies for the MCP skills extension.

Run through ./build-mcp-skills.sh. Reads plugin/skills/, applies the rules below to five
skills, checks the result, and writes one generated TypeScript module that the PayIt2 MCP
server vendors as a pinned file.

Every rule is replace-or-fail: its anchor text must appear exactly once in the source file, so a
wording change in the plugin breaks this build instead of silently serving a stale or untrimmed
copy. After the rules run, a banned-pattern check fails the build if any Claude Code-only or
plugin-only construct survives in the output.

No third-party dependencies. Deterministic: the same input and the same commit give the same bytes.
"""
import argparse
import hashlib
import json
import os
import re
import subprocess
import sys

REPO = "PayIt2/payit2-ai-plugin"
PREFIX = "payit2"
SERVED = ["campaign", "check-in", "promote", "engage", "campaign-context"]
MAX_FILES = 512
MAX_BYTES = 16 * 1024 * 1024
NAME_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")

# --------------------------------------------------------------------------------------------
# Rules. kinds:
#   drop_key   remove one frontmatter key line (key, e.g. "allowed-tools")
#   replace    old text -> new text (old must appear exactly once)
#   between    from start (inclusive) up to end (exclusive) -> new text (both anchors exactly once)
#   section    delete a markdown section: its heading line through the line before the next
#              heading of the same or a higher level (heading must appear exactly once)
# --------------------------------------------------------------------------------------------


def drop_key(rid, file, key):
    return {"id": rid, "file": file, "kind": "drop_key", "key": key}


def replace(rid, file, old, new):
    return {"id": rid, "file": file, "kind": "replace", "old": old, "new": new}


def between(rid, file, start, end, new=""):
    return {"id": rid, "file": file, "kind": "between", "start": start, "end": end, "new": new}


def section(rid, file, heading):
    return {"id": rid, "file": file, "kind": "section", "heading": heading}


RULES = [
    # ---- campaign ------------------------------------------------------------------------
    drop_key("campaign/drop-allowed-tools", "campaign/SKILL.md", "allowed-tools"),
    drop_key("campaign/drop-argument-hint", "campaign/SKILL.md", "argument-hint"),
    replace(
        "campaign/arguments-wording",
        "campaign/SKILL.md",
        "Never re-ask anything already in the conversation or the arguments.",
        "Never re-ask anything the organizer already said in the conversation.",
    ),
    between(
        "campaign/step1-connect-to-one-line",
        "campaign/SKILL.md",
        "## Step 1: Connect PayIt2 (only if it is not connected)",
        "---\n\n## Step 2: Get the basics in one message",
        "## Step 1: Check that PayIt2 is connected\n\n"
        "If the PayIt2 tools (`create_campaign`, `list_my_campaigns`) are missing from this session, "
        "tell the organizer plainly that the PayIt2 connector is not active here, and stop. "
        "Otherwise go straight to Step 2.\n\n",
    ),
    replace(
        "campaign/promote-handoff",
        "campaign/SKILL.md",
        '"Promote it" hands off to /promote.',
        '"Promote it" hands off to the promote skill.',
    ),
    section("campaign/drop-standalone-finish", "campaign/SKILL.md", "## Standalone finish (PayIt2 not connected)"),
    replace(
        "campaign/enrich-guide-slash",
        "campaign/references/enrich-guide.md",
        "The /campaign skill creates the campaign first",
        "The campaign skill creates the campaign first",
    ),
    # ---- check-in ------------------------------------------------------------------------
    drop_key("check-in/drop-allowed-tools", "check-in/SKILL.md", "allowed-tools"),
    drop_key("check-in/drop-argument-hint", "check-in/SKILL.md", "argument-hint"),
    replace(
        "check-in/arguments",
        "check-in/SKILL.md",
        "Run a campaign health check: $ARGUMENTS",
        "Run a campaign health check for the campaign the organizer names.",
    ),
    replace(
        "check-in/modes-intro",
        "check-in/SKILL.md",
        "This skill works in two modes. See `campaign-context` for the operating-modes overview.\n\n"
        "- **Standalone (default):** ask the organizer for current numbers (raised, donors, days active, etc.) "
        "and run the diagnostic against benchmarks below.\n"
        "- **Connected:** pull live",
        "Pull live",
    ),
    replace(
        "check-in/modes-outro",
        "check-in/SKILL.md",
        "If PayIt2 tools aren't available in the session, use the standalone flow below. "
        "See `campaign-context` for the one sign-in mention.\n\n",
        "",
    ),
    replace(
        "check-in/agent-at-risk",
        "check-in/SKILL.md",
        "Significant changes needed, dispatch campaign-assistant agent",
        "Significant changes needed, give the full prioritized plan",
    ),
    replace(
        "check-in/agent-critical",
        "check-in/SKILL.md",
        "Major intervention, dispatch campaign-assistant agent",
        "Major intervention, give the full prioritized plan",
    ),
    replace(
        "check-in/agent-below-60",
        "check-in/SKILL.md",
        "If score is below 60, dispatch the campaign-assistant agent for deep analysis.",
        "If score is below 60, work through the three diagnostic stages in Section 3 step by step "
        "and give the full prioritized plan.",
    ),
    replace(
        "check-in/promote-slash",
        "check-in/SKILL.md",
        "Reference the /promote skill.",
        "Reference the promote skill.",
    ),
    replace(
        "check-in/save-report-heading",
        "check-in/SKILL.md",
        "## 7. Save the Weekly Report",
        "## 7. Deliver the Weekly Report",
    ),
    replace(
        "check-in/save-report-write",
        "check-in/SKILL.md",
        "Write the health check results to `[campaign-title]-checkin-[date].md` in the workspace.",
        "Give the health check report in your reply, and save the action items with `save_improvement_notes`.",
    ),
    replace(
        "check-in/mcp-heading",
        "check-in/SKILL.md",
        "## If the PayIt2 MCP server is connected",
        "## Using live PayIt2 data",
    ),
    replace(
        "check-in/mcp-intro",
        "check-in/SKILL.md",
        "When the MCP server is available, enhance the check-in with live data. This section is optional: "
        "the standalone workflow above works without any MCP connection.",
        "Enhance the check-in with live PayIt2 data.",
    ),
    replace(
        "check-in/prompt-invocation",
        "check-in/SKILL.md",
        "3. Invoke the `campaign_improvements` prompt with the health data to generate a tailored improvement plan",
        "3. Use the health data to write a tailored improvement plan",
    ),
    # ---- promote -------------------------------------------------------------------------
    drop_key("promote/drop-allowed-tools", "promote/SKILL.md", "allowed-tools"),
    drop_key("promote/drop-argument-hint", "promote/SKILL.md", "argument-hint"),
    replace(
        "promote/arguments",
        "promote/SKILL.md",
        "Build a promotion strategy for this campaign: $ARGUMENTS",
        "Build a promotion strategy for the campaign the organizer names.",
    ),
    replace(
        "promote/modes-intro",
        "promote/SKILL.md",
        "This skill works in two modes. See `campaign-context` for the operating-modes overview.\n\n"
        "- **Standalone (default):** generate a full promotion package (channel strategy, content calendar, "
        "platform-specific posts, email templates) that the organizer can copy and paste into their channels. "
        "No PayIt2 account needed.\n"
        "- **Connected:** the same package, with live",
        "Generate a full promotion package (channel strategy, content calendar, platform-specific posts, "
        "email templates) that the organizer can copy and paste into their channels, with live",
    ),
    replace(
        "promote/modes-outro",
        "promote/SKILL.md",
        "If PayIt2 tools aren't available in the session, use the standalone flow. "
        "See `campaign-context` for the one sign-in mention.\n\n",
        "",
    ),
    replace(
        "promote/save-package-heading",
        "promote/SKILL.md",
        "### 10. Save the Promotion Package",
        "### 10. Deliver the Promotion Package",
    ),
    replace(
        "promote/save-package-write",
        "promote/SKILL.md",
        "Write all content to `[campaign-title]-promotion-[date].md` in the workspace, organized by platform and phase.",
        "Give all content in your reply, organized by platform and phase, and save each update post with `save_update_post`.",
    ),
    replace(
        "promote/mcp-heading",
        "promote/SKILL.md",
        "## If the PayIt2 MCP server is connected",
        "## Using live PayIt2 data",
    ),
    replace(
        "promote/mcp-intro",
        "promote/SKILL.md",
        "When the MCP server is available, the promotion workflow gains two additional capabilities:",
        "The promotion workflow uses two PayIt2 capabilities:",
    ),
    replace(
        "promote/mcp-enhanced-heading",
        "promote/SKILL.md",
        "**Enhanced workflow when MCP is connected:**",
        "**Live-data workflow:**",
    ),
    replace(
        "promote/standalone-default",
        "promote/SKILL.md",
        "- The standalone workflow (steps 1-10 above) is the default and works fully without MCP; "
        "the items above are additive enhancements.\n",
        "",
    ),
    # ---- engage --------------------------------------------------------------------------
    drop_key("engage/drop-allowed-tools", "engage/SKILL.md", "allowed-tools"),
    drop_key("engage/drop-argument-hint", "engage/SKILL.md", "argument-hint"),
    replace(
        "engage/arguments",
        "engage/SKILL.md",
        "Manage participant engagement for your campaign: $ARGUMENTS",
        "Manage participant engagement for the campaign the organizer names.",
    ),
    replace(
        "engage/gather-from-tools-first",
        "engage/SKILL.md",
        "2. **Gather What's Needed**: Ask the organizer for the information you need:",
        "2. **Gather What's Needed**: Pull what you can from PayIt2 first (see Live participant data below), "
        "then ask the organizer only for what is missing:",
    ),
    replace(
        "engage/save-package-heading",
        "engage/SKILL.md",
        "5. **Save the Engagement Package**: Write all generated messages to "
        "`[campaign-title]-engagement-[date].md` in the workspace, organized by recipient or action type.",
        "5. **Deliver the Engagement Package**: Give all generated messages in your reply, organized by "
        "recipient or action type, and save thank-yous and updates with the save tools (see below).",
    ),
    replace(
        "engage/modes-section",
        "engage/SKILL.md",
        "## Standalone vs. MCP-connected mode\n\n"
        "This skill works in either mode. See `campaign-context` for the full operating-modes overview.\n\n"
        "- **Standalone (default):** ask the organizer for participant names, amounts, and payment status, "
        "then generate messages they can copy into email, text, or the campaign page directly.\n"
        "- **Connected:** pull live",
        "## Using PayIt2 data\n\nPull live",
    ),
    replace(
        "engage/modes-outro",
        "engage/SKILL.md",
        "If PayIt2 tools aren't available in the session, use the standalone flow. "
        "See `campaign-context` for the one sign-in mention.\n\n",
        "",
    ),
    replace(
        "engage/mcp-heading",
        "engage/SKILL.md",
        "## If the PayIt2 MCP server is connected\n\n"
        "When MCP tools are available, use them to pull real participant data",
        "## Live participant data\n\nUse the PayIt2 tools to pull real participant data",
    ),
    replace(
        "engage/optional-enhancements",
        "engage/SKILL.md",
        "\n\nThese MCP tools are optional enhancements. The skill generates the same quality content in "
        "standalone mode by asking the organizer for participant details directly.",
        "",
    ),
    # ---- campaign-context (trimmed: a served skill can assume the organizer is connected) -----
    replace(
        "campaign-context/description",
        "campaign-context/SKILL.md",
        "description: Shared context-gathering engine used by all PayIt2 commands. Opens a conversation with the "
        "organizer's campaigns when PayIt2 is connected, handles a payit2.com campaign link pasted into the chat, "
        "determines campaign type and collects the minimum information needed for the current task. Triggers at "
        "the start of a conversation, when a payit2.com campaign link appears, and at the start of /campaign, "
        "/promote, /check-in, and /engage.",
        "description: Shared PayIt2 context rules for the campaign, check-in, promote and engage skills. Handles a "
        "payit2.com campaign link pasted into the chat, determines campaign type, gathers only the minimum "
        "information the current task needs, asks one question at a time and confirms before any change to a "
        "campaign. Use when a payit2.com campaign link appears or when another PayIt2 skill needs campaign context.",
    ),
    replace(
        "campaign-context/intro-command",
        "campaign-context/SKILL.md",
        "Gather the minimum context needed for the current command through natural conversation.",
        "Gather the minimum context needed for the current task through natural conversation.",
    ),
    between(
        "campaign-context/drop-operating-modes",
        "campaign-context/SKILL.md",
        "## Operating Modes",
        "**Creating a campaign always goes through the `campaign` skill.**",
        "## Working with PayIt2\n\nThe organizer is connected and signed in, so the PayIt2 tools are available. "
        "Content you generate can be saved to the campaign with the `save_*` tools, and the organizer finds it on "
        "the campaign's page in their PayIt2 account: an update draft they review and post, or a story, thank-you "
        "or set of notes in the AI drafts card. Saving never posts, emails or changes the public page. Tell the "
        "organizer where to find what you saved, and give them the text in your reply too.\n\n",
    ),
    replace(
        "campaign-context/creating-slash",
        "campaign-context/SKILL.md",
        "in any words, not only with /campaign, follow the `campaign` skill",
        "in any words, follow the `campaign` skill",
    ),
    between(
        "campaign-context/drop-sign-in-mention",
        "campaign-context/SKILL.md",
        "**The one sign-in mention.**",
        "**Before changing any campaign setting**",
    ),
    replace(
        "campaign-context/theme-slash",
        "campaign-context/SKILL.md",
        "the theme the /campaign skill applies right after creating a campaign",
        "the theme the `campaign` skill applies right after creating a campaign",
    ),
    section("campaign-context/drop-start-of-conversation", "campaign-context/SKILL.md", "## Start of a conversation"),
    replace(
        "campaign-context/links-connected",
        "campaign-context/SKILL.md",
        "If PayIt2 tools are available, call `get_campaign_overview` with the slug before you reply, and use what it "
        "returns. If they are not, ask for the current numbers the task needs. If the organizer has not said what "
        "they want, ask which they need: /check-in for a health score and action plan, /promote for a promotion "
        "plan, or /engage for messages to participants.",
        "Find the campaign the link points to in `list_my_campaigns` (ask which one if you cannot tell), then call "
        "`get_campaign_overview` with its ID before you reply, and use what it returns. If the organizer "
        "has not said what they want, ask which they need: the `check-in` skill for a health score and action "
        "plan, the `promote` skill for a promotion plan, or the `engage` skill for messages to participants.",
    ),
    section("campaign-context/drop-context-model", "campaign-context/SKILL.md", "## Context Model"),
    replace(
        "campaign-context/live-data-heading",
        "campaign-context/SKILL.md",
        "## MCP-Enhanced Data Gathering (when available)\n\n"
        "When the PayIt2 MCP server is connected, use it to eliminate manual questions and pull live campaign data:",
        "## Live Data Gathering\n\nUse the PayIt2 tools to avoid manual questions and pull live campaign data:",
    ),
    replace(
        "campaign-context/live-data-checkin",
        "campaign-context/SKILL.md",
        "2. **For /check-in**, also call",
        "2. **For a health check**, also call",
    ),
    replace(
        "campaign-context/live-data-skip",
        "campaign-context/SKILL.md",
        "\n\nIf PayIt2 tools are not available, skip this section and use the manual context-gathering rules below, "
        "apart from the one sign-in mention described under Operating Modes.",
        "",
    ),
    replace(
        "campaign-context/rule-minimum",
        "campaign-context/SKILL.md",
        "Ask only what the current command needs. /promote needs type + title + what's been tried. /engage needs type + what action the user wants to take.",
        "Ask only what the current task needs. A promotion plan needs type + title + what's been tried. Engagement messages need type + what action "
        "the organizer wants to take.",
    ),
    replace(
        "campaign-context/rule-url",
        "campaign-context/SKILL.md",
        "(e.g., current progress stats for /check-in)",
        "(e.g., current progress stats for a health check)",
    ),
    replace(
        "campaign-context/rule-one-question",
        "campaign-context/SKILL.md",
        "The one exception is the /campaign fast path,",
        "The one exception is the `campaign` skill's fast path,",
    ),
    section("campaign-context/drop-questions-by-command", "campaign-context/SKILL.md", "## Context Questions by Command"),
    between(
        "campaign-context/drop-tool-reference",
        "campaign-context/SKILL.md",
        "## MCP Tool Reference",
        "`get_campaign_overview` includes a `Verified organizer` line",
        "## Notes on the Verified badge\n\n",
    ),
]

# Constructs that must not survive in any served file. (id, regex, sample that must trip it)
BANNED = [
    ("arguments-placeholder", r"\$ARGUMENTS", "Run a check: $ARGUMENTS"),
    ("allowed-tools", r"allowed-tools", "allowed-tools: Read"),
    ("argument-hint", r"argument-hint", 'argument-hint: "[x]"'),
    (
        "slash-command",
        r"(?<![\w/.:~-])/(campaign|check-in|promote|engage|get-started|campaign-context|payit2|mcp|plugin)\b",
        "Run /promote now.",
    ),
    ("plugin-namespace", r"\bpayit2:(campaign|check-in|promote|engage|get-started|campaign-context)\b", "Use payit2:campaign."),
    ("standalone-mode", r"(?i)\bstandalone\b", "Use the standalone flow."),
    ("operating-modes", r"(?i)\boperating[- ]modes?\b", "See the operating modes."),
    ("sign-in-nudge", r"(?i)\bone sign-in mention\b", "Make the one sign-in mention."),
    ("connect-reference", r"connect\.md", "See references/connect.md."),
    ("get-started-skill", r"get-started", "Hand off to get-started."),
    ("campaign-assistant-agent", r"campaign-assistant", "Dispatch the campaign-assistant agent."),
    ("agent-dispatch", r"(?i)\bdispatch\b", "Dispatch a helper."),
    ("workspace-write", r"(?i)\bworkspace\b", "Write it in the workspace."),
    ("web-search-tool", r"WebSearch", "Use WebSearch."),
    ("relative-link-out", r"\.\./", "See ../campaign/references/x.md."),
    ("plugin-install-ui", r"Customize\s*>\s*Plugins", "Open Customize > Plugins."),
    ("hook-event", r"\b(PreToolUse|PostToolUse|SessionStart|UserPromptSubmit)\b", "On SessionStart do it."),
    ("hooks-folder", r"\bhooks/", "See hooks/hooks.json."),
    ("claude-code-tool", r"(?i)\bRead, Write\b", "Tools: Read, Write"),
    ("em-dash", "\u2014", "A dash \u2014 here."),
]


class BuildError(Exception):
    pass


def fail(msg):
    raise BuildError(msg)


def once(text, anchor, rid, label="anchor"):
    n = text.count(anchor)
    if n != 1:
        shown = anchor if len(anchor) < 90 else anchor[:87] + "..."
        fail(f"rule {rid}: {label} must appear exactly once, found {n}: {shown!r}")
    return text.index(anchor)


def apply_rule(rule, text):
    rid, kind = rule["id"], rule["kind"]
    if kind == "replace":
        i = once(text, rule["old"], rid)
        return text[:i] + rule["new"] + text[i + len(rule["old"]):]
    if kind == "between":
        i = once(text, rule["start"], rid, "start anchor")
        j = once(text, rule["end"], rid, "end anchor")
        if j <= i:
            fail(f"rule {rid}: end anchor comes before start anchor")
        return text[:i] + rule["new"] + text[j:]
    if kind == "section":
        heading = rule["heading"]
        level = len(heading) - len(heading.lstrip("#"))
        lines = text.split("\n")
        hits = [k for k, ln in enumerate(lines) if ln == heading]
        if len(hits) != 1:
            fail(f"rule {rid}: heading must appear exactly once, found {len(hits)}: {heading!r}")
        start = hits[0]
        end = len(lines)
        for k in range(start + 1, len(lines)):
            m = re.match(r"^(#{1,6})\s", lines[k])
            if m and len(m.group(1)) <= level:
                end = k
                break
        # Drop the separator rule that closed the deleted section, so one remains between neighbours.
        if end < len(lines) and end - 2 > start and lines[end - 2] == "---" and lines[end - 1] == "":
            end_cut = end
            start_cut = start
            return "\n".join(lines[:start_cut] + lines[end_cut:])
        return "\n".join(lines[:start] + lines[end:])
    if kind == "drop_key":
        key = rule["key"]
        lines = text.split("\n")
        if not lines or lines[0] != "---":
            fail(f"rule {rid}: file has no frontmatter")
        try:
            close = lines.index("---", 1)
        except ValueError:
            fail(f"rule {rid}: frontmatter is not closed")
        hits = [k for k in range(1, close) if lines[k].startswith(key + ":")]
        if len(hits) != 1:
            fail(f"rule {rid}: frontmatter key {key!r} must appear exactly once, found {len(hits)}")
        del lines[hits[0]]
        return "\n".join(lines)
    fail(f"rule {rid}: unknown kind {kind}")


def rule_anchors(rule):
    kind = rule["kind"]
    if kind == "replace":
        return [rule["old"]]
    if kind == "between":
        return [rule["start"], rule["end"]]
    if kind == "section":
        return [rule["heading"]]
    return [rule["key"] + ":"]


# ---- frontmatter -------------------------------------------------------------------------


def parse_frontmatter(text, where):
    """Strict reader for the subset of YAML a SKILL.md uses: top-level `key: value` lines.
    Plain values may not contain ': ' or ' #' (YAML rejects them); quoted values are JSON strings."""
    lines = text.split("\n")
    if not lines or lines[0] != "---":
        fail(f"{where}: SKILL.md must start with a --- frontmatter line")
    try:
        close = lines.index("---", 1)
    except ValueError:
        fail(f"{where}: frontmatter is not closed")
    out = {}
    for n, ln in enumerate(lines[1:close], start=2):
        m = re.match(r"^([A-Za-z][\w-]*): (.*)$", ln)
        if not m:
            fail(f"{where}: frontmatter line {n} is not 'key: value': {ln[:60]!r}")
        key, val = m.group(1), m.group(2)
        if key in out:
            fail(f"{where}: duplicate frontmatter key {key!r}")
        if val.startswith('"'):
            try:
                val = json.loads(val)
            except ValueError:
                fail(f"{where}: frontmatter line {n} has an invalid quoted value")
        else:
            if val.startswith(("'", "[", "{", "&", "*", "!", "|", ">", "%", "@", "`")):
                fail(f"{where}: frontmatter line {n}: quote the value")
            if ": " in val or " #" in val or val.endswith(":"):
                fail(f"{where}: frontmatter line {n}: a plain value cannot contain ': ' or ' #'; quote it")
        out[key] = val
    return out


def check_skill(name, files):
    where = f"{name}/SKILL.md"
    if "SKILL.md" not in files:
        fail(f"{name}: no SKILL.md")
    fm = parse_frontmatter(files["SKILL.md"], where)
    for key in ("name", "description"):
        if not fm.get(key):
            fail(f"{where}: frontmatter needs {key}")
    if fm["name"] != name:
        fail(f"{where}: frontmatter name {fm['name']!r} must equal the folder name {name!r}")
    if len(fm["name"]) > 64 or not NAME_RE.match(fm["name"]):
        fail(f"{where}: name {fm['name']!r} breaks the Agent Skills naming rule")
    if len(fm["description"]) > 1024:
        fail(f"{where}: description is {len(fm['description'])} characters, the limit is 1024")
    if len(files) > MAX_FILES:
        fail(f"{name}: {len(files)} files, the limit is {MAX_FILES}")
    total = sum(len(v.encode("utf-8")) for v in files.values())
    if total > MAX_BYTES:
        fail(f"{name}: {total} bytes, the limit is {MAX_BYTES}")


def check_banned(rel, text):
    for bid, pattern, _sample in BANNED:
        m = re.search(pattern, text)
        if m:
            line = text.count("\n", 0, m.start()) + 1
            fail(f"banned pattern {bid} in {rel} line {line}: {m.group(0)!r}")


# ---- build -------------------------------------------------------------------------------


def read_source(source):
    skills = {}
    for name in SERVED:
        root = os.path.join(source, name)
        if not os.path.isdir(root):
            fail(f"source skill folder is missing: {root}")
        files = {}
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames.sort()
            for fn in sorted(filenames):
                if fn == ".DS_Store":
                    continue
                full = os.path.join(dirpath, fn)
                rel = os.path.relpath(full, root).replace(os.sep, "/")
                with open(full, "rb") as fh:
                    raw = fh.read()
                try:
                    text = raw.decode("utf-8")
                except UnicodeDecodeError:
                    fail(f"{name}/{rel} is not valid UTF-8")
                if "\r" in text:
                    fail(f"{name}/{rel} has carriage returns; the served copy is LF only")
                files[rel] = text
        skills[name] = files
    return skills


def transform(skills):
    used = set()
    for rule in RULES:
        skill, _, rel = rule["file"].partition("/")
        if skill not in skills:
            fail(f"rule {rule['id']}: skill {skill!r} is not served")
        if rel not in skills[skill]:
            fail(f"rule {rule['id']}: file {rule['file']} is missing from the source")
        skills[skill][rel] = apply_rule(rule, skills[skill][rel])
        used.add(rule["id"])
    if len(used) != len(RULES):
        fail("duplicate rule id")
    # connect.md is for people who are not connected yet; a served skill never needs it.
    if "references/connect.md" not in skills["campaign-context"]:
        fail("campaign-context/references/connect.md is missing from the source; update the build")
    del skills["campaign-context"]["references/connect.md"]
    return skills


def module_text(skills, commit, version):
    manifest = {}
    blocks = []
    for name in sorted(skills):
        for rel in sorted(skills[name]):
            key = f"{PREFIX}/{name}/{rel}"
            text = skills[name][rel]
            raw = text.encode("utf-8")
            manifest[key] = {"digest": "sha256:" + hashlib.sha256(raw).hexdigest(), "size": len(raw)}
            lines = text.split("\n")
            body = ",\n".join("    " + json.dumps(ln, ensure_ascii=False) for ln in lines)
            blocks.append(f"  {json.dumps(key)}: [\n{body},\n  ].join(\"\\n\"),\n")
    out = []
    out.append("// Generated by payit2-ai-plugin build-mcp-skills.sh. Do not edit by hand.")
    out.append(f"// Source: https://github.com/{REPO} at the commit in PIN below.")
    out.append("// Each file is an array of JSON-quoted lines so a git diff reads line by line.")
    out.append("")
    out.append("export const FILES: Record<string, string> = {")
    out.append("".join(blocks).rstrip("\n"))
    out.append("};")
    out.append("")
    out.append("export const PIN = {")
    out.append(f"  repo: {json.dumps(REPO)},")
    out.append(f"  commit: {json.dumps(commit)},")
    out.append(f"  pluginVersion: {json.dumps(version)},")
    out.append("  manifest: {")
    for key in sorted(manifest):
        e = manifest[key]
        out.append(f"    {json.dumps(key)}: {{ digest: {json.dumps(e['digest'])}, size: {e['size']} }},")
    out.append("  },")
    out.append("} as const;")
    out.append("")
    return "\n".join(out)


def git(args, cwd):
    return subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True, text=True).stdout


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--repo", default=os.getcwd(), help="repo root (default: current directory)")
    ap.add_argument("--source", help="skills folder to read (default: <repo>/plugin/skills)")
    ap.add_argument("--out", help="output folder (default: <repo>/dist/mcp-skills)")
    ap.add_argument("--allow-dirty", action="store_true", help="build from a dirty tree (tests)")
    ap.add_argument("--list-rules", action="store_true", help="print the rules as JSON and exit")
    ap.add_argument("--list-banned", action="store_true", help="print the banned patterns as JSON and exit")
    args = ap.parse_args(argv)

    if args.list_rules:
        print(json.dumps([{**r, "anchors": rule_anchors(r)} for r in RULES], indent=1))
        return 0
    if args.list_banned:
        print(json.dumps([{"id": b[0], "sample": b[2]} for b in BANNED], indent=1))
        return 0

    repo = os.path.abspath(args.repo)
    source = os.path.abspath(args.source or os.path.join(repo, "plugin", "skills"))
    out_dir = os.path.abspath(args.out or os.path.join(repo, "dist", "mcp-skills"))
    try:
        if not args.allow_dirty and git(["status", "--porcelain"], repo).strip():
            fail("the working tree is dirty; commit or discard changes first (or pass --allow-dirty, for tests)")
        commit = git(["rev-parse", "HEAD"], repo).strip()
        if not re.fullmatch(r"[0-9a-f]{40}", commit):
            fail(f"git rev-parse HEAD gave {commit!r}")
        with open(os.path.join(repo, "plugin", ".claude-plugin", "plugin.json"), encoding="utf-8") as fh:
            version = json.load(fh)["version"]

        skills = transform(read_source(source))
        for name in SERVED:
            check_skill(name, skills[name])
            for rel, text in skills[name].items():
                check_banned(f"{name}/{rel}", text)
        text = module_text(skills, commit, version)
    except BuildError as e:
        print(f"build-mcp-skills: {e}", file=sys.stderr)
        return 1
    except subprocess.CalledProcessError as e:
        print(f"build-mcp-skills: git failed: {e.stderr.strip()}", file=sys.stderr)
        return 1

    os.makedirs(out_dir, exist_ok=True)
    target = os.path.join(out_dir, "payit2-skills.ts")
    with open(target, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(text)
    count = sum(len(v) for v in skills.values())
    print(f"Built {target} ({os.path.getsize(target)} bytes, {len(skills)} skills, {count} files, commit {commit[:9]}, plugin {version})")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
