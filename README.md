# YourThinkingStyle

一个帮助你理解“自己的思路为什么在代码里走偏了”的 C++ 错题分析工具。

它不会直接替你写标准答案，而是结合题目、代码、解题思路和失败信息，生成三部分诊断：

- 思路还原
- 错误解释
- 修正方向

## 本地运行

需要 Node.js 20 或更高版本。

```bash
npm install
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

Next.js、React、TypeScript、Tailwind CSS、Monaco Editor、Zod。

当前 MVP 只支持 C++ 代码分析，不负责编译、运行或判题。
