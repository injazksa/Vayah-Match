'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ArrowRight, Send, Loader2, MessageCircle } from 'lucide-react';

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
  const [input, setInput] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/'); return; }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
      if (!p?.is_verified && p?.role==='user') { router.push('/waiting'); return; }
      setMe(p);
      loadThreads(p.id);
      if (targetId) openThread(targetId, p.id);

      // Realtime listener
      const ch = supabase.channel('msg-rt')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${p.id}` },
          (payload) => {
            const msg = payload.new;
            if (activeUser && msg.sender_id === activeUser.id) {
              setMessages(m => [...m, msg]);
            }
            loadThreads(p.id);
          }).subscribe();
      return () => supabase.removeChannel(ch);
    })();
  }, [targetId, router, supabase]);

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
    setInput('');
    const { data, error } = await supabase.from('messages').insert({
      sender_id: me.id, receiver_id: activeUser.id, content
    }).select().single();
    if (!error && data) setMessages(m => [...m, data]);
  };

  if (!me) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-accent"/></div>;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={()=>activeUser ? setActiveUser(null) : router.push('/dashboard')}><ArrowRight className="w-5 h-5"/></Button>
          <div className="flex-1 font-bold">{activeUser ? activeUser.display_name : 'المحادثات'}</div>
        </div>
      </header>
      {!activeUser ? (
        <div className="max-w-3xl mx-auto w-full p-4">
          {threads.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 text-accent/40"/>
              <p>لا توجد محادثات بعد. ابدأ محادثة مع أحد الأعضاء.</p>
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
            {messages.map(m=>(
              <div key={m.id} className={`flex ${m.sender_id===me.id?'justify-end':'justify-start'}`}>
                <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${m.sender_id===me.id?'bg-foreground text-background rounded-br-sm':'bg-white shadow-sm border rounded-bl-sm'}`}>
                  {m.content}
                </div>
              </div>
            ))}
          </div>
          <div className="p-3 border-t bg-white sticky bottom-0">
            <div className="flex gap-2 max-w-3xl mx-auto">
              <Input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="رسالة..." className="h-11"/>
              <Button onClick={send} disabled={!input.trim()} className="bg-foreground text-background h-11 px-4"><Send className="w-4 h-4"/></Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
