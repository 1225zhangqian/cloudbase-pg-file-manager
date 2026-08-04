# CloudBase 传统模式 vs PG 模式 vs Supabase — 三维对比报告

> 基于三个 Demo 的实际运行验证，从初始化、API 形态、权限模型、开发体验四个维度对比。

---

## 结论先行

| | Supabase | CloudBase PG 模式 | CloudBase 传统模式 |
|------|:---:|:---:|:---:|
| **迁移难度** | - | ⭐⭐ 改动少 | ⭐⭐⭐ 需绕过多个坑 |
| **`list()` 文件列表** | ✅ | ✅ | ❌ |
| **`getPublicUrl` 永久链接** | ✅ | ✅ | ❌ 600s 过期 |
| **与 Supabase API 相似度** | - | **高** (同名同签名) | 低 (需改方法名+参数) |
| **权限模型** | RLS | RLS | 安全规则 JSON |
| **本地开发体验** | 开箱即用 | 需匿名登录 | 需配 CORS + Publishable Key |

**如果 Supabase 项目要迁移到 CloudBase，首选 PG 模式。**

---

## 一、初始化对比

```js
// ===== Supabase =====
import { createClient } from '@supabase/supabase-js'
const supabase = createClient('https://xxx.supabase.co', 'eyJ...')

// ===== CloudBase PG 模式 =====
import cloudbase from '@cloudbase/js-sdk'
const app = cloudbase.init({ env: 'test-pg-xxx' })
// 需匿名登录
await app.auth().anonymousAuthProvider().signIn()

// ===== CloudBase 传统模式 =====
import cloudbase from '@cloudbase/js-sdk'
const app = cloudbase.init({
  env: 'lowcode-xxx',
  accessKey: 'eyJ...'  // 必须传 Publishable Key
})
```

| 维度 | Supabase | PG 模式 | 传统模式 |
|------|:---:|:---:|:---:|
| 初始化参数 | URL + anonKey | envId | envId + accessKey |
| 是否需登录 | 否 | 是（匿名） | 否（Key 内置鉴权） |
| 复杂度 | ⭐ | ⭐⭐ | ⭐⭐ |

---

## 二、API 调用形态逐项对比

### 2.1 上传文件

```js
// Supabase
const { error } = await supabase.storage.from('files').upload('avatar.png', file, {
  cacheControl: '3600',
  upsert: true
})

// CloudBase PG 模式 — 形态几乎一致
const { error } = await app.storage.from('files').upload('avatar.png', file, {
  cacheControl: 'max-age=3600',
  upsert: true   // ⚠️ 注意：PG 模式默认 false，必须显式传 true
})

// CloudBase 传统模式 — bucket 在 from() 里不传，upsert 默认 true
const { data, error } = await app.storage.from().upload('avatar.png', file, {
  cacheControl: 'max-age=3600',
  upsert: true
})
```

### 2.2 文件列表

```js
// Supabase
const { data } = await supabase.storage.from('files').list()

// CloudBase PG 模式 — 同名！返回 data.objects
const { data } = await app.storage.from('files').list()
// data.objects → [{ name: 'avatar.png', metadata: { size: 12345 }, ... }]

// CloudBase 传统模式 — ❌ 不支持！
// 必须用 localStorage 缓存或云函数封装绕过
```

### 2.3 获取公开链接

```js
// Supabase — 永久有效
const { data } = supabase.storage.from('files').getPublicUrl('avatar.png')
// data.publicUrl → 永久 CDN 链接

// CloudBase PG 模式 — 永久有效 ✅
const { data } = app.storage.from('files').getPublicUrl('avatar.png')
// data.publicUrl → 永久公开链接

// CloudBase 传统模式 — ⚠️ 600s 过期
const { data } = app.storage.from().getPublicUrl('avatar.png')
// data.publicUrl → 10 分钟后失效！
// 正确做法：用 createSignedUrl 每次实时获取
```

### 2.4 删除文件

```js
// Supabase
await supabase.storage.from('files').remove(['avatar.png'])

// CloudBase PG 模式 — 同名同参数！
await app.storage.from('files').remove(['avatar.png'])

// CloudBase 传统模式 — 参数是 fileId 不是路径
await app.storage.from().remove(['cloud://envId.xxx/avatar.png'])
```

### 2.5 获取签名链接

```js
// Supabase
const { data } = await supabase.storage.from('files').createSignedUrl('avatar.png', 3600)

// CloudBase PG 模式 — 同名，返回 fullSignedURL
const { data } = await app.storage.from('files').createSignedUrl('avatar.png', 3600)
// data.fullSignedURL

// CloudBase 传统模式 — 同名，返回 signedUrl
const { data } = await app.storage.from().createSignedUrl(fileId, 3600)
// data.signedUrl
```

---

## 三、API 覆盖度矩阵

| API | Supabase | PG 模式 | 传统模式 | 备注 |
|------|:---:|:---:|:---:|------|
| `upload` | ✅ | ✅ | ✅ | PG upsert 默认 false |
| `download` | ✅ | ✅ | ✅ | |
| `remove` | ✅ | ✅ | ✅ | 传统模式用 fileId |
| `list` | ✅ | ✅ | ❌ | **传统模式硬伤** |
| `getPublicUrl` | ✅ (永久) | ✅ (永久) | ⚠️ (600s) | **传统模式语义坑** |
| `createSignedUrl` | ✅ | ✅ | ✅ | PG 返回 fullSignedURL |
| `createSignedUrls` | ✅ | ✅ | ⚠️ (不支持 download) | |
| `uploadToSignedUrl` | ✅ | ✅ | ⚠️ (忽略 token) | |
| `move` | ✅ | ✅ | ✅ | |
| `copy` | ✅ | ✅ | ✅ | |
| `update` | ✅ | ✅ | ✅ | |
| `info` | ✅ | ✅ | ✅ | |
| `exists` | ✅ | ✅ | ✅ | |
| `createBucket` | ✅ | ❌ | ❌ | 需控制台创建 |
| `listBuckets` | ✅ | ❌ | ❌ | |

---

## 四、权限模型对比

| | Supabase | PG 模式 | 传统模式 |
|------|----------|----------|----------|
| 权限方式 | RLS Policy (SQL) | RLS Policy (SQL) | 安全规则 (JSON) |
| 粒度 | 表级 + 行级 | 表级 + 行级 | Bucket 级 |
| 能否按用户隔离 | ✅ `auth.uid()` | ✅ `auth.uid()` | ⚠️ 需自定义规则 |
| 能否按路径隔离 | ✅ | ✅ | ⚠️ 有限支持 |
| 迁移复杂度 | - | 低（同 RLS 体系） | 高（需翻译成 JSON） |

**示例**：只允许用户访问自己的文件

```sql
-- Supabase & PG 模式（完全相同）
CREATE POLICY "user_own_files" ON storage.objects
FOR SELECT USING (auth.uid() = owner_id);
```

```json
// 传统模式（需翻译）
{
  "read": "auth.uid == resource.openid",
  "write": "auth.uid == resource.openid"
}
```

---

## 五、开发体验对比

| | Supabase | PG 模式 | 传统模式 |
|------|:---:|:---:|:---:|
| 本地 `file://` 协议 | ❌ 需 HTTP 服务器 | ❌ 需 HTTP 服务器 | ❌ 需 HTTP 服务器 |
| CORS 配置 | 无需 | 需配或部署线上 | **必须配或部署线上** |
| CDN 依赖 | 可 npm 本地安装 | npm 本地安装 | npm 本地安装 |
| 开箱即用度 | ⭐⭐⭐ | ⭐⭐ | ⭐ |
| 首次跑通耗时 | 5 分钟 | 10 分钟 | 30 分钟+ |

---

## 六、Supabase 项目迁移到 CloudBase 选型建议

| 场景 | 推荐模式 | 原因 |
|------|:---:|------|
| 有 `list` 需求（文件管理） | **PG 模式** | 传统模式不支持 |
| 需要永久公开 URL | **PG 模式** | 传统模式 600s 过期 |
| 有 RLS 权限策略 | **PG 模式** | 同体系，直接迁移 |
| 简单上传下载，无列表需求 | 传统模式 | 改动量 S |
| 已有传统模式环境 | 传统模式 + 云函数封装 list | 不想迁移环境 |

**结论**：如果从 Supabase 迁移，PG 模式和 Supabase 的 API 形态最接近，`list`/`getPublicUrl`/`remove` 都是同名同签名，权限模型同是 RLS。传统模式需要绕过 `list` 和 `getPublicUrl` 两个硬伤。

---

*生成时间：2026-07-20 | 基于三个 Demo 的实际验证*
