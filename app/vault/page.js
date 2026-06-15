'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Lock, ArrowRight, MessageCircle, Coffee } from 'lucide-react';
import { PERSONAS } from '@/lib/personas';

export default function VaultPage() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [profile, setProfile] = useState(null);
  const [aiConvs, setAiConvs] = useState([]);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/'); return; }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
      if (!p?.vault_pin_hash) { toast.error('اضبط رمز الصندوق أولاً'); router.push('/profile'); return; }
      setProfile(p);
    })();
  }, [router, supabase]);

  const unlock = async () => {
    if (!/^\d{4}$/.test(pin)) return toast.error('4 أرقام');
    setVerifying(true);
    const { data: { session } } = await supabase.auth.getSession();
    const r = await fetch('/api/vault/verify-pin', { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`}, body: JSON.stringify({ pin })});
    const j = await r.json();
    setVerifying(false);
    if (!j.ok) return toast.error('رمز خاطئ');
    setUnlocked(true);
    const { data: ac } = await supabase.from('ai_conversations').select('*').eq('user_id', profile.id).eq('in_vault', true).eq('is_deleted_by_user', false).order('updated_at',{ascending:false});
    setAiConvs(ac || []);
  };

  if (!profile) return <div className="min-h-screen flex items-center justify-center"><Lock className="w-8 h-8 animate-spin text-accent"/></div>;

  if (!unlocked) {
    return (
      <div className="min-h-screen luxury-gradient flex items-center justify-center p-6">
        <Card className="glass-card max-w-sm w-full"><CardContent className="p-8 text-center space-y-5">
          <div className="w-16 h-16 mx-auto rounded-full gold-border bg-white/5 flex items-center justify-center"><Lock className="w-8 h-8 text-accent"/></div>
          <h1 className="text-xl font-bold">الصندوق السري</h1>
          <p className="text-sm text-muted-foreground">أدخل رمز PIN المكوّن من 4 أرقام</p>
          <Input type="password" inputMode="numeric" maxLength={4} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,''))} className="text-center text-2xl tracking-widest h-14" autoFocus/>
          <Button onClick={unlock} disabled={verifying} className="w-full bg-foreground text-background">{verifying?'جاري...':'فتح'}</Button>
          <Button variant="ghost" onClick={()=>router.push('/dashboard')} className="w-full"><ArrowRight className="w-4 h-4 ml-1"/>إلغاء</Button>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="luxury-gradient text-white p-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={()=>router.push('/dashboard')} className="text-white"><ArrowRight className="w-5 h-5"/></Button>
        <div className="flex-1"><div className="font-bold flex items-center gap-2"><Lock className="w-4 h-4 text-accent"/>الصندوق السري</div><div className="text-xs text-stone-400">مفتوح · سيقفل تلقائياً</div></div>
      </header>
      <main className="max-w-3xl mx-auto p-4">
        <h3 className="font-bold mb-3 flex items-center gap-1.5"><Coffee className="w-4 h-4 text-accent"/>محادثات مقهى الروح المحفوظة</h3>
        {aiConvs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">لا توجد محادثات محفوظة في الصندوق</div>
        ) : (
          <div className="space-y-2">
            {aiConvs.map(c=>{
              const p = PERSONAS[c.persona_id];
              return (
                <Card key={c.id}><CardContent className="p-4 flex items-center gap-3">
                  <div className="text-2xl">{p?.emoji}</div>
                  <div className="flex-1">
                    <div className="font-semibold">{p?.name}</div>
                    <div className="text-xs text-muted-foreground">{new Date(c.updated_at).toLocaleString('ar')}</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={async()=>{ await supabase.from('ai_conversations').update({in_vault:false}).eq('id',c.id); toast.success('أُعيدت للعلن'); setAiConvs(a=>a.filter(x=>x.id!==c.id)); }}>إعادة</Button>
                </CardContent></Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
