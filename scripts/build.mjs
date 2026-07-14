import { mkdir, writeFile, readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const dist = join(root, "dist")
await mkdir(dist, { recursive: true })

// Hand-written ESM build: no runtime deps, works without tsc/bun.
const js = `/**
 * opencode-inputfix
 * Coerce stringified booleans/numbers/JSON in tool args before schema validation.
 */

const BOOL_KEYS = new Set([
  "background",
  "run_in_background",
  "block",
  "full_session",
  "include_thinking",
  "include_tool_results",
  "from_end",
  "dryRun",
  "dry_run",
  "extract_main",
  "include_metadata",
  "save_binary",
  "matchCase",
  "matchWholeWords",
  "useRegexp",
  "replaceAll",
  "multiple",
]);

const NUMBER_KEYS = new Set([
  "timeout",
  "numResults",
  "limit",
  "offset",
  "context",
  "message_limit",
  "thinking_max_chars",
  "lastN",
  "port",
  "max_tokens",
  "temperature",
]);

const JSON_KEYS = new Set([
  "todos",
  "questions",
  "options",
  "images",
  "globs",
  "paths",
  "language",
  "skills",
  "mcps",
]);

function coerceValue(key, value) {
  if (typeof value === "string") {
    const s = value.trim();

    if (BOOL_KEYS.has(key)) {
      const lower = s.toLowerCase();
      if (lower === "true" || s === "1" || lower === "yes") return true;
      if (lower === "false" || s === "0" || lower === "no") return false;
    }

    if (
      NUMBER_KEYS.has(key) &&
      s !== "" &&
      !Number.isNaN(Number(s)) &&
      /^-?\\d+(\\.\\d+)?$/.test(s)
    ) {
      return Number(s);
    }

    if (
      JSON_KEYS.has(key) &&
      ((s.startsWith("[") && s.endsWith("]")) || (s.startsWith("{") && s.endsWith("}")))
    ) {
      try {
        return JSON.parse(s);
      } catch {
        // keep original
      }
    }
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    coerceArgs(value);
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      if (item && typeof item === "object") coerceArgs(item);
    }
  }

  return value;
}

export function coerceArgs(args) {
  let changed = false;
  for (const [key, value] of Object.entries(args)) {
    const next = coerceValue(key, value);
    if (next !== value) {
      args[key] = next;
      changed = true;
    }
  }
  return changed;
}

export const ToolTypeCoercePlugin = async () => {
  return {
    "tool.execute.before": async (_input, output) => {
      const args = output?.args;
      if (!args || typeof args !== "object" || Array.isArray(args)) return;
      coerceArgs(args);
    },
  };
};

export default ToolTypeCoercePlugin;
`

const dts = `import type { Plugin } from "@opencode-ai/plugin";

export declare function coerceArgs(args: Record<string, unknown>): boolean;
export declare const ToolTypeCoercePlugin: Plugin;
declare const _default: Plugin;
export default _default;
`

await writeFile(join(dist, "index.js"), js)
await writeFile(join(dist, "index.d.ts"), dts)

// smoke test
const mod = await import(join(dist, "index.js") + `?t=${Date.now()}`)
const sample = { background: "true", timeout: "3000", todos: '[{"id":"1"}]', keep: "x" }
mod.coerceArgs(sample)
if (sample.background !== true) throw new Error("bool coerce failed")
if (sample.timeout !== 3000) throw new Error("number coerce failed")
if (!Array.isArray(sample.todos)) throw new Error("json coerce failed")
if (sample.keep !== "x") throw new Error("unknown key mutated")
const hooks = await mod.default({})
if (typeof hooks["tool.execute.before"] !== "function") throw new Error("plugin shape invalid")
const args = { background: "false" }
await hooks["tool.execute.before"]({ tool: "task" }, { args })
if (args.background !== false) throw new Error("hook mutate failed")

console.log("build ok:", (await readFile(join(dist, "index.js"))).length, "bytes")
