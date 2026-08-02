# Proma upstream (Helios desktop shell)

本目录是 [proma-ai/Proma](https://github.com/proma-ai/Proma) 的 **clone 魔改基线**，不是 Helios 自研 Electron 壳。

| 项 | 值 |
|----|-----|
| Upstream | https://github.com/proma-ai/Proma |
| Snapshot commit | `1ae8a1a471b39753123d6a339658dfe6a1fdc19b`（2026-08-01） |
| License | **AGPL-3.0**（见本目录 `LICENSE`） |
| Helios 决策 | `docs/decisions/ADR-004-proma-agpl-desktop-shell.md` |
| 切片 | `docs/architecture/slice-t-desktop-proma-shell.md` |

## 工具链

- 包管理 / 脚本：**Bun**（勿并入仓库根 pnpm workspace）
- 开发：`cd desktop && bun install && bun run dev`

## 魔改约定

1. 保留 Upstream 版权与 `LICENSE`；显著改动在 Helios 文档与本文件记录。
2. 默认产品路径改为 **Helios 业务对话**（本机 `/api/v1` + NL 卡片），不把 Proma Agent SDK 当 Helios 执行内核。
3. 重新拉取 Upstream：在临时目录 shallow clone → 对比合并；更新本文件与 `.proma-source` 的 commit。

## Baseline commit policy

- Initial `desktop/` import preserves the Proma-derived tree as-is, including upstream/default-skill whitespace.
- Do not mix future Helios Workflow Studio changes into the baseline import commit.
- Future Helios-authored desktop changes should pass focused `git diff --check` on touched files.

Machine-readable pin: `.proma-source`。
