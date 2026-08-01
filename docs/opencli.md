# OpenCLI 接入（无公开 API → CLI）

用 [OpenCLI](https://github.com/jackwener/opencli)（`@jackwener/opencli`，Apache-2.0）把网页结晶成确定性命令，再经 Helios 包装命令 `helios-opencli` 进 Runtime。

设计：`docs/architecture/slice-p-opencli-adapter.md`（Slice P）

## 在接入梯子里的位置

```text
官方 CLI → OpenAPI factory → OpenCLI(web→CLI) → uses:gui → human_help
```

- **做：** 已结晶 adapter 命令（allowlist）  
- **不做：** 把 `opencli browser` 自由会话当默认 DAG 步骤  

## 一次性准备

```bash
npm i -g @jackwener/opencli
# 或: export HELIOS_OPENCLI_BIN=/path/to/opencli

./scripts/dev-api.sh          # 另开终端
./scripts/register-opencli.sh
```

## 样板剧本

**`opencli.demo-read`**：`hackernews top`（公共 API，无需 Chrome 登录）→ evidence。

```bash
./scripts/smoke-opencli.sh
```

控制台跑 `opencli.demo-read`，或：

```bash
helios-opencli hackernews top --limit 5 -f json
```

## Allowlist（v0.1.0）

| Path | 说明 |
|------|------|
| `list` | 列出 OpenCLI 命令 |
| `doctor` | 浏览器桥诊断 |
| `hackernews top` | 只读样板（Slice P） |

需要新站点时：先用 OpenCLI `explore` / `generate` 结晶，再扩 `helios-opencli` introspect（新切片）。
