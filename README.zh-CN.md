# opencode-inputfix

[English](./README.md)

OpenCode 插件：在 schema 校验前，修正模型把 tool 参数类型写错的问题。

常见报错：

```text
SchemaError(Expected boolean | undefined, got "true" at ["background"])
Please rewrite the input so it satisfies the expected schema.
```

Claude / 某些代理有时会把参数类型序列化成字符串：

| 错误输入 | 修正后 |
|---|---|
| `"true"` / `"false"` | `true` / `false` |
| `"3000"` | `3000` |
| `"[\"a\"]"`（已知列表字段） | `["a"]` |

插件挂在 `tool.execute.before`，在 OpenCode 严格 schema decode **之前** 原地修改 `output.args`。

## 安装

写入 `~/.config/opencode/opencode.json`（或项目级 `opencode.json`）：

### GitHub

```json
{
  "plugin": [
    "github:linze0721/opencode-inputfix"
  ]
}
```

### npm（发布后）

```json
{
  "plugin": [
    "opencode-inputfix@0.1.0"
  ]
}
```

### 本地路径

```json
{
  "plugin": [
    "file:///absolute/path/to/opencode-inputfix"
  ]
}
```

改完插件配置后需要 **重启 OpenCode**。

## 会修正哪些字段

布尔类（字符串 → boolean）：

- `background`, `run_in_background`, `block`, `full_session`
- `include_thinking`, `include_tool_results`, `from_end`
- `dryRun`, `dry_run`, `extract_main`, `include_metadata`, `save_binary`
- `matchCase`, `matchWholeWords`, `useRegexp`, `replaceAll`, `multiple`

数字类（数字字符串 → number）：

- `timeout`, `numResults`, `limit`, `offset`, `context`
- `message_limit`, `thinking_max_chars`, `lastN`, `port`
- `max_tokens`, `temperature`

JSON 字符串类：

- `todos`, `questions`, `options`, `images`, `globs`, `paths`
- `language`, `skills`, `mcps`

只做明确、安全的转换；未知字段不会动。

## 开发

```bash
git clone https://github.com/linze0721/opencode-inputfix.git
cd opencode-inputfix
node ./scripts/build.mjs
```

`dist/index.js` 是纯 ESM，运行时不依赖额外 npm 包。

## 协议

MIT
