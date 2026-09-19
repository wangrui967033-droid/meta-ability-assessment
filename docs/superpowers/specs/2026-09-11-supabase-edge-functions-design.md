# Supabase Edge Functions 后端迁移设计

## 目标

将元能力测评的生产 API 从独立 Node HTTP 服务迁移到 Supabase Edge Functions。学生端和管理端继续作为 OSS 静态站点发布；Supabase 承担 API、密钥托管与 Postgres 数据存储，不再依赖 ECS 上的 Node 常驻进程。

本次迁移保留既有学生测评、管理端查询、报告查看与重新生成能力，不改变测评算法、报告规则或用户可见的页面框架。

## 范围与非目标

范围：

- 实现一个名为 `assessment-api` 的 Edge Function，承接既有 API 契约。
- 将评分、提交校验、手机号脱敏和加密、项目隔离、管理端鉴权迁入函数运行时。
- 由 Supabase Secrets 保存敏感配置；静态前端仅保存函数 URL。
- 让前端 API 客户端支持以可配置的 Edge Function URL 调用。
- 为 Edge Function 增加可在 Deno 环境执行的单元测试与部署文档。

非目标：

- 不迁移或改变题库、报告分类算法、视觉样式与页面路由。
- 不把 service role key、管理员密码散入前端、OSS 或 Git 仓库。
- 不替换 Supabase 项目 `ray-learning-data` 现有的 `app_projects` / `assessments` 数据结构。

## 架构与数据流

```text
学生端 / 管理端（OSS 静态文件）
             |
             | HTTPS: /functions/v1/assessment-api/<route>
             v
Supabase Edge Function: assessment-api
  - CORS、来源校验、请求体边界与输入校验
  - 评分与报告生成
  - 管理员会话验证与登录限流
  - 使用 service_role 访问项目隔离数据
             |
             v
Supabase Postgres
  app_projects + assessments + 既有 RPC
```

函数读取 `ASSESSMENT_PROJECT_KEY`，每次数据库查询或 RPC 调用都以该 key 解析项目。一个 Supabase 项目可容纳多个业务项目，但不能跨项目读取或写入测评记录。

## 路由契约

原 `/api` 前缀改为 Edge Function 的路径前缀；路由语义与响应 JSON 保持一致：

| 方法 | Edge Function 路径 | 作用 |
| --- | --- | --- |
| `GET` | `/health` | 数据库可用性检查 |
| `POST` | `/assessments` | 验证、评分并幂等写入学生测评 |
| `POST` | `/admin/login` | 校验管理员账号并创建会话 |
| `POST` | `/admin/logout` | 清除会话 |
| `GET` | `/admin/assessments` | 分页查询项目内测评记录 |
| `POST` | `/admin/assessments/search` | 用手机号哈希精确查找项目内记录 |
| `GET` | `/admin/assessments/:id` | 获取单条详情与报告 |
| `POST` | `/admin/assessments/:id/regenerate` | 基于已保存作答重新生成报告 |

Edge Function 外层 URL 为：

```text
https://xldjstqwqydcohsebnde.supabase.co/functions/v1/assessment-api/<route>
```

前端通过构建变量 `VITE_ASSESSMENT_API_URL` 配置到上述函数根地址。开发环境未配置时仍默认调用当前同源 `/api`，从而保留本地 Node 测试与开发流程。

## 安全设计

### 密钥

以下值只存 Supabase Edge Function Secrets：

- `SUPABASE_SERVICE_ROLE_KEY`
- `ASSESSMENT_PROJECT_KEY`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD_HASH`
- `SESSION_SECRET`
- `PHONE_ENCRYPTION_KEY`
- `PHONE_LOOKUP_SECRET`

函数使用 `SUPABASE_URL`（由运行时提供）及 service role key 访问数据库。浏览器仅获知公开的函数 URL，不能直接访问 `assessments` 或 `app_projects` 表。

### 管理员会话

保留已有的 HMAC 签名、8 小时有效期的会话格式，但改为 Edge Function 签发的 `HttpOnly; Secure; SameSite=Lax` Cookie。Cookie 的 `Path=/` 让 OSS `/projects/meta-ability-assessment/admin/` 与函数请求共享；函数仅接受配置的生产 Origin。

登录限流迁移为基于 Supabase KV（或 Postgres 的短期窗口记录）的持久化限流。V1 采用数据库表 `admin_login_attempts`，以项目 key 与请求来源哈希作为键；成功登录时清除失败记录，达到阈值时返回现有 `429` 响应。

### 请求边界

- 仅允许配置的 OSS Origin；所有返回 `Vary: Origin` 与 `Cache-Control: no-store`。
- JSON 请求上限为 1 MiB，限定 `Content-Type: application/json`。
- 管理端写操作同时校验 Origin、会话、HTTP 方法与白名单字段。
- 数据库使用已部署的项目范围 RPC 和 server-only 访问；错误日志不记录手机号、作答或密钥。

## 代码组织

新增 `supabase/functions/assessment-api/`：

- `index.ts`：Deno `serve` 入口、路由和 HTTP 响应。
- `config.ts`：必需 secrets 与公开配置的严格解析。
- `security.ts`：Web Crypto 版本的手机号加密、HMAC 会话、密码校验、请求来源校验。
- `database.ts`：项目范围的 Supabase 查询与既有 RPC 封装。
- `score-assessment.ts` 及所需纯算法模块：从 Node 专用依赖剥离，改为可被 Node 和 Deno 共同使用的纯 TypeScript 模块。

现有 `server/` 保留为本地开发与回退实现，生产部署文档则切换为 Edge Functions。待函数稳定运行后，可在后续独立变更中删除 Node 生产路径。

## 数据库变更

新增迁移：

- `admin_login_attempts`，包含 `project_id`、`client_key_hash`、`failures`、`expires_at`、`updated_at`，并在 `(project_id, client_key_hash)` 上唯一。
- RLS 开启，撤销 `anon` 与 `authenticated` 权限；仅 service role 可用。
- 基于 expiry 的索引，函数在读写时清理当前键的过期记录；后续可接 pg_cron 批量回收。

现有 `assessments`、`app_projects` 和两个 RPC 不变。

## 测试与验收

1. 纯算法与安全工具在 Node / Deno 可复用测试中通过。
2. Edge Function 路由测试覆盖提交幂等、冲突、项目隔离、管理员未授权、错误 Origin、登录限流、详情、检索与重生成。
3. 前端请求测试覆盖同源后备与 `VITE_ASSESSMENT_API_URL` 两种路径。
4. `supabase functions serve assessment-api` 本地联调可创建记录、登录、查询、重生成。
5. 部署到 `ray-learning-data` 后，用真实 OSS 域名进行一次学生提交与管理端报告打印验收。
6. 生产构建中不含 service role key、管理员凭据、电话加密密钥或完整手机号。

## 部署与回退

部署顺序：先应用数据库迁移，再设定 Edge Function Secrets，部署函数，最后以 `VITE_ASSESSMENT_API_URL` 重新构建并上传 OSS 静态资源。部署后先对 `/health`、学生提交与管理员登录执行冒烟测试。

回退仅需将 OSS 前端重新部署为未设置 `VITE_ASSESSMENT_API_URL` 的版本，并恢复原 Node API 地址；数据库记录格式不变。函数 secrets 不会进入 Git，也不需要回退或暴露。
