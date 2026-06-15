'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowRight, Send, Loader2, MessageCircle, ImagePlus, Check, X, Eye, Lock } from 'lucide-react';

export default function MessagesPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-accent"/></div>}>
      <MessagesPage />
    </Suspense>
  );
}

function MessagesPage() {
  const router = useRouter();
  const params = useSearchParams();
  const targetId = params.get('to');
  const supabase = getSupabaseClient();
  const [me, setMe] = useState(null);
  const [threads, setThreads] = useState([]);
  const [activeUser, setActiveUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [photoRequests, setPhotoRequests] = useState({}); // {exchange_id: data}
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingIncoming, setPendingIncoming] = useState([]);
  const fileRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/'); return; }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
      if (!p?.is_verified && p?.role==='user') { router.push('/waiting'); return; }
      setMe(p);
      loadThreads(p.id);
      loadPendingPhotos(session);
      if (targetId) openThread(targetId, p.id);

      const ch = supabase.channel('msg-rt-'+p.id)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${p.id}` },
          (payload) => {
            const msg = payload.new;
            if (activeUser && msg.sender_id === activeUser.id) {
              setMessages(m => [...m, msg]);
            }
            loadThreads(p.id);
          })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'photo_exchanges', filter: `receiver_id=eq.${p.id}` },
          () => loadPendingPhotos(session))
        .subscribe();
      return () => supabase.removeChannel(ch);
    })();
  }, [targetId, router, supabase]); // eslint-disable-line

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);

  const loadThreads = async (uid) => {
    const { data } = await supabase.from('messages')
      .select('id, sender_id, receiver_id, content, created_at, is_read')
      .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`)
      .eq('in_vault', false).eq('is_deleted_by_user', false)
      .order('created_at', { ascending: false }).limit(100);
    const grouped = {};
    (data || []).forEach(m => {
      const other = m.sender_id === uid ? m.receiver_id : m.sender_id;
      if (!grouped[other]) grouped[other] = m;
    });
    const otherIds = Object.keys(grouped);
    if (otherIds.length === 0) { setThreads([]); return; }
    const { data: profs } = await supabase.from('profiles').select('id, display_name, age, country').in('id', otherIds);
    setThreads(otherIds.map(id => ({ user: profs?.find(p=>p.id===id), last: grouped[id] })).filter(t=>t.user));
  };

  const loadPendingPhotos = async (session) => {
    const r = await fetch('/api/photos/pending', { headers: { Authorization: `Bearer ${session.access_token}` } });
    const j = await r.json();
    setPendingIncoming(j.requests || []);
  };

  const openThread = async (otherId, myId) => {
    const { data: u } = await supabase.from('profiles').select('id, display_name, age, country').eq('id', otherId).maybeSingle();
    if (!u) return;
    setActiveUser(u);
    const { data } = await supabase.from('messages')
      .select('*')
      .or(`and(sender_id.eq.${myId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${myId})`)
      .eq('is_deleted_by_user', false).eq('in_vault', false).order('created_at');
    setMessages(data || []);
  };

  const send = async () => {
    if (!input.trim() || !activeUser) return;
    const content = input.trim();
    setInput(''); setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ receiver_id: activeUser.id, content })
      });
      const j = await r.json();
      if (!r.ok) {
        toast.error(j.error || 'خطأ');
        if (j.blockedCount) {
          toast.warning(`تم حجب ${j.blockedCount} عنصر: ${(j.blocked||[]).slice(0,3).join(', ')}`, { duration: 5000 });
        }
        setInput(content);
        return;
      }
      if (j.message) setMessages(m => [...m, j.message]);
    } finally { setSending(false); }
  };

  // طلب إرسال صورة
  const requestSendPhoto = async (file) => {
    if (!file || !activeUser) return;
    const { data: { session } } = await supabase.auth.getSession();
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${me.id}/${Date.now()}.${ext}`;
    const { error: ue } = await supabase.storage.from('chat_photos').upload(path, file);
    if (ue) { toast.error('فشل رفع الصورة: ' + ue.message); return; }
    const r = await fetch('/api/photos/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ receiver_id: activeUser.id, storage_path: path })
    });
    if (r.ok) toast.success('تم إرسال طلب الصورة. سيتم العرض بعد موافقة الطرف الآخر.');
    else toast.error('فشل الطلب');
  };

  const respondPhoto = async (exchangeId, decision) => {
    const { data: { session } } = await supabase.auth.getSession();
    const r = await fetch('/api/photos/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ exchange_id: exchangeId, decision })
    });
    if (r.ok) {
      toast.success(decision === 'approve' ? 'تم القبول' : 'تم الرفض');
      loadPendingPhotos(session);
      if (activeUser) openThread(activeUser.id, me.id);
    }
  };

  const viewApprovedPhoto = async (exchangeId) => {
    if (photoRequests[exchangeId]) {
      window.open(photoRequests[exchangeId], '_blank');
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    const r = await fetch('/api/photos/url/' + exchangeId, { headers: { Authorization: `Bearer ${session.access_token}` } });
    const j = await r.json();
    if (j.url) {
      setPhotoRequests(p => ({ ...p, [exchangeId]: j.url }));
      window.open(j.url, '_blank');
    }
  };

  if (!me) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-accent"/></div>;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={()=>activeUser ? setActiveUser(null) : router.push('/dashboard')}><ArrowRight className="w-5 h-5"/></Button>
          <div className="flex-1 font-bold">{activeUser ? activeUser.display_name : 'المحادثات'}</div>
          {pendingIncoming.length > 0 && !activeUser && (
            <Badge variant="destructive" className="gap-1"><ImagePlus className="w-3 h-3"/>{pendingIncoming.length} طلب صورة</Badge>
          )}
        </div>
      </header>

      {!activeUser ? (
        <div className="max-w-3xl mx-auto w-full p-4 space-y-4">
          {pendingIncoming.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold flex items-center gap-1.5"><ImagePlus className="w-4 h-4 text-accent"/>طلبات صور بانتظار موافقتك</h3>
              {pendingIncoming.map(req => (
                <div key={req.id} className="p-3 border rounded-xl bg-card flex items-center gap-3">
                  <Lock className="w-8 h-8 text-accent"/>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{req.sender?.display_name || 'عضو'} يرغب بإرسال صورة</div>
                    <div className="text-xs text-muted-foreground">لن تُعرض الصورة قبل موافقتك</div>
                  </div>
                  <Button size="sm" onClick={()=>respondPhoto(req.id, 'approve')} className="bg-green-600 hover:bg-green-700 text-white"><Check className="w-4 h-4"/></Button>
                  <Button size="sm" variant="destructive" onClick={()=>respondPhoto(req.id, 'reject')}><X className="w-4 h-4"/></Button>
                </div>
              ))}
            </div>
          )}

          {threads.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 text-accent/40"/>
              <p>لا توجد محادثات بعد. ابدأ محادثة من القائمة الرئيسية.</p>
            </div>
          ) : (
            <div className="divide-y rounded-2xl border bg-card overflow-hidden">
              {threads.map(t=>(
                <button key={t.user.id} onClick={()=>openThread(t.user.id, me.id)} className="w-full p-4 hover:bg-muted/50 flex items-center gap-3 text-right">
                  <Avatar className="gold-border"><AvatarFallback className="luxury-gradient text-accent">{t.user.display_name?.[0]}</AvatarFallback></Avatar>
                  <div className="flex-1">
                    <div className="font-semibold">{t.user.display_name}</div>
                    <div className="text-sm text-muted-foreground line-clamp-1">{t.last.content}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-stone-50">
            {messages.map(m=>{
              const photoMatch = m.content.match(/\[PHOTO:([0-9a-f-]+)\]/);
              return (
                <div key={m.id} className={`flex ${m.sender_id===me.id?'justify-end':'justify-start'}`}>
                  <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${m.sender_id===me.id?'bg-foreground text-background rounded-br-sm':'bg-white shadow-sm border rounded-bl-sm'}`}>
                    {photoMatch ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2"><ImagePlus className="w-4 h-4"/><span>📸 صورة مشتركة</span></div>
                        <Button size="sm" variant={m.sender_id===me.id?'secondary':'outline'} onClick={()=>viewApprovedPhoto(photoMatch[1])}><Eye className="w-3 h-3 ml-1"/>عرض</Button>
                      </div>
                    ) : m.content}
                  </div>
                </div>
              );
            })}
            {messages.length===0 && <div className="text-center text-muted-foreground py-8 text-sm">ابدأ محادثة جديدة</div>}
          </div>
          <div className="p-3 border-t bg-white sticky bottom-0">
            <div className="flex gap-2 max-w-3xl mx-auto">
              <Button variant="outline" size="icon" onClick={()=>fileRef.current?.click()} title="طلب إرسال صورة" className="h-11"><ImagePlus className="w-4 h-4 text-accent"/></Button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e)=>{requestSendPhoto(e.target.files?.[0]); e.target.value='';}}/>
              <Input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="رسالة..." className="h-11" disabled={sending}/>
              <Button onClick={send} disabled={!input.trim()||sending} className="bg-foreground text-background h-11 px-4">{sending?<Loader2 className="w-4 h-4 animate-spin"/>:<Send className="w-4 h-4"/>}</Button>
            </div>
            <div className="text-[10px] text-muted-foreground text-center mt-1.5">⚠️ ممنوع مشاركة أرقام الهواتف أو حسابات السوشال ميديا. سيتم حجبها تلقائياً.</div>
          </div>
        </>
      )}
    </div>
  );
}
