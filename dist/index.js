/**
 * opencode-inputfix
 * Auto-coerce stringified booleans / numbers / JSON in tool args
 * before OpenCode schema validation. Detection is value-based, not key-based.
 */

const BOOL_RE = /^(true|false)$/i;
const NUMBER_RE = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;

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
