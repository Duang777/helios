# OpenCLI 接入（无公开 API → CLI）

用 [OpenCLI](https://github.com/jackwener/opencli)（`@jackwener/opencli`，Apache-2.0）把网页结晶成确定性命令，再经 Helios 包装命令 `helios-opencli` 进 Runtime。

设计：`docs/architecture/slice-p-opencli-adapter.md`（Slice P）·  
会话站：`docs/architecture/slice-q-opencli-session-read.md`（Slice Q）

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

| Workflow | 命令 | 依赖 |
|----------|------|------|
| `opencli.demo-read` | `hackernews top` | 无 Chrome（Slice P） |
| `opencli.bilibili-hot` | `bilibili hot` | OpenCLI Browser Bridge（Slice Q） |

```bash
./scripts/smoke-opencli.sh              # HN
./scripts/smoke-opencli-session.sh      # bilibili；无 Bridge 则 SKIP
```

建会话（可选）：

```bash
opencli doctor
opencli bilibili login                  # 浏览器登录后
helios-opencli bilibili whoami -f json
```

## Allowlist（v0.2.0）

| Path | 说明 |
|------|------|
| `list` | 列出 OpenCLI 命令 |
| `doctor` | 浏览器桥诊断 |
| `hackernews top` | 公共只读（Slice P） |
| `bilibili hot` | 会话站只读（Slice Q） |
| `bilibili whoami` | 登录探针 |
| `bilibili login` | 建会话（写；不进默认剧本） |

需要新站点时：先用 OpenCLI `explore` / `generate` 结晶，再扩 `helios-opencli` introspect（新切片）。
