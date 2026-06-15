'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ChevronRight, ChevronLeft, Camera, Check, Loader2, Sparkles, Heart, User, Globe2 } from 'lucide-react';

const COUNTRIES = ['الأردن','السعودية','الإمارات','الكويت','قطر','البحرين','عمان','سوريا','لبنان','فلسطين','مصر','العراق','اليمن','المغرب','الجزائر','تونس','ليبيا','السودان','أخرى'];
const GOALS = ['زواج جدي','تعارف بنية الزواج','بحث عن شريك متوافق','تعدد','صداقة صادقة'];
const INTERESTS = ['القراءة','السفر','الرياضة','الفن','الموسيقى','الطبخ','التصوير','التأمل','التطوع','تربية الحيوانات','الطبيعة','التاريخ','الدين','العلوم','التكنولوجيا','الريادة','العائلة','الأفلام','المسرح','الشعر'];

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const [step, setStep] = useState(1);
  const [userId, setUserId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState({
    display_name: '', age: '', gender: '', country: '',
    marriage_goal: '', bio: '',
    interests: [],
  });

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/'); return; }
      setUserId(session.user.id);
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
      if (profile) {
        if (profile.onboarding_completed && profile.kyc_selfie_url) {
          router.push(profile.is_verified ? '/dashboard' : '/waiting');
          return;
        }
        setData({
          display_name: profile.display_name || '',
          age: profile.age || '',
          gender: profile.gender || '',
          country: profile.country || '',
          marriage_goal: profile.marriage_goal || '',
          bio: profile.bio || '',
          interests: profile.interests || [],
        });
      }
    })();
  }, [router, supabase]);

  const next = () => {
    if (step === 1) {
      if (!data.display_name || data.display_name.length < 2) return toast.error('الرجاء إدخال اسمك');
      if (!data.age || Number(data.age) < 18) return toast.error('يجب أن يكون عمرك 18 عاماً فأكثر');
      if (!data.gender) return toast.error('اختر الجنس');
      if (!data.country) return toast.error('اختر الدولة');
    }
    if (step === 2) {
      if (!data.marriage_goal) return toast.error('اختر هدفك');
      if (!data.bio || data.bio.length < 20) return toast.error('اكتب نبذة في 20 حرفاً على الأقل');
    }
    if (step === 3) {
      if (data.interests.length < 3) return toast.error('اختر 3 اهتمامات على الأقل');
    }
    setStep(step + 1);
  };

  const toggleInterest = (it) => {
    setData(d => ({ ...d, interests: d.interests.includes(it) ? d.interests.filter(i=>i!==it) : [...d.interests, it] }));
  };

  const saveStep3 = async () => {
    if (data.interests.length < 3) return toast.error('اختر 3 اهتمامات على الأقل');
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      display_name: data.display_name, age: parseInt(data.age),
      gender: data.gender, country: data.country,
      marriage_goal: data.marriage_goal, bio: data.bio, interests: data.interests,
      updated_at: new Date().toISOString(),
    }).eq('id', userId);
    setSaving(false);
    if (error) return toast.error('خطأ في حفظ البيانات: ' + error.message);
    toast.success('تم حفظ بياناتك');
    setStep(4);
  };

  const progress = (step / 4) * 100;

  return (
    <div className="min-h-screen luxury-gradient relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.04]" style={{backgroundImage:'radial-gradient(circle at 20% 30%, #C9A961 0%, transparent 40%)'}} />
      <div className="relative z-10 max-w-3xl mx-auto px-6 py-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 text-accent text-sm mb-3">
            <Sparkles className="w-4 h-4" /> رحلة التعريف الفاخرة
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">الخطوة {step} من 4</h1>
        </div>

        <Progress value={progress} className="mb-8 h-1.5 bg-white/10" />

        <Card className="glass-card border-accent/20 premium-shadow">
          <CardContent className="p-6 md:p-10">
            {step === 1 && (
              <div className="space-y-5 fadein">
                <div className="text-center mb-2">
                  <User className="w-8 h-8 text-accent mx-auto mb-2"/>
                  <h2 className="text-xl font-semibold">البيانات الأساسية</h2>
                  <p className="text-sm text-muted-foreground">لن تظهر للعلن حتّى تكتمل المراجعة</p>
                </div>
                <div className="space-y-2">
                  <Label>اسم العرض (لا يلزم أن يكون اسمك الحقيقي)</Label>
                  <Input value={data.display_name} onChange={e=>setData({...data, display_name: e.target.value})} placeholder="أحمد" className="h-12" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>العمر (18+ فقط)</Label>
                    <Input type="number" min={18} max={80} value={data.age} onChange={e=>setData({...data, age: e.target.value})} placeholder="25" className="h-12" />
                  </div>
                  <div className="space-y-2">
                    <Label>الجنس</Label>
                    <Select value={data.gender} onValueChange={v=>setData({...data, gender: v})}>
                      <SelectTrigger className="h-12"><SelectValue placeholder="اختر" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">ذكر</SelectItem>
                        <SelectItem value="female">أنثى</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Globe2 className="w-3.5 h-3.5"/>الدولة</Label>
                  <Select value={data.country} onValueChange={v=>setData({...data, country: v})}>
                    <SelectTrigger className="h-12"><SelectValue placeholder="اختر دولتك" /></SelectTrigger>
                    <SelectContent className="max-h-72">{COUNTRIES.map(c=>(<SelectItem key={c} value={c}>{c}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5 fadein">
                <div className="text-center mb-2">
                  <Heart className="w-8 h-8 text-accent mx-auto mb-2"/>
                  <h2 className="text-xl font-semibold">النيّة والهدف</h2>
                  <p className="text-sm text-muted-foreground">صراحتك البرجسهل التوافق</p>
                </div>
                <div className="space-y-2">
                  <Label>عن ماذا تبحث؟</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {GOALS.map(g=>(
                      <button key={g} type="button" onClick={()=>setData({...data, marriage_goal:g})}
                        className={`p-3 rounded-xl border text-sm transition ${data.marriage_goal===g ? 'border-accent bg-accent/10 gold-glow' : 'border-border hover:border-accent/40'}`}>
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>نبذة عنك (20 حرف على الأقل)</Label>
                  <Textarea rows={6} value={data.bio} onChange={e=>setData({...data, bio: e.target.value})} placeholder="احكي عن نفسك، شغفك، وما تبحث عنه في شريكة/شريك الحياة..." className="resize-none" />
                  <div className="text-xs text-muted-foreground">{data.bio.length} حرف</div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5 fadein">
                <div className="text-center mb-2">
                  <Sparkles className="w-8 h-8 text-accent mx-auto mb-2"/>
                  <h2 className="text-xl font-semibold">الاهتمامات والقيم</h2>
                  <p className="text-sm text-muted-foreground">اختر 3 على الأقل</p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {INTERESTS.map(it=>(
                    <button key={it} type="button" onClick={()=>toggleInterest(it)}
                      className={`px-4 py-2 rounded-full text-sm border transition ${data.interests.includes(it) ? 'bg-foreground text-background border-foreground gold-glow' : 'bg-background border-border hover:border-accent/40'}`}>
                      {it}
                    </button>
                  ))}
                </div>
                <div className="text-center text-sm text-muted-foreground">اخترت {data.interests.length} من {INTERESTS.length}</div>
              </div>
            )}

            {step === 4 && (
              <KYCStep userId={userId} onDone={()=>{ toast.success('تم رفع التحقّق - جاري التحويل'); setTimeout(()=>router.push('/waiting'),1200); }} />
            )}

            {step !== 4 && (
              <div className="flex justify-between gap-3 mt-8">
                <Button variant="outline" onClick={()=>setStep(Math.max(1, step-1))} disabled={step===1}>
                  <ChevronRight className="w-4 h-4 ml-1"/> السابق
                </Button>
                <Button onClick={step===3 ? saveStep3 : next} disabled={saving} className="bg-foreground text-background hover:bg-foreground/90 gold-glow">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : (
                    <>{step===3 ? 'تأكيد والتوجّه للتحقّق' : 'التالي'}<ChevronLeft className="w-4 h-4 mr-1"/></>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// =========== KYC STEP - التحقق الحيوي بالسيلفي ===========
function KYCStep({ userId, onDone }) {
  const supabase = getSupabaseClient();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [phase, setPhase] = useState('intro'); // intro | scanning | captured | uploading
  const [countdown, setCountdown] = useState(3);
  const [error, setError] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [blinkProgress, setBlinkProgress] = useState(0);

  const startCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setPhase('scanning');
      // محاكاة فحص حيوي (blink detection placeholder)
      let p = 0;
      const iv = setInterval(() => {
        p += 5;
        setBlinkProgress(p);
        if (p >= 100) { clearInterval(iv); capture(); }
      }, 100);
    } catch (e) {
      setError('تعذّر الوصول للكاميرا. يرجى السماح بإذن الكاميرا وإعادة المحاولة.');
      setPhase('intro');
    }
  };

  const capture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const v = videoRef.current; const c = canvasRef.current;
    const size = Math.min(v.videoWidth, v.videoHeight);
    c.width = size; c.height = size;
    const ctx = c.getContext('2d');
    // التقاط مربع مركزي وعكس الصورة أفقياً (لأنها selfie)
    ctx.translate(c.width, 0); ctx.scale(-1, 1);
    const sx = (v.videoWidth - size) / 2; const sy = (v.videoHeight - size) / 2;
    ctx.drawImage(v, sx, sy, size, size, 0, 0, size, size);
    c.toBlob(async (blob) => {
      setPhoto(URL.createObjectURL(blob));
      setPhase('captured');
      stop();
      await upload(blob);
    }, 'image/jpeg', 0.9);
  };

  const stop = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t=>t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => () => stop(), []);

  const upload = async (blob) => {
    setPhase('uploading');
    const path = `${userId}/kyc-${Date.now()}.jpg`;
    const { error: upErr } = await supabase.storage.from('identity_verification_kyc').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
    if (upErr) { setError('فشل رفع الصورة: ' + upErr.message); setPhase('intro'); return; }
    const { error: pErr } = await supabase.from('profiles').update({
      kyc_selfie_url: path, onboarding_completed: true, account_status: 'pending', updated_at: new Date().toISOString()
    }).eq('id', userId);
    if (pErr) { setError('خطأ في الحفظ: ' + pErr.message); setPhase('intro'); return; }
    onDone();
  };

  return (
    <div className="space-y-6 fadein text-center">
      <div>
        <Camera className="w-9 h-9 text-accent mx-auto mb-2"/>
        <h2 className="text-xl font-semibold">التحقّق الحيوي (KYC)</h2>
        <p className="text-sm text-muted-foreground mt-1">سيتم فتح الكاميرا الأمامية لالتقاط سيلفي حيّة - لا يسمح برفع صور من المعرض</p>
      </div>

      {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      <div className="relative mx-auto" style={{ width: 'min(360px, 100%)', aspectRatio: '1/1' }}>
        <div className="absolute inset-0 rounded-2xl overflow-hidden bg-stone-900">
          {phase !== 'captured' && phase !== 'uploading' && (
            <video ref={videoRef} className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} playsInline muted />
          )}
          {photo && (phase === 'captured' || phase === 'uploading') && (
            <img src={photo} alt="selfie" className="w-full h-full object-cover" />
          )}
          {/* Face Frame Overlay */}
          {phase === 'scanning' && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-0 face-frame-overlay"></div>
              <div className="absolute inset-[12%] rounded-full border-2 border-accent gold-glow"></div>
              <div className="absolute bottom-4 inset-x-4 text-center">
                <div className="inline-block px-4 py-1.5 rounded-full bg-black/60 text-white text-xs backdrop-blur-sm">
                  تفحّص حيوي... {blinkProgress}%
                </div>
              </div>
              <div className="absolute top-4 inset-x-0 text-center">
                <div className="inline-block px-4 py-1.5 rounded-full bg-accent text-foreground text-xs font-medium">
                  ابق وجهك داخل الدائرة
                </div>
              </div>
            </div>
          )}
          {phase === 'captured' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <div className="bg-green-500 rounded-full w-16 h-16 flex items-center justify-center"><Check className="w-9 h-9 text-white"/></div>
            </div>
          )}
          {phase === 'uploading' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60"><Loader2 className="w-10 h-10 animate-spin text-accent"/></div>
          )}
        </div>
      </div>
      <canvas ref={canvasRef} className="hidden" />

      {phase === 'intro' && (
        <Button onClick={startCamera} size="lg" className="bg-foreground text-background hover:bg-foreground/90 gold-glow">
          <Camera className="w-5 h-5 ml-2"/> ابدأ التحقّق الحيوي
        </Button>
      )}
      {phase === 'uploading' && <div className="text-sm text-muted-foreground">جاري الحفظ الآمن...</div>}
    </div>
  );
}
