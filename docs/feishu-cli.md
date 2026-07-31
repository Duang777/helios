# Feishu / Lark CLI 接入

使用官方 [`lark-cli`](https://github.com/larksuite/cli)（`@larksuite/cli`），经 Helios 包装命令 `helios-lark` 注册进 Runtime。

设计：`docs/architecture/slice-i-feishu-thicken.md`（Slice I）

## 为什么要包装

Helios 要求 CLI 提供 `introspect`。官方 `lark-cli` 没有该子命令，所以 `helios-lark`：

- 提供 Helios 契约的 `introspect`（allowlist）
- 其余参数原样转发给本机 `lark-cli`

当前 wrapper 版本：`0.2.0`。

## 一次性准备

```bash
# 1. 安装官方 CLI（若还没有）
npx @larksuite/cli@latest install

# 2. 启动 Helios API（另开终端）
./scripts/dev-api.sh

# 3. 注册包装 CLI + 导入飞书工作流
./scripts/register-lark.sh

# 4. 配置并登录飞书（交互/浏览器）
lark-cli config init --new
lark-cli auth login --recommend
lark-cli auth status
lark-cli doctor
```

## 自带工作流

| ID | 作用 | 需登录 |
|---|---|---|
| `feishu.doctor` | 只跑 `doctor` | 否（无配置会失败并留 hint） |
| `feishu.auth-status` | `auth status` + `doctor` | 建议 |
| `feishu.chat-list` | `im +chat-list` | 是 |
| `feishu.calendar-agenda` | `calendar +agenda` | 是 |
| `feishu.my-tasks` | `task +get-my-tasks` | 是 |
| `feishu.docs-search` | `docs +search --query` | 是 |
| `feishu.sheets-cells-get` | `sheets +cells-get`（token + range） | 是 |
| `feishu.send-text` | 审批后发 IM 文本 | 是 |
| `feishu.calendar-create` | 审批后创建日历事件 | 是 |

写操作（`send-text` / `calendar-create`）一律：dry-run → approval → write。

未完成 `config init` 时，只读工作流会失败，并在证据里留下官方 JSON 错误（含 hint）。这是预期行为。

## 控制台用法

1. 打开 `web` 控制台  
2. 左侧加载 `feishu.doctor`  
3. 运行；若失败，按证据里的 hint 去登录  
4. 登录成功后再跑 `feishu.auth-status` / `feishu.calendar-agenda` / `feishu.chat-list`  
5. 发消息用 `feishu.send-text`；建日程用 `feishu.calendar-create`（写操作会卡审批）

## 注意

- 凭证在 `lark-cli` 本地配置/钥匙串，不要写进 YAML  
- 发消息 / 建日程属于写操作，默认必须审批  
- 扩展 allowlist：改 `backend/cmd/helios-lark/main.go` 的 introspect，bump 版本，再 `register-lark.sh`  
- 官方 shortcut 以本机 `lark-cli <domain> --help` 为准  

## 无凭证验收

```bash
./scripts/smoke-feishu-lark.sh
```
