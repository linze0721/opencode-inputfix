# opencode-inputfix

[中文文档](./README.zh-CN.md)

OpenCode plugin that fixes a common Claude / proxy issue:

```text
SchemaError(Expected boolean | undefined, got "true" at ["background"])
Please rewrite the input so it satisfies the expected schema.
```

Some models occasionally emit tool arguments with stringified types. This plugin **auto-detects values** (not field-name allowlists) and coerces:

| dirty input | coerced to |
|---|---|
| `"true"` / `"false"` (any key) | `true` / `false` |
| `"3000"` / `"1e3"` (any key) | `3000` / `1000` |
| `"[...]"` / `"{...}"` valid JSON | parsed array / object |

Nested objects/arrays are walked recursively. Plain text strings are left unchanged.

The plugin hooks `tool.execute.before` and mutates `output.args` **before** OpenCode's strict schema decode.

## Install

Add to `~/.config/opencode/opencode.json` (or project `opencode.json`):

### From GitHub

```json
{
  "plugin": [
    "github:linze0721/opencode-inputfix"
  ]
}
```

### Local path

```json
{
  "plugin": [
    "file:///absolute/path/to/opencode-inputfix"
  ]
}
```

Restart OpenCode after changing plugins.

## Coercion rules

Applied to **every string leaf** under tool args:

1. **Boolean**: exact `true` / `false` (case-insensitive) → boolean  
2. **Number**: full-string numeric literal (`42`, `-3.14`, `1e3`) → number  
3. **JSON**: string that is a complete `[...]` or `{...}` and `JSON.parse` succeeds → object/array (then recurse)  
4. Otherwise leave the string as-is  

Leading-zero pure digits like `"001"` become number `1` (same as `Number("001")`). Non-numeric text, shell snippets, file paths, and partial braces are not forced.

## Develop

```bash
git clone https://github.com/linze0721/opencode-inputfix.git
cd opencode-inputfix
node ./scripts/build.mjs
```

`dist/index.js` is plain ESM and has no runtime dependency besides the OpenCode host.

## License

MIT
