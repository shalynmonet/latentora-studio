// Build with Muse — deterministic checks on generated source code.
// Generated code is only PARSED (acorn) and pattern-checked here; it is never executed.
import { parse } from "acorn";
import type { PreferenceKey } from "./made-for-me";
import type { ResultSource } from "./types";

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface BuildCheck {
  id: string;
  label: string;
  status: "pass" | "fail" | "warn";
  detail: string;
}

export interface MuseBuild {
  tool_name: string;
  files: GeneratedFile[];
  checks: BuildCheck[];
  model: string;
  endpoint: string;
  attempts: number;
  source: ResultSource;
  generated_at: string;
}

export const REQUIRED_FILES = ["index.html", "styles.css", "app.js", "README.md"] as const;
export const BUILD_LIMITS = { maxFiles: 12, maxFileBytes: 120_000, maxTotalBytes: 400_000 } as const;
const ALLOWED_EXT = /\.(html|css|js|mjs|json|md|webmanifest|svg|txt)$/i;

export function safePath(p: string): string | null {
  const clean = p.trim().replace(/\\/g, "/").replace(/^\.\/+/, "");
  if (!clean || clean.startsWith("/") || clean.includes("..") || clean.includes("//")) return null;
  if (!/^[A-Za-z0-9._\-/]+$/.test(clean) || clean.split("/").length > 3) return null;
  if (!ALLOWED_EXT.test(clean)) return null;
  return clean;
}

/** Keeps safe, unique, size-limited files. Returns files plus problems found. */
export function sanitizeFiles(raw: unknown): { files: GeneratedFile[]; problems: string[] } {
  const problems: string[] = [];
  const files: GeneratedFile[] = [];
  const seen = new Set<string>();
  let total = 0;
  for (const f of Array.isArray(raw) ? raw : []) {
    const o = (f ?? {}) as Partial<Record<"path" | "content", unknown>>;
    if (typeof o.path !== "string" || typeof o.content !== "string") continue;
    const path = safePath(o.path);
    if (!path) {
      problems.push(`Rejected unsafe or unsupported file path "${o.path.slice(0, 60)}".`);
      continue;
    }
    if (seen.has(path)) continue;
    const bytes = new TextEncoder().encode(o.content).length;
    if (bytes > BUILD_LIMITS.maxFileBytes) {
      problems.push(`${path} is too large.`);
      continue;
    }
    if (files.length >= BUILD_LIMITS.maxFiles || total + bytes > BUILD_LIMITS.maxTotalBytes) {
      problems.push("Too many or too large files; extras were dropped.");
      break;
    }
    seen.add(path);
    total += bytes;
    files.push({ path, content: o.content });
  }
  return { files, problems };
}

const EXTERNAL_RESOURCE = [
  /<script[^>]+src\s*=\s*["']\s*(https?:)?\/\//i,
  /<link[^>]+href\s*=\s*["']\s*(https?:)?\/\//i,
  /@import\s+(url\()?\s*["']?\s*(https?:)?\/\//i,
  /\bimport\s+[^;]*?from\s+["']\s*(https?:)?\/\//i,
  /\bimport\s*\(\s*["']\s*(https?:)?\/\//i,
  /\bfetch\s*\(\s*["'`]\s*https?:\/\//i,
];

function jsSyntax(content: string): string | null {
  for (const sourceType of ["module", "script"] as const) {
    try {
      parse(content, { ecmaVersion: "latest", sourceType });
      return null;
    } catch (e) {
      if (sourceType === "script") return e instanceof Error ? e.message : "Syntax error";
    }
  }
  return null;
}

function jsonSyntax(content: string): string | null {
  try {
    JSON.parse(content);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "Invalid JSON";
  }
}

/** Which source files a preference should visibly influence, and how we detect it statically. */
const PREFERENCE_SIGNALS: Partial<Record<PreferenceKey, { label: string; test: (all: string, css: string, js: string, html: string) => boolean }>> = {
  voice_first: { label: "Voice input via Web Speech API with typed fallback", test: (_a, _c, js) => /SpeechRecognition/.test(js) },
  keyboard_only: { label: "Visible keyboard focus styles", test: (_a, css) => /:focus(-visible)?/.test(css) },
  screen_reader: { label: "Live region for status announcements", test: (all) => /aria-live/.test(all) },
  reduced_motion: { label: "Honours prefers-reduced-motion", test: (_a, css) => /prefers-reduced-motion/.test(css) },
  high_contrast: { label: "High-contrast support", test: (_a, css, js) => /prefers-contrast|contrast/i.test(css + js) },
  large_text: { label: "Large base text size", test: (_a, css) => /font-size\s*:\s*(1[89]|[2-9]\d)px|font-size\s*:\s*1\.[1-9]\d*(rem|em)|font-size\s*:\s*[2-9](\.\d+)?(rem|em)/.test(css) },
  step_by_step: { label: "Step-by-step flow (Step X of Y)", test: (all) => /step\s*\$?\{?[^\n]{0,20}of/i.test(all) },
  flexible_pacing: { label: "Autosaves work locally", test: (_a, _c, js) => /localStorage|indexedDB/.test(js) },
};

export function validateBuild(files: GeneratedFile[], prefs: readonly string[]): BuildCheck[] {
  const checks: BuildCheck[] = [];
  const get = (p: string) => files.find((f) => f.path === p)?.content ?? "";
  for (const req of REQUIRED_FILES) {
    const present = files.some((f) => f.path === req && f.content.trim().length > 20);
    checks.push({ id: `file:${req}`, label: `Includes ${req}`, status: present ? "pass" : "fail", detail: present ? "Present" : "Missing or empty" });
  }
  const html = get("index.html");
  const css = files.filter((f) => f.path.endsWith(".css")).map((f) => f.content).join("\n");
  const js = files.filter((f) => /\.(m?js)$/.test(f.path)).map((f) => f.content).join("\n");
  const all = files.map((f) => f.content).join("\n");

  const linksCss = /<link[^>]+href\s*=\s*["']\.?\/?styles\.css["']/i.test(html);
  const linksJs = /<script[^>]+src\s*=\s*["']\.?\/?app\.js["']/i.test(html);
  checks.push({ id: "html:wiring", label: "index.html loads styles.css and app.js", status: linksCss && linksJs ? "pass" : "fail", detail: linksCss && linksJs ? "Both linked" : `${linksCss ? "" : "styles.css not linked. "}${linksJs ? "" : "app.js not loaded."}` });
  const structure = /<html[^>]*\blang=/i.test(html) && /<main[\s>]/i.test(html) && /<meta[^>]+viewport/i.test(html);
  checks.push({ id: "html:structure", label: "Accessible page structure (lang, main landmark, mobile viewport)", status: structure ? "pass" : "fail", detail: structure ? "Found" : "Missing lang, <main> or viewport meta" });

  for (const f of files) {
    if (/\.(m?js)$/.test(f.path)) {
      const err = jsSyntax(f.content);
      checks.push({ id: `syntax:${f.path}`, label: `${f.path} parses as valid JavaScript`, status: err ? "fail" : "pass", detail: err ?? "Parsed (not executed)" });
    } else if (/\.(json|webmanifest)$/.test(f.path)) {
      const err = jsonSyntax(f.content);
      checks.push({ id: `syntax:${f.path}`, label: `${f.path} is valid JSON`, status: err ? "fail" : "pass", detail: err ?? "Valid" });
    }
  }

  const external = files.filter((f) => /\.(html|css|m?js)$/.test(f.path) && EXTERNAL_RESOURCE.some((r) => r.test(f.content)));
  checks.push({
    id: "self-contained",
    label: "Self-contained: no CDNs, remote scripts or external APIs",
    status: external.length ? "fail" : "pass",
    detail: external.length ? `External resources in ${external.map((f) => f.path).join(", ")}` : "No external resources found",
  });

  for (const p of prefs) {
    const sig = PREFERENCE_SIGNALS[p as PreferenceKey];
    if (!sig) continue;
    const ok = sig.test(all, css, js, html);
    checks.push({ id: `pref:${p}`, label: sig.label, status: ok ? "pass" : "warn", detail: ok ? "Found in the code" : "Not detected by a static check — review before relying on it" });
  }
  return checks;
}

export const blockingFailures = (checks: BuildCheck[]) => checks.filter((c) => c.status === "fail");
