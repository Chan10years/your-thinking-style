# YourThinkingStyle

一个帮助你理解“自己的思路为什么在代码里走偏了”的 C++ 错题分析工具。

它不会直接替你写标准答案，而是结合题目、代码、解题思路和失败信息，生成三部分诊断：

- 思路还原
- 错误解释
- 修正方向

## 本地运行

需要 Node.js 24 LTS。项目使用 npm 和 `package-lock.json` 固定依赖，推荐使用
`npm ci` 复现仓库锁定的依赖版本。

```bash
npm ci
copy .env.example .env.local
npm run dev
```

然后打开 <http://localhost:3000>。

`.env.local` 只用于配置服务端 DeepSeek 接口地址和模型：

```env
DEEPSEEK_API_ENDPOINT=https://api.deepseek.com/chat/completions
DEEPSEEK_MODEL=deepseek-v4-pro
```

用户在页面中输入自己的 API Key。Key 只随当前分析请求发送，不会写入仓库、浏览器持久存储或服务端日志。不要把真实 Key 写入 `.env.example`、源码或提交记录。

## 常用命令

```bash
npm run dev       # 启动开发服务器
npm run lint      # 检查代码规范
npm run build     # 构建生产版本
npm test          # 运行测试
```

## 技术栈

当前应用使用 Next.js 16、React 19、TypeScript 5、Tailwind CSS、Monaco
Editor 和 Zod。TypeScript 同时用于浏览器界面与 Next.js 服务端 API；项目不另设
Express 后端。

当前 MVP 只支持 C++ 代码分析，不负责编译、运行或判题。

## 版本边界与后端规划

仓库长期保留两种运行形态：

- `local`：默认的本地部署版，直接进入诊断工作台；不包含品牌首页、账户、数据库、
  历史记录、使用统计、管理后台或任何官方遥测。
- `hosted`：官方托管版；规划增加邮箱账户、个人资料、头像、诊断历史和最小使用统计。

账户后端尚未实现。后续开发必须遵守：

- [后端架构设计](docs/superpowers/specs/2026-08-07-hosted-backend-architecture-design.md)
- [后端实施计划](docs/superpowers/plans/2026-08-07-hosted-backend-implementation.md)

在实施计划完成并通过本机验收以前，不进行云服务器部署，也不把规划中的能力写成
已经上线的功能。
