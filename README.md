# PiBun

[pi agent](https://pi.dev) 的可视化桌面客户端 —— 基于 [Electrobun](https://framework.blackboard.sh/electrobun/) + Vue 3。

面向小白用户：**无需配置 Node 等任何环境，打开应用、粘贴一个 API Key 即可开始与 pi agent 对话。**

## 特性

- 🪶 基于 Electrobun（Bun 运行时 + 系统 Webview），安装包体积远小于 Electron
- 🔑 零环境配置：API Key 由 pi 自身持久化（`~/.pi/agent/auth.json`），一次粘贴永久生效
- 💬 Codex 风格聊天界面：Markdown 流式渲染、思考过程折叠、工具调用卡片（bash/read/edit/write…）
- 🗂 会话管理：历史会话列表、恢复会话（复用 pi 的 JSONL 会话存储）
- 🤖 40+ 模型服务商：Anthropic / OpenAI / Google / DeepSeek / Kimi / 智谱 / OpenRouter…
- 🛑 支持中断运行、流式中插队（steer）
- 💾 应用设置存 SQLite（`bun:sqlite`，`~/.pibun/settings.db`）

## 架构

```
Electrobun 主进程（Bun 运行时）
 ├── src/bun/pi-service.ts   pi SDK 封装（createAgentSession / ModelRuntime / SessionManager）
 ├── src/bun/db.ts           bun:sqlite 应用设置存储
 ├── src/bun/index.ts        窗口 + Electrobun RPC 桥
 └── src/shared/rpc-schema.ts  bun <-> webview 类型安全协议

Webview（Vue 3 + Vite）
 └── src/mainview/
      ├── store.ts           事件流 → UI 渲染条目
      ├── actions.ts         RPC 调用动作层
      └── components/        Sidebar / ChatView / MessageItem / ToolCallCard / InputBox / SettingsModal
```

关键设计：**直接在 Electrobun 的 Bun 主进程里 `import` pi SDK**（不走子进程、不需要用户装 Node），
agent 事件通过 Electrobun RPC 原样推送到 webview 渲染。

## 开发

```bash
bun install
bun run start       # vite build + electrobun dev
bun run dev:hmr     # HMR 模式（vite dev server + electrobun）
```

## 打包

```bash
bun run build:stable   # 产出 build/stable-win-x64/ 下的安装包
```

## 配置说明

| 配置项 | 位置 |
|---|---|
| API Key | 应用内「设置」弹窗，存 `~/.pi/agent/auth.json`（pi 原生机制） |
| 默认模型 / 工作目录 | 应用内「设置」弹窗，存 `~/.pibun/settings.db` |
| 会话数据 | pi 原生 JSONL，位于 `~/.pi/agent/sessions/` |
