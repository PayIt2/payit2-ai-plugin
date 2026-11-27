import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";

// build-mcp-skills.sh turns the plugin's skills into server copies for the MCP skills extension.
// Every transform rule is replace-or-fail and a banned-pattern check guards the output.
const REPO = fileURLToPath(new URL("../../", import.meta.url));
const SCRIPT = REPO + "scripts/build_mcp_skills.py";
const SERVED = ["campaign", "campaign-context", "check-in", "engage", "promote"];

type Rule = { id: string; file: string; kind: string; anchors: string[] };
type Pin = { repo: string; commit: string; pluginVersion: string; manifest: Record<string, { digest: string; size: number }> };
type Mod = { FILES: Record<string, string>; PIN: Pin };

const py = (args: string[], cwd = REPO) => spawnSync("python3", [SCRIPT, "--repo", REPO, ...args], { cwd, encoding: "utf8" });
const sha = (s: string) => "sha256:" + createHash("sha256").update(Buffer.from(s, "utf8")).digest("hex");

let work = "";
let outA = "";
let moduleA = "";
let a: Mod;
let rules: Rule[] = [];
let banned: { id: string; sample: string }[] = [];

const load = async (file: string): Promise<Mod> => (await import(/* @vite-ignore */ pathToFileURL(file).href)) as Mod;

/** Copy plugin/skills to a scratch folder, change one file, build from it, return the result. */
function buildFromMutated(file: string, mutate: (t: string) => string) {
  const src = mkdtempSync(join(work, "src-"));
  cpSync(REPO + "plugin/skills", src, { recursive: true });
  const p = join(src, file);
  writeFileSync(p, mutate(readFileSync(p, "utf8")));
  return py(["--allow-dirty", "--source", src, "--out", mkdtempSync(join(work, "out-"))]);
}

beforeAll(async () => {
  work = mkdtempSync(join(tmpdir(), "payit2-mcp-skills-"));
  outA = join(work, "a");
  const r = py(["--allow-dirty", "--out", outA]);
  expect(r.status, r.stderr).toBe(0);
  moduleA = join(outA, "payit2-skills.ts");
  a = await load(moduleA);
  rules = JSON.parse(py(["--list-rules"]).stdout);
  banned = JSON.parse(py(["--list-banned"]).stdout);
});
afterAll(() => rmSync(work, { recursive: true, force: true }));

describe("the skill set", () => {
  it("serves exactly five skills under the payit2/ prefix, and not get-started", () => {
    const skills = new Set(Object.keys(a.FILES).map((k) => k.split("/")[1]));
    expect([...skills].sort()).toEqual(SERVED);
    for (const k of Object.keys(a.FILES)) expect(k.startsWith("payit2/")).toBe(true);
    expect(Object.keys(a.FILES).some((k) => k.includes("get-started"))).toBe(false);
    expect(Object.keys(a.FILES).some((k) => k.endsWith("connect.md"))).toBe(false);
  });

  it("every skill has a SKILL.md whose frontmatter parses as YAML with name equal to its folder", () => {
    for (const s of SERVED) {
      const text = a.FILES[`payit2/${s}/SKILL.md`];
      const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
      expect(m, s).not.toBeNull();
      const fm = parseYaml(m![1]) as Record<string, unknown>;
      expect(fm.name, s).toBe(s);
      expect(typeof fm.description, s).toBe("string");
      expect((fm.description as string).length).toBeGreaterThan(20);
      expect((fm.description as string).length).toBeLessThanOrEqual(1024);
      expect(Object.keys(fm).sort(), s).toEqual(["description", "name"]);
      expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("stays within 512 files and 16 MiB per skill", () => {
    for (const s of SERVED) {
      const mine = Object.entries(a.FILES).filter(([k]) => k.startsWith(`payit2/${s}/`));
      expect(mine.length).toBeLessThanOrEqual(512);
      expect(mine.reduce((n, [, v]) => n + Buffer.byteLength(v), 0)).toBeLessThanOrEqual(16 * 1024 * 1024);
    }
  });

  it("references only files that exist in the same skill", () => {
    for (const s of SERVED) {
      const body = a.FILES[`payit2/${s}/SKILL.md`];
      for (const m of body.matchAll(/`(references\/[\w.-]+\.md)`/g)) {
        expect(a.FILES[`payit2/${s}/${m[1]}`], `${s} -> ${m[1]}`).toBeDefined();
      }
    }
  });
});

describe("PIN", () => {
  it("records the repo, the HEAD commit and the plugin version", () => {
    const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: REPO, encoding: "utf8" }).trim();
    const version = JSON.parse(readFileSync(REPO + "plugin/.claude-plugin/plugin.json", "utf8")).version;
    expect(a.PIN.repo).toBe("PayIt2/payit2-ai-plugin");
    expect(a.PIN.commit).toBe(head);
    expect(a.PIN.pluginVersion).toBe(version);
  });

  it("lists every file in the manifest with the sha256 digest and byte size of the bytes in FILES", () => {
    expect(Object.keys(a.PIN.manifest).sort()).toEqual(Object.keys(a.FILES).sort());
    for (const [k, text] of Object.entries(a.FILES)) {
      expect(a.PIN.manifest[k].digest, k).toBe(sha(text));
      expect(a.PIN.manifest[k].size, k).toBe(Buffer.byteLength(text, "utf8"));
    }
  });

  it("writes FILES as JSON-quoted lines, so a git diff reads by line", () => {
    const src = readFileSync(moduleA, "utf8");
    expect(src.split("\n")[0]).toMatch(/^\/\/ Generated by payit2-ai-plugin build-mcp-skills\.sh/);
    expect(src).toContain('  "payit2/campaign/SKILL.md": [\n    "---",\n    "name: campaign",');
    expect(src).toContain("].join(\"\\n\"),");
  });
});

describe("determinism", () => {
  it("two runs give identical bytes", () => {
    const out2 = join(work, "b");
    const r = py(["--allow-dirty", "--out", out2]);
    expect(r.status, r.stderr).toBe(0);
    expect(readFileSync(join(out2, "payit2-skills.ts"))).toEqual(readFileSync(moduleA));
  });
});

describe("transform rules", () => {
  it("has rules for every served skill except nothing else", () => {
    const skills = new Set(rules.map((r) => r.file.split("/")[0]));
    expect([...skills].sort()).toEqual(SERVED);
    expect(new Set(rules.map((r) => r.id)).size).toBe(rules.length);
  });

  it("every rule fails the build, naming itself, when one of its anchors is missing", () => {
    for (const rule of rules) {
      for (const anchor of rule.anchors) {
        const r = buildFromMutated(rule.file, (t) => t.replace(anchor, "ANCHOR-GONE"));
        expect(r.status, `${rule.id}: ${anchor.slice(0, 40)}`).toBe(1);
        expect(r.stderr, rule.id).toContain(`rule ${rule.id}:`);
      }
    }
  }, 600_000);

  it("fails when an anchor is ambiguous (appears twice)", () => {
    const rule = rules.find((x) => x.id === "campaign/promote-handoff")!;
    const r = buildFromMutated(rule.file, (t) => t + "\n" + rule.anchors[0] + "\n");
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("rule campaign/promote-handoff");
    expect(r.stderr).toContain("found 2");
  });

  it("replaces what it says: the Claude Code-only constructs are gone from the four plugin skills", () => {
    const all = (s: string) => Object.entries(a.FILES).filter(([k]) => k.startsWith(`payit2/${s}/`)).map(([, v]) => v).join("\n");
    for (const s of ["campaign", "check-in", "promote", "engage"]) {
      const text = all(s);
      expect(text, s).not.toMatch(/\$ARGUMENTS|allowed-tools|argument-hint|[Ss]tandalone|workspace|campaign-assistant|dispatch/);
      expect(text, s).not.toMatch(/(^|[\s(])\/(campaign|check-in|promote|engage|get-started)\b/);
    }
    expect(a.FILES["payit2/check-in/SKILL.md"]).toContain("Run a campaign health check for the campaign the organizer names.");
    expect(a.FILES["payit2/promote/SKILL.md"]).toContain("Deliver the Promotion Package");
    expect(a.FILES["payit2/engage/SKILL.md"]).toContain("## Live participant data");
    expect(a.FILES["payit2/campaign/SKILL.md"]).toContain("## Step 1: Check that PayIt2 is connected");
    expect(a.FILES["payit2/campaign/SKILL.md"]).not.toContain("Standalone finish");
    expect(a.FILES["payit2/campaign/references/enrich-guide.md"]).toContain("The campaign skill creates the campaign first");
  });

  it("keeps references to campaign-context in the four skills, since it is served", () => {
    for (const s of ["campaign", "check-in", "promote", "engage"]) {
      expect(a.FILES[`payit2/${s}/SKILL.md`], s).toContain("campaign-context");
    }
  });
});

describe("the trimmed campaign-context", () => {
  const cc = () => a.FILES["payit2/campaign-context/SKILL.md"];

  it("drops what is dead for a connected, on-demand skill", () => {
    const text = Object.entries(a.FILES).filter(([k]) => k.startsWith("payit2/campaign-context/")).map(([, v]) => v).join("\n");
    for (const dead of [
      "Operating Modes",
      "Standalone",
      "standalone",
      "sign-in mention",
      "connect.md",
      "Start of a conversation",
      "greeting",
      "Context Model",
      "Context Questions by Command",
      "MCP Tool Reference",
      "Mutation tools",
      "get-started",
      "Triggers at the start of a conversation",
    ]) {
      expect(text, dead).not.toContain(dead);
    }
    expect(Object.keys(a.FILES).filter((k) => k.startsWith("payit2/campaign-context/"))).toEqual(["payit2/campaign-context/SKILL.md"]);
  });

  it("keeps the live parts", () => {
    for (const live of [
      "## Campaign links",
      "payit2.com/fundraiser/<slug>",
      "get_campaign_overview",
      "**Type first.**",
      "**Minimum viable context.**",
      "**One question at a time.**",
      "**Before changing any campaign setting**",
      "update_campaign_settings",
      "`confirm: true`",
      "**Creating a campaign always goes through the `campaign` skill.**",
      "## Notes on the Verified badge",
      "No em dashes",
    ]) {
      expect(cc(), live).toContain(live);
    }
  });
});

describe("the banned-pattern check", () => {
  it("lists a sample for each banned construct", () => {
    expect(banned.length).toBeGreaterThanOrEqual(15);
  });

  it("fails the build, naming the pattern, for each banned construct", () => {
    for (const b of banned) {
      const r = buildFromMutated("engage/SKILL.md", (t) => t + "\n\n" + b.sample + "\n");
      expect(r.status, b.id).toBe(1);
      expect(r.stderr, b.id).toContain(`banned pattern ${b.id} in engage/SKILL.md`);
    }
  }, 600_000);

  it("does not trip on payit2.com campaign URLs", () => {
    const r = buildFromMutated("engage/SKILL.md", (t) => t + "\nSee https://payit2.com/event/my-run and collect.payit2.com/fund/x.\n");
    expect(r.status, r.stderr).toBe(0);
  });
});

describe("frontmatter and limit checks", () => {
  it("fails when a source file has carriage returns", () => {
    const r = buildFromMutated("engage/SKILL.md", (x) => x + "a\r\nb\n");
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("carriage returns");
  });

  it("fails when a description has an unquoted ': ' that YAML rejects", () => {
    const r = buildFromMutated("check-in/SKILL.md", (t) => t.replace("description: Run a weekly health check", "description: Run a weekly: health check"));
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("plain value cannot contain");
  });

  it("fails when the frontmatter name differs from the folder", () => {
    const r = buildFromMutated("check-in/SKILL.md", (t) => t.replace("name: check-in", "name: checkin"));
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("must equal the folder name");
  });
});

describe("the git guard", () => {
  it("records HEAD, refuses a dirty tree, and builds a dirty tree only with --allow-dirty", () => {
    const repo = mkdtempSync(join(work, "repo-"));
    mkdirSync(join(repo, "scripts"));
    cpSync(SCRIPT, join(repo, "scripts/build_mcp_skills.py"));
    cpSync(REPO + "plugin", join(repo, "plugin"), { recursive: true });
    const git = (...args: string[]) =>
      execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd: repo, encoding: "utf8" }).trim();
    git("init", "-q");
    git("add", "-A");
    git("commit", "-q", "-m", "x");
    const run = (...extra: string[]) =>
      spawnSync("python3", [join(repo, "scripts/build_mcp_skills.py"), "--repo", repo, "--out", join(work, "g"), ...extra], { encoding: "utf8" });

    const clean = run();
    expect(clean.status, clean.stderr).toBe(0);
    const text = readFileSync(join(work, "g/payit2-skills.ts"), "utf8");
    expect(text).toContain(`commit: "${git("rev-parse", "HEAD")}"`);

    writeFileSync(join(repo, "NOTES.txt"), "dirty");
    const dirty = run();
    expect(dirty.status).toBe(1);
    expect(dirty.stderr).toContain("working tree is dirty");
    expect(run("--allow-dirty").status).toBe(0);
    expect(existsSync(join(repo, "dist"))).toBe(false);
  });
});
