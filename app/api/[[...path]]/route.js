import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@supabase/supabase-js';
import { PERSONAS } from '@/lib/personas';
import { generateAIReply } from '@/lib/gemini';
import { filterLeaks, severity } from '@/lib/leak-filter';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return res;
}
export async function OPTIONS() { return cors(NextResponse.json({})); }

async function getUserFromAuth(request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false }
  });
  const { data: { user } } = await supa.auth.getUser(token);
  return user;
}

async function getRole(userId) {
  const admin = getSupabaseAdmin();
  const { data } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle();
  return data?.role || 'user';
}

function sha256(s) { return crypto.createHash('sha256').update(s).digest('hex'); }

// تسجيل محاولة تسريب + إشعار الأدمن
async function logLeak(admin, userId, context, original, blocked) {
  const sev = severity(blocked.length);
  await admin.from('leak_logs').insert({
    user_id: userId, context, original_content: original,
    blocked_matches: blocked, blocked_count: blocked.length, severity: sev
  });
  // إشعار للسوبر أدمن إذا high severity
  if (sev === 'high') {
    const { data: admins } = await admin.from('profiles').select('id').in('role', ['super_admin', 'admin']);
    if (admins) {
      await admin.from('notifications').insert(admins.map(a => ({
        user_id: a.id, type: 'leak_alert', from_admin: true,
        title: '⚠️ محاولة تسريب عالية',
        body: `العضو ${userId.slice(0, 8)} حاول مشاركة ${blocked.length} معرّفات في ${context}`
      })));
    }
  }
}

export async function GET(request, { params }) {
  const path = (params?.path || []).join('/');
  try {
    if (path === '' || path === 'health') {
      return cors(NextResponse.json({ ok: true, service: 'vayah', timestamp: Date.now() }));
    }

    // 📸 طلبات الصور الواردة
    if (path === 'photos/pending') {
      const user = await getUserFromAuth(request); if (!user) return cors(NextResponse.json({ error: 'unauth' }, { status: 401 }));
      const admin = getSupabaseAdmin();
      const { data } = await admin.from('photo_exchanges')
        .select('*, sender:profiles!photo_exchanges_sender_id_fkey(display_name)')
        .eq('receiver_id', user.id).eq('status', 'pending')
        .order('created_at', { ascending: false });
      return cors(NextResponse.json({ requests: data || [] }));
    }

    if (path.startsWith('photos/url/')) {
      const user = await getUserFromAuth(request); if (!user) return cors(NextResponse.json({ error: 'unauth' }, { status: 401 }));
      const exchangeId = path.split('/').pop();
      const admin = getSupabaseAdmin();
      const { data: ex } = await admin.from('photo_exchanges').select('*').eq('id', exchangeId).maybeSingle();
      const role = await getRole(user.id);
      const isAdmin = ['admin','super_admin','moderator'].includes(role);
      if (!ex) return cors(NextResponse.json({ error: 'not found' }, { status: 404 }));
      if (!isAdmin && ex.sender_id !== user.id && (ex.receiver_id !== user.id || ex.status !== 'approved')) {
        return cors(NextResponse.json({ error: 'forbidden' }, { status: 403 }));
      }
      const { data: signed } = await admin.storage.from('chat_photos').createSignedUrl(ex.storage_path, 600);
      return cors(NextResponse.json({ url: signed?.signedUrl || null }));
    }

    // 🛡️ Admin endpoints
    if (path.startsWith('admin/')) {
      const user = await getUserFromAuth(request); if (!user) return cors(NextResponse.json({ error: 'unauth' }, { status: 401 }));
      const role = await getRole(user.id);
      if (!['admin','super_admin','moderator'].includes(role)) return cors(NextResponse.json({ error: 'forbidden' }, { status: 403 }));
      const admin = getSupabaseAdmin();

      // قائمة الأعضاء مع pagination
      if (path === 'admin/users') {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '0');
        const pageSize = parseInt(url.searchParams.get('pageSize') || '25');
        const filter = url.searchParams.get('filter') || 'all';
        const search = url.searchParams.get('search') || '';

        let q = admin.from('profiles').select('*', { count: 'exact' });
        if (filter === 'pending') q = q.eq('is_verified', false).not('account_status', 'in', '("banned_temp","banned_permanent")');
        else if (filter === 'verified') q = q.eq('is_verified', true);
        else if (filter === 'banned') q = q.in('account_status', ['banned_temp','banned_permanent']);
        else if (filter === 'vip') q = q.in('subscription_status', ['VIP','VIP_MANUAL']);
        if (search) q = q.or(`display_name.ilike.%${search}%,email.ilike.%${search}%`);

        const { data, count } = await q.order('created_at', { ascending: false }).range(page * pageSize, page * pageSize + pageSize - 1);
        return cors(NextResponse.json({ users: data || [], total: count || 0, page, pageSize }));
      }

      // إحصائيات
      if (path === 'admin/stats') {
        const [{ count: total }, { count: verified }, { count: pending }, { count: vip }, { count: leaks }] = await Promise.all([
          admin.from('profiles').select('*', { count: 'exact', head: true }),
          admin.from('profiles').select('*', { count: 'exact', head: true }).eq('is_verified', true),
          admin.from('profiles').select('*', { count: 'exact', head: true }).eq('account_status', 'pending'),
          admin.from('profiles').select('*', { count: 'exact', head: true }).in('subscription_status', ['VIP','VIP_MANUAL']),
          admin.from('leak_logs').select('*', { count: 'exact', head: true }).gte('created_at', new Date(Date.now()-7*86400000).toISOString()),
        ]);
        const { data: byCountry } = await admin.from('profiles').select('country').not('country','is',null);
        const countryStats = {};
        (byCountry||[]).forEach(r => { countryStats[r.country] = (countryStats[r.country]||0)+1; });
        return cors(NextResponse.json({ total, verified, pending, vip, leaks_7d: leaks, countryStats }));
      }

      // ملف عضو كامل (Admin Citadel detail)
      if (path.startsWith('admin/user-detail/')) {
        const userId = path.split('/').pop();
        const [{ data: profile }, { data: msgs, count: msgCount }, { data: photos }, { data: leaks }, { data: gifts }, { data: aiConvs }] = await Promise.all([
          admin.from('profiles').select('*').eq('id', userId).maybeSingle(),
          admin.from('messages').select('*', { count: 'exact' }).or(`sender_id.eq.${userId},receiver_id.eq.${userId}`).order('created_at', { ascending: false }).limit(20),
          admin.from('photo_exchanges').select('*').or(`sender_id.eq.${userId},receiver_id.eq.${userId}`).order('created_at', { ascending: false }).limit(50),
          admin.from('leak_logs').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
          admin.from('gifts').select('*, receiver:profiles!gifts_receiver_id_fkey(display_name)').eq('sender_id', userId).order('created_at', { ascending: false }).limit(20),
          admin.from('ai_conversations').select('id, persona_id, in_vault, updated_at').eq('user_id', userId).order('updated_at', { ascending: false }).limit(20),
        ]);
        // Signed URLs للصور والوثائق
        let kycSelfieUrl = null, kycDocUrl = null;
        if (profile?.kyc_selfie_url) {
          const { data: s } = await admin.storage.from('identity_verification_kyc').createSignedUrl(profile.kyc_selfie_url, 600);
          kycSelfieUrl = s?.signedUrl;
        }
        if (profile?.kyc_document_url) {
          const { data: s } = await admin.storage.from('kyc_documents').createSignedUrl(profile.kyc_document_url, 600);
          kycDocUrl = s?.signedUrl;
        }
        return cors(NextResponse.json({
          profile, kycSelfieUrl, kycDocUrl,
          messages: msgs || [], messageCount: msgCount || 0,
          photos: photos || [], leaks: leaks || [],
          gifts: gifts || [], aiConvs: aiConvs || []
        }));
      }

      // محادثة كاملة بين عضوين
      if (path.startsWith('admin/chat-thread/')) {
        const parts = path.split('/');
        const userA = parts[parts.length - 2];
        const userB = parts[parts.length - 1];
        const { data } = await admin.from('messages')
          .select('*')
          .or(`and(sender_id.eq.${userA},receiver_id.eq.${userB}),and(sender_id.eq.${userB},receiver_id.eq.${userA})`)
          .order('created_at');
        return cors(NextResponse.json({ messages: data || [] }));
      }

      // كل المحادثات (paginated)
      if (path === 'admin/all-messages') {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '0');
        const pageSize = 50;
        const { data, count } = await admin.from('messages')
          .select('*, sender:profiles!messages_sender_id_fkey(display_name, email), receiver:profiles!messages_receiver_id_fkey(display_name, email)', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(page * pageSize, page * pageSize + pageSize - 1);
        return cors(NextResponse.json({ messages: data || [], total: count || 0, page }));
      }

      // سجل محاولات التسريب
      if (path === 'admin/leak-logs') {
        const { data } = await admin.from('leak_logs')
          .select('*, profile:profiles(display_name, email)')
          .order('created_at', { ascending: false }).limit(100);
        return cors(NextResponse.json({ logs: data || [] }));
      }

      // سجل صور عضو
      if (path.startsWith('admin/user-photos/')) {
        const userId = path.split('/').pop();
        const { data: photos } = await admin.from('photo_exchanges')
          .select('*, receiver:profiles!photo_exchanges_receiver_id_fkey(display_name)')
          .eq('sender_id', userId).order('created_at', { ascending: false });
        // Signed URLs
        const enriched = await Promise.all((photos || []).map(async p => {
          const { data: s } = await admin.storage.from('chat_photos').createSignedUrl(p.storage_path, 600);
          return { ...p, signedUrl: s?.signedUrl };
        }));
        return cors(NextResponse.json({ photos: enriched }));
      }

      if (path.startsWith('admin/kyc/')) {
        const userId = path.split('/').pop();
        const { data: p } = await admin.from('profiles').select('kyc_selfie_url').eq('id', userId).maybeSingle();
        if (!p?.kyc_selfie_url) return cors(NextResponse.json({ url: null }));
        const { data: signed } = await admin.storage.from('identity_verification_kyc').createSignedUrl(p.kyc_selfie_url, 600);
        return cors(NextResponse.json({ url: signed?.signedUrl || null }));
      }
    }

    return cors(NextResponse.json({ error: 'not found' }, { status: 404 }));
  } catch (e) {
    console.error('GET error', e);
    return cors(NextResponse.json({ error: e.message }, { status: 500 }));
  }
}

export async function POST(request, { params }) {
  const path = (params?.path || []).join('/');
  try {
    // ☕ SOUL CAFE CHAT
    if (path === 'soul-cafe/chat') {
      const user = await getUserFromAuth(request); if (!user) return cors(NextResponse.json({ error: 'unauth' }, { status: 401 }));
      const body = await request.json();
      const { conversationId, personaId, message } = body;
      const persona = PERSONAS[personaId];
      if (!persona) return cors(NextResponse.json({ error: 'unknown persona' }, { status: 400 }));
      const admin = getSupabaseAdmin();
      const { data: conv } = await admin.from('ai_conversations').select('*').eq('id', conversationId).eq('user_id', user.id).maybeSingle();
      if (!conv) return cors(NextResponse.json({ error: 'conversation not found' }, { status: 404 }));
      const { data: history } = await admin.from('ai_messages').select('role, content').eq('conversation_id', conversationId).order('created_at').limit(30);
      const { data: userMsg } = await admin.from('ai_messages').insert({ conversation_id: conversationId, role: 'user', content: message }).select('id').single();
      let reply;
      try {
        reply = await generateAIReply({ systemPrompt: persona.systemPrompt, history: history || [], userMessage: message });
      } catch (e) {
        console.error('Gemini error:', e);
        return cors(NextResponse.json({ error: 'الخدمة مزدحمة - حاول بعد لحظات' }, { status: 503 }));
      }
      const { data: assMsg } = await admin.from('ai_messages').insert({ conversation_id: conversationId, role: 'assistant', content: reply }).select('id').single();
      await admin.from('ai_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);
      return cors(NextResponse.json({ userMsgId: userMsg.id, assistantMsgId: assMsg.id, reply }));
    }

    // 💬 إرسال رسالة (مع فلتر التسريب)
    if (path === 'messages/send') {
      const user = await getUserFromAuth(request); if (!user) return cors(NextResponse.json({ error: 'unauth' }, { status: 401 }));
      const { receiver_id, content } = await request.json();
      if (!receiver_id || !content?.trim()) return cors(NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 }));
      const admin = getSupabaseAdmin();
      const { clean, blocked, hasViolation } = filterLeaks(content);
      if (hasViolation) {
        await logLeak(admin, user.id, 'message', content, blocked);
        return cors(NextResponse.json({
          error: 'تم رصد محاولة لمشاركة معلومات تواصل خارج المنصة. الرسالة محجوبة.',
          blocked, blockedCount: blocked.length
        }, { status: 422 }));
      }
      const { data, error } = await admin.from('messages').insert({
        sender_id: user.id, receiver_id, content: clean
      }).select().single();
      if (error) return cors(NextResponse.json({ error: error.message }, { status: 500 }));
      await admin.from('notifications').insert({
        user_id: receiver_id, type: 'message',
        title: 'رسالة جديدة', body: clean.slice(0, 80)
      });
      return cors(NextResponse.json({ message: data }));
    }

    // 📝 تحديث الـ Bio (مع فلتر)
    if (path === 'profile/update-bio') {
      const user = await getUserFromAuth(request); if (!user) return cors(NextResponse.json({ error: 'unauth' }, { status: 401 }));
      const { bio, display_name } = await request.json();
      const admin = getSupabaseAdmin();
      const update = {};
      if (bio !== undefined) {
        const { clean, blocked, hasViolation } = filterLeaks(bio);
        if (hasViolation) {
          await logLeak(admin, user.id, 'bio', bio, blocked);
          return cors(NextResponse.json({ error: 'النبذة تحتوي على معلومات تواصل ممنوعة', blocked }, { status: 422 }));
        }
        update.bio = clean;
      }
      if (display_name !== undefined) {
        const { clean, hasViolation, blocked } = filterLeaks(display_name);
        if (hasViolation) {
          await logLeak(admin, user.id, 'display_name', display_name, blocked);
          return cors(NextResponse.json({ error: 'الاسم يحتوي على رموز ممنوعة' }, { status: 422 }));
        }
        update.display_name = clean;
      }
      update.updated_at = new Date().toISOString();
      await admin.from('profiles').update(update).eq('id', user.id);
      return cors(NextResponse.json({ ok: true }));
    }

    // 🎴 بطاقة فكرية (مع فلتر)
    if (path === 'mindset-cards/create') {
      const user = await getUserFromAuth(request); if (!user) return cors(NextResponse.json({ error: 'unauth' }, { status: 401 }));
      const { content, background_style } = await request.json();
      const admin = getSupabaseAdmin();
      const { clean, blocked, hasViolation } = filterLeaks(content);
      if (hasViolation) {
        await logLeak(admin, user.id, 'mindset_card', content, blocked);
        return cors(NextResponse.json({ error: 'البطاقة تحتوي على معلومات تواصل ممنوعة' }, { status: 422 }));
      }
      const { data } = await admin.from('mindset_cards').insert({
        user_id: user.id, content: clean, background_style
      }).select().single();
      return cors(NextResponse.json({ card: data }));
    }

    // 📸 طلب إرسال صورة
    if (path === 'photos/request') {
      const user = await getUserFromAuth(request); if (!user) return cors(NextResponse.json({ error: 'unauth' }, { status: 401 }));
      const { receiver_id, storage_path, caption } = await request.json();
      const admin = getSupabaseAdmin();
      const { data: ex } = await admin.from('photo_exchanges').insert({
        sender_id: user.id, receiver_id, storage_path, caption
      }).select().single();
      // إشعار للطرف الآخر
      const { data: sender } = await admin.from('profiles').select('display_name').eq('id', user.id).maybeSingle();
      await admin.from('notifications').insert({
        user_id: receiver_id, type: 'photo_request',
        title: '📸 طلب مشاركة صورة',
        body: `يرغب ${sender?.display_name || 'أحد الأعضاء'} في إرسال صورة لك`
      });
      return cors(NextResponse.json({ exchange: ex }));
    }

    // ✅ الرد على طلب صورة
    if (path === 'photos/respond') {
      const user = await getUserFromAuth(request); if (!user) return cors(NextResponse.json({ error: 'unauth' }, { status: 401 }));
      const { exchange_id, decision } = await request.json(); // approve | reject
      const admin = getSupabaseAdmin();
      const { data: ex } = await admin.from('photo_exchanges').select('*').eq('id', exchange_id).maybeSingle();
      if (!ex || ex.receiver_id !== user.id) return cors(NextResponse.json({ error: 'forbidden' }, { status: 403 }));
      const newStatus = decision === 'approve' ? 'approved' : 'rejected';
      await admin.from('photo_exchanges').update({
        status: newStatus, responded_at: new Date().toISOString(), admin_notified: true
      }).eq('id', exchange_id);

      if (decision === 'approve') {
        // أنشئ رسالة في المحادثة بإشارة الصورة
        const { data: msg } = await admin.from('messages').insert({
          sender_id: ex.sender_id, receiver_id: ex.receiver_id,
          content: `📸 [PHOTO:${exchange_id}] ${ex.caption || ''}`.trim()
        }).select('id').single();
        await admin.from('photo_exchanges').update({ message_id: msg?.id }).eq('id', exchange_id);
        // إشعار للمرسل
        await admin.from('notifications').insert({
          user_id: ex.sender_id, type: 'photo_approved',
          title: '✅ تمت الموافقة على الصورة', body: 'تم قبول مشاركة صورتك'
        });
      } else {
        await admin.from('notifications').insert({
          user_id: ex.sender_id, type: 'photo_rejected',
          title: '❌ تم رفض الصورة', body: 'لم يقبل الطرف الآخر استلام صورتك'
        });
      }
      return cors(NextResponse.json({ ok: true, status: newStatus }));
    }

    // 🔐 VAULT PIN
    if (path === 'vault/set-pin') {
      const user = await getUserFromAuth(request); if (!user) return cors(NextResponse.json({ error: 'unauth' }, { status: 401 }));
      const { pin } = await request.json();
      if (!/^\d{4}$/.test(pin)) return cors(NextResponse.json({ error: 'bad pin' }, { status: 400 }));
      const admin = getSupabaseAdmin();
      await admin.from('profiles').update({ vault_pin_hash: sha256(pin) }).eq('id', user.id);
      return cors(NextResponse.json({ ok: true }));
    }
    if (path === 'vault/verify-pin') {
      const user = await getUserFromAuth(request); if (!user) return cors(NextResponse.json({ error: 'unauth' }, { status: 401 }));
      const { pin } = await request.json();
      const admin = getSupabaseAdmin();
      const { data } = await admin.from('profiles').select('vault_pin_hash').eq('id', user.id).maybeSingle();
      return cors(NextResponse.json({ ok: data?.vault_pin_hash === sha256(pin) }));
    }

    // 🗑 حذف الحساب
    if (path === 'account/delete') {
      const user = await getUserFromAuth(request); if (!user) return cors(NextResponse.json({ error: 'unauth' }, { status: 401 }));
      const admin = getSupabaseAdmin();
      await admin.from('profiles').delete().eq('id', user.id);
      await admin.auth.admin.deleteUser(user.id);
      return cors(NextResponse.json({ ok: true }));
    }

    // 🎁 GIFTS
    if (path === 'gifts/send') {
      const user = await getUserFromAuth(request); if (!user) return cors(NextResponse.json({ error: 'unauth' }, { status: 401 }));
      const { receiver_id, gift_type, gift_emoji, message } = await request.json();
      const admin = getSupabaseAdmin();
      const { clean, blocked, hasViolation } = filterLeaks(message || '');
      if (hasViolation) {
        await logLeak(admin, user.id, 'gift_message', message, blocked);
        return cors(NextResponse.json({ error: 'الرسالة تحتوي على معلومات ممنوعة' }, { status: 422 }));
      }
      await admin.from('gifts').insert({ sender_id: user.id, receiver_id, gift_type, gift_emoji, message: clean });
      await admin.from('notifications').insert({ user_id: receiver_id, type: 'gift', title: 'تلقيت هدية! '+gift_emoji, body: clean || gift_type });
      return cors(NextResponse.json({ ok: true }));
    }

    // 🚫 ADMIN ACTIONS
    if (path.startsWith('admin/')) {
      const user = await getUserFromAuth(request); if (!user) return cors(NextResponse.json({ error: 'unauth' }, { status: 401 }));
      const role = await getRole(user.id);
      if (!['admin','super_admin','moderator'].includes(role)) return cors(NextResponse.json({ error: 'forbidden' }, { status: 403 }));
      const admin = getSupabaseAdmin();
      const body = await request.json();

      const logAction = async (action, target, details={}) => {
        await admin.from('audit_logs').insert({ admin_id: user.id, action, target_user_id: target, details });
      };

      if (path === 'admin/verify') {
        await admin.from('profiles').update({ is_verified: true, account_status: 'active' }).eq('id', body.user_id);
        await admin.from('notifications').insert({ user_id: body.user_id, type: 'verified', title: 'تم التحقّق من حسابك', body: 'مرحباً بك في وَيَّاه! حسابك موثّق الآن.', from_admin: true });
        await logAction('verify_user', body.user_id);
        return cors(NextResponse.json({ ok: true }));
      }
      if (path === 'admin/unverify') {
        await admin.from('profiles').update({ is_verified: false, account_status: 'pending' }).eq('id', body.user_id);
        await logAction('unverify_user', body.user_id);
        return cors(NextResponse.json({ ok: true }));
      }
      if (path === 'admin/ban') {
        await admin.from('profiles').update({ account_status: body.permanent ? 'banned_permanent' : 'banned_temp', is_verified: false }).eq('id', body.user_id);
        await logAction('ban_user', body.user_id, { permanent: body.permanent });
        return cors(NextResponse.json({ ok: true }));
      }
      if (path === 'admin/unban') {
        await admin.from('profiles').update({ account_status: 'active' }).eq('id', body.user_id);
        await logAction('unban_user', body.user_id);
        return cors(NextResponse.json({ ok: true }));
      }
      if (path === 'admin/delete-user') {
        if (role !== 'super_admin') return cors(NextResponse.json({ error: 'super only' }, { status: 403 }));
        await admin.from('profiles').delete().eq('id', body.user_id);
        await admin.auth.admin.deleteUser(body.user_id);
        await logAction('delete_user', body.user_id);
        return cors(NextResponse.json({ ok: true }));
      }
      if (path === 'admin/notify') {
        await admin.from('notifications').insert({ user_id: body.user_id, type: 'admin_msg', title: body.title || 'رسالة إدارية', body: body.body, from_admin: true });
        await logAction('admin_notify', body.user_id, { title: body.title });
        return cors(NextResponse.json({ ok: true }));
      }
      if (path === 'admin/vip-grant') {
        if (role !== 'super_admin') return cors(NextResponse.json({ error: 'super only' }, { status: 403 }));
        const { identifier } = body;
        let target;
        if (identifier?.includes('@')) {
          const { data } = await admin.from('profiles').select('id').eq('email', identifier).maybeSingle();
          target = data?.id;
        } else target = identifier;
        if (!target) return cors(NextResponse.json({ error: 'غير موجود' }, { status: 404 }));
        await admin.from('profiles').update({ subscription_status: 'VIP_MANUAL' }).eq('id', target);
        await admin.from('notifications').insert({ user_id: target, type: 'vip_granted', title: '🎉 مبروك! باقة VIP', body: 'تم منحك عضوية VIP مجاناً كهدية!', from_admin: true });
        await logAction('vip_grant', target);
        return cors(NextResponse.json({ ok: true, user_id: target }));
      }
      if (path === 'admin/vip-revoke') {
        if (role !== 'super_admin') return cors(NextResponse.json({ error: 'super only' }, { status: 403 }));
        await admin.from('profiles').update({ subscription_status: 'FREE' }).eq('id', body.user_id);
        await logAction('vip_revoke', body.user_id);
        return cors(NextResponse.json({ ok: true }));
      }
      if (path === 'admin/set-role') {
        if (role !== 'super_admin') return cors(NextResponse.json({ error: 'super only' }, { status: 403 }));
        await admin.from('profiles').update({ role: body.role }).eq('id', body.user_id);
        await logAction('set_role', body.user_id, { role: body.role });
        return cors(NextResponse.json({ ok: true }));
      }
    }

    return cors(NextResponse.json({ error: 'not found' }, { status: 404 }));
  } catch (e) {
    console.error('POST error', e);
    return cors(NextResponse.json({ error: e.message }, { status: 500 }));
  }
}
