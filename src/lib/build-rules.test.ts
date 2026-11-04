import { describe, expect, it } from "vitest";
import { blockingFailures, safePath, sanitizeFiles, validateBuild, type GeneratedFile } from "./build-rules";

const good: GeneratedFile[] = [
  { path: "index.html", content: '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="./styles.css"></head><body><main><p aria-live="polite"></p></main><script type="module" src="./app.js"></script></body></html>' },
  { path: "styles.css", content: "body{font-size:18px} :focus-visible{outline:3px solid} @media (prefers-reduced-motion: reduce){*{animation:none}}" },
  { path: "app.js", content: "const R = window.SpeechRecognition || window.webkitSpeechRecognition; export const x = 1; localStorage.setItem('a','b');" },
  { path: "README.md", content: "# Tool\\nOpen index.html in your browser to run it." },
];

describe("Build with Muse checks", () => {
  it("rejects unsafe paths", () => {
    expect(safePath("../etc/passwd")).toBeNull();
    expect(safePath("/abs.js")).toBeNull();
    expect(safePath("run.sh")).toBeNull();
    expect(safePath("./app.js")).toBe("app.js");
  });

  it("drops unsafe files and keeps safe ones", () => {
    const { files, problems } = sanitizeFiles([{ path: "app.js", content: "x" }, { path: "../x.js", content: "y" }]);
    expect(files.map((f) => f.path)).toEqual(["app.js"]);
    expect(problems.length).toBe(1);
  });

  it("passes a complete self-contained app", () => {
    expect(blockingFailures(validateBuild(good, ["voice_first", "reduced_motion", "keyboard_only"]))).toEqual([]);
  });

  it("fails when a required file is missing", () => {
    const checks = validateBuild(good.filter((f) => f.path !== "README.md"), []);
    expect(checks.find((c) => c.id === "file:README.md")?.status).toBe("fail");
  });

  it("fails JavaScript that does not parse, without running it", () => {
    const bad = good.map((f) => (f.path === "app.js" ? { ...f, content: "globalThis.__ran = true; function (" } : f));
    expect(validateBuild(bad, []).find((c) => c.id === "syntax:app.js")?.status).toBe("fail");
    expect((globalThis as Record<string, unknown>)["__ran"]).toBeUndefined();
  });

  it("fails apps that load remote scripts or call external APIs", () => {
    const cdn = good.map((f) => (f.path === "index.html" ? { ...f, content: f.content.replace("</head>", '<script src="https://cdn.example.com/x.js"></script></head>') } : f));
    expect(validateBuild(cdn, []).find((c) => c.id === "self-contained")?.status).toBe("fail");
    const api = good.map((f) => (f.path === "app.js" ? { ...f, content: "fetch('https://api.example.com/x')" } : f));
    expect(validateBuild(api, []).find((c) => c.id === "self-contained")?.status).toBe("fail");
  });

  it("warns when a chosen preference isn't detected", () => {
    const noVoice = good.map((f) => (f.path === "app.js" ? { ...f, content: "export const x = 1;" } : f));
    expect(validateBuild(noVoice, ["voice_first"]).find((c) => c.id === "pref:voice_first")?.status).toBe("warn");
  });
});
