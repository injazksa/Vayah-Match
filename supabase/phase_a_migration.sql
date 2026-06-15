-- ============================================================
-- 🛡️ VAYAH - PHASE A MIGRATION
-- أضف هذا في Supabase SQL Editor (جديد - لا يعيد بناء الجداول الأصلية)
-- ============================================================

-- 1. إضافة حقول جديدة لـ KYC المزدوج (وثيقة + سيلفي)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS kyc_document_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS kyc_document_type TEXT; -- id_card | passport | license
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_score INTEGER DEFAULT 0;

-- 2. جدول سجلات المحاولات المحجوبة (Anti-Leakage Logs)
CREATE TABLE IF NOT EXISTS leak_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  context TEXT NOT NULL,                    -- bio | message | mindset_card | profile
  original_content TEXT,
  blocked_matches TEXT[],
  blocked_count INTEGER DEFAULT 0,
  severity TEXT DEFAULT 'low',              -- low | medium | high
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_leak_logs_user ON leak_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leak_logs_severity ON leak_logs(severity, created_at DESC);

-- 3. جدول تبادل الصور (Photo Consent System)
CREATE TABLE IF NOT EXISTS photo_exchanges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  thumbnail_url TEXT,
  caption TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired')),
  admin_notified BOOLEAN DEFAULT FALSE,
  message_id UUID,                          -- يرتبط برسالة بعد الموافقة
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_photo_ex_receiver ON photo_exchanges(receiver_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_photo_ex_sender ON photo_exchanges(sender_id, created_at DESC);

-- 4. تفعيل RLS
ALTER TABLE leak_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_exchanges ENABLE ROW LEVEL SECURITY;

-- سياسات leak_logs - الأدمن فقط
DROP POLICY IF EXISTS leak_logs_admin_only ON leak_logs;
CREATE POLICY leak_logs_admin_only ON leak_logs FOR SELECT USING (is_admin_or_above());
DROP POLICY IF EXISTS leak_logs_insert_self ON leak_logs;
CREATE POLICY leak_logs_insert_self ON leak_logs FOR INSERT WITH CHECK (true);

-- سياسات photo_exchanges - الطرفان + الأدمن
DROP POLICY IF EXISTS pe_select ON photo_exchanges;
CREATE POLICY pe_select ON photo_exchanges FOR SELECT
  USING (sender_id = auth.uid() OR receiver_id = auth.uid() OR is_admin_or_above());
DROP POLICY IF EXISTS pe_insert ON photo_exchanges;
CREATE POLICY pe_insert ON photo_exchanges FOR INSERT WITH CHECK (sender_id = auth.uid());
DROP POLICY IF EXISTS pe_update ON photo_exchanges;
CREATE POLICY pe_update ON photo_exchanges FOR UPDATE
  USING (receiver_id = auth.uid() OR sender_id = auth.uid() OR is_admin_or_above());

-- 5. Storage Buckets جديدة
INSERT INTO storage.buckets (id, name, public) VALUES ('chat_photos', 'chat_photos', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('kyc_documents', 'kyc_documents', false) ON CONFLICT (id) DO NOTHING;

-- سياسات chat_photos - المرسل يرفع، المستقبل يرى (بعد الموافقة)، الأدمن يرى دائماً
DROP POLICY IF EXISTS chat_photos_insert ON storage.objects;
CREATE POLICY chat_photos_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat_photos' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS chat_photos_select ON storage.objects;
CREATE POLICY chat_photos_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat_photos');

-- سياسات kyc_documents - السوبر أدمن فقط يرى
DROP POLICY IF EXISTS kyc_docs_insert ON storage.objects;
CREATE POLICY kyc_docs_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'kyc_documents' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS kyc_docs_select ON storage.objects;
CREATE POLICY kyc_docs_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'kyc_documents' AND (auth.uid()::text = (storage.foldername(name))[1] OR is_super_admin()));

-- 6. Realtime للجداول الجديدة
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE photo_exchanges; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ✅ PHASE A MIGRATION COMPLETE
SELECT '✅ تم ترقية المنصة للمرحلة A بنجاح' AS status;
