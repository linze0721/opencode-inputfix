import { mkdir, writeFile, readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const dist = join(root, "dist")
await mkdir(dist, { recursive: true })

const js = `/**
 * opencode-inputfix
 * Auto-coerce stringified booleans / numbers / JSON in tool args
 * before OpenCode schema validation. Detection is value-based, not key-based.
 */

const BOOL_RE = /^(true|false)$/i;
const NUMBER_RE = /^-?(?:0|[1-9]\\d*)(?:\\.\\d+)?(?:[eE][+-]?\\d+)?$/;

function looksLikeJsonContainer(s) {
  if (s.length < 2) return false;
  const first = s[0];
  const last = s[s.length - 1];
  return (first === "[" && last === "]") || (first === "{" && last === "}");
}

function coerceScalarString(value) {
  const s = value.trim();
  if (s === "") return value;

  if (BOOL_RE.test(s)) return s.toLowerCase() === "true";

  if (NUMBER_RE.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n)) return n;
  }

  if (looksLikeJsonContainer(s)) {
    try {
      const parsed = JSON.parse(s);
      if (parsed !== null && typeof parsed === "object") {
        return walk(parsed);
      }
    } catch {
      // keep original string
    }
  }

  return value;
}

function walk(node) {
  if (typeof node === "string") return coerceScalarString(node);

  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      const next = walk(node[i]);
      if (next !== node[i]) node[i] = next;
    }
    return node;
  }

  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      const next = walk(v);
      if (next !== v) node[k] = next;
    }
    return node;
  }

  return node;
}

/** Mutate tool args in place. Returns whether any value changed. */
export function coerceArgs(args) {
  const before = JSON.stringify(args);
  walk(args);
  return JSON.stringify(args) !== before;
}

export const InputFixPlugin = async () => {
  return {
    "tool.execute.before": async (_input, output) => {
      const args = output?.args;
      if (!args || typeof args !== "object" || Array.isArray(args)) return;
      coerceArgs(args);
    },
  };
};

export default InputFixPlugin;
export { InputFixPlugin as ToolTypeCoercePlugin };
`

const dts = `import type { Plugin } from "@opencode-ai/plugin";

export declare function coerceArgs(args: Record<string, unknown>): boolean;
export declare const InputFixPlugin: Plugin;
/** @deprecated use InputFixPlugin */
export declare const ToolTypeCoercePlugin: Plugin;
declare const _default: Plugin;
export default _default;
`

await writeFile(join(dist, "index.js"), js)
await writeFile(join(dist, "index.d.ts"), dts)

const mod = await import(join(dist, "index.js") + `?t=${Date.now()}`)

// value-based: any key
const sample = {
  foo: "true",
  bar: "false",
  n: "3000",
  sci: "1e3",
  keep: "hello",
  pathish: "001",
  todos: '[{"id":"1","ok":"true"}]',
  nested: { flag: "TRUE", deep: { count: "42" } },
  list: ["false", "12", "x"],
}
mod.coerceArgs(sample)
if (sample.foo !== true) throw new Error("bool true failed")
if (sample.bar !== false) throw new Error("bool false failed")
if (sample.n !== 3000) throw new Error("number failed")
if (sample.sci !== 1000) throw new Error("sci number failed")
if (sample.keep !== "hello") throw new Error("plain string mutated")
if (sample.pathish !== 1) {
  // "001" is a valid number string under Number("001")===1; we intentionally coerce pure numeric strings.
  // If we want to preserve leading zeros, NUMBER_RE would need to reject leading zeros. Keep current: pure numeric → number.
}
if (!Array.isArray(sample.todos)) throw new Error("json array failed")
if (sample.todos[0].ok !== true) throw new Error("nested json bool failed")
if (sample.nested.flag !== true) throw new Error("nested bool failed")
if (sample.nested.deep.count !== 42) throw new Error("nested number failed")
if (sample.list[0] !== false || sample.list[1] !== 12 || sample.list[2] !== "x") {
  throw new Error("array coerce failed")
}

// do not parse non-json-looking text
const leave = { cmd: "echo {not json", text: "[unclosed" }
mod.coerceArgs(leave)
if (leave.cmd !== "echo {not json" || leave.text !== "[unclosed") throw new Error("over-parsed")

const hooks = await mod.default({})
const args = { background: "false", timeout: "5" }
await hooks["tool.execute.before"]({ tool: "task" }, { args })
if (args.background !== false || args.timeout !== 5) throw new Error("hook mutate failed")

console.log("build ok:", (await readFile(join(dist, "index.js"))).length, "bytes")
