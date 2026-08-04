-- ============================================================
-- 还原为真正的单桶 RLS 配置
-- 用法: npx tcb db execute revert-single-bucket.sql -e test-pg-d3gf5tl148895663c
-- ============================================================

-- 1. 删除全局策略（即使不存在也不报错）
DROP POLICY IF EXISTS anon_objects_all ON storage.objects;
DROP POLICY IF EXISTS anon_buckets_all ON storage.buckets;

-- 2. 删除旧单桶策略（避免重复创建）
DROP POLICY IF EXISTS "anon_test_bucket_insert" ON storage.objects;
DROP POLICY IF EXISTS "anon_test_bucket_select" ON storage.objects;
DROP POLICY IF EXISTS "anon_test_bucket_update" ON storage.objects;
DROP POLICY IF EXISTS "anon_test_bucket_delete" ON storage.objects;

DROP POLICY IF EXISTS "anon_test2_bucket_insert" ON storage.objects;
DROP POLICY IF EXISTS "anon_test2_bucket_select" ON storage.objects;
DROP POLICY IF EXISTS "anon_test2_bucket_update" ON storage.objects;
DROP POLICY IF EXISTS "anon_test2_bucket_delete" ON storage.objects;

DROP POLICY IF EXISTS "anon_test3_bucket_insert" ON storage.objects;
DROP POLICY IF EXISTS "anon_test3_bucket_select" ON storage.objects;
DROP POLICY IF EXISTS "anon_test3_bucket_update" ON storage.objects;
DROP POLICY IF EXISTS "anon_test3_bucket_delete" ON storage.objects;

DROP POLICY IF EXISTS "anon_test4_bucket_insert" ON storage.objects;
DROP POLICY IF EXISTS "anon_test4_bucket_select" ON storage.objects;
DROP POLICY IF EXISTS "anon_test4_bucket_update" ON storage.objects;
DROP POLICY IF EXISTS "anon_test4_bucket_delete" ON storage.objects;

DROP POLICY IF EXISTS "anon_sdktest_bucket_insert" ON storage.objects;
DROP POLICY IF EXISTS "anon_sdktest_bucket_select" ON storage.objects;
DROP POLICY IF EXISTS "anon_sdktest_bucket_update" ON storage.objects;
DROP POLICY IF EXISTS "anon_sdktest_bucket_delete" ON storage.objects;

-- 3. 保留表级 GRANT（不变）
GRANT USAGE ON SCHEMA storage TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO anon;
GRANT SELECT ON storage.buckets TO anon;

-- 4. 为每个桶单独创建 4 条 RLS Policy
-- test（私有桶）
CREATE POLICY "anon_test_bucket_select" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'test');
CREATE POLICY "anon_test_bucket_insert" ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'test');
CREATE POLICY "anon_test_bucket_update" ON storage.objects
  FOR UPDATE TO anon USING (bucket_id = 'test') WITH CHECK (bucket_id = 'test');
CREATE POLICY "anon_test_bucket_delete" ON storage.objects
  FOR DELETE TO anon USING (bucket_id = 'test');

-- test2（公开桶）
CREATE POLICY "anon_test2_bucket_select" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'test2');
CREATE POLICY "anon_test2_bucket_insert" ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'test2');
CREATE POLICY "anon_test2_bucket_update" ON storage.objects
  FOR UPDATE TO anon USING (bucket_id = 'test2') WITH CHECK (bucket_id = 'test2');
CREATE POLICY "anon_test2_bucket_delete" ON storage.objects
  FOR DELETE TO anon USING (bucket_id = 'test2');

-- test3（公开桶）
CREATE POLICY "anon_test3_bucket_select" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'test3');
CREATE POLICY "anon_test3_bucket_insert" ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'test3');
CREATE POLICY "anon_test3_bucket_update" ON storage.objects
  FOR UPDATE TO anon USING (bucket_id = 'test3') WITH CHECK (bucket_id = 'test3');
CREATE POLICY "anon_test3_bucket_delete" ON storage.objects
  FOR DELETE TO anon USING (bucket_id = 'test3');

-- test4（公开桶）
CREATE POLICY "anon_test4_bucket_select" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'test4');
CREATE POLICY "anon_test4_bucket_insert" ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'test4');
CREATE POLICY "anon_test4_bucket_update" ON storage.objects
  FOR UPDATE TO anon USING (bucket_id = 'test4') WITH CHECK (bucket_id = 'test4');
CREATE POLICY "anon_test4_bucket_delete" ON storage.objects
  FOR DELETE TO anon USING (bucket_id = 'test4');

-- sdk-test（公开桶）
CREATE POLICY "anon_sdktest_bucket_select" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'sdk-test');
CREATE POLICY "anon_sdktest_bucket_insert" ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'sdk-test');
CREATE POLICY "anon_sdktest_bucket_update" ON storage.objects
  FOR UPDATE TO anon USING (bucket_id = 'sdk-test') WITH CHECK (bucket_id = 'sdk-test');
CREATE POLICY "anon_sdktest_bucket_delete" ON storage.objects
  FOR DELETE TO anon USING (bucket_id = 'sdk-test');
