# Slice T — Desktop Shell（Proma clone）

Status: Implemented
Date: 2026-08-01
Accepted-by: user（对话确认：壳子直接 clone Proma 再魔改，禁止自研桌面壳）
Parent: Slice S（业务对话）+ 桌面产品方向
Reuse: [proma-ai/Proma](https://github.com/proma-ai/Proma)
Gate: `docs/architecture/dev-gate.md`
License note: `docs/decisions/ADR-004-proma-agpl-desktop-shell.md`

## Goal

给 Helios 一条**桌面端**业务对话入口：本地窗口、会话留存、连本机 Helios API，主交互仍是自然语言 + NL 卡片（意图/步骤/审批/结果）。

交付物：

1. 将 **Proma** 开源桌面壳 **clone** 进仓库目录 `desktop/`（整仓可跑），再魔改——**禁止从零手写 Electron/Tauri 壳**
2. 保留 Proma 的桌面基建：Electron main/preload/IPC、窗口/托盘/更新骨架、本地会话存储分层
3. 把默认「多模型 Chat / Claude·Pi Agent」主路径，收敛为 **Helios 业务对话**：对接本机 `HELIOS_API`（compile / workflows / runs / approve）与 NL 卡片
4. 与 `web-business/` 共享卡片语义与 API 形状（可先复用 HTTP 契约，UI 可逐步对齐）

成功标准：macOS 上 `desktop/` 开发模式可启动窗口；用户用自然语言或快捷建议跑通至少一条 Helios demo 剧本（如 `opencli.demo-read`），看到步骤/结果卡片，且不依赖浏览器打开 `web-business`；重启后同一会话消息仍在。

## Non-goals

- 整仓替换 Helios Go runtime / YAML 契约
- 保留/运营 Proma 商业版渠道、Claude/Pi Agent SDK 作为 Helios 执行内核（可暂留代码，默认关闭）
- 飞书/钉钉/微信桥接（Proma 自带能力，本切片不验收）
- 完美多租户 / 自动更新上架
- 把 Cherry Studio / Chatbox 再 clone 一遍

## Reuse

| 对象 | 许可 | 用法 |
|------|------|------|
| **[Proma](https://github.com/proma-ai/Proma)** | **AGPL-3.0** | **直接 clone 魔改**（桌面壳） |
| Helios `/api/v1` | 本仓库 | 业务真相；桌面薄适配 |
| Slice S 卡片语义 | 本仓库 | 意图/步骤/审批/结果 |

**禁止：** 自研 Electron 壳；把 Proma Agent SDK 当成 Helios runtime；忽略 AGPL 传染性擅自闭源分发。

## Architecture

```text
业务同学（桌面窗口）
    ↕
desktop/                 ← Proma clone（Electron + React renderer）
  业务对话 UI + NL 卡片
  会话落盘：conversations/{id}.jsonl（appendMessage）
    ↕ HTTP localhost
Helios Go /api/v1
  compile / workflows / runs / approve
```

## Acceptance

```bash
# API（桌面依赖的剧本路径）
./scripts/smoke-desktop-helios-api.sh

# 桌面（需本机 Bun）
cd desktop && bun install && bun run dev
# 窗口内：「帮我看看 Hacker News 热帖」→ 步骤/结果卡
# 重启桌面后同一会话仍可见 user + assistant（含卡片 fence）
```

## Packaging / AGPL

- `desktop/LICENSE`（AGPL-3.0）经 `electron-builder` `extraResources` 打进安装包
- About：Helios 仓库 + Proma 上游归因 + AGPL 链接
- 默认 **不** publish 到 Proma GitHub；发 Helios Release 时在 CI 覆盖
- `productName: Helios` / `appId: com.helios.desktop`

## Status log

- 2026-08-01：Accepted；clone Proma → `desktop/`；品牌/业务对话/HN 卡片
- 2026-08-01：Helios 业务消息 `chat:append-message` 落盘；pending-approval localStorage
- 2026-08-01：AGPL LICENSE 进包、About/publish 修正、多尺寸 `icon.ico`
- 2026-08-01：`smoke-desktop-helios-api.sh` 绿 → Status **Implemented**
