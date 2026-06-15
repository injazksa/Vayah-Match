'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Shield, Lock, Loader2 } from 'lucide-react';

export default function HiddenAdminGate() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const { data: p } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
      if (p?.role !== 'super_admin' && p?.role !== 'admin' && p?.role !== 'moderator') {
        await supabase.auth.signOut();
        toast.error('غير مصرح لك بالدخول');
        return;
      }
      toast.success('أهلاً بعودتك، أيها المسؤول');
      router.push('/admin');
    } catch (err) { toast.error(err.message); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen luxury-gradient flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="text-center mb-8 text-white">
          <Shield className="w-12 h-12 text-accent mx-auto mb-3"/>
          <h1 className="text-2xl font-bold gold-text">بوابة التحكم السرية</h1>
          <p className="text-stone-400 text-sm mt-1">الدخول للمسؤولين فقط</p>
        </div>
        <Card className="glass-card border-accent/20"><CardContent className="p-6">
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2"><Label>البريد الإلكتروني</Label><Input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="h-12" required/></div>
            <div className="space-y-2"><Label>كلمة السر</Label><Input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="h-12" required/></div>
            <Button type="submit" disabled={loading} className="w-full h-12 bg-foreground text-background gold-glow">
              {loading ? <Loader2 className="w-5 h-5 animate-spin"/> : (<><Lock className="w-4 h-4 ml-1.5"/>دخول آمن</>)}
            </Button>
          </form>
        </CardContent></Card>
      </div>
    </div>
  );
}
