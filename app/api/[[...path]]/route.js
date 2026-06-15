import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@supabase/supabase-js';
import { PERSONAS } from '@/lib/personas';
import { generateAIReply } from '@/lib/gemini';
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

// تحقّق من جلسة المستخدم
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

export async function GET(request, { params }) {
  const path = (params?.path || []).join('/');
  try {
    if (path === '' || path === 'health') {
      return cors(NextResponse.json({ ok: true, service: 'vayah', timestamp: Date.now() }));
    }

    // Admin endpoints
    if (path.startsWith('admin/')) {
      const user = await getUserFromAuth(request); if (!user) return cors(NextResponse.json({ error: 'unauth' }, { status: 401 }));
      const role = await getRole(user.id);
      if (!['admin','super_admin','moderator'].includes(role)) return cors(NextResponse.json({ error: 'forbidden' }, { status: 403 }));
      const admin = getSupabaseAdmin();

      if (path === 'admin/users') {
        const { data } = await admin.from('profiles').select('*').order('created_at', { ascending: false }).limit(500);
        return cors(NextResponse.json({ users: data || [] }));
      }
      if (path === 'admin/stats') {
        const [{ count: total }, { count: verified }, { count: pending }, { count: vip }] = await Promise.all([
          admin.from('profiles').select('*', { count: 'exact', head: true }),
          admin.from('profiles').select('*', { count: 'exact', head: true }).eq('is_verified', true),
          admin.from('profiles').select('*', { count: 'exact', head: true }).eq('account_status', 'pending'),
          admin.from('profiles').select('*', { count: 'exact', head: true }).in('subscription_status', ['VIP','VIP_MANUAL']),
        ]);
        const { data: byCountry } = await admin.from('profiles').select('country').not('country','is',null);
        const countryStats = {};
        (byCountry||[]).forEach(r => { countryStats[r.country] = (countryStats[r.country]||0)+1; });
        return cors(NextResponse.json({ total, verified, pending, vip, countryStats }));
      }
      if (path.startsWith('admin/audit-chat/')) {
        if (role !== 'super_admin') return cors(NextResponse.json({ error: 'super only' }, { status: 403 }));
        const userId = path.split('/').pop();
        const { data } = await admin.from('messages').select('*').or(`sender_id.eq.${userId},receiver_id.eq.${userId}`).order('created_at');
        return cors(NextResponse.json({ messages: data || [] }));
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
    // ☕ SOUL CAFE CHAT — AI Gemini
    if (path === 'soul-cafe/chat') {
      const user = await getUserFromAuth(request); if (!user) return cors(NextResponse.json({ error: 'unauth' }, { status: 401 }));
      const body = await request.json();
      const { conversationId, personaId, message } = body;
      const persona = PERSONAS[personaId];
      if (!persona) return cors(NextResponse.json({ error: 'unknown persona' }, { status: 400 }));
      const admin = getSupabaseAdmin();
      const { data: conv } = await admin.from('ai_conversations').select('*').eq('id', conversationId).eq('user_id', user.id).maybeSingle();
      if (!conv) return cors(NextResponse.json({ error: 'conversation not found' }, { status: 404 }));
      // اجلب السجل
      const { data: history } = await admin.from('ai_messages').select('role, content').eq('conversation_id', conversationId).order('created_at').limit(30);
      // أضف رسالة المستخدم
      const { data: userMsg } = await admin.from('ai_messages').insert({ conversation_id: conversationId, role: 'user', content: message }).select('id').single();
      // استدعاء Gemini
      let reply;
      try {
        reply = await generateAIReply({
          systemPrompt: persona.systemPrompt,
          history: history || [],
          userMessage: message,
        });
      } catch (e) {
        console.error('Gemini error:', e);
        return cors(NextResponse.json({ error: 'تعذر الاتصال بالذكاء: ' + e.message }, { status: 500 }));
      }
      const { data: assMsg } = await admin.from('ai_messages').insert({ conversation_id: conversationId, role: 'assistant', content: reply }).select('id').single();
      await admin.from('ai_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);
      return cors(NextResponse.json({ userMsgId: userMsg.id, assistantMsgId: assMsg.id, reply }));
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

    // 🗑 ACCOUNT DELETION
    if (path === 'account/delete') {
      const user = await getUserFromAuth(request); if (!user) return cors(NextResponse.json({ error: 'unauth' }, { status: 401 }));
      const admin = getSupabaseAdmin();
      await admin.from('profiles').delete().eq('id', user.id);
      await admin.auth.admin.deleteUser(user.id);
      return cors(NextResponse.json({ ok: true }));
    }

    // 🎯 GIFTS
    if (path === 'gifts/send') {
      const user = await getUserFromAuth(request); if (!user) return cors(NextResponse.json({ error: 'unauth' }, { status: 401 }));
      const { receiver_id, gift_type, gift_emoji, message } = await request.json();
      const admin = getSupabaseAdmin();
      await admin.from('gifts').insert({ sender_id: user.id, receiver_id, gift_type, gift_emoji, message });
      await admin.from('notifications').insert({ user_id: receiver_id, type: 'gift', title: 'تلقيت هدية! '+gift_emoji, body: message || gift_type });
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
        await admin.from('notifications').insert({ user_id: body.user_id, type: 'verified', title: 'تم التحقّق من حسابك', body: 'مرحباً بك في ويّاه! حسابك موثّق الآن.', from_admin: true });
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
