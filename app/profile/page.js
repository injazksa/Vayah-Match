'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ArrowRight, Camera, Save, Trash2, Lock, Loader2, AlertTriangle } from 'lucide-react';

export default function ProfilePage() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const [profile, setProfile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pin, setPin] = useState('');
  const [pinSet, setPinSet] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/'); return; }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
      if (!p) { router.push('/'); return; }
      setProfile(p);
    })();
  }, [router, supabase]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      display_name: profile.display_name, bio: profile.bio,
      profile_picture_public: profile.profile_picture_public,
      updated_at: new Date().toISOString(),
    }).eq('id', profile.id);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success('تم الحفظ بنجاح');
  };

  const uploadPicture = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const ok = window.confirm('هل تسمح بفتح المعرض ورفع صورة للملف العام؟');
    if (!ok) return;
    const ext = file.name.split('.').pop();
    const path = `${profile.id}/profile-${Date.now()}.${ext}`;
    const { error: ue } = await supabase.storage.from('profile_pictures').upload(path, file, { upsert: true });
    if (ue) return toast.error(ue.message);
    const { data: pub } = supabase.storage.from('profile_pictures').getPublicUrl(path);
    await supabase.from('profiles').update({ profile_picture_url: pub.publicUrl }).eq('id', profile.id);
    setProfile(p => ({ ...p, profile_picture_url: pub.publicUrl }));
    toast.success('تم رفع الصورة');
  };

  const savePin = async () => {
    if (!/^\d{4}$/.test(pinSet)) return toast.error('أدخل 4 أرقام');
    // hash بسيطاً على الجانب الخادم
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/vault/set-pin', { method: 'POST', headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${session.access_token}` }, body: JSON.stringify({ pin: pinSet }) });
    if (!res.ok) return toast.error('خطأ');
    toast.success('تم ضبط رمز الصندوق السري');
    setPinSet(''); setProfile(p => ({ ...p, vault_pin_hash: 'set' }));
  };

  const deleteAccount = async () => {
    if (!window.confirm('هل أنت متأكد؟ سيتم حذف الحساب وكل البيانات نهائياً')) return;
    if (!window.confirm('تأكيد نهائي: لا يمكن التراجع. المتابعة؟')) return;
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/account/delete', { method: 'POST', headers: { 'Authorization': `Bearer ${session.access_token}` } });
    if (res.ok) { toast.success('تم حذف حسابك'); await supabase.auth.signOut(); router.push('/'); }
    else toast.error('خطأ في الحذف');
  };

  if (!profile) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-accent"/></div>;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 bg-background/95 backdrop-blur-md border-b z-30">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={()=>router.push('/dashboard')}><ArrowRight className="w-5 h-5"/></Button>
          <div className="font-bold">إعدادات الحساب</div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* الصورة */}
        <Card><CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-muted gold-border flex items-center justify-center">
              {profile.profile_picture_url ? <img src={profile.profile_picture_url} alt="" className="w-full h-full object-cover"/> : <span className="text-2xl text-muted-foreground">{profile.display_name?.[0]}</span>}
            </div>
            <div className="flex-1">
              <Button onClick={()=>fileRef.current?.click()} variant="outline"><Camera className="w-4 h-4 ml-1"/>تغيير الصورة</Button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadPicture} />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl border p-3">
            <div>
              <div className="font-medium text-sm">إظهار الصورة للعلن</div>
              <div className="text-xs text-muted-foreground">{profile.profile_picture_public ? 'مرئية للجميع' : 'خاصة · للمقبولين فقط'}</div>
            </div>
            <Switch checked={profile.profile_picture_public} onCheckedChange={v=>setProfile({...profile, profile_picture_public:v})} />
          </div>
        </CardContent></Card>

        {/* البيانات */}
        <Card><CardContent className="p-5 space-y-4">
          <h3 className="font-bold">تعديل البيانات</h3>
          <div className="space-y-2"><Label>الاسم</Label><Input value={profile.display_name||''} onChange={e=>setProfile({...profile, display_name:e.target.value})}/></div>
          <div className="space-y-2"><Label>النبذة</Label><Textarea rows={5} value={profile.bio||''} onChange={e=>setProfile({...profile, bio:e.target.value})}/></div>
          <Button onClick={save} disabled={saving} className="bg-foreground text-background">{saving ? <Loader2 className="w-4 h-4 animate-spin"/> : (<><Save className="w-4 h-4 ml-1"/>حفظ</>)}</Button>
        </CardContent></Card>

        {/* رمز الصندوق السري */}
        <Card><CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2 font-bold"><Lock className="w-4 h-4 text-accent"/>الصندوق السري (PIN 4 أرقام)</div>
          <p className="text-xs text-muted-foreground">استخدم رمزاً لإخفاء محادثات حساسة</p>
          <div className="flex gap-2 max-w-xs">
            <Input type="password" inputMode="numeric" maxLength={4} value={pinSet} onChange={e=>setPinSet(e.target.value.replace(/\D/g,''))} placeholder="••••" className="text-center tracking-widest text-lg"/>
            <Button onClick={savePin}>{profile.vault_pin_hash ? 'تحديث' : 'حفظ'}</Button>
          </div>
          {profile.vault_pin_hash && <a href="/vault" className="text-xs text-accent underline">افتح الصندوق السري</a>}
        </CardContent></Card>

        {/* Danger Zone */}
        <Card className="border-destructive/30"><CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2 font-bold text-destructive"><AlertTriangle className="w-4 h-4"/>منطقة الخطر</div>
          <p className="text-sm text-muted-foreground">حذف الحساب نهائي وغير قابل للاسترداد.</p>
          <Button variant="destructive" onClick={deleteAccount}><Trash2 className="w-4 h-4 ml-1"/>حذف الحساب نهائياً</Button>
        </CardContent></Card>
      </main>
    </div>
  );
}
