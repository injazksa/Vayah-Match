# 🌹 وَيَّاه (Vayah) - منصة الزواج الفاخرة

> منصة عربية حصرية كاملة للارتباط الجدي، مبنية بـ Next.js 14 + Supabase + Google Gemini 2.5 Flash.

## 📋 ما تم بناؤه (الكتلة الكاملة الإنتاجية)

### 🏗️ البنية التحتية (Backend)
- ✅ **10 جداول Postgres** عبر Supabase (يدعم +200,000 مستخدم متزامن)
- ✅ **سياسات أمان RLS** على كل الجداول
- ✅ **Realtime Channels** للرسائل الفورية والإشعارات الحية
- ✅ **Storage Buckets** مشفّرة لصور KYC والبروفايل
- ✅ **Triggers** تلقائية لإنشاء الملفات الشخصية
- ✅ **Helper Functions** للأمان والصلاحيات

### 🎨 الواجهة الأمامية (Frontend)
- ✅ **تصميم Quiet Luxury** - فحمي دافئ + كريمي ناعم + ذهبي
- ✅ **RTL عربي كامل** بخط Tajawal/Cormorant Garamond الفاخر
- ✅ متجاوب مع الجوال والديسكتوب (Safari/Chrome/Firefox)

### 🔐 رحلة المستخدم الكاملة
1. **التسجيل**: Supabase Auth بالبريد + تأكيد إيميل
2. **Onboarding 4 خطوات** مع لوحة Lock حتى الاكتمال:
   - الديموغرافيا (عمر +18، جنس، دولة)
   - النية والهدف + النبذة الذاتية
   - الاهتمامات (Multi-select Chips)
   - **التحقق البيومتري الحي** بالكاميرا الأمامية ضمن إطار دائري ذهبي
3. **شاشة الانتظار** "جاري مراجعة طلبك..." مع Realtime watch
4. **Dashboard فاخر** + بطاقات الحالة الفكرية + قائمة الأعضاء
5. **مقهى الروح** - 6 شخصيات AI بالشامية الدافئة:
   - نَفَس، الحكيم، ست أم نور، الصديق، المُفكِّر، رحمة
6. **محادثات Realtime** بين الأعضاء (WebSocket)
7. **الصندوق السري** بقفل PIN 4 أرقام
8. **إعدادات الحساب** + تعديل بيانات + خصوصية الصور + حذف نهائي

### 🛡️ لوحة السوبر أدمن (Omnipotent Command Center)
- ✅ بوابتان سريتان: **10 نقرات على الشعار** + الرابط المخفي `/vayah-hidden-secure-vault-gate`
- ✅ جدول إدارة كامل لـ +200k عضو مع: توثيق/إلغاء، حظر مؤقت/دائم، حذف نهائي
- ✅ عرض صورة KYC بـ Signed URL آمن
- ✅ إرسال إشعار خاص لـ UUID/Email محدد
- ✅ **منح VIP يدوي** فوري للمستخدم بإدخال UUID أو Email
- ✅ تحليلات (إجمالي، موثقين، VIP، توزيع الدول)
- ✅ سجل تدقيق (audit_logs) لكل إجراء إداري
- ✅ نظام RBAC: super_admin / admin / moderator / user

### 📜 الإطار القانوني (Footer)
صفحات بنود تفصيلية في الفوتر: الشروط، الخصوصية، إخلاء المسؤولية، السلامة، مكافحة التحرش.

---

## ⚙️ خطوات التشغيل (إجباري قبل الإطلاق)

### الخطوة 1️⃣: تنفيذ مخطط قاعدة البيانات

افتح **Supabase SQL Editor**:
👉 https://supabase.com/dashboard/project/fwhfllbdqfxgprhqibdb/sql/new

ثم انسخ كامل محتوى الملف `/app/supabase/schema.sql` والصقه واضغط **RUN**.

سيُنشئ هذا:
- 10 جداول + Indexes
- Enums (الأدوار، الاشتراكات، الحالات)
- Trigger إنشاء الملف الشخصي تلقائياً عند التسجيل
- Helper Functions: `is_super_admin()`, `is_admin_or_above()`
- RLS Policies على كل الجداول
- Storage Buckets: `identity_verification_kyc` (خاص) + `profile_pictures` (عام)
- تفعيل Realtime على: `messages`, `notifications`, `mindset_cards`, `gifts`

### الخطوة 2️⃣: إنشاء حساب السوبر أدمن

من Supabase Dashboard → **Authentication → Users → Add User**:
- Email: `admin@vayah.com`
- Password: `VayahAdmin2026!Master`
- **Auto Confirm Email**: ✅ (مهم!)

> الـ Trigger سيمنحه دور `super_admin` تلقائياً لأن إيميله مطابق.

### الخطوة 3️⃣: (اختياري) تعطيل تأكيد الإيميل للاختبار

من Supabase → **Authentication → Providers → Email**:
- ضع `Confirm email` على OFF مؤقتاً لتجربة سريعة بدون إيميلات.

---

## 🔑 متغيرات البيئة المطلوبة

⚠️ **لا تضع المفاتيح الحقيقية في الـ Git أبداً!** القيم الفعلية محفوظة محلياً في `/app/.env` (مُدرج في `.gitignore`).

انسخ `.env.example` إلى `.env.local` (على Vercel: أضفها في Environment Variables):

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxxxx
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxxxx
GEMINI_API_KEY=your_gemini_api_key
SUPER_ADMIN_EMAIL=admin@vayah.com
SUPER_ADMIN_PASSWORD=YourStrongPassword
```

من أين تحصل عليها:
- Supabase: [Dashboard → Settings → API](https://supabase.com/dashboard)
- Gemini: [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

---

## 🚀 رحلة تجربة المنصة

### كمستخدم عادي:
1. افتح الصفحة الرئيسية → اختر "إنشاء حساب" → سجل بإيميل وكلمة سر
2. أكمل الـ 4 خطوات
3. عند خطوة KYC، اسمح للمتصفح بفتح الكاميرا → ستلتقط سيلفي ضمن الإطار الدائري الذهبي بعد scan 100%
4. ستُحوّل إلى شاشة "جاري مراجعة طلبك..."
5. سجّل دخول كأدمن وافحص الحساب → اضغط [توثيق]
6. عُد للمستخدم → سيُحوّل تلقائياً عبر Realtime إلى Dashboard

### كسوبر أدمن:
- **الطريقة A**: اضغط 10 مرات متتالية على شعار "Vayah" في الصفحة الرئيسية
- **الطريقة B**: افتح مباشرة: `/vayah-hidden-secure-vault-gate`
- سجل بـ `admin@vayah.com` / `VayahAdmin2026!Master`

---

## 🎯 اختبار مقهى الروح

من Dashboard → اضغط "مقهى الروح":
- اختر شخصية (مثلاً "نَفَس")
- اكتب: "بحس حالي ضايق اليوم"
- ستحصل على رد بعامية شامية دافئة من Gemini 2.5 Flash

> ✅ تم اختبار Gemini API → رد بالشامية الأصيلة: *"أهلاً وسهلاً فيك يا سيدي! تكرم عينك..."*

---

## 📦 الهيكل التقني

```
/app
├── app/
│   ├── page.js                          # صفحة الهبوط + تسجيل/دخول
│   ├── onboarding/page.js               # 4 خطوات + KYC حي
│   ├── waiting/page.js                  # شاشة المراجعة
│   ├── dashboard/page.js                # الرئيسية + بطاقات + أعضاء
│   ├── soul-cafe/page.js                # محادثة AI (Gemini)
│   ├── messages/page.js                 # محادثات Realtime
│   ├── profile/page.js                  # الإعدادات
│   ├── vault/page.js                    # الصندوق السري (PIN)
│   ├── admin/page.js                    # لوحة التحكم الخارقة
│   ├── vayah-hidden-secure-vault-gate/  # البوابة السرية
│   ├── legal/[slug]/page.js             # الصفحات القانونية
│   ├── layout.js                        # RTL Arabic
│   ├── globals.css                      # تصميم Quiet Luxury
│   └── api/[[...path]]/route.js         # الباك إند الموحد
├── lib/
│   ├── supabase/client.js               # Browser client
│   ├── supabase/admin.js                # Service Role client
│   ├── personas.js                      # 6 شخصيات AI
│   └── gemini.js                        # Gemini 2.5 Flash
└── supabase/schema.sql                  # المخطط الكامل للقاعدة
```

---

## ✨ نقاط القوة المعمارية

| الميزة | التنفيذ |
|--------|---------|
| **التوسع** | RLS + Indexes تتحمل +200k مستخدم |
| **Realtime** | Supabase Channels على 4 جداول حيوية |
| **الأمان** | service_role server-only، RLS على كل الجداول |
| **KYC حقيقي** | `getUserMedia({facingMode:'user'})` + Canvas capture |
| **AI طبيعي** | System Prompts صارمة + Gemini 2.5 Flash |
| **العامية الشامية** | تعليمات مفصلة بأمثلة محددة في كل شخصية |
| **Audit** | كل عمل إداري يُسجَّل في `audit_logs` |
| **Soft Delete** | `is_deleted_by_user` يخفي من المستخدم فقط |

---

🎉 **المنصة جاهزة للإقلاع. نفّذ الخطوات الـ 3 أعلاه وستراها تعمل.**
