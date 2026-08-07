# Hosted 本机备份与恢复

本项目的 hosted 本机数据只有两类需要备份：PostgreSQL 数据库和头像目录。备份脚本不记录密码、Cookie、API Key、Prompt 或模型原始响应。

## 备份

先确认 Docker Desktop 显示 `Engine running`，然后在项目根目录执行：

```powershell
npm run infra:up
npm run backup:hosted -- backup --output .data/backups
```

脚本会使用 PostgreSQL 容器里的 `pg_dump`，并把头像目录复制到同一备份目录，最后生成 `manifest.json`。`.data/` 已加入 Git 忽略，不应提交备份或真实环境文件。

## 校验

```powershell
npm run backup:hosted -- verify --backup .data/backups/<timestamp>
```

校验会重新计算所有文件的 SHA-256 和大小；失败时不要把该目录当作可恢复备份。

## 恢复演练

恢复属于会覆盖 hosted 数据的操作，本轮只提供操作边界，不在开发机自动执行。正式演练前必须：

1. 停止应用写入并复制当前数据库和头像目录；
2. 先运行 `verify`；
3. 使用独立的临时 PostgreSQL 数据库恢复 `database.sql`；
4. 将头像目录复制到临时 `AVATAR_STORAGE_DIR`；
5. 启动 hosted 版本，验证注册、登录、历史、资料和头像；
6. 记录恢复耗时、缺失文件和最终 SHA-256 清单。

生产恢复脚本需要由维护者在明确确认后执行，不能把恢复动作放进普通启动命令或 CI。
