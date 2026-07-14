/**
 * Coerce common LLM type mistakes before OpenCode schema validation.
 *
 * Claude / proxies sometimes emit:
 *   background: "true"  instead of true
 *   timeout: "3000"     instead of 3000
 *   tags: "[\"a\"]"     instead of ["a"]
 *
 * tool.execute.before runs before Tool.define() schema decode, and mutates
 * output.args in place. That is the supported recovery path when the model
 * stringifies booleans/numbers/JSON.
 */
import type { Plugin } from "@opencode-ai/plugin"

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
])

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
])

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
])

function coerceValue(key: string, value: unknown): unknown {
  if (typeof value === "string") {
    const s = value.trim()

    if (BOOL_KEYS.has(key)) {
      const lower = s.toLowerCase()
      if (lower === "true" || s === "1" || lower === "yes") return true
      if (lower === "false" || s === "0" || lower === "no") return false
    }

    if (
      NUMBER_KEYS.has(key) &&
      s !== "" &&
      !Number.isNaN(Number(s)) &&
      /^-?\d+(\.\d+)?$/.test(s)
    ) {
      return Number(s)
    }

    if (
      JSON_KEYS.has(key) &&
      ((s.startsWith("[") && s.endsWith("]")) || (s.startsWith("{") && s.endsWith("}")))
    ) {
      try {
        return JSON.parse(s)
      } catch {
        // keep original
      }
    }
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    coerceArgs(value as Record<string, unknown>)
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      if (item && typeof item === "object") coerceArgs(item as Record<string, unknown>)
    }
  }

  return value
}

function coerceArgs(args: Record<string, unknown>): boolean {
  let changed = false
  for (const [key, value] of Object.entries(args)) {
    const next = coerceValue(key, value)
    if (next !== value) {
      args[key] = next
      changed = true
    }
  }
  return changed
}

const ToolTypeCoercePlugin: Plugin = async () => {
  return {
    "tool.execute.before": async (_input, output) => {
      const args = output?.args
      if (!args || typeof args !== "object" || Array.isArray(args)) return
      coerceArgs(args as Record<string, unknown>)
    },
  }
}

export default ToolTypeCoercePlugin
export { ToolTypeCoercePlugin, coerceArgs }
