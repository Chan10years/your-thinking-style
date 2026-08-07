# Documentation Index

本目录保存会约束开发行为的设计与实施计划，必须进入版本控制。

## Current backend authority

以下两份文档共同构成账户后端开发准则：

1. [Hosted backend architecture design](superpowers/specs/2026-08-07-hosted-backend-architecture-design.md)
2. [Hosted backend implementation plan](superpowers/plans/2026-08-07-hosted-backend-implementation.md)

设计文档决定范围、技术栈、数据边界和验收标准；实施计划决定顺序、文件边界、测试
和提交粒度。若代码实现与二者冲突，应先修改并重新审批文档，不能让代码自行改变
产品边界。

## Historical documents

`2026-07-17-mvp-stage-one-completion*` 是基础诊断阶段的历史记录。当时明确禁止账户和
数据库，并使用当时的超时参数。它们不再是账户后端的执行依据，但保留用于解释现有
内存请求保护和分析重试逻辑的来源。
