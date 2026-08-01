# ADR-004 — Proma（AGPL-3.0）作为桌面壳来源

Status: Accepted
Date: 2026-08-01

## Context

Helios 需要桌面端业务对话壳。评估后决定 **clone [Proma](https://github.com/proma-ai/Proma)** 再魔改，禁止自研 Electron/Tauri 壳。Proma 社区版为 **AGPL-3.0**。

## Decision

1. 将 Proma 源码置于仓库 `desktop/`，作为 Helios 桌面壳上游。
2. **开源分发**（含修改后的桌面应用）：遵守 AGPL-3.0（提供对应源码、保留许可声明）。
3. **闭源 / SaaS 商用**若不接受 AGPL 义务：不得把 `desktop/` 衍生二进制按专有许可发布；需自行取得 Proma 商业授权或更换 MIT/Apache 壳。
4. Helios **Go 后端与 `web/` / `web-business/`** 保持原有许可与边界；不因 `desktop/` 自动把整个 monorepo 宣称为单一 AGPL 作品——但合并分发时仍应按律师意见处理衍生范围。工程默认：**桌面产物单独声明 AGPL**。

## Consequences

- 魔改必须保留 Proma 版权与 LICENSE 文件（见 `desktop/`）。
- 贡献者向 `desktop/` 提交代码即进入 AGPL 范围（与 Proma 上游贡献条款叠加时以各项目 LICENSE 为准）。
- 选型复盘见 Slice T：`docs/architecture/slice-t-desktop-proma-shell.md`。
