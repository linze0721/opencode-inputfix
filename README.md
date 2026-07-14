# opencode-inputfix

[中文文档](./README.zh-CN.md)

OpenCode plugin that fixes a common Claude / proxy issue:

```text
SchemaError(Expected boolean | undefined, got "true" at ["background"])
Please rewrite the input so it satisfies the expected schema.
```

Some models occasionally emit tool arguments with stringified types:

| dirty input | coerced to |
|---|---|
| `"true"` / `"false"` | `true` / `false` |
| `"3000"` | `3000` |
| `"[\"a\"]"` on known list fields | `["a"]` |

The plugin hooks `tool.execute.before` and mutates `output.args` **before** OpenCode's strict schema decode.

## Install

Add to `~/.config/opencode/opencode.json` (or project `opencode.json`):

### From GitHub / npm path

```json
{
  "plugin": [
    "github:linze0721/opencode-inputfix"
  ]
}
```

Or after publishing to npm:

```json
{
  "plugin": [
    "opencode-inputfix@0.1.0"
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

## What it coerces

Boolean-like keys (string → boolean):

- `background`, `run_in_background`, `block`, `full_session`
- `include_thinking`, `include_tool_results`, `from_end`
- `dryRun`, `dry_run`, `extract_main`, `include_metadata`, `save_binary`
- `matchCase`, `matchWholeWords`, `useRegexp`, `replaceAll`, `multiple`

Number-like keys (numeric string → number):

- `timeout`, `numResults`, `limit`, `offset`, `context`
- `message_limit`, `thinking_max_chars`, `lastN`, `port`
- `max_tokens`, `temperature`

JSON-string list/object keys:

- `todos`, `questions`, `options`, `images`, `globs`, `paths`
- `language`, `skills`, `mcps`

Only safe, explicit conversions are applied. Unknown keys are left alone.

## Develop

```bash
git clone https://github.com/linze0721/opencode-inputfix.git
cd opencode-inputfix
node ./scripts/build.mjs
```

`dist/index.js` is plain ESM and has no runtime dependency besides the OpenCode host.

## License

MIT
