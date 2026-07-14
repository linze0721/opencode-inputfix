# opencode-inputfix

[English](./README.md)

OpenCode 插件：在 schema 校验前，**自动**修正模型把 tool 参数类型写错的问题。

常见报错：

```text
SchemaError(Expected boolean | undefined, got "true" at ["background"])
Please rewrite the input so it satisfies the expected schema.
```

Claude / 某些代理有时会把参数序列化成字符串。本插件按**值内容**识别（不再依赖字段名白名单）：

| 错误输入 | 修正后 |
|---|---|
| 任意字段 `"true"` / `"false"` | `true` / `false` |
| 任意字段 `"3000"` / `"1e3"` | `3000` / `1000` |
| 合法 JSON 字符串 `"[...]"` / `"{...}"` | 解析成数组 / 对象 |

会递归处理嵌套对象和数组；普通文本字符串不动。

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

### 本地路径

```json
{
  "plugin": [
    "file:///absolute/path/to/opencode-inputfix"
  ]
}
```

改完后需要 **重启 OpenCode**。

## 修正规则

对 tool args 下每个字符串叶子：

1. **布尔**：整段就是 `true` / `false`（忽略大小写）→ boolean  
2. **数字**：整段都是数字字面量（`42`、`-3.14`、`1e3`）→ number  
3. **JSON**：完整的 `[...]` 或 `{...}` 且 `JSON.parse` 成功 → 对象/数组（再递归）  
4. 其他情况保持原字符串  

纯数字且带前导零的 `"001"` 会变成数字 `1`。路径、命令、残缺括号等不会被强行解析。

## 开发

```bash
git clone https://github.com/linze0721/opencode-inputfix.git
cd opencode-inputfix
node ./scripts/build.mjs
```

`dist/index.js` 是纯 ESM，运行时不依赖额外 npm 包。

## 协议

MIT
