# Feishu / Lark CLI 接入

使用官方 [`lark-cli`](https://github.com/larksuite/cli)（`@larksuite/cli`），经 Helios 包装命令 `helios-lark` 注册进 Runtime。

## 为什么要包装

Helios 要求 CLI 提供 `introspect`。官方 `lark-cli` 没有该子命令，所以 `helios-lark`：

- 提供 Helios 契约的 `introspect`
- 其余参数原样转发给本机 `lark-cli`

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

| ID | 作用 |
|---|---|
| `feishu.doctor` | 只跑 `doctor`，检查 CLI/配置/连通 |
| `feishu.auth-status` | `auth status` + `doctor` |
| `feishu.send-text` | 审批后 `im +messages-send`（需 `chat_id`、`text`） |

未完成 `config init` 时，只读工作流会失败，并在证据里留下官方 JSON 错误（含 hint）。这是预期行为。

## 控制台用法

1. 打开 `web` 控制台  
2. 左侧加载 `feishu.doctor`  
3. 运行；若失败，按证据里的 hint 去登录  
4. 登录成功后再跑 `feishu.auth-status`  
5. 发消息用 `feishu.send-text`（写操作会卡审批）

## 注意

- 凭证在 `lark-cli` 本地配置/钥匙串，不要写进 YAML  
- 发消息属于写操作，默认必须审批  
- 当前 `helios-lark` introspect 只开放少量命令；要加日历/云文档等，扩展 `cmd/helios-lark` 的 allowlist 即可  
