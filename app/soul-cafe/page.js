'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase/client';
import { PERSONAS } from '@/lib/personas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { ArrowRight, Send, Loader2, Lock, Coffee, Sparkles } from 'lucide-react';

export default function SoulCafePage() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const [profile, setProfile] = useState(null);
  const [selectedPersona, setSelectedPersona] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/'); return; }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
      if (!p || (!p.is_verified && p.role === 'user')) { router.push('/waiting'); return; }
      setProfile(p);
    })();
  }, [router, supabase]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  const startConversation = async (personaId) => {
    const persona = PERSONAS[personaId];
    setSelectedPersona(persona);
    // إنشاء محادثة جديدة أو جلب الأخيرة
    const { data: existing } = await supabase
      .from('ai_conversations')
      .select('id').eq('user_id', profile.id).eq('persona_id', personaId)
      .eq('in_vault', false).eq('is_deleted_by_user', false)
      .order('updated_at', { ascending: false }).limit(1).maybeSingle();

    let convId = existing?.id;
    if (!convId) {
      const { data: newConv, error } = await supabase.from('ai_conversations')
        .insert({ user_id: profile.id, persona_id: personaId }).select('id').single();
      if (error) { toast.error('خطأ: ' + error.message); return; }
      convId = newConv.id;
    }
    setConversationId(convId);
    const { data: msgs } = await supabase.from('ai_messages')
      .select('*').eq('conversation_id', convId).order('created_at');
    setMessages(msgs || []);
  };

  const send = async (textOverride) => {
    const text = (textOverride ?? input).trim();
    if (!text || !conversationId) return;
    setInput('');
    setSending(true);
    // أضف للواجهة أولاً
    const tempUser = { id: 'tmp_' + Date.now(), role: 'user', content: text, created_at: new Date().toISOString() };
    setMessages(m => [...m, tempUser]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/soul-cafe/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ conversationId, personaId: selectedPersona.id, message: text })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'AI error');
      setMessages(m => [...m.filter(x => x.id !== tempUser.id), 
        { ...tempUser, id: json.userMsgId },
        { id: json.assistantMsgId, role: 'assistant', content: json.reply, created_at: new Date().toISOString() }
      ]);
    } catch (e) {
      toast.error(e.message);
      setMessages(m => m.filter(x => x.id !== tempUser.id));
    } finally {
      setSending(false);
    }
  };

  const moveToVault = async () => {
    if (!conversationId) return;
    if (!profile.vault_pin_hash) {
      toast.error('اضبط رمز الصندوق السري أولاً من الإعدادات');
      return;
    }
    await supabase.from('ai_conversations').update({ in_vault: true }).eq('id', conversationId);
    toast.success('تم نقل المحادثة للصندوق السري');
    setSelectedPersona(null);
    setConversationId(null);
    setMessages([]);
  };

  if (!profile) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-accent"/></div>;

  // اختيار شخصية
  if (!selectedPersona) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b">
          <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
            <Button variant="ghost" onClick={()=>router.push('/dashboard')}><ArrowRight className="w-4 h-4 ml-1"/>الرئيسية</Button>
            <div className="text-center">
              <div className="font-bold flex items-center gap-1.5"><Coffee className="w-4 h-4 text-accent"/>مقهى الروح</div>
              <div className="text-[11px] text-muted-foreground">فضفف بثقة · تجربة حميمة</div>
            </div>
            <div className="w-20"></div>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-1.5 text-xs text-accent mb-2"><Sparkles className="w-3 h-3"/>بالعامية الشامية الدافئة</div>
            <h1 className="text-2xl md:text-3xl font-bold">مع مين بتحب تحكي الليلة؟</h1>
            <p className="text-sm text-muted-foreground mt-2">اختر الشخصية اللي بترتاح لها · كل محادثة خاصة بك</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.values(PERSONAS).map(p=>(
              <button key={p.id} onClick={()=>startConversation(p.id)} className={`${p.color ? 'bg-gradient-to-br '+p.color : 'luxury-gradient'} rounded-2xl p-6 text-right text-white premium-shadow hover:scale-[1.02] transition group`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="text-4xl">{p.emoji}</div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-green-400">متصل الآن</span>
                    <span className="w-2 h-2 rounded-full bg-green-400 online-dot"></span>
                  </div>
                </div>
                <h3 className="text-xl font-bold mb-1">{p.name}</h3>
                <div className="text-xs text-accent mb-2">{p.title}</div>
                <p className="text-sm text-white/80 leading-relaxed">{p.description}</p>
              </button>
            ))}
          </div>
        </main>
      </div>
    );
  }

  // واجهة المحادثة
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="bg-foreground text-background p-3 flex items-center gap-3 sticky top-0 z-30">
        <Button variant="ghost" size="icon" onClick={()=>{ setSelectedPersona(null); setConversationId(null); setMessages([]); }} className="text-background hover:bg-white/10"><ArrowRight className="w-5 h-5"/></Button>
        <div className="text-2xl">{selectedPersona.emoji}</div>
        <div className="flex-1">
          <div className="font-bold flex items-center gap-1.5">
            {selectedPersona.name}
            <span className="w-2 h-2 rounded-full bg-green-400 online-dot"></span>
          </div>
          <div className="text-xs text-stone-400">متصل الآن · {selectedPersona.title}</div>
        </div>
        <Button variant="ghost" size="icon" onClick={moveToVault} className="text-background hover:bg-white/10" title="نقل للصندوق السري"><Lock className="w-4 h-4"/></Button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-stone-50" style={{minHeight: 'calc(100vh - 200px)'}}>
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="text-5xl mb-3">{selectedPersona.emoji}</div>
            <h3 className="font-bold text-lg">{selectedPersona.name}</h3>
            <p className="text-sm text-muted-foreground mb-6">{selectedPersona.description}</p>
            <div className="flex flex-wrap gap-2 justify-center max-w-md mx-auto">
              {selectedPersona.icebreakers.map((ib,i)=>(
                <button key={i} onClick={()=>send(ib)} className="px-3 py-2 rounded-full bg-white border border-border hover:border-accent text-sm transition">{ib}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map(m=>(
          <div key={m.id} className={`flex ${m.role==='user' ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${m.role==='user' ? 'bg-foreground text-background rounded-bl-sm' : 'bg-white shadow-sm border rounded-br-sm'}`}>
              {m.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-end"><div className="bg-white shadow-sm border rounded-2xl rounded-br-sm px-4 py-3 text-sm flex gap-1 items-center">
            <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce"></span>
            <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce" style={{animationDelay:'.15s'}}></span>
            <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce" style={{animationDelay:'.3s'}}></span>
          </div></div>
        )}
      </div>

      <div className="p-3 border-t bg-white sticky bottom-0">
        <div className="flex gap-2 max-w-3xl mx-auto">
          <Input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter' && send()} placeholder="اكتب رسالتك..." disabled={sending} className="h-11" />
          <Button onClick={()=>send()} disabled={sending || !input.trim()} className="bg-foreground text-background h-11 px-4">
            {sending ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>}
          </Button>
        </div>
      </div>
    </div>
  );
}
