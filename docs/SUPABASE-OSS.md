# Supabase + OSS 实际部署方式

本文件取代早期设计文档中 Node 运行服务、邮箱登录和跨站 Cookie 的方案。

- OSS 只放静态网页：`projects/meta-ability-assessment/`，不覆盖桶根目录或其他项目。
- Supabase 项目：`ray-learning-data`（`xldjstqwqydcohsebnde`）。
- Edge Function：`assessment-api`。评分复用 `shared/score-assessment.ts`，学生包不包含答案表。
- 学生提交、报告快照、管理员查询及重新生成均由 Supabase 处理。
- 管理员只填账号和密码，不需要真实邮箱、验证码或邮件验证。Auth 邮箱仅作为内部不可投递标识；管理员权限以 `app_project_admins` 为准。
- 账号 `feifan`，密码仅在 Supabase Auth 中以密码散列保存。源码和上传包不保存密码。
- 登录成功返回短期 access token，保存在当前标签页 sessionStorage；过期后重新登录，不在浏览器保存密码或 service-role key。
- 退出清理本地会话并调用 Auth logout。已签发的 access token 在其到期前可能仍有效；不要把它分享给他人。
- 所有管理员接口逐次校验 Auth 用户和本项目成员资格。公开学生提交接口只回传本次提交的报告，不提供公开查询学生名单的接口。
- 登录尝试使用数据库原子限流；公开提交有按手机号限流，但正式大规模开放前还应配置人机验证/网关防刷。
- 手机号使用 AES-GCM 加密、HMAC 精确检索。密钥在 Supabase Vault，读取配置 RPC 仅授予 service_role。请勿删除或轮换现有密钥，除非同步迁移已保存的手机号。

## 上传及入口

运行 `pnpm run build:oss`，生成带时间戳的 ZIP，解压上传其中 `projects` 目录到桶根目录。不要上传源代码、`.env`、`edge`、`supabase`、`node_modules` 或 `dist-server`。

学生：`http://sishu.ray.xshq0521.cn/projects/meta-ability-assessment/index.html`

管理：`http://sishu.ray.xshq0521.cn/projects/meta-ability-assessment/admin/index.html`

管理入口跳转至同目录 `index.html#/admin`，因此 OSS 不需要额外 SPA 路由回退。

用户选择先用 HTTP 页面进行内测。前端 API 地址固定 HTTPS，密码和测评数据发往 HTTPS 的 Supabase 接口；但 HTTP 页面本身可能被篡改，因此并不构成完整的安全访问链路。正式使用建议为自定义域名绑定正确的 HTTPS 证书，再将 APP_ORIGIN 改为对应 HTTPS Origin。不要忽略证书错误。

## 验证与适用范围

`pnpm test` 覆盖评分、报表、原服务及新增 Edge 认证测试；完整云端验证还需实际提交、登录、读取、打印流程。

数据库按 `project_id` 隔离。后续项目另建目录，并配置自己的接口和权限映射；不能仅换前端目录却复用本项目接口。
