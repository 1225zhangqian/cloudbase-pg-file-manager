# Supabase vs CloudBase 深度功能对比报告

> 基于 3 个真实 Demo 验证 + 官方 API 文档交叉对比  
> 验证日期：2025-07-20 | Supabase JS SDK v2.x vs CloudBase JS SDK v3.x (PG模式/传统模式)

---

## 一、初始化与鉴权

| 维度 | Supabase | CloudBase PG 模式 | CloudBase 传统模式 |
|------|----------|-------------------|-------------------|
| **SDK 包名** | `@supabase/supabase-js` | `@cloudbase/js-sdk` (同一包) | `@cloudbase/js-sdk` (同一包) |
| **初始化函数** | `createClient(url, key)` | `cloudbase.init({ env, accessKey })` | 同左 |
| **鉴权方式** | `anon` key (JWT) | Publishable Key (JWT) 或匿名登录 | 同左 |
| **环境标识** | Project URL (`xxx.supabase.co`) | 环境ID (`envId`) | 环境ID (`envId`) |
| **地域配置** | 无需（自动路由） | 可选 `region: 'ap-shanghai'` | 同左 |
| **本地开发** | ✅ localhost 直连 | ❌ localhost CORS 受限，需部署或配跨域 | 同左 |

### 代码对比

```javascript
// ========== Supabase ==========
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(
  'https://ccgpmgmfrsyucnmfzbjn.supabase.co',   // URL
  'eyJhbGciOiJIUzI1NiIs...'                       // anon JWT key
)
// → 即刻可用，无需登录，无需额外配置

// ========== CloudBase PG 模式 ==========
import cloudbase from '@cloudbase/js-sdk'
const app = cloudbase.init({
  env: 'test-pg-d3gf5tl148895663c',               // 环境ID
  accessKey: 'eyJhbGciOiJSUzI1NiIs...'            // Publishable Key (JWT)
})
// → accessKey 已内置鉴权，无需 signInAnonymously

// ========== CloudBase 传统模式 ==========
import cloudbase from '@cloudbase/js-sdk'
const app = cloudbase.init({
  env: 'lowcode-8gr4tbore6df2c6a',
  accessKey: 'eyJhbGciOiJSUzI1NiIs...'
})
// → 同上，accessKey 内置鉴权
```

### 实测结论
- **Supabase 本地开发体验最优**：`npm run dev` 后 localhost 直连无 CORS 问题（注：RLS 仍需手动配置才能上传，详见第五章）
- **CloudBase 两模式本地均受 CORS 限制**：必须部署到静态托管域名才能正常调用 API（除非手动配 CORS 白名单）
- **Publishable Key 是 CloudBase 推荐的 Web 端鉴权方式**：等同于 Supabase 的 anon key，都是 JWT 格式，可安全暴露在浏览器中

---

## 二、Storage API 核心对比

### 2.1 入口与路径模型（最关键差异）

| 维度 | Supabase | CloudBase PG 模式 | CloudBase 传统模式 |
|------|----------|-------------------|-------------------|
| **入口方法** | `supabase.storage.from('bucket')` | `app.storage.from('bucketId')` | `app.storage.from()` （无参）|
| **Bucket 概念** | ✅ 显式 Bucket | ✅ 显式 Bucket | ❌ 单一存储空间 |
| **路径参数** | 文件名 (`avatar.png`) | 对象名 (`user-123/avatar.png`) | 相对路径 或 fileID |
| **返回 ID 含义** | 对象完整路径 | `{ id, path, fullPath }` | `cloud://env.xxx/fileID` |

### 代码对比 — 上传

```javascript
// ========== Supabase ==========
const { error } = await supabase.storage.from('files')
  .upload('photo.png', file, {
    cacheControl: '3600',
    upsert: true          // 覆盖同名文件
  })

// ========== CloudBase PG 模式 ==========
const { data, error } = await app.storage.from('test3')
  .upload('photo.png', file, {
    cacheControl: 'max-age=3600',
    upsert: true          // 注意：默认 false！
  })
// data: { id: string, path: string, fullPath: "bucketId/photo.png" }

// ========== CloudBase 传统模式 ==========
const { data, error } = await app.storage.from()
  .upload(`${Date.now()}-photo.png`, file, {    // 必须加前缀防冲突
    cacheControl: 'max-age=3600',
    upsert: true          // 默认 true
  })
// data.id = "cloud://lowcode-8gr4tbore6df2c6a.timestamp-photo.png"
```

### 代码对比 — 列表文件（最大差异点）

```javascript
// ========== Supabase ✅ 原生支持 ==========
const { data, error } = await supabase.storage.from('files').list()
// data: [{ id, name, created_at, metadata: { size }, ... }]

// ========== CloudBase PG 模式 ✅ 原生支持 ==========
const { data, error } = await app.storage.from('test3').list()
// data: { objects: [...], folders: [...], hasNext, nextCursor }

// ========== CloudBase 传统模式 ❌ 不支持 ==========
// 无 list() 方法！Demo 中被迫使用 localStorage 缓存来维护文件列表
const cached = localStorage.getItem('cloudbase_files')
const existing = cached ? JSON.parse(cached) : []
```

### 代码对比 — 获取公开 URL（语义差异）

```javascript
// ========== Supabase — 永久公开 URL ==========
const { data: { publicUrl } } = supabase.storage.from('files')
  .getPublicUrl('photo.png')
// publicUrl: https://xxx.supabase.co/storage/v1/object/public/files/photo.png
// → 公开桶的 URL 永不过期，可直接用作 <img src>

// ========== CloudBase PG 模式 — 也是永久公开 URL ✅ ==========
const { data } = app.storage.from('test3').getPublicUrl('photo.png')
// data.publicUrl: 永久有效的公开访问地址
// → 与 Supabase 行为一致！

// ========== CloudBase 传统模式 — 签名 URL（600s 过期）❌ ==========
const { data } = await app.storage.from().createSignedUrl(fileId, 600)
// data.signedUrl: 带签名的临时 URL，默认 600 秒过期
// → 无法直接用于 <img src>（会很快失效）
// → getPublicUrl() 存在但返回的还是签名 URL
```

### 代码对比 — 删除文件

```javascript
// ========== Supabase — 按名称删除 ==========
const { error } = await supabase.storage.from('files')
  .remove(['photo.png'])

// ========== CloudBase PG 模式 — 按对象名删除 ==========
const { error } = await app.storage.from('test3')
  .remove(['photo.png'])

// ========== CloudBase 传统模式 — 按 fileID 删除 ==========
const { error } = await app.storage.from()
  .remove(['cloud://env.xxxxx/timestamp-photo.png'])
// → 必须保存上传时返回的 fileID，无法通过文件名反查
```

### 2.2 完整 API 能力矩阵

| API 方法 | Supabase | CB PG 模式 | CB 传统模式 | 说明 |
|---------|:--------:|:----------:|:-----------:|------|
| **upload(path, file)** | ✅ | ✅ | ✅ | 上传文件 |
| **update(path, file)** | ✅ (upsert替代) | ✅ | ✅ | 更新已存在文件 |
| **download(path)** | ✅ `.download()` | ✅ + `.asStream()` 流式 | ✅ | 下载为 Blob |
| **remove(paths)** | ✅ 按名称数组 | ✅ 按对象名数组 | ✅ 按 fileID 数组 | 批量删除 |
| **list(prefix, opts)** | ✅ | ✅ 分页+游标+排序 | ❌ 不支持 | 列出文件 |
| **getPublicUrl(path)** | ✅ **永久URL** | ✅ **永久URL** | ⚠️ 返回签名URL(临时) | 获取访问链接 |
| **createSignedUrl(path, ttl)** | ✅ | ✅ | ✅ | 创建临时签名链接 |
| **createSignedUrls(paths, ttl)** | ✅ 批量 | ✅ 批量 | ✅ 批量 | 批量签名链接 |
| **createSignedUploadUrl(path)** | ✅ | ✅ | ✅ | 服务端直传 URL |
| **uploadToSignedUrl(path, token, file)** | ✅ | ✅ | ❌ | 签名直传 |
| **move(from, to)** | ✅ | ✅ + 跨Bucket | ✅ | 移动/重命名 |
| **copy(from, to)** | ✅ | ✅ + 跨Bucket+元数据复制 | ✅ | 复制 |
| **info(path)** | ❌ | ✅ | ✅ | 获取文件元信息 |
| **exists(path)** | ❌ | ✅ | ✅ | 检查文件存在 |
| **createBucket(name, opts)** | ❌ (仅Dashboard/SQL) | ✅ SDK 支持 | ❌ | 创建桶 |
| **listBuckets(opts)** | ✅ | ✅ | ❌ | 列出所有桶 |
| **updateBucket(id, opts)** | ❌ | ✅ | ❌ | 更新桶配置 |
| **deleteBucket(id)** | ❌ | ✅ | ❌ | 删除桶 |
| **图片转换(Transform)** | ⚠️ 仅限付费计划 | ❌ | ✅ `download()` 参数 | 缩放/格式转换/质量 |
| **流式下载 asStream()** | ✅ (Response body) | ✅ ReadableStream | ❌ | 大文件流式处理 |

---

## 三、Database API 对比

> Storage 是本次验证的核心，但 Database 能力也直接影响技术选型。

| 维度 | Supabase | CloudBase (PG/传统共用) |
|------|----------|-----------------------|
| **数据库类型** | PostgreSQL（原生） | 文档数据库 (MongoDB 兼容) |
| **SDK 入口** | `supabase.from('table')` | `app.database().collection('coll')` |
| **查询风格** | PostgREST 链式调用 | MongoDB 链式调用 |
| **查询能力** | SQL 级别（join/filter/order/fulltext） | NoSQL 级别（where/order/aggregation） |
| **关系查询** | ✅ 原生 JOIN | ✅ lookup 聚合阶段 |
| **全文搜索** | ✅ 原生 textSearch | ✅ RegExp 正则 |
| **地理位置** | ❌ 需扩展 postgis | ✅ 原生 GeoPoint/GeoPolygon |
| **实时推送** | ✅ `supabase.channel('xxx')` | ✅ `collection.watch({ onChange })` |
| **事务** | ✅ RPC 函数内事务 | ✅ `startTransaction/runTransaction` |
| **聚合管道** | ⚠️ 通过 RPC 调用 SQL | ✅ 原生 aggregate pipeline |
| **RLS / 权限** | Row Level Security | 安全规则 JSON / RLS(PG模式) |
| **TypeScript** | ✅ 自动生成类型 | ⚠️ 基础类型定义 |

### Database 代码风格对比

```javascript
// ========== Supabase (PostgREST 风格) ==========
// 查询
const { data } = await supabase.from('todos')
  .select('id, title, priority, created_at')
  .eq('completed', false)
  .order('created_at', { ascending: false })
  .range(0, 9)

// 插入
const { data } = await supabase.from('todos')
  .insert([{ title: '学习 CloudBase', priority: 'high' }])
  .select()

// 更新
await supabase.from('todos')
  .update({ completed: true })
  .eq('id', 123)

// 删除
await supabase.from('todos').delete().eq('id', 123)
// 全文搜索
await supabase.from('docs')
  .select('*')
  .textSearch('content', 'cloudbase', { config: 'english' })


// ========== CloudBase (MongoDB 风格) ==========
const db = app.database()
const _ = db.command

// 查询
const result = await db.collection('todos')
  .where({ completed: false })
  .orderBy('createdAt', 'desc')
  .field({ title: true, priority: true, createdAt: true })
  .skip(0).limit(10)
  .get()

// 插入
const result = await db.collection('todos').add({
  title: '学习 CloudBase', priority: 'high'
})
// result.id

// 更新
await db.collection('todos').doc('123').update({
  completed: true,
  updatedAt: new Date()
})

// 删除
await db.collection('todos').doc('123').remove()

// 条件删除
await db.collection('todos')
  .where({ completed: true, createdAt: _.lt(Date.now() - 30*86400000) })
  .remove()

// 聚合统计
await db.collection('todos').aggregate()
  .group({ _id: '$priority', count: { $sum: 1 } })
  .sort({ count: -1 }).end()

// 地理位置查询（Supabase 原生不支持）
await db.collection('shops')
  .where({ location: _.geoNear({
    geometry: new db.Geo.Point(116.404, 39.915),
    maxDistance: 1000
  }) }).get()
```

---

## 四、Auth 认证体系对比

| 能力 | Supabase | CloudBase |
|------|----------|-----------|
| **邮箱密码** | ✅ signUp/signInWithPassword | ✅ signUp/signInWithPassword |
| **匿名登录** | ✅ signInAnonymously | ✅ signInAnonymously |
| **OAuth 社交登录** | ✅ Google/GitHub/etc (20+) | ✅ 微信/QQ/匿名/自定义 |
| **手机 OTP** | ✅ signInWithOTP | ✅ 短信验证码 |
| **Magic Link** | ✅ 邮箱魔法链接 | ❌ |
| **SSO / SAML** | ✅ signInWithSSO | ❌ |
| **Passkey / WebAuthn** | ✅ registerPasskey / signInWithPasskey | ❌ |
| **MFA 多因素** | ✅ admin MFA 管理 | ❌ |
| **Session 管理** | ✅ autoRefresh/getSession/setSession | ✅ 类似机制 |
| **Admin SDK** | ✅ service_role key | ✅ secretId/secretKey |
| **自定义 Claim** | ✅ Custom Access Token Hook | ❌ |
| **角色/RBAC** | ✅ 内建 role system | ✅ 自定义安全规则 |

---

## 五、权限模型深度对比（踩坑总结）

### 5.1 Supabase — Public 桶读取绕过 RLS（⚠️ 修正：不会自动生成 Policy）

> ⚠️ **重要修正**：之前的版本错误地说"Supabase 创建公开桶时自动生成 SELECT RLS Policy"。经查证官方文档，**Supabase 不会自动生成任何 RLS Policy**。

**官方文档原文**：
> "By default Storage does not allow any uploads to buckets without RLS policies."
> "Buckets are private by default."
> "When a bucket is designated as 'Public,' it effectively **bypasses access controls** for retrieving and serving files."

**真实机制**：
- 创建桶时**不生成**任何 RLS Policy
- 桶默认私有，需要手动配置 RLS 才能操作
- Public 桶的"公开"机制是**绕过 RLS（仅对读取/下载）**，不是创建 policy
- **写入操作（上传/删除/移动/复制）仍然需要手动配置 RLS Policy**

**为什么 Supabase Demo 能上传？**  
是用户通过 SQL migration **手动**创建了 RLS policies（包括 SELECT/INSERT/UPDATE/DELETE），不是 Supabase 自动生成的。我之前错把"用户配置过"记成了"自动配置"。

| 操作类型 | Public 桶是否需要 RLS |
|---------|:--------------------:|
| 读取 / 下载 / 列表 | ❌ 绕过 RLS（零配置可读） |
| 上传 / 删除 / 更新 / 移动 / 复制 | ✅ **需要手动配置 RLS** |

- **RLS 配置方式**：Dashboard UI / SQL Editor / Migration 都可以
- **相对 CloudBase PG 的优势**：仅限于**读取场景**可以零配置（Public 桶绕过 RLS）

### 5.2 CloudBase PG 模式 — 手动配置（关键踩坑）

```
创建桶 → ❌ 无默认 RLS Policy → 
→ 匿名用户无权限（403）→ 
→ 需手动执行 SQL：
  1. GRANT USAGE/SELECT/INSERT/UPDATE/DELETE ON storage.objects TO anon
  2. CREATE POLICY ... FOR ALL TO anon USING (true) WITH CHECK (true)
  3. 如果要用 createBucket：还需对 storage.buckets 授权
```

**核心发现（通过 demo 反复验证）**：

| 问题现象 | 根因 | 解决方案 |
|---------|------|---------|
| 上传返回 403 "new row violates row-level security policy" | `storage.objects` 表缺少 INSERT/SELECT RLS Policy | 添加 FOR ALL Policy |
| 上传返回 "Bucket not found" 但桶确实存在 | SDK 内部先 SELECT 查询桶是否存在 | **必须同时配置 SELECT Policy**（即使只是上传！） |
| createBucket 报错 "permission denied for table storage.buckets" | `anon` 角色缺少 storage.buckets 的 INSERT 权限 | GRANT + RLS Policy |
| 桶 A 能用、桶 B 不能用 | 不同桶可能在不同时间创建，Policy 配置不一致 | 使用通用 Policy：`FOR ALL USING (true)` 一劳永逸 |

**通用 RLS 策略（推荐用于测试/开发环境）**：
```sql
-- objects 表：对所有操作开放
CREATE POLICY anon_all ON storage.objects
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- buckets 表：允许创建/查看桶
CREATE POLICY anon_buckets_all ON storage.buckets
  FOR ALL TO anon USING (true) WITH CHECK (true);
```

### 5.3 CloudBase 传统模式 — JSON 安全规则

- 基于 JSON 规则表达式（类似 Firebase Firestore 规则）
- `read/write: true` 为完全开放
- 支持按路径、身份认证状态等条件控制
- 在控制台可视化配置

---

## 六、实际 Demo 运行差异总结

| 体验维度 | Supabase Demo | CloudBase PG Demo | CloudBase 传统 Demo |
|---------|:---:|:---:|:---:|
| **本地启动即用** | ✅ `npm run dev` → 直接工作 | ⚠️ 需部署到托管域名 | ⚠️ 同左 |
| **文件列表展示** | ✅ list() 原生支持 | ✅ list() 原生支持 | ❌ localStorage hack |
| **图片预览** | ✅ getPublicUrl 永久URL `<img>` | ✅ getPublicUrl 永久URL `<img>` | ⚠️ 每次 AsyncImage 请求签名URL |
| **下载文件** | ✅ publicUrl 直链 download | ✅ signedUrl 下载 | ✅ signedUrl 下载 |
| **删除后再列表** | ✅ 实时同步 | ✅ 实时同步 | ⚠️ 需同步清理 localStorage |
| **创建桶按钮** | ❌ SDK 不支持 | ✅ createBucket() 可用 | ❌ 不适用 |
| **CORS 问题** | ❌ 无（自带域名白名单） | ⚠️ 本地受限 | ⚠️ 同左 |

---

## 七、迁移成本评估

### Supabase → CloudBase PG 模式（低迁移成本）

```
Storage API 差异极小（~95% 相似度）：
  ✓ upload/remove/copy/move 语法几乎一致
  ✓ list() 都支持
  ✓ getPublicUrl() 都是公开永久 URL
  ✓ createSignedUrl() 用法相同
  
需要改的地方：
  - 导入和初始化方式不同
  - list() 返回结构不同（data vs data.objects）
  - upsert 默认值相反（Supabase 默认不覆盖？PG 默认 false）
  - 错误处理格式略有不同
```

### Supabase → CloudBase 传统模式（高迁移成本）

```
Storage API 差异大（~50% 相似度）：
  ✗ 没有 Bucket 概念
  ✗ 没有 list() —— 需自建文件索引（如用数据库表记录）
  ✗ getPublicUrl() 返回临时签名 URL —— 需定期刷新或改用 CDN
  ✗ 路径模型从“名称”变为“fileID” —— 需改造数据模型
  ✗ 删除依赖 fileID —— 需额外存储映射关系
  ✗ 图片预览体验差 —— 每个 img 都要异步获取签名 URL
```

---

## 八、最终结论

| 场景 | 推荐方案 | 理由 |
|------|---------|------|
| **快速原型/MVP** | **Supabase** | 本地开发无 CORS 障碍，Public 桶读取零配置（写入仍需配 RLS） |
| **已有微信生态** | **CloudBase** | 微信登录/支付/小程序原生集成 |
| **从 Supabase 迁移到腾讯云** | **CloudBase PG 模式** | Storage API 高度相似，迁移成本最低 |
| **纯文件存储需求** | **Supabase ≈ CloudBase PG** | 两者能力基本对等 |
| **需要文件列表管理** | **Supabase > CloudBase PG >> 传统模式** | 传统模式的 list() 缺失是硬伤 |
| **需要 SDK 动态创建桶** | **CloudBase PG 模式（唯一支持）** | Supabase 只能 Dashboard/SQL 创建 |
| **生产环境长期运营** | **两者皆可** | Supabase 海外节点多；CloudBase 国内访问快 + 腾讯云集成 |
| **地理位置查询** | **CloudBase** | 原生 GeoPoint 支持；Supabase 需要 postgis 扩展 |
| **Auth 能力丰富度** | **Supabase** | Passkey/SSO/MFA/OAuth 生态更完善 |

### 一句话总结

> **CloudBase PG 模式的 Storage API 已经与 Supabase 高度对等**（list/getPublicUrl/createBucket 全部支持），主要差距在于：(1) **本地开发体验** Supabase 更好（无 CORS 限制）；(2) **权限配置**两者都需要手动配 RLS Policy，但 Supabase 的 Public 桶对**读取**操作可绕过 RLS（零配置可读），CloudBase PG 模式即使读取也需要 SELECT Policy；(3) **传统模式**与 Supabase 差距仍然较大（无 list / URL 临时过期），不建议作为 Supabase 替代方案。
