-- CloudBase PG 模式 RLS 配置脚本
-- 用法: npx tcb db execute setup-rls.sql -e test-pg-d3gf5tl148895663c

-- 1. 授权 anon 角色
GRANT USAGE ON SCHEMA storage TO anon;
GRANT INSERT, SELECT, UPDATE, DELETE ON storage.objects TO anon;
GRANT SELECT ON storage.buckets TO anon;

-- 2. 删除可能已存在的同名 policy
DROP POLICY IF EXISTS "anon_test_bucket_insert" ON storage.objects;
DROP POLICY IF EXISTS "anon_test_bucket_select" ON storage.objects;
DROP POLICY IF EXISTS "anon_test_bucket_update" ON storage.objects;
DROP POLICY IF EXISTS "anon_test_bucket_delete" ON storage.objects;

-- 3. 创建 RLS Policy（允许 anon 对 test bucket 完全操作）
CREATE POLICY "anon_test_bucket_insert"
ON storage.objects FOR INSERT TO anon
WITH CHECK (bucket_id = 'test');

CREATE POLICY "anon_test_bucket_select"
ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'test');

CREATE POLICY "anon_test_bucket_update"
ON storage.objects FOR UPDATE TO anon
USING (bucket_id = 'test')
WITH CHECK (bucket_id = 'test');

CREATE POLICY "anon_test_bucket_delete"
ON storage.objects FOR DELETE TO anon
USING (bucket_id = 'test');
