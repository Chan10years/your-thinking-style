# 托管版账户后端实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**目标：** 在不破坏匿名本地部署版的前提下，用现有 Next.js + TypeScript 项目完成可在
本机复现和验收的邮箱账户、个人资料、头像、诊断历史与最小使用统计后端。

**架构：** 保持单仓库、单 Next.js 应用，不引入 Express 或第二个后端服务。通过
`APP_EDITION=local|hosted` 集中控制能力；HTTP 路由保持轻薄，业务放在服务中，数据库
与外部能力通过 Repository/Adapter 隔离。PostgreSQL 与 Mailpit 由 Docker Compose
运行，开发中的 Next.js 仍直接由 npm 启动。

**技术栈：** Node.js 24 LTS、Next.js 16、React 19、TypeScript 5 strict、Zod 4、
Better Auth 1.6.25、Drizzle ORM 0.45.2、Drizzle Kit 0.31.10、node-postgres 8.22.0、
PostgreSQL 17.10、Mailpit 1.30.0、Sharp 0.35.3、Node test runner、Docker Compose。

## 全局约束

- 实施前先阅读配套的
  `docs/superpowers/specs/2026-08-07-hosted-backend-architecture-design.md`。
- `local` 是默认版本，不得要求数据库、SMTP、账户配置或官方网络连接。
- `hosted` 只增加邮箱密码账户，不增加手机号、第三方登录、MFA、组织、付费或社区。
- 不引入 Express、NestJS、Redis、队列、微服务或第二个应用服务器。
- 用户 DeepSeek API Key 只存在于单次请求内存，不得持久化或记录日志。
- 只有通过 `analysisResponseSchema` 的成功结果进入历史；失败结果不进入历史。
- 本地版不记录访问、事件、账户、历史或官方遥测。
- 默认头像由本地种子生成；自定义头像落在可持久化目录，不调用外部头像服务。
- 所有新增 npm 依赖使用精确稳定版本，禁止 alpha、beta、RC 和未固定 Git 依赖。
- 每个任务遵循：失败测试 → 最小实现 → 测试通过 → 全量回归 → 独立提交。
- 在任务 13 完成以前，不进行腾讯云、阿里云、Vercel 或 Supabase 部署。
- 最终 UI、诊断文案、返回格式精调和产品视觉优化不属于本计划。

---

## 文件职责图

计划新增或收敛为以下结构：

```text
compose.yaml                              本机 PostgreSQL 与 Mailpit
.node-version                             Node 24 运行时约束
.env.hosted.example                       托管开发变量示例
drizzle.config.ts                         迁移生成配置
drizzle/                                  进入版本控制的 SQL 迁移
scripts/report-usage.ts                   JSON/CSV 聚合报告
scripts/backup-hosted-data.ts             数据库与头像备份入口
src/config/edition.ts                     唯一版本能力来源
src/server/env.ts                         服务端环境变量校验
src/server/db/client.ts                   PostgreSQL 连接池与 Drizzle 实例
src/server/db/schema/*.ts                 认证、资料、历史、活动表
src/server/auth/auth.ts                   Better Auth 配置
src/server/auth/session.ts                当前用户解析与 verified 约束
src/server/email/auth-email.ts            邮箱验证与重置邮件适配器
src/server/profile/profile-service.ts     昵称和默认资料规则
src/server/storage/avatar-storage.ts      头像存储接口
src/server/storage/local-avatar-storage.ts 单机磁盘实现
src/server/profile/avatar-service.ts      格式验证、Sharp 处理与替换
src/server/analysis/analysis-service.ts    DeepSeek 分析编排
src/server/history/history-repository.ts  历史读写与所有权
src/server/metrics/activity-repository.ts 每日活动聚合
src/server/metrics/usage-report.ts         使用人数统计查询
src/app/api/auth/[...all]/route.ts         Better Auth HTTP 入口
src/app/api/profile/route.ts               资料查询与修改
src/app/api/profile/avatar/route.ts        头像上传与恢复默认
src/app/api/history/route.ts               历史分页列表
src/app/api/history/[id]/route.ts           历史详情与删除
```

---

### 任务 1：固定运行时与双版本能力

**文件：**

- 创建：`.node-version`
- 创建：`.env.hosted.example`
- 创建：`src/config/edition.ts`
- 创建：`src/server/env.ts`
- 创建：`tests/edition-config.test.ts`
- 修改：`package.json`
- 修改：`.env.example`
- 修改：`README.md`

**接口：**

- 产生：`type AppEdition = "local" | "hosted"`
- 产生：`getAppEdition(env?: NodeJS.ProcessEnv): AppEdition`
- 产生：`getEditionCapabilities(edition: AppEdition): EditionCapabilities`
- 产生：`getHostedEnvironment(env?: NodeJS.ProcessEnv): HostedEnvironment`

- [ ] **步骤 1：先写版本能力失败测试**

```ts
test("local is the default and has no hosted capabilities", () => {
  assert.equal(getAppEdition({}), "local");
  assert.deepEqual(getEditionCapabilities("local"), {
    marketing: false,
    auth: false,
    database: false,
    profile: false,
    history: false,
    metrics: false,
  });
});

test("rejects an unknown edition", () => {
  assert.throws(() => getAppEdition({ APP_EDITION: "preview" }));
});
```

- [ ] **步骤 2：运行并确认测试因模块不存在而失败**

运行：`npm.cmd exec -- tsx --test tests/edition-config.test.ts`

预期：FAIL，提示无法解析 `src/config/edition.ts`。

- [ ] **步骤 3：实现集中式能力配置**

实现不可变能力对象；`local` 不读取任何 hosted 变量，`hosted` 才使用 Zod 校验
`DATABASE_URL`、`BETTER_AUTH_SECRET`、`BETTER_AUTH_URL`、SMTP 和头像目录。

- [ ] **步骤 4：固定 Node.js 24**

`.node-version` 写入 `24`；`package.json` 增加：

```json
"engines": {
  "node": ">=24 <25"
}
```

- [ ] **步骤 5：运行聚焦与现有测试**

运行：`npm.cmd exec -- tsx --test tests/edition-config.test.ts`

预期：PASS。

运行：`npm.cmd test`

预期：现有测试全部通过，local 默认行为没有改变。

- [ ] **步骤 6：提交独立变更**

```bash
git add .node-version .env.example .env.hosted.example package.json README.md src/config/edition.ts src/server/env.ts tests/edition-config.test.ts
git commit -m "chore: define reproducible app editions"
```

---

### 任务 2：建立本机 PostgreSQL 与 Mailpit 基础设施

**文件：**

- 创建：`compose.yaml`
- 创建：`drizzle.config.ts`
- 创建：`src/server/db/client.ts`
- 创建：`tests/hosted-infrastructure.test.mts`
- 修改：`package.json`
- 修改：`package-lock.json`
- 修改：`.env.hosted.example`

**接口：**

- 消费：`getHostedEnvironment()`
- 产生：`getDatabase(): NodePgDatabase<typeof schema>`
- 产生：`closeDatabase(): Promise<void>`
- 产生 npm scripts：`infra:up`、`infra:down`、`db:generate`、`db:migrate`、
  `db:check`、`dev:hosted`

- [ ] **步骤 1：写基础设施配置失败测试**

测试读取 `compose.yaml` 和 `package.json`，要求：

```ts
assert.match(compose, /postgres:17\.10-alpine3\.23/);
assert.match(compose, /axllent\/mailpit:v1\.30\.0/);
assert.equal(pkg.dependencies["better-auth"], "1.6.25");
assert.equal(pkg.dependencies["@better-auth/drizzle-adapter"], "1.6.25");
assert.equal(pkg.dependencies["drizzle-orm"], "0.45.2");
assert.equal(pkg.dependencies.pg, "8.22.0");
assert.equal(pkg.dependencies.sharp, "0.35.3");
assert.equal(pkg.devDependencies["drizzle-kit"], "0.31.10");
```

- [ ] **步骤 2：运行并确认配置测试失败**

运行：`node --test tests/hosted-infrastructure.test.mts`

预期：FAIL，因为 Compose 和依赖尚不存在。

- [ ] **步骤 3：安装经过批准的稳定依赖**

运行：

```bash
npm.cmd install --save-exact better-auth@1.6.25 @better-auth/drizzle-adapter@1.6.25 drizzle-orm@0.45.2 pg@8.22.0 sharp@0.35.3
npm.cmd install --save-dev --save-exact drizzle-kit@0.31.10 @types/pg
```

检查 `package-lock.json` 中没有 RC、Git URL 或意外的第二个 ORM。

- [ ] **步骤 4：创建版本固定的 Compose**

PostgreSQL 使用命名卷、健康检查和仅本机端口；Mailpit使用1025 SMTP和8025 Web
端口。密码从环境变量读取，不写真实密码到Compose。

- [ ] **步骤 5：实现延迟数据库初始化**

`getDatabase()` 只能在 hosted 能力开启后创建唯一 `pg.Pool`；local 模式调用时抛出
明确的 `DATABASE_DISABLED`，但普通local启动不得调用它。

- [ ] **步骤 6：启动基础设施并验证连接**

运行：

```bash
npm.cmd run infra:up
docker compose ps
npm.cmd run db:check
```

预期：两个容器 healthy，`db:check` 输出一次成功的 `select 1`。

- [ ] **步骤 7：运行测试并提交**

运行：`node --test tests/hosted-infrastructure.test.mts`

预期：PASS。

```bash
git add compose.yaml drizzle.config.ts package.json package-lock.json .env.hosted.example src/server/db/client.ts tests/hosted-infrastructure.test.mts
git commit -m "feat: add hosted development infrastructure"
```

---

### 任务 3：建立数据库 Schema 与可重复迁移

**文件：**

- 创建：`src/server/db/schema/auth.ts`
- 创建：`src/server/db/schema/profile.ts`
- 创建：`src/server/db/schema/history.ts`
- 创建：`src/server/db/schema/activity.ts`
- 创建：`src/server/db/schema/index.ts`
- 创建：`drizzle/0000_hosted_backend.sql`
- 创建：`tests/database-migrations.test.ts`
- 修改：`src/server/db/client.ts`

**接口：**

- 产生：Better Auth要求的 `user`、`session`、`account`、`verification` 表
- 产生：`userProfiles`、`analysisHistory`、`dailyUserActivity` Drizzle表对象
- 产生：`migrateDatabase(): Promise<void>`

- [ ] **步骤 1：写迁移失败测试**

测试创建空测试数据库、运行迁移两次，并断言：

```ts
assert.deepEqual(requiredTables.sort(), [
  "account",
  "analysis_history",
  "daily_user_activity",
  "session",
  "user",
  "user_profiles",
  "verification",
].sort());
```

同时查询索引，要求历史包含 `(user_id, created_at)` 索引，活动表主键为
`(user_id, activity_date)`。

- [ ] **步骤 2：运行并确认迁移测试失败**

运行：`npm.cmd exec -- tsx --test tests/database-migrations.test.ts`

预期：FAIL，因为迁移和Schema不存在。

- [ ] **步骤 3：使用Better Auth官方CLI生成认证表基线**

运行：`npm.cmd exec -- auth@1.6.25 generate`

将生成结果转换为当前Drizzle Schema布局；逐字段对照Better Auth 1.6.25文档，不手写
密码或Token算法。

- [ ] **步骤 4：实现应用表与约束**

`user_profiles.user_id` 唯一引用用户并级联删除；历史和活动引用用户并级联删除；
`validated_result_json` 使用JSONB；所有时间使用带时区时间；昵称和avatar key设置数据库
长度上限。

- [ ] **步骤 5：生成并人工审阅SQL迁移**

运行：`npm.cmd run db:generate`

审阅SQL，确认没有DROP、没有未预期的扩展、没有明文种子秘密。

- [ ] **步骤 6：迁移测试与提交**

运行：`npm.cmd exec -- tsx --test tests/database-migrations.test.ts`

预期：PASS，第二次迁移无重复对象错误。

```bash
git add src/server/db/schema src/server/db/client.ts drizzle tests/database-migrations.test.ts
git commit -m "feat: define hosted backend database schema"
```

---

### 任务 4：实现邮箱账户、验证、登录与密码重置

**文件：**

- 创建：`src/server/auth/auth.ts`
- 创建：`src/server/auth/session.ts`
- 创建：`src/server/email/auth-email.ts`
- 创建：`src/app/api/auth/[...all]/route.ts`
- 创建：`tests/auth-flow.test.ts`
- 创建：`tests/auth-local-boundary.test.ts`
- 修改：`.env.hosted.example`

**接口：**

- 产生：`getAuth(): BetterAuthInstance`
- 产生：`getOptionalSession(headers: Headers): Promise<VerifiedSession | null>`
- 产生：`requireVerifiedSession(headers: Headers): Promise<VerifiedSession>`
- 产生：`sendVerificationEmail(input: AuthEmailInput): Promise<void>`
- 产生：`sendPasswordResetEmail(input: AuthEmailInput): Promise<void>`

- [ ] **步骤 1：写local边界失败测试**

```ts
test("local auth route returns 404 without initializing hosted services", async () => {
  const response = await authRouteForEdition("local", new Request("http://local/api/auth/session"));
  assert.equal(response.status, 404);
  assert.equal(databaseFactoryCalls, 0);
  assert.equal(mailFactoryCalls, 0);
});
```

- [ ] **步骤 2：写hosted认证流程失败测试**

集成测试依次要求：注册成功、Mailpit收到验证邮件、验证前受保护接口403、验证后登录
成功、退出只清除当前Session、密码重置后旧Session失效。

- [ ] **步骤 3：运行并确认测试失败**

运行：`npm.cmd exec -- tsx --test tests/auth-local-boundary.test.ts tests/auth-flow.test.ts`

预期：FAIL，因为认证模块不存在。

- [ ] **步骤 4：配置Better Auth最小能力**

开启email/password和email verification；密码长度8–128；Session Cookie为HttpOnly、
SameSite=Lax，生产环境Secure；Session有效期30天；关闭social providers、organizations、
MFA和无关插件。

- [ ] **步骤 5：接入SMTP适配器**

开发默认发送到Mailpit；模板只包含验证或重置用途，不包含营销内容；日志只记录邮件类型
和安全请求ID，不记录Token或完整链接。

- [ ] **步骤 6：实现密码重置后的Session撤销**

在Better Auth支持的密码重置完成hook中删除该用户旧Session；新增断言证明另一浏览器旧
Cookie无法继续访问。

- [ ] **步骤 7：运行测试和提交**

运行：`npm.cmd exec -- tsx --test tests/auth-local-boundary.test.ts tests/auth-flow.test.ts`

预期：PASS。

```bash
git add src/server/auth src/server/email src/app/api/auth tests/auth-local-boundary.test.ts tests/auth-flow.test.ts .env.hosted.example
git commit -m "feat: add verified email authentication"
```

---

### 任务 5：实现默认资料和昵称修改

**文件：**

- 创建：`src/server/profile/profile-schema.ts`
- 创建：`src/server/profile/profile-service.ts`
- 创建：`src/app/api/profile/route.ts`
- 创建：`tests/profile-service.test.ts`
- 创建：`tests/profile-route.test.ts`
- 修改：`src/server/auth/auth.ts`

**接口：**

- 产生：`createDefaultProfile(userId: string): NewUserProfile`
- 产生：`getProfile(userId: string): Promise<UserProfile>`
- 产生：`updateNickname(userId: string, nickname: string): Promise<UserProfile>`
- 产生Zod Schema：`nicknameSchema`、`profileResponseSchema`

- [ ] **步骤 1：写默认资料和昵称失败测试**

```ts
test("default profile does not reveal email", () => {
  const profile = createDefaultProfile("018f-example-user-id");
  assert.match(profile.nickname, /^用户-[A-Z0-9]{6}$/);
  assert.match(profile.avatarSeed, /^[0-9a-f-]{36}$/);
  assert.equal(JSON.stringify(profile).includes("@"), false);
});
```

补充测试：2和24字符通过；空白、25字符、控制字符失败；昵称重复允许。

- [ ] **步骤 2：运行并确认测试失败**

运行：`npm.cmd exec -- tsx --test tests/profile-service.test.ts tests/profile-route.test.ts`

- [ ] **步骤 3：在已验证注册完成hook创建资料**

资料创建与用户创建保持一致性；重复hook使用upsert但不覆盖用户已经修改的昵称。

- [ ] **步骤 4：实现GET/PATCH路由**

只从Session读取user ID，不接受请求体提供user ID；未登录401、未验证403、非法昵称400。

- [ ] **步骤 5：运行测试和提交**

运行：`npm.cmd exec -- tsx --test tests/profile-service.test.ts tests/profile-route.test.ts`

预期：PASS。

```bash
git add src/server/profile src/app/api/profile src/server/auth/auth.ts tests/profile-service.test.ts tests/profile-route.test.ts
git commit -m "feat: add editable user profiles"
```

---

### 任务 6：实现安全的自定义头像

**文件：**

- 创建：`src/server/storage/avatar-storage.ts`
- 创建：`src/server/storage/local-avatar-storage.ts`
- 创建：`src/server/profile/avatar-service.ts`
- 创建：`src/app/api/profile/avatar/route.ts`
- 创建：`src/app/avatar/[seed]/route.ts`
- 创建：`tests/avatar-service.test.ts`
- 创建：`tests/avatar-route.test.ts`
- 修改：`.env.hosted.example`

**接口：**

```ts
export interface AvatarStorage {
  put(userId: string, bytes: Uint8Array): Promise<string>;
  read(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
}
```

- 产生：`replaceAvatar(userId: string, upload: File): Promise<UserProfile>`
- 产生：`resetAvatar(userId: string): Promise<UserProfile>`
- 产生：`renderDefaultAvatar(seed: string): string`

- [ ] **步骤 1：写格式和替换顺序失败测试**

测试JPEG/PNG/WebP成功；SVG、GIF、伪扩展名、超过5MB和损坏内容失败；输出必须是
256×256 WebP且不含EXIF。模拟新文件写入失败时，旧avatar key和旧文件保持不变。

- [ ] **步骤 2：写路径隔离失败测试**

```ts
assert.throws(() => storage.read("../outside.env"));
assert.equal(await storage.read(otherUsersKey), null);
```

- [ ] **步骤 3：运行并确认测试失败**

运行：`npm.cmd exec -- tsx --test tests/avatar-service.test.ts tests/avatar-route.test.ts`

- [ ] **步骤 4：实现Sharp处理和原子替换**

先读取实际媒体格式，再`autoOrient()`、正方形cover裁剪、256×256、WebP质量80、移除
metadata。新文件写入并更新数据库成功后再尽力删除旧文件。

- [ ] **步骤 5：实现默认头像内部路由**

只根据校验后的seed生成本地SVG；不访问Gravatar或第三方头像API；响应设置长期immutable
缓存，不写数据库。

- [ ] **步骤 6：运行测试和提交**

运行：`npm.cmd exec -- tsx --test tests/avatar-service.test.ts tests/avatar-route.test.ts`

预期：PASS。

```bash
git add src/server/storage src/server/profile/avatar-service.ts src/app/api/profile/avatar src/app/avatar tests/avatar-service.test.ts tests/avatar-route.test.ts .env.hosted.example
git commit -m "feat: add safe custom avatars"
```

---

### 任务 7：拆分分析路由并引入统一Actor

**文件：**

- 创建：`src/server/analysis/analysis-actor.ts`
- 创建：`src/server/analysis/analysis-service.ts`
- 创建：`src/server/analysis/analysis-errors.ts`
- 修改：`src/app/api/analyze/route.ts`
- 修改：`src/lib/deepseek.ts`
- 修改：`src/lib/analysis-request-guard.ts`
- 创建：`tests/analysis-actor.test.ts`
- 修改：`tests/analyze-route.test.ts`

**接口：**

```ts
export type AnalysisActor =
  | { edition: "local"; guardKey: string }
  | { edition: "hosted"; guardKey: string; userId: string };

export type AnalysisExecution = {
  data: AnalysisResponse;
  durationMs: number;
};
```

- 产生：`resolveAnalysisActor(request: Request): Promise<AnalysisActor>`
- 产生：`executeAnalysis(input: AnalysisInput & { apiKey: string }): Promise<AnalysisExecution>`

- [ ] **步骤 1：锁定现有行为测试**

补充回归测试，锁定当前输入限制、一次结构重试、270秒DeepSeek预算、300秒路由上限、
错误码和`mvp-1` Schema，确保拆分不改变基础诊断。

- [ ] **步骤 2：写actor失败测试**

要求local使用浏览器Session ID；hosted未登录401、未验证403、已验证用户以user ID作为
guard key；请求体中的伪造user ID被忽略。

- [ ] **步骤 3：运行测试并确认新增断言失败**

运行：`npm.cmd run test:api`

- [ ] **步骤 4：移动纯业务逻辑**

将DeepSeek请求、JSON解析、Zod校验和一次重试移动到`analysis-service.ts`；路由只负责
解析、actor、guard和响应。不要改变Prompt和返回Schema。

- [ ] **步骤 5：让guard按actor工作**

保留每分钟三次、同actor一个进行中请求；local键为浏览器Session，hosted键为用户ID。
拒绝的并发请求不消耗频率配额。

- [ ] **步骤 6：运行测试和提交**

运行：`npm.cmd run test:api && npm.cmd run test:request-guard`

预期：PASS。

```bash
git add src/server/analysis src/app/api/analyze/route.ts src/lib/deepseek.ts src/lib/analysis-request-guard.ts tests/analysis-actor.test.ts tests/analyze-route.test.ts
git commit -m "refactor: isolate analysis orchestration"
```

---

### 任务 8：成功分析自动保存历史并记录活动

**文件：**

- 创建：`src/server/history/history-repository.ts`
- 创建：`src/server/metrics/activity-repository.ts`
- 创建：`src/server/analysis/persist-analysis.ts`
- 修改：`src/server/analysis/analysis-service.ts`
- 修改：`src/app/api/analyze/route.ts`
- 创建：`tests/analysis-persistence.test.ts`

**接口：**

```ts
export type SaveAnalysisInput = {
  userId: string;
  input: AnalysisInput;
  result: AnalysisResponse;
};

export type AnalysisPersistence =
  | { historySaved: true; historyId: string }
  | { historySaved: false; warning: "HISTORY_SAVE_FAILED" };
```

- 产生：`saveSuccessfulAnalysis(input: SaveAnalysisInput): Promise<AnalysisPersistence>`
- 产生：`upsertDailyActivity(userId: string, at: Date): Promise<void>`

- [ ] **步骤 1：写持久化失败测试**

要求hosted成功结果恰好保存一次并更新当天计数；模型错误、无效JSON和Schema失败均不
创建历史；local成功结果不调用数据库。

- [ ] **步骤 2：写秘密排除测试**

构造带唯一marker的API Key、Authorization值、Prompt和原始响应，保存后搜索所有应用
表和捕获日志，断言marker不存在；问题、代码和validated result存在。

- [ ] **步骤 3：运行并确认测试失败**

运行：`npm.cmd exec -- tsx --test tests/analysis-persistence.test.ts`

- [ ] **步骤 4：实现事务写入**

历史insert与daily activity upsert在同一短事务完成；数据库写入最多重试一次，不重试
DeepSeek；第二次失败返回`historySaved:false`但保留有效诊断结果。

- [ ] **步骤 5：扩展成功响应Schema**

成功响应增加：

```ts
history: {
  saved: boolean;
  id?: string;
  warning?: "HISTORY_SAVE_FAILED";
}
```

local响应固定`history.saved=false`且不显示故障警告；前端兼容旧测试。

- [ ] **步骤 6：运行测试和提交**

运行：`npm.cmd exec -- tsx --test tests/analysis-persistence.test.ts && npm.cmd run test:api`

```bash
git add src/server/history src/server/metrics src/server/analysis src/app/api/analyze/route.ts tests/analysis-persistence.test.ts tests/analyze-route.test.ts
git commit -m "feat: persist successful hosted analyses"
```

---

### 任务 9：实现历史列表、详情与永久删除API

**文件：**

- 创建：`src/server/history/history-schema.ts`
- 修改：`src/server/history/history-repository.ts`
- 创建：`src/app/api/history/route.ts`
- 创建：`src/app/api/history/[id]/route.ts`
- 创建：`tests/history-repository.test.ts`
- 创建：`tests/history-route.test.ts`

**接口：**

- 产生：`listHistory(userId: string, page: number, pageSize: number): Promise<HistoryPage>`
- 产生：`getHistory(userId: string, id: string): Promise<HistoryDetail | null>`
- 产生：`deleteHistory(userId: string, id: string): Promise<boolean>`
- 产生Zod Schema：`historyPageSchema`、`historyDetailSchema`

- [ ] **步骤 1：写分页和所有权失败测试**

要求默认20、最大50、时间倒序；非法页码400；用户A读取或删除用户B记录均404；删除后
列表和详情不可见；请求体和查询参数无法覆盖Session user ID。

- [ ] **步骤 2：运行并确认测试失败**

运行：`npm.cmd exec -- tsx --test tests/history-repository.test.ts tests/history-route.test.ts`

- [ ] **步骤 3：实现Repository所有权条件**

详情和删除SQL必须同时包含`id = ?`与`user_id = ?`，不能先按ID读取再在应用层判断；
列表只选择摘要字段，详情才读取完整代码和JSONB。

- [ ] **步骤 4：实现local 404与hosted Session约束**

local模式所有历史路由404且数据库调用次数为0；hosted未登录401、未验证403。

- [ ] **步骤 5：运行测试和提交**

运行：`npm.cmd exec -- tsx --test tests/history-repository.test.ts tests/history-route.test.ts`

预期：PASS。

```bash
git add src/server/history src/app/api/history tests/history-repository.test.ts tests/history-route.test.ts
git commit -m "feat: add private analysis history api"
```

---

### 任务 10：实现最小使用人数统计与导出

**文件：**

- 创建：`src/server/metrics/usage-report.ts`
- 创建：`scripts/report-usage.ts`
- 创建：`tests/usage-report.test.ts`
- 修改：`package.json`

**接口：**

```ts
export type UsageReport = {
  generatedAt: string;
  registeredUsers: number;
  verifiedUsers: number;
  dau: number;
  wau: number;
  mau: number;
  successfulAnalyses: number;
  analysesPerActiveUser: number;
  sevenDayReturningUsers: number;
};
```

- 产生：`buildUsageReport(now: Date): Promise<UsageReport>`
- 产生命令：`stats:report`输出JSON、`stats:export`写CSV到指定显式路径

- [ ] **步骤 1：写固定时间统计失败测试**

插入跨8天、31天的测试用户和活动，固定`now`，断言DAU/WAU/MAU边界、已验证用户、
成功诊断数、零活跃时除法结果为0、七日回访不重复计数。

- [ ] **步骤 2：写敏感字段排除测试**

断言JSON和CSV列名仅来自`UsageReport`，不包含email、user_id、source_code、problem、
API key、prompt或单用户事件明细。

- [ ] **步骤 3：运行并确认测试失败**

运行：`npm.cmd exec -- tsx --test tests/usage-report.test.ts`

- [ ] **步骤 4：实现参数化聚合查询和CLI**

所有时间窗口使用UTC数据库时间；命令只允许hosted环境；local调用直接拒绝且不建立
数据库连接。

- [ ] **步骤 5：运行测试和提交**

运行：`npm.cmd exec -- tsx --test tests/usage-report.test.ts`

```bash
git add src/server/metrics scripts/report-usage.ts tests/usage-report.test.ts package.json
git commit -m "feat: add privacy-limited usage reports"
```

---

### 任务 11：完成双模式最小端到端联调

**文件：**

- 创建：`src/app/login/page.tsx`
- 创建：`src/app/register/page.tsx`
- 创建：`src/app/verify-email/page.tsx`
- 创建：`src/app/reset-password/page.tsx`
- 创建：`src/app/settings/profile/page.tsx`
- 创建：`src/app/history/page.tsx`
- 创建：`src/proxy.ts`
- 创建：`tests/hosted-route-access.test.mts`
- 创建：`tests/local-edition-isolation.test.mts`
- 修改：`src/app/page.tsx`
- 修改：`src/app/analyze/page.tsx`

**接口：**

- 消费：认证、资料、头像、历史和分析API
- 产生：仅用于本机验收的功能页面，不建立最终视觉规范

- [ ] **步骤 1：写路由可用性失败测试**

要求local根地址进入分析工作台、账户和历史页面404、分析页匿名可用；hosted根地址保留
品牌入口、未登录分析页跳转登录、登录后可访问分析/资料/历史。

- [ ] **步骤 2：写local无副作用测试**

在没有DATABASE_URL、SMTP、头像目录的local环境加载所有公开页面和分析API，断言构建
成功且数据库、邮件、auth工厂调用为0。

- [ ] **步骤 3：运行并确认测试失败**

运行：`npm.cmd exec -- tsx --test tests/hosted-route-access.test.mts tests/local-edition-isolation.test.mts`

- [ ] **步骤 4：实现最小功能页面**

页面只需可访问标签、字段错误、加载状态和成功/失败提示；复用现有样式变量，不在本任务
进行品牌视觉、动画、响应式精修或诊断结果改版。

- [ ] **步骤 5：本机人工走通完整流程**

```text
启动PostgreSQL和Mailpit
→ hosted注册
→ Mailpit验证
→ 登录
→ 修改昵称
→ 上传/删除头像
→ 使用BYOK完成一次诊断
→ 历史中重开
→ 删除历史
→ 当前设备退出
→ 重置密码并验证旧Session失效
```

- [ ] **步骤 6：运行测试和提交**

运行：`npm.cmd exec -- tsx --test tests/hosted-route-access.test.mts tests/local-edition-isolation.test.mts`

```bash
git add src/app src/proxy.ts tests/hosted-route-access.test.mts tests/local-edition-isolation.test.mts
git commit -m "feat: complete local hosted-backend flow"
```

---

### 任务 12：备份、恢复和开发文档

**文件：**

- 创建：`scripts/backup-hosted-data.ts`
- 创建：`scripts/verify-hosted-backup.ts`
- 创建：`docs/HOSTED_DEVELOPMENT.md`
- 创建：`docs/BACKUP_AND_RECOVERY.md`
- 创建：`tests/backup-config.test.mts`
- 修改：`package.json`
- 修改：`README.md`

**接口：**

- 产生命令：`backup:create -- --output <explicit-directory>`
- 产生命令：`backup:verify -- --input <explicit-archive>`
- 备份包含：`pg_dump`自定义格式、头像目录归档、manifest SHA-256

- [ ] **步骤 1：写备份安全失败测试**

要求输出路径必须显式传入且不能是仓库根、用户目录或磁盘根；manifest包含数据库和头像
校验和；归档不包含`.env`、日志、API Key或Node依赖。

- [ ] **步骤 2：运行并确认测试失败**

运行：`node --test tests/backup-config.test.mts`

- [ ] **步骤 3：实现可恢复备份脚本**

使用参数数组调用`pg_dump`，不拼接shell字符串；先写临时归档，校验完成后原子移动到
显式目标；失败时保留原数据库和头像，不自动删除旧备份。

- [ ] **步骤 4：编写从空白电脑开始的中文文档**

文档必须逐条覆盖Node 24、Docker、`npm ci`、环境文件、启动、迁移、Mailpit、测试、
统计、备份、验证和恢复到新卷。命令同时给出Windows PowerShell的`npm.cmd`形式。

- [ ] **步骤 5：执行一次真实备份和隔离恢复演练**

恢复到新测试数据库与新临时头像目录，比较用户、历史数量和文件SHA-256；不得覆盖当前
开发卷。

- [ ] **步骤 6：运行测试和提交**

运行：`node --test tests/backup-config.test.mts`

```bash
git add scripts/backup-hosted-data.ts scripts/verify-hosted-backup.ts docs/HOSTED_DEVELOPMENT.md docs/BACKUP_AND_RECOVERY.md tests/backup-config.test.mts package.json README.md
git commit -m "docs: add hosted recovery workflow"
```

---

### 任务 13：后端完成门槛与最终验证

**文件：**

- 修改：`docs/superpowers/plans/2026-08-07-hosted-backend-implementation.md`（仅勾选
  已有证据的项目）
- 审阅：本计划涉及的所有代码、迁移、配置和文档

**接口：**

- 产生：可由另一个开发者复现的本机后端完成证据
- 不产生：云部署、域名、备案或最终UI变更

- [ ] **步骤 1：验证local模式**

在停止Docker并清除hosted环境变量后运行：

```bash
npm.cmd ci
npm.cmd test
npm.cmd run lint
npm.cmd run build
npm.cmd run dev
```

验收：无需数据库即可进入诊断；账户、历史、统计不可用；无官方请求和持久化。

- [ ] **步骤 2：验证hosted模式**

从空Docker卷执行文档命令：启动基础设施、迁移、启动应用、走通任务11流程、重启
容器、再次查看资料和历史。

- [ ] **步骤 3：运行全量自动化门槛**

```bash
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

分别在local和hosted环境运行。预期全部exit code 0，无跳过的安全或模式隔离测试。

- [ ] **步骤 4：审查秘密和依赖**

运行仓库搜索，确认没有真实邮箱密码、BETTER_AUTH_SECRET、数据库密码、DeepSeek Key、
Token、Cookie或备份归档；确认依赖树中没有RC、第二个ORM、Express或NestJS。

- [ ] **步骤 5：审查数据边界**

检查数据库和日志样本，确认不存API Key、Prompt、原始上游响应和失败分析输入；检查
local模式无用户数据、历史和活动记录。

- [ ] **步骤 6：记录完成证据并提交**

在计划中只勾选已验证任务，记录命令与结果摘要：

```bash
git add docs/superpowers/plans/2026-08-07-hosted-backend-implementation.md
git commit -m "docs: record hosted backend verification"
```

任务13通过后，才允许另开规划处理产品端API文案、纠正格式、最终账户UI和云部署。

## 计划自审

- 设计中的每项账户、资料、头像、历史、统计和local隔离要求都有对应任务。
- 没有未决技术选型；依赖、容器和运行时均指定稳定版本。
- 所有后续任务引用的接口都在前置任务中定义。
- 每个任务都有失败测试、聚焦验证、独立提交和可拒绝的验收边界。
- 计划没有把云部署、付费、手机号、社交登录、复杂管理后台或最终UI混入后端阶段。
