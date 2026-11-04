// Server-only: asks Muse Wonder for a complete, self-contained web app from an approved blueprint.
// The output is parsed and pattern-checked by build-rules.ts; it is never executed here.
import { CHAT_ENDPOINT, META_MODELS, MetaUnavailableError, codeJSON } from "./meta.server";
import { accessibilityRequirements, type Blueprint } from "./made-for-me";
import { blockingFailures, REQUIRED_FILES, sanitizeFiles, validateBuild, type GeneratedFile, type MuseBuild } from "./build-rules";

const FILES_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["files"],
  properties: {
    files: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["path", "content"],
        properties: { path: { type: "string" }, content: { type: "string" } },
      },
    },
  },
};

const SYSTEM = [
  "You are a senior front-end engineer. Write the COMPLETE source code for a small, working, personal web app described by the blueprint.",
  "Stack: plain HTML, CSS and modern JavaScript (ES2020, no frameworks, no build step, no npm packages). It must work by opening index.html in a browser or with any static file server.",
  `Return these files at minimum: ${REQUIRED_FILES.join(", ")}. You may add up to 4 more (extra .js modules, manifest.webmanifest, an .svg icon). Paths are relative, no folders deeper than one level.`,
  "index.html must have <html lang>, a viewport meta tag, a <main> landmark, link ./styles.css and load ./app.js (type=module allowed).",
  "Strictly self-contained: NO CDNs, remote fonts, remote scripts, analytics, external APIs, accounts or paid services. Only browser APIs (localStorage/IndexedDB, Web Speech API with a typed fallback when unsupported, File/Blob for export, Notifications only if the blueprint needs them).",
  "Store data only on the device. Include a way to export the data (JSON download) and to delete all data.",
  "Implement every MUST feature fully, and SHOULD features where reasonable. No placeholders, no TODOs, no lorem ipsum. Seed with no fake personal data — start empty with a friendly first-use hint.",
  "Implement every accessibility requirement listed; they are authoritative. Use semantic HTML, labelled controls, visible :focus-visible styles, and an aria-live status region.",
  "README.md: what the tool is for, how to run it (open index.html, or `npx serve .`), how to use it, where data is stored and how to delete it, and a checklist of the acceptance tests to try by hand.",
  "If you show/hide screens with the hidden attribute, include `[hidden]{display:none !important}` in styles.css so CSS display rules can't override it; only the current step should be visible.",
  "Keep the code clear and reasonably compact (aim under 900 lines total).",
].join(" ");

function brief(b: Blueprint) {
  return {
    tool_name: b.tool_name,
    purpose: b.purpose,
    intended_benefit: b.intended_benefit,
    user_requirements: b.user_requirements,
    core_features: b.core_features,
    interface: b.interface,
    accessibility_requirements: Array.from(new Set([...accessibilityRequirements(b.preferences), ...b.accessibility])),
    data_privacy: b.data_privacy,
    acceptance_tests: b.acceptance_tests,
    first_use_validation: b.first_use_validation,
    design_decisions: b.design_decisions,
    // Only details the person approved for sharing are in the blueprint.
    approved_personal_context: b.personal_context.map((d) => d.text),
  };
}

async function ask(user: unknown): Promise<GeneratedFile[]> {
  try {
    const raw = await codeJSON<{ files: unknown }>({ schemaName: "web_app_files", schema: FILES_SCHEMA, system: SYSTEM, user: JSON.stringify(user) });
    return sanitizeFiles(raw.files).files;
  } catch (e) {
    if (e instanceof MetaUnavailableError)
      throw new Error("Muse Wonder couldn't finish writing your app right now. Nothing was charged to you — please try again.");
    if (e instanceof SyntaxError) throw new Error("Muse Wonder's answer was cut off or unreadable. Please try again.");
    throw e;
  }
}

export async function runMuseBuild(b: Blueprint): Promise<MuseBuild> {
  let files = await ask({ blueprint: brief(b) });
  let checks = validateBuild(files, b.preferences);
  let attempts = 1;
  const failing = blockingFailures(checks);
  // One automatic repair pass, sending only the failed checks back.
  if (failing.length) {
    attempts = 2;
    const repaired = await ask({
      blueprint: brief(b),
      previous_files: files,
      fix_these_problems: failing.map((c) => `${c.label}: ${c.detail}`),
      instruction: "Return the full corrected set of files.",
    });
    if (repaired.length) {
      files = repaired;
      checks = validateBuild(files, b.preferences);
    }
  }
  if (blockingFailures(checks).some((c) => c.id.startsWith("file:") || c.id === "self-contained"))
    throw new Error("Muse Wonder's app didn't pass the safety and completeness checks, so it wasn't saved. Please try again.");
  return {
    tool_name: b.tool_name,
    files,
    checks,
    model: META_MODELS.code,
    endpoint: `POST ${CHAT_ENDPOINT}`,
    attempts,
    source: "meta_live",
    generated_at: new Date().toISOString(),
  };
}
