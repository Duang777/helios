# desktop/ — Helios 桌面端

- 来源与许可：`UPSTREAM.md`、根目录 ADR-004；`LICENSE`（AGPL-3.0）
- 切片：`docs/architecture/slice-t-desktop-proma-shell.md`（Implemented）
- Slice V NL 编译闭环：`docs/architecture/slice-v-desktop-nl-compile-loop.md`（Implemented）— 自由句走 `/compile` → 确认 → 保存 → 运行；仅 HN 快捷演示
- 工具链：**Bun only**（勿并入根 pnpm）
- 开发：`bun install && bun run dev`（需 Bun；API：`./scripts/dev-api.sh` 或 `dev-api-hatchet.sh`；compile 需 `./scripts/dev-pi-sidecar.sh`）
- 业务对话：`heliosBusinessEnabledAtom`（默认开）→ `ChatView` → `renderer/lib/helios/`，消息经 `appendMessage` 落盘
- 环境：`VITE_HELIOS_API_BASE`（默认 `http://127.0.0.1:8080/api/v1`）
- API smoke：`../scripts/smoke-desktop-helios-api.sh`（HN）；`../scripts/smoke-desktop-nl-compile.sh`（compile→save→run）
- 不把桌面 UI 层的 Agent 适配器当 Helios runtime
