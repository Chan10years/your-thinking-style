# YourThinkingStyle

一个帮助你理解“自己的思路为什么在代码里走偏了”的 C++ 错题分析工具。
它结合题目、代码、解题思路和失败信息，输出：

- 思路还原
- 错误解释
- 修正方向

当前应用支持两种运行模式：

- `local`：默认模式，无需账户和数据库，直接使用诊断工作台。
- `hosted`：带邮箱账户、资料、头像、诊断历史和使用统计，需要 PostgreSQL。

## 快速开始

要求 Node.js 24 LTS。依赖版本由 `package-lock.json` 锁定。

```bash
npm ci
copy .env.example .env.local # macOS/Linux 可用 cp .env.example .env.local
npm run dev
```

打开 <http://localhost:3000> 即可使用本地模式。

页面中的 DeepSeek API Key 只随当前分析请求发送，不写入仓库、浏览器持久存储或服务端日志。不要把真实 Key 写入示例文件、源码或提交历史。

## Hosted 本机开发

复制 `.env.hosted.example` 为 `.env.hosted`，再启动 PostgreSQL 和 Mailpit：

```bash
copy .env.hosted.example .env.hosted
npm run infra:up
npm run db:migrate
npm run db:check
npm run dev:hosted
```

Mailpit 管理页面：<http://localhost:8025>。

Hosted 环境至少需要配置 `DATABASE_URL`、长度不小于 32 个字符的 `BETTER_AUTH_SECRET` 和 `BETTER_AUTH_URL`。真实环境变量只放在本地或部署平台，`.env*`（示例文件除外）已被 Git 忽略。

## 常用命令

```bash
npm run dev          # 本地模式开发服务器
npm run dev:hosted   # Hosted 本机开发服务器
npm run infra:up     # 启动 PostgreSQL 与 Mailpit
npm run infra:down   # 停止本地基础设施
npm run db:migrate   # 应用数据库迁移
npm run db:check     # 检查数据库配置
npm run lint         # ESLint 检查
npm run build        # 生产构建
npm test             # 完整测试
```

## 技术栈

Next.js 16、React 19、TypeScript 5、Tailwind CSS、Monaco Editor、Zod、Drizzle ORM、Better Auth 和 PostgreSQL。浏览器界面与服务端 API 共用 TypeScript，不另设 Express 后端。

## 目录说明

```text
src/       应用页面、组件、校验逻辑与服务端代码
tests/     单元测试与集成测试
drizzle/   数据库迁移
scripts/   统计与 Hosted 维护脚本
public/    静态资源
```

默认构建命令为 `npm run build`，可直接用于 Vercel 等支持 Next.js 的部署平台。部署时请在平台的环境变量设置中填写真实的 Hosted 配置和 DeepSeek 服务端配置。
