# Supabase vs CloudBase PG 模式 — Storage 完整对比报告

> 基于三个 Demo（Supabase / CloudBase 传统 / CloudBase PG）的实际运行验证，从初始化、API、权限模型、开发体验四个维度对比。

---

## 结论先行

| | Supabase | CloudBase PG 模式 | CloudBase 传统模式 |
|------|:---:|:---:|:---:|
| **迁移难度** | - | ⭐⭐ 改动少 | ⭐⭐⭐ 多个坑 |
| **`list()` 文件列表** | ✅ | ✅ | ❌ |
| **`getPublicUrl` 永久链接** | ✅ | ✅ | ❌ 600s 过期 |
| **与 Supabase API 相似度** | - | **高** | 低 |
| **权限模型** | PostgreSQL RLS | PostgreSQL RLS | 安全规则 JSON |
| **Public 桶读取** | ✅ 可绕过 RLS | ❌ 仍需手动配 SELECT Policy | 不适用（用安全规则） |
| **写入权限配置** | ❌ 仍需手动配 RLS | ❌ 仍需手动配 RLS | 用安全规则控制 |
| **本地开发体验** | localhost 直连更顺 | 需匿名登录 + RLS | 需 CORS + Publishable Key |

**如果 Supabase 项目要迁移到 CloudBase，首选 PG 模式。**

---

## 一、初始化对比

```js
// Supabase
import { createClient } from '@supabase/supabase-js'
const supabase = createClient('https://xxx.supabase.co', 'eyJ...')

// CloudBase PG 模式
import cloudbase from '@cloudbase/js-sdk'
const app = cloudbase.init({
  env: 'test-pg-xxx',
  accessKey: 'eyJ...'  // Publishable Key
})

// CloudBase 传统模式
import cloudbase from '@cloudbase/js-sdk'
const app = cloudbase.init({
  env: 'lowcode-xxx',
  accessKey: 'eyJ...'  // Publishable Key
})
```

| | Supabase | PG 模式 | 传统模式 |
|------|:---:|:---:|:---:|
| 初始化参数 | URL + anonKey | envId + accessKey | envId + accessKey |
| 是否需登录 | 否 | 否（Publishable Key 内置） | 否 |
| 复杂度 | ⭐ | ⭐⭐ | ⭐⭐ |

---

## 二、API 调用形态对比

### 2.1 上传文件

```js
// Supabase
const { error } = await supabase.storage.from('files').upload('avatar.png', file, {
  cacheControl: '3600',
  upsert: true
})

// CloudBase PG — 形态几乎一致
const { error } = await app.storage.from('files').upload('avatar.png', file, {
  cacheControl: 'max-age=3600',
  upsert: true   // ⚠️ PG 默认 false，必须显式传
})

// CloudBase 传统 — bucket 在 from() 里不传
const { data, error } = await app.storage.from().upload('avatar.png', file, {
  cacheControl: 'max-age=3600',
  upsert: true
})
```

### 2.2 文件列表

```js
// Supabase
const { data } = await supabase.storage.from('files').list()

// CloudBase PG — 同名！返回 data.objects
const { data } = await app.storage.from('files').list()
// data.objects → [{ name, metadata: { size }, ... }]

// CloudBase 传统 — ❌ 不支持！
// 必须用 localStorage 缓存或云函数封装
```

### 2.3 获取公开链接

```js
// Supabase — 永久有效
const { data } = supabase.storage.from('files').getPublicUrl('avatar.png')

// CloudBase PG — 永久有效 ✅
const { data } = app.storage.from('files').getPublicUrl('avatar.png')

// CloudBase 传统 — ⚠️ 600s 过期！
const { data } = app.storage.from().getPublicUrl('avatar.png')
// 必须改用 createSignedUrl 实时获取
```

### 2.4 删除文件

```js
// Supabase
await supabase.storage.from('files').remove(['avatar.png'])

// CloudBase PG — 同名同参数！
await app.storage.from('files').remove(['avatar.png'])

// CloudBase 传统 — 参数是 fileId 不是路径
await app.storage.from().remove(['cloud://envId.xxx/avatar.png'])
```

---

## 三、API 覆盖度矩阵

| API | Supabase | PG 模式 | 传统模式 | 备注 |
|------|:---:|:---:|:---:|------|
| `upload` | ✅ | ✅ | ✅ | PG upsert 默认 false |
| `download` | ✅ | ✅ | ✅ | |
| `remove` | ✅ | ✅ | ✅ | 传统模式用 fileId |
| `list` | ✅ | ✅ | ❌ | **传统模式硬伤** |
| `getPublicUrl` | ✅ 永久 | ✅ 永久 | ⚠️ 600s | **传统模式语义坑** |
| `createSignedUrl` | ✅ | ✅ | ✅ | PG 返回 fullSignedURL |
| `uploadToSignedUrl` | ✅ | ✅ | ⚠️ | 传统模式忽略 token |
| `move/copy/update` | ✅ | ✅ | ✅ | |
| `info/exists` | ✅ | ✅ | ✅ | |
| `createBucket` | ✅ | ❌ | ❌ | 需控制台创建 |

---

## 四、权限模型对比

### 4.1 模型对比

| | Supabase | PG 模式 | 传统模式 |
|------|----------|----------|----------|
| 权限方式 | RLS Policy (SQL) | RLS Policy (SQL) | 安全规则 (JSON) |
| 粒度 | 表级 + 行级 | 表级 + 行级 | Bucket 级 |
| Public 桶读取 | ✅ **绕过 RLS**（无需 Policy） | ❌ 仍需 SELECT Policy | 不适用 |
| 写入操作 | ❌ 需手动配 RLS | ❌ 需手动配 RLS | JSON 规则控制 |
| 角色 | public/anon/authenticated | anon/authenticated | 用 auth.uid |

### 4.2 创建公开桶的配置流程对比

> ⚠️ **重要修正**：之前的版本错误地说"Supabase 一行 SQL 自动配齐 RLS Policy"。经查证官方文档，**Supabase 不会自动生成任何 RLS Policy**。Public 桶的机制是**读取绕过 RLS**，不是自动创建 Policy。写入操作（上传/删除/更新）仍然需要手动配置 RLS。

**Supabase**（创建桶 + 读取零配置，写入需手动配 RLS）：

```sql
-- Step 1: 一行 SQL 创建 Public Bucket（仅设置 public=true 标志位）
INSERT INTO storage.buckets (id, name, public) VALUES ('files', 'files', true);
-- 此时：读取/下载操作可绕过 RLS（零配置可读）
-- 但：上传/删除/更新操作仍被 RLS 拦截！

-- Step 2: 如需允许匿名上传/删除，必须手动创建 RLS Policy（与 CloudBase PG 一样）
CREATE POLICY anon_files_insert ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'files');
CREATE POLICY anon_files_delete ON storage.objects FOR DELETE TO anon USING (bucket_id = 'files');
```

**CloudBase PG 模式**（需要分步手动配）：

```sql
-- Step 1: 控制台手动创建 Bucket
-- Step 2: 手动配 GRANT
GRANT USAGE ON SCHEMA storage TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO anon;
GRANT SELECT ON storage.buckets TO anon;

-- Step 3: 手动配 4 条 RLS Policy（缺一不可！）
CREATE POLICY anon_files_select ON storage.objects FOR SELECT TO anon USING (bucket_id = 'files');
CREATE POLICY anon_files_insert ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'files');
CREATE POLICY anon_files_update ON storage.objects FOR UPDATE TO anon USING (bucket_id = 'files') WITH CHECK (bucket_id = 'files');
CREATE POLICY anon_files_delete ON storage.objects FOR DELETE TO anon USING (bucket_id = 'files');
```

### 4.3 ⚠️ 关键发现：SELECT Policy 是必须的

**CloudBase PG 模式的隐藏坑**：上传文件时，SDK 会先 SELECT 查询 bucket 是否存在，**如果没有 SELECT Policy，上传直接失败**。

实测验证：

| 配置 | 能否上传 |
|------|:---:|
| 只配 INSERT Policy | ❌ 403 |
| 只配 SELECT + INSERT | ✅ |
| 只配 SELECT + INSERT + DELETE | ✅ |

**完整 Policy 配置清单**（PG 模式必备）：

| Policy | 必须性 | 作用 |
|--------|:---:|------|
| **SELECT** | **必须** | 上传/下载/列表/删除都需要先查 Bucket |
| INSERT | 上传必须 | 写入新文件 |
| UPDATE | 更新必须 | 更新文件元数据 |
| DELETE | 删除必须 | 删除文件 |

**Supabase 的 `public` 角色默认有 SELECT 权限**，所以 Supabase 从不缺 SELECT policy；CloudBase PG 需要显式配。

---

## 五、踩过的坑汇总

| # | 问题 | 影响 | 解决 |
|---|------|------|------|
| 1 | `file://` 协议加载外部 CDN 被拦截 | SDK 加载失败 | 起本地 HTTP 服务器 |
| 2 | `cdn.jsdelivr.net` 不可达 | SDK 加载超时 | 改用 npm 本地安装 |
| 3 | `OPERATION_FAIL INVALID_PARAM`（传统模式） | 上传失败 | 改用 Publishable Key |
| 4 | CORS 跨域拦截 | 本地无法上传 | 部署到线上域名 |
| 5 | `list` 传统模式抛错 | 文件列表无法加载 | 切换到 PG 模式 |
| 6 | Vite 8.x rolldown native binding 缺失 | 构建失败 | 降级 Vite 5.x |
| 7 | PG 模式 Bucket 不存在 | 404 | 控制台创建 Bucket |
| 8 | **PG 模式缺 SELECT Policy** | **上传 403** | **手动配 RLS Policy** |
| 9 | PG 模式缺 INSERT Policy | 上传 403 | 配 INSERT Policy |
| 10 | 传统模式 `getPublicUrl` 600s 过期 | 持久链接失效 | 用 `createSignedUrl` 替代 |

---

## 六、迁移建议

### 6.1 选型决策

| 场景 | 推荐模式 | 原因 |
|------|:---:|------|
| 有 `list` 需求（文件管理） | **PG 模式** | 传统模式不支持 |
| 需要永久公开 URL | **PG 模式** | 传统模式 600s 过期 |
| 有 RLS 权限策略 | **PG 模式** | 同体系直接迁移 |
| 简单上传下载，无列表需求 | 传统模式 | 改动量 S |

### 6.2 Supabase → CloudBase PG 迁移 Checklist

- [ ] **Step 1**：在 CloudBase 控制台创建对应 Bucket
- [ ] **Step 2**：用 `tcb db execute` 配 GRANT 和 4 条 RLS Policy（**必含 SELECT**）
- [ ] **Step 3**：替换初始化代码（`createClient` → `cloudbase.init({ env, accessKey })`）
- [ ] **Step 4**：`storage.from('bucket')` 形态基本不变
- [ ] **Step 5**：注意 `upsert` 默认值是 `false`（Supabase 是 `true`）
- [ ] **Step 6**：迁移存量文件（Supabase → CloudBase COS）
- [ ] **Step 7**：用映射表批量改写 DB 中的 URL

### 6.3 SQL 模板（PG 模式 Bucket 配置）

```sql
-- 替换 <bucket_name> 为实际 bucket id
GRANT USAGE ON SCHEMA storage TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO anon;
GRANT SELECT ON storage.buckets TO anon;

CREATE POLICY anon_<bucket_name>_select ON storage.objects
  FOR SELECT TO anon USING (bucket_id = '<bucket_name>');
CREATE POLICY anon_<bucket_name>_insert ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = '<bucket_name>');
CREATE POLICY anon_<bucket_name>_update ON storage.objects
  FOR UPDATE TO anon USING (bucket_id = '<bucket_name>') WITH CHECK (bucket_id = '<bucket_name>');
CREATE POLICY anon_<bucket_name>_delete ON storage.objects
  FOR DELETE TO anon USING (bucket_id = '<bucket_name>');
```

---

## 七、总结

**核心差异在权限配置**：

| | Supabase | CloudBase PG |
|------|:---:|:---:|
| 创建公开桶 | 1 行 SQL（public=true）+ 读取零配置 | 控制台建桶 + 手动配 SELECT Policy |
| 写入操作（上传/删除） | **仍需手动配 RLS Policy** | 需手动配 RLS Policy |
| 读取操作（下载/列表） | Public 桶**绕过 RLS**（零配置） | **必须显式配 SELECT Policy** |
| 配置方式 | SQL / Dashboard GUI | SQL 命令行 |

**API 层面 PG 模式和 Supabase 几乎一致**：`upload` / `list` / `remove` / `getPublicUrl` 同名同签名，迁移改动量 S。

**权限配置的真实差异**——两者**写入操作都需要手动配 RLS Policy**，唯一区别是 Supabase 的 Public 桶对**读取操作**可以绕过 RLS（零配置可读），而 CloudBase PG 模式即使读取也需要 SELECT Policy。

---

*生成时间：2026-07-20 | 基于三个 Demo 的实际验证*  
*Demo 项目位置：`file-manager/react-app`、`cloudbase-file-manager`、`cloudbase-pg-file-manager`*
