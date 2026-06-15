'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase/client';
import { ShieldCheck, Loader2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function WaitingPage() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let unsub;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/'); return; }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
      if (p?.is_verified) { router.push('/dashboard'); return; }
      setProfile(p);
      // الاستماع للتغييرات على حالة is_verified
      const channel = supabase.channel('profile-watch')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${session.user.id}` },
          (payload) => {
            if (payload.new?.is_verified) router.push('/dashboard');
            setProfile(payload.new);
          }).subscribe();
      unsub = () => supabase.removeChannel(channel);
    })();
    // فحص دوري كل 30 ثانية كإجراء احتياطي
    const iv = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: p } = await supabase.from('profiles').select('is_verified, account_status').eq('id', session.user.id).maybeSingle();
      if (p?.is_verified) router.push('/dashboard');
    }, 30000);
    return () => { iv && clearInterval(iv); unsub && unsub(); };
  }, [router, supabase]);

  const signOut = async () => { await supabase.auth.signOut(); router.push('/'); };

  return (
    <div className="min-h-screen luxury-gradient flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.05]" style={{backgroundImage:'radial-gradient(circle at 50% 50%, #C9A961 0%, transparent 60%)'}} />
      <div className="relative z-10 max-w-lg w-full text-center text-white space-y-8 fadein">
        <div className="relative inline-block">
          <div className="absolute inset-0 rounded-full bg-accent/20 blur-3xl animate-pulse"></div>
          <div className="relative w-28 h-28 mx-auto rounded-full gold-border bg-white/5 backdrop-blur-md flex items-center justify-center">
            <ShieldCheck className="w-14 h-14 text-accent" strokeWidth={1.4}/>
          </div>
        </div>
        <div className="space-y-3">
          <h1 className="text-2xl md:text-3xl font-bold leading-relaxed">
            جاري مراجعة طلبك والتحقق من الهوية..
          </h1>
          <p className="text-stone-300 leading-relaxed">
            حسابك تحت المعالجة الآمنة حالياً
          </p>
        </div>
        <div className="flex items-center justify-center gap-2 text-accent">
          <Loader2 className="w-5 h-5 animate-spin"/>
          <span className="text-sm">المراجعة بواسطة فريق الموثوقية</span>
        </div>
        <div className="pt-4 grid grid-cols-3 gap-3 text-xs text-stone-300">
          <div className="p-3 rounded-xl gold-border bg-white/5"><div className="text-accent text-base mb-0.5">✓</div>تسجيل البيانات</div>
          <div className="p-3 rounded-xl gold-border bg-white/5"><div className="text-accent text-base mb-0.5">✓</div>التحقّق الحيوي</div>
          <div className="p-3 rounded-xl gold-border bg-white/5"><div className="text-accent text-base mb-0.5 animate-pulse">…</div>مراجعة إدارية</div>
        </div>
        <Button variant="ghost" onClick={signOut} className="text-stone-400 hover:text-white"><LogOut className="w-4 h-4 ml-1"/>تسجيل الخروج</Button>
      </div>
    </div>
  );
}
