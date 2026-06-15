'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Heart, Sparkles, Shield, Lock, Mail, Eye, EyeOff, Loader2 } from 'lucide-react';

function Logo({ onSecretActivate, large=false }) {
  const [clicks, setClicks] = useState(0);
  const timer = useRef(null);
  const handleClick = () => {
    const next = clicks + 1;
    setClicks(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setClicks(0), 1800);
    if (next >= 10) {
      setClicks(0);
      onSecretActivate && onSecretActivate();
    }
  };
  return (
    <button onClick={handleClick} aria-label="Vayah" className="select-none inline-flex items-center gap-3 group">
      <div className={`${large?'w-14 h-14':'w-11 h-11'} rounded-full bg-foreground flex items-center justify-center premium-shadow group-hover:scale-105 transition`}>
        <Heart className={`${large?'w-7 h-7':'w-5 h-5'} text-accent`} strokeWidth={1.6} />
      </div>
      <div className="text-right leading-tight">
        <div className={`${large?'text-3xl':'text-2xl'} font-bold gold-text tracking-tight`} style={{fontFamily:'Cormorant Garamond, Tajawal'}}>Vayah</div>
        <div className="text-[11px] text-muted-foreground -mt-1">وَيَّاه · الزواج الفاخر</div>
      </div>
    </button>
  );
}

export default function LandingAuth() {
  const router = useRouter();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const supabase = getSupabaseClient();

  useEffect(() => {
    // فحص جلسة سابقة
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // تحويل حسب حالة الملف
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
        if (profile?.role === 'super_admin' || profile?.role === 'admin') router.push('/admin');
        else if (!profile?.onboarding_completed) router.push('/onboarding');
        else if (!profile?.is_verified) router.push('/waiting');
        else router.push('/dashboard');
      } else { setChecking(false); }
    })();
  }, [router, supabase]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { toast.error('يرجى إدخال كل البيانات'); return; }
    if (password.length < 8) { toast.error('كلمة السر يجب أن تكون 8 حروف على الأقل'); return; }
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/onboarding` }
        });
        if (error) throw error;
        if (data.user && !data.session) {
          toast.success('تم إنشاء حسابك! افتح بريدك لتأكيد الحساب.', { duration: 6000 });
        } else {
          toast.success('تم التسجيل بنجاح');
          router.push('/onboarding');
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success('أهلاً وسهلاً بعودتك');
        // التحويل تلقائي عبر useEffect
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
        if (profile?.role === 'super_admin' || profile?.role === 'admin') router.push('/admin');
        else if (!profile?.onboarding_completed) router.push('/onboarding');
        else if (!profile?.is_verified) router.push('/waiting');
        else router.push('/dashboard');
      }
    } catch (err) {
      toast.error(err.message || 'حدث خطأ');
    } finally { setLoading(false); }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* خلفية فاخرة */}
      <div className="absolute inset-0 luxury-gradient" />
      <div className="absolute inset-0 opacity-[0.04]" style={{backgroundImage:'radial-gradient(circle at 20% 30%, #C9A961 0%, transparent 40%), radial-gradient(circle at 80% 70%, #C9A961 0%, transparent 40%)'}} />

      {/* Header */}
      <header className="relative z-10 px-6 md:px-12 py-6 flex items-center justify-between">
        <Logo onSecretActivate={() => { toast.info('جاري فتح بوابة الإدارة...'); setTimeout(()=>router.push('/vayah-hidden-secure-vault-gate'), 700); }} />
        <nav className="hidden md:flex items-center gap-6 text-sm text-stone-300">
          <a href="#features" className="hover:text-accent transition">المميزات</a>
          <a href="#trust" className="hover:text-accent transition">التحقق والأمان</a>
        </nav>
      </header>

      <main className="relative z-10 px-6 md:px-12 pt-8 md:pt-16 pb-20">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-10 md:gap-20 items-center">
          {/* Hero */}
          <div className="text-white space-y-7 fadein">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full gold-border bg-white/5 backdrop-blur-sm text-xs text-accent">
              <Sparkles className="w-3.5 h-3.5" /> تجربة للنخبة · تحقق حيوي 100%
            </div>
            <h1 className="text-4xl md:text-6xl font-bold leading-[1.15]">
              الزواج <span className="gold-text">الفاخر</span><br/>يبدأ بنيّة صادقة
            </h1>
            <p className="text-stone-300 text-base md:text-lg leading-relaxed max-w-xl">
              منصّة عربية حصرية للباحثين عن رفيق العمر. نئوي على تعريف حيوي صارم ، تجربة فاخرة بسيطة، وعالم أمين.
            </p>
            <div className="grid grid-cols-3 gap-3 max-w-xl pt-2">
              {[{i:Shield,t:'تحقق حيوي'},{i:Lock,t:'صندوق سري'},{i:Sparkles,t:'مقهى الروح'}].map((f,i) => (
                <div key={i} className="px-3 py-3 rounded-xl gold-border bg-white/5 text-center">
                  <f.i className="w-5 h-5 text-accent mx-auto mb-1" />
                  <div className="text-xs text-stone-200">{f.t}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Auth Card */}
          <Card className="glass-card border-accent/20 premium-shadow fadein" id="features">
            <CardContent className="p-6 md:p-8">
              <Tabs value={mode} onValueChange={setMode} className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-foreground/10 mb-6">
                  <TabsTrigger value="signin" className="data-[state=active]:bg-foreground data-[state=active]:text-background">تسجيل دخول</TabsTrigger>
                  <TabsTrigger value="signup" className="data-[state=active]:bg-foreground data-[state=active]:text-background">إنشاء حساب</TabsTrigger>
                </TabsList>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">البريد الإلكتروني</Label>
                    <div className="relative">
                      <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input id="email" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="name@example.com" className="pr-10 h-12" required />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">كلمة السر</Label>
                    <div className="relative">
                      <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input id="password" type={showPw?'text':'password'} value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="8 أحرف على الأقل" className="pr-10 pl-10 h-12" required minLength={8} />
                      <button type="button" onClick={()=>setShowPw(!showPw)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showPw ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                      </button>
                    </div>
                  </div>

                  <Button type="submit" disabled={loading} className="w-full h-12 bg-foreground hover:bg-foreground/90 text-background gold-glow text-base font-medium">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin"/> : (mode==='signup' ? 'أنشئ حسابي' : 'دخول آمن')}
                  </Button>

                  <p className="text-xs text-muted-foreground text-center pt-2">
                    بإنشائك حساباً فأنت توافق على <a href="/legal/terms" className="underline hover:text-accent">الشروط</a> و <a href="/legal/privacy" className="underline hover:text-accent">سياسة الخصوصية</a>
                  </p>
                </form>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        <section id="trust" className="max-w-7xl mx-auto mt-24 grid md:grid-cols-3 gap-6 text-white">
          {[
            {t:'تحقّق حيوي بالسيلفي',d:'لا صور مستعارة. فحص بالكاميرا حيّاً ومراجعة بشرية.',i:Shield},
            {t:'محادثات فورية وآمنة',d:'بنية Realtime تتحمل مئات الآلاف دون تأخير مع حفظ سجل سري للإدارة.',i:Sparkles},
            {t:'مقهى الروح',d:'فضفف مع شخصيات فريدة تفهمك بالعامية الشامية دافئة بدون اتهامات.',i:Heart}
          ].map((f,i) => (
            <div key={i} className="p-6 rounded-2xl gold-border bg-white/5 backdrop-blur-sm">
              <f.i className="w-7 h-7 text-accent mb-3" />
              <h3 className="text-lg font-semibold mb-1">{f.t}</h3>
              <p className="text-sm text-stone-300 leading-relaxed">{f.d}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/10 bg-black/30 text-stone-400 text-xs py-6 px-6">
        <div className="max-w-7xl mx-auto flex flex-wrap gap-4 justify-between items-center">
          <div>© 2025 Vayah · جميع الحقوق محفوظة</div>
          <div className="flex flex-wrap gap-4">
            <a href="/legal/terms" className="hover:text-accent">الشروط والأحكام</a>
            <a href="/legal/privacy" className="hover:text-accent">سياسة الخصوصية</a>
            <a href="/legal/disclaimer" className="hover:text-accent">إخلاء المسؤولية</a>
            <a href="/legal/safety" className="hover:text-accent">سياسة السلامة</a>
            <a href="/legal/anti-harassment" className="hover:text-accent">مكافحة التحرش</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
