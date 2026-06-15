-- ============================================================
-- 🌹 VAYAH وَيَّاه - منصة الزواج الفاخرة
-- المخطط الكامل: 10 جداول + RLS + Storage + Realtime
-- نفّذ هذا الملف داخل Supabase SQL Editor دفعة واحدة
-- ============================================================

-- 1. الإضافات الأساسية
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. أنواع البيانات المخصصة (Enums)
DO $$ BEGIN
  CREATE TYPE user_role_enum AS ENUM ('user','moderator','admin','super_admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE subscription_status_enum AS ENUM ('FREE','VIP','VIP_MANUAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE account_status_enum AS ENUM ('pending','active','banned_temp','banned_permanent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. جدول الملفات الشخصية
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  display_name TEXT,
  age INTEGER CHECK (age IS NULL OR age >= 18),
  gender TEXT,
  country TEXT,
  marriage_goal TEXT,
  bio TEXT,
  interests TEXT[],
  profile_picture_url TEXT,
  profile_picture_public BOOLEAN DEFAULT FALSE,
  kyc_selfie_url TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  role user_role_enum DEFAULT 'user',
  subscription_status subscription_status_enum DEFAULT 'FREE',
  account_status account_status_enum DEFAULT 'pending',
  onboarding_completed BOOLEAN DEFAULT FALSE,
  vault_pin_hash TEXT,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_is_verified ON profiles(is_verified);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_country ON profiles(country);
CREATE INDEX IF NOT EXISTS idx_profiles_account_status ON profiles(account_status);

-- 4. بطاقات الحالة الفكرية (تنتهي خلال 24 ساعة)
CREATE TABLE IF NOT EXISTS mindset_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) <= 280),
  background_style TEXT DEFAULT 'gradient-charcoal',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);
CREATE INDEX IF NOT EXISTS idx_mindset_cards_expires ON mindset_cards(expires_at);
CREATE INDEX IF NOT EXISTS idx_mindset_cards_user ON mindset_cards(user_id);

-- 5. الرسائل (Real-time + Soft Delete)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  is_deleted_by_user BOOLEAN DEFAULT FALSE,
  in_vault BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(sender_id, receiver_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);

-- 6. محادثات الذكاء الاصطناعي (مقهى الروح)
CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  persona_id TEXT NOT NULL,
  in_vault BOOLEAN DEFAULT FALSE,
  is_deleted_by_user BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS ai_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON ai_messages(conversation_id);

-- 7. الهدايا الافتراضية
CREATE TABLE IF NOT EXISTS gifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  gift_type TEXT NOT NULL,
  gift_emoji TEXT,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gifts_receiver ON gifts(receiver_id);

-- 8. الإشعارات
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  from_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

-- 9. البلاغات
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  reported_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. سجلات التدقيق (للسوبر أدمن)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_user_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TRIGGER: إنشاء ملف شخصي تلقائياً عند التسجيل
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (
    NEW.id, 
    NEW.email,
    CASE 
      WHEN NEW.email = 'Abdallhsmj@gmail.com' THEN 'super_admin'::user_role_enum
      ELSE 'user'::user_role_enum
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- HELPER FUNCTIONS للـ RLS
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin');
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin_or_above()
RETURNS BOOLEAN AS $$
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin','moderator'));
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================================
-- تفعيل سياسات الأمان RLS
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE mindset_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Profiles
DROP POLICY IF EXISTS p_select ON profiles;
CREATE POLICY p_select ON profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS p_update ON profiles;
CREATE POLICY p_update ON profiles FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS p_insert ON profiles;
CREATE POLICY p_insert ON profiles FOR INSERT WITH CHECK (id = auth.uid());

-- Mindset cards (ephemeral 24h)
DROP POLICY IF EXISTS m_select ON mindset_cards;
CREATE POLICY m_select ON mindset_cards FOR SELECT USING (expires_at > NOW());
DROP POLICY IF EXISTS m_insert ON mindset_cards;
CREATE POLICY m_insert ON mindset_cards FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS m_delete ON mindset_cards;
CREATE POLICY m_delete ON mindset_cards FOR DELETE USING (user_id = auth.uid());

-- Messages
DROP POLICY IF EXISTS msg_select ON messages;
CREATE POLICY msg_select ON messages FOR SELECT
  USING ((sender_id = auth.uid() OR receiver_id = auth.uid()) AND is_deleted_by_user = false);
DROP POLICY IF EXISTS msg_insert ON messages;
CREATE POLICY msg_insert ON messages FOR INSERT WITH CHECK (sender_id = auth.uid());
DROP POLICY IF EXISTS msg_update ON messages;
CREATE POLICY msg_update ON messages FOR UPDATE
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

-- AI Conversations
DROP POLICY IF EXISTS aiconv_all ON ai_conversations;
CREATE POLICY aiconv_all ON ai_conversations FOR ALL USING (user_id = auth.uid());
DROP POLICY IF EXISTS aimsg_all ON ai_messages;
CREATE POLICY aimsg_all ON ai_messages FOR ALL
  USING (EXISTS(SELECT 1 FROM ai_conversations WHERE id = conversation_id AND user_id = auth.uid()));

-- Gifts
DROP POLICY IF EXISTS g_select ON gifts;
CREATE POLICY g_select ON gifts FOR SELECT USING (sender_id = auth.uid() OR receiver_id = auth.uid());
DROP POLICY IF EXISTS g_insert ON gifts;
CREATE POLICY g_insert ON gifts FOR INSERT WITH CHECK (sender_id = auth.uid());

-- Notifications
DROP POLICY IF EXISTS n_all ON notifications;
CREATE POLICY n_all ON notifications FOR ALL USING (user_id = auth.uid());

-- Reports
DROP POLICY IF EXISTS r_select ON reports;
CREATE POLICY r_select ON reports FOR SELECT USING (reporter_id = auth.uid());
DROP POLICY IF EXISTS r_insert ON reports;
CREATE POLICY r_insert ON reports FOR INSERT WITH CHECK (reporter_id = auth.uid());

-- ============================================================
-- Storage Buckets
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('identity_verification_kyc', 'identity_verification_kyc', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('profile_pictures', 'profile_pictures', true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS kyc_upload ON storage.objects;
CREATE POLICY kyc_upload ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'identity_verification_kyc' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS kyc_select ON storage.objects;
CREATE POLICY kyc_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'identity_verification_kyc');
DROP POLICY IF EXISTS pic_select ON storage.objects;
CREATE POLICY pic_select ON storage.objects FOR SELECT USING (bucket_id = 'profile_pictures');
DROP POLICY IF EXISTS pic_upload ON storage.objects;
CREATE POLICY pic_upload ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'profile_pictures' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS pic_update ON storage.objects;
CREATE POLICY pic_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'profile_pictures' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================
-- تفعيل Realtime على الجداول الحيوية
-- ============================================================
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE mindset_cards;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE gifts;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ✅ تم الانتهاء بنجاح - Schema جاهز للإنتاج
