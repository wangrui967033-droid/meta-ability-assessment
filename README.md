# 元能力测评：已上线版本

当前源码对应 2026-09-15 上线版本 `1.6-readable-20260915`，后端为 Supabase Edge Function `assessment-api` v4。
2026-09-19 已逐一核验线上 HTML、JS、CSS，与发布清单 SHA-256 完全一致。

- [学生入口](http://sishu.ray.xshq0521.cn/projects/meta-ability-assessment/projects/meta-ability-assessment/index.html)
- [管理入口](http://sishu.ray.xshq0521.cn/projects/meta-ability-assessment/projects/meta-ability-assessment/admin/index.html)
- [实际部署架构](docs/SUPABASE-OSS.md)
- [发布记录](docs/releases/20260915-release-notes.txt)
- [前端文件校验清单](docs/releases/20260915-frontend-manifest.json)

使用 Node.js 24+，执行 `pnpm install --frozen-lockfile`、`pnpm test`、`pnpm run build:oss`。
`build:oss` 生成 OSS 静态发布包；GitHub 用于源码版本管理。现有线上服务仍由 OSS 与 Supabase 提供。
密钥和数据库数据不进入仓库。下方为原 Node 服务实现的参考文档；当前线上部署以实际部署架构文档为准。

---

# 元能力学习入口测评

面向浙江新高考学生的移动端测评与学习任务报告。学生完成 V1.6 题库后，Node.js 服务会在服务端校验作答、计分并将报告快照存入 SQLite；机构管理员可在 `/admin` 检索、查看、重新生成和打印报告。

当前分类阈值仅用于产品验证，正式解读仍需用真实学生样本完成校准与效度验证。

## 运行前提

- Node.js 24 或更高版本；
- pnpm；
- 生产环境中由 Nginx 或等价反向代理终止 HTTPS；
- 单机、单个 Node 进程访问 SQLite。需要多机或高并发时应先迁移数据库。

```bash
pnpm install --frozen-lockfile
cp .env.example .env
chmod 600 .env
```

`.env` 不得提交。先交互式读取管理员密码，再生成兼容的密码摘要和三个随机密钥：

```bash
read -r -s -p "Administrator password: " ADMIN_PASSWORD
export ADMIN_PASSWORD
node scripts/create-admin-credentials.mjs
unset ADMIN_PASSWORD
```

将终端输出的 `ADMIN_PASSWORD_HASH`、`SESSION_SECRET`、`PHONE_ENCRYPTION_KEY` 和 `PHONE_LOOKUP_SECRET` 手工写入 `.env`；不要将输出重定向到仓库文件。配置 `ADMIN_USERNAME`、`DATABASE_PATH`、`BACKUP_DIRECTORY` 和精确的 `APP_ORIGIN`。生产环境的 `APP_ORIGIN` 是必填项，必须是浏览器实际访问的、不带路径/查询的 HTTPS Origin，例如 `https://assessment.example.com`；缺失、HTTP 或非 Origin 值会阻止生产服务启动。

更换数据库后仍需保留创建这些记录时的 `PHONE_ENCRYPTION_KEY` 和 `PHONE_LOOKUP_SECRET`，否则历史手机号无法解密或精确检索。

## 本地学生端与管理端

两个终端分别运行：

```bash
# 终端 1：服务端，默认 http://127.0.0.1:3001
pnpm dev:server

# 终端 2：Vite 开发服务器
pnpm dev
```

学生端为 `http://127.0.0.1:5173/`，管理端为 `http://127.0.0.1:5173/admin`。Vite 只在开发服务器中将 `/api` 代理到 `API_PROXY_TARGET`（默认 `http://127.0.0.1:3001`）；该值必须是精确的 HTTP(S) Origin，生产构建不读取也不使用它。修改本地 `PORT` 时，在 `.env` 中同步修改 `API_PROXY_TARGET`，无需改动 Vite 源码。

## 生产构建与启动

```bash
pnpm build:production
pnpm start:server
```

`build:production` 依次生成：

- `dist/`：学生端和管理端的公开静态文件，资源 URL 保持相对路径；
- `dist-server/index.js`：服务端 API 与权威计分程序。

`start:server` 显式以 `NODE_ENV=production` 启动，因此管理员 Cookie 会带 `Secure`。命令会在存在时读取项目根目录的 `.env`；生产平台也可直接注入同名环境变量，已注入的值优先于文件。Node 默认只绑定 `HOST=127.0.0.1`；仅接受规范 IPv4、有效 IPv6 或 DNS 主机名，`0`、`0x0`、`127.1` 等可被系统隐式解释为 IP 的旧式写法会被拒绝。仅在受控网络确实需要时才改为显式 IP/主机名；如使用 `0.0.0.0` 必须同时用主机防火墙限制入站源。

### Nginx / HTTPS 边界

下列片段展示必需边界：同一 HTTPS Origin 托管 `dist/`，SPA 路由回退到 `index.html`，`/api` 原样转发到 Node。证书路径、域名和项目路径必须替换为部署环境的真实值。

```nginx
server {
    listen 443 ssl http2;
    server_name assessment.example.com;

    ssl_certificate     /etc/letsencrypt/live/assessment.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/assessment.example.com/privkey.pem;

    root /srv/meta-ability/current/dist;
    index index.html;
    client_max_body_size 1m;

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Request-Id $request_id;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

80 端口应只做到 HTTPS 的永久跳转。不得缓存 `/api/*` 响应；服务端已发送 `Cache-Control: no-store`。建议由 systemd 运行 `pnpm start:server`，设置专用非 root 用户、最小文件权限和失败自动重启。上述 Nginx 配置故意不公开 `/health`；本机监控直接请求 `http://127.0.0.1:3001/health`。如必须由 Nginx 提供健康检查，应单独定义精确 `location = /health`、限制监控网段且不开启缓存，不要改为无限制公开路由。

## SQLite 备份与恢复

数据库使用 WAL 模式，而当前备份工具通过 `fs.copyFile` 复制主数据库文件。因此备份的前提是先停止 Node 服务，等待数据库连接正常关闭和 WAL 检查点完成。不得在服务运行时将单个 `.sqlite` 拷贝视为可恢复备份。

每日维护窗口将下列完整块保存为受控运维脚本并执行。它只在 systemd 确认服务已停止时备份；无论备份成败都尝试重启，最终优先保留备份失败码，否则返回重启失败码：

```bash
task6_backup_status=0
task6_restart_status=0

if ! sudo systemctl stop meta-ability; then
  exit 1
fi

if sudo systemctl is-active --quiet meta-ability; then
  task6_backup_status=1
else
  sudo -u meta-ability pnpm --dir /srv/meta-ability/current backup:database \
    || task6_backup_status=$?
fi

sudo systemctl start meta-ability || task6_restart_status=$?

if [ "$task6_backup_status" -ne 0 ]; then
  exit "$task6_backup_status"
fi
exit "$task6_restart_status"
```

`backup:database` 必须获得非空 `DATABASE_PATH`，并使用 `BACKUP_DIRECTORY`（默认 `./backups`）创建 UTC 时间命名的 `meta-ability-YYYYMMDD-HHmmss.sqlite`。它拒绝空路径、源与目标相同、同名备份，以及任何现存的 `-wal`/`-journal`/`-shm` 边车文件。复制前后还会比对源文件身份、大小和高精度修改时间；任何变化都会删除未发布的临时副本并非零退出。备份目录包括已存在的目录会被校正为 `0700`；复制先在该私有目录中以 `0600` 临时文件完成，通过安全复查后才以不覆盖方式发布。

Node 服务正常关闭会关闭最后一个 SQLite 连接并完成 WAL 检查点；备份命令的边车检查是第二道强制门。定时器仍应为备份失败、重启失败分别告警，并实施保留期清理。

备份目录必须位于 Web 根目录之外，仅服务账号可读，使用磁盘加密，并按机构的保留期异地复制。备份包含手机号密文、原始作答和报告，敏感级别与正式数据库相同。

恢复前必须满足全部条件：Node 服务已停止；备份已在隔离目录中通过 SQLite `PRAGMA integrity_check`；当前数据库及 `-wal`/`-shm` 边车文件已移到可回滚目录；原部署的 `PHONE_ENCRYPTION_KEY` 和 `PHONE_LOOKUP_SECRET` 已安全恢复。然后以数据库运行账号将通过检查的备份复制到 `DATABASE_PATH`，启动服务，并验证 `/health`、登录、列表和一条历史记录的解密/检索。不要在运行中直接覆盖数据库。

## OSS 与产物边界

OSS/CDN 只可托管 `dist/` 中的公开前端文件。绝不得上传 `.env`、`dist-server/`、SQLite 数据库、`-wal`/`-shm` 边车文件或任何备份。服务端包含权威答案与计分逻辑，只能留在受控服务器。

前端使用相对 `/api` 路径。如果静态文件由 OSS 提供，必须通过同一域名的 CDN/边缘规则将 `/api/*` 转发到 HTTPS Node 服务，同时保持 `APP_ORIGIN`、Cookie 和 CORS 边界一致。仅上传 `dist/` 而没有可达 API 的纯静态部署无法提交测评，不得用于真实学生数据。

## 验证与产物审计

```bash
pnpm test:server
pnpm test
pnpm build:production
pnpm build:deployment
pnpm vitest run src/lib/score-range-simulation.test.ts
pnpm audit:student-bundle
pnpm audit:production-artifacts
rg -n 'ADMIN_PASSWORD|SESSION_SECRET|PHONE_ENCRYPTION_KEY|phone_encrypted|correctAnswer|v16AnswerKey' dist dist-server || true
git status --short
```

`dist/` 中不应出现管理凭据、密钥、手机号密文字段或客户端答案。`dist-server/` 可以包含服务端环境变量名和权威答案代码，但不得包含任何部署环境的实际配置值。审计前确认工作区没有 `.env`、数据库或备份文件被 Git 跟踪或列为待提交。

## 静态演示文件

- [测评与报告联调版](design/元能力测评-题库报告联调版.html)
- [学生学习画像报告](design/元能力学习画像-报告端.html)

静态演示仅用于设计复核，不连接生产数据库，也不得代替服务端提交流程。
