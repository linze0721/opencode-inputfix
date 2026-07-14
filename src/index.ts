/**
 * Auto-coerce stringified tool args before OpenCode schema validation.
 *
 * Claude / proxies sometimes emit:
 *   background: "true"  instead of true
 *   timeout: "3000"     instead of 3000
 *   tags: "[\"a\"]"     instead of ["a"]
 *
 * Values are detected by content, not by field-name allowlists.
 * tool.execute.before mutates output.args in place before schema decode.
 */
import type { Plugin } from "@opencode-ai/plugin"

const BOOL_RE = /^(true|false)$/i
const NUMBER_RE = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/

function looksLikeJsonContainer(s: string): boolean {
  if (s.length < 2) return false
  const first = s[0]
  const last = s[s.length - 1]
  return (first === "[" && last === "]") || (first === "{" && last === "}")
}

function coerceScalarString(value: string): unknown {
  const s = value.trim()
  if (s === "") return value

  if (BOOL_RE.test(s)) return s.toLowerCase() === "true"

  if (NUMBER_RE.test(s)) {
    const n = Number(s)
    if (Number.isFinite(n)) return n
  }

  if (looksLikeJsonContainer(s)) {
    try {
      const parsed = JSON.parse(s)
      if (parsed !== null && typeof parsed === "object") {
        return walk(parsed)
      }
    } catch {
      // keep original string
    }
  }

  return value
}

function walk(node: unknown): unknown {
  if (typeof node === "string") return coerceScalarString(node)

  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      const next = walk(node[i])
      if (next !== node[i]) node[i] = next
    }
    return node
  }

  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>
    for (const [k, v] of Object.entries(obj)) {
      const next = walk(v)
      if (next !== v) obj[k] = next
    }
    return node
  }

  return node
}

/** Mutate tool args in place. Returns whether any value changed. */
function coerceArgs(args: Record<string, unknown>): boolean {
  const before = JSON.stringify(args)
  walk(args)
  return JSON.stringify(args) !== before
}

const InputFixPlugin: Plugin = async () => {
  return {
    "tool.execute.before": async (_input, output) => {
      const args = output?.args
      if (!args || typeof args !== "object" || Array.isArray(args)) return
      coerceArgs(args as Record<string, unknown>)
    },
  }
}

export default InputFixPlugin
export { InputFixPlugin, InputFixPlugin as ToolTypeCoercePlugin, coerceArgs }
