'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Crown, Shield, Users, CheckCircle2, XCircle, Ban, Send, Eye, Trash2, Search, Loader2, LogOut, BarChart3, Gift } from 'lucide-react';

async function authedFetch(supabase, url, options={}) {
  const { data: { session } } = await supabase.auth.getSession();
  return fetch(url, { ...options, headers: { ...(options.headers||{}), 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' } });
}

export default function AdminPage() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const [me, setMe] = useState(null);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [kycUrl, setKycUrl] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyData, setNotifyData] = useState({ title: '', body: '' });
  const [vipId, setVipId] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/vayah-hidden-secure-vault-gate'); return; }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
      if (!p || !['admin','super_admin','moderator'].includes(p.role)) { router.push('/'); return; }
      setMe(p);
      await refresh();
      setLoading(false);
    })();
  }, [router, supabase]);

  const refresh = async () => {
    const [uRes, sRes] = await Promise.all([
      authedFetch(supabase, '/api/admin/users'),
      authedFetch(supabase, '/api/admin/stats')
    ]);
    const u = await uRes.json(); const s = await sRes.json();
    setUsers(u.users || []); setStats(s);
  };

  const act = async (path, body) => {
    const r = await authedFetch(supabase, '/api/admin/'+path, { method: 'POST', body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) { toast.error(j.error || 'خطأ'); return false; }
    toast.success('تمت العملية');
    await refresh();
    return true;
  };

  const viewKYC = async (userId) => {
    const r = await authedFetch(supabase, '/api/admin/kyc/' + userId);
    const j = await r.json();
    setKycUrl(j.url);
    if (!j.url) toast.error('لا توجد صورة KYC');
  };

  const grantVip = async () => {
    if (!vipId.trim()) return;
    const r = await authedFetch(supabase, '/api/admin/vip-grant', { method: 'POST', body: JSON.stringify({ identifier: vipId.trim() }) });
    const j = await r.json();
    if (!r.ok) toast.error(j.error || 'غير موجود');
    else { toast.success('تم منح VIP'); setVipId(''); refresh(); }
  };

  const sendNotify = async () => {
    if (!selectedUser || !notifyData.title) return;
    await act('notify', { user_id: selectedUser.id, title: notifyData.title, body: notifyData.body });
    setNotifyOpen(false); setNotifyData({ title:'', body:'' });
  };

  const filtered = users.filter(u => {
    if (search && !((u.display_name||'').includes(search) || (u.email||'').includes(search) || (u.id||'').includes(search))) return false;
    if (filter === 'pending') return !u.is_verified && u.account_status !== 'banned_permanent' && u.account_status !== 'banned_temp';
    if (filter === 'verified') return u.is_verified;
    if (filter === 'banned') return ['banned_temp','banned_permanent'].includes(u.account_status);
    if (filter === 'vip') return ['VIP','VIP_MANUAL'].includes(u.subscription_status);
    return true;
  });

  if (loading || !me) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-accent"/></div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="luxury-gradient text-white sticky top-0 z-30 border-b border-accent/20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Shield className="w-7 h-7 text-accent"/>
            <div>
              <div className="font-bold flex items-center gap-2">لوحة التحكم <Badge className="bg-accent text-foreground text-[10px]">{me.role}</Badge></div>
              <div className="text-[10px] text-stone-400">{me.email}</div>
            </div>
          </div>
          <Button variant="ghost" onClick={async()=>{await supabase.auth.signOut(); router.push('/');}} className="text-white hover:bg-white/10"><LogOut className="w-4 h-4 ml-1"/>خروج</Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              {l:'إجمالي',v:stats.total||0,i:Users,c:'text-blue-600'},
              {l:'موثّقين',v:stats.verified||0,i:CheckCircle2,c:'text-green-600'},
              {l:'بانتظار التحقّق',v:stats.pending||0,i:Eye,c:'text-amber-600'},
              {l:'أعضاء VIP',v:stats.vip||0,i:Crown,c:'text-accent'},
            ].map((s,i)=>(
              <Card key={i}><CardContent className="p-4 flex items-center justify-between">
                <div><div className="text-2xl font-bold">{s.v}</div><div className="text-xs text-muted-foreground">{s.l}</div></div>
                <s.i className={`w-7 h-7 ${s.c}`}/>
              </CardContent></Card>
            ))}
          </div>
        )}

        <Tabs defaultValue="users">
          <TabsList className="mb-4">
            <TabsTrigger value="users"><Users className="w-4 h-4 ml-1"/>إدارة الأعضاء</TabsTrigger>
            <TabsTrigger value="vip"><Crown className="w-4 h-4 ml-1"/>منح VIP يدوي</TabsTrigger>
            <TabsTrigger value="analytics"><BarChart3 className="w-4 h-4 ml-1"/>التحليلات</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              <div className="relative flex-1 min-w-64">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
                <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="بحث بالاسم/الإيميل/UUID" className="pr-10"/>
              </div>
              <div className="flex gap-1">
                {[['all','الكل'],['pending','بانتظار'],['verified','موثّق'],['banned','محظور'],['vip','VIP']].map(([k,l])=>(
                  <Button key={k} variant={filter===k?'default':'outline'} size="sm" onClick={()=>setFilter(k)}>{l}</Button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs"><tr>
                    <th className="p-3 text-right">العضو</th>
                    <th className="p-3 text-right">الحالة</th>
                    <th className="p-3 text-right">الباقة</th>
                    <th className="p-3 text-right">الدولة</th>
                    <th className="p-3 text-right">الإجراءات</th>
                  </tr></thead>
                  <tbody className="divide-y">
                    {filtered.map(u=>(
                      <tr key={u.id} className="hover:bg-muted/30">
                        <td className="p-3">
                          <div className="font-medium">{u.display_name || 'بدون اسم'}</div>
                          <div className="text-xs text-muted-foreground">{u.email}</div>
                          <div className="text-[10px] text-muted-foreground/70 font-mono">{u.id.slice(0,8)}…</div>
                        </td>
                        <td className="p-3">
                          {u.is_verified ? <Badge className="bg-green-600">موثّق</Badge> :
                           u.account_status==='banned_permanent' ? <Badge variant="destructive">محظور نهائي</Badge> :
                           u.account_status==='banned_temp' ? <Badge variant="destructive">محظور مؤقت</Badge> :
                           <Badge variant="outline">بانتظار</Badge>}
                          {u.role!=='user' && <Badge className="mr-1 bg-accent text-foreground text-[10px]">{u.role}</Badge>}
                        </td>
                        <td className="p-3">
                          {u.subscription_status==='VIP_MANUAL' ? <Badge className="bg-accent text-foreground gap-1"><Crown className="w-3 h-3"/>VIP</Badge> :
                           u.subscription_status==='VIP' ? <Badge className="bg-amber-500">VIP</Badge> :
                           <Badge variant="outline">FREE</Badge>}
                        </td>
                        <td className="p-3 text-xs">{u.country || '—'}</td>
                        <td className="p-3">
                          <div className="flex gap-1 flex-wrap">
                            {!u.is_verified && <Button size="sm" variant="outline" onClick={()=>act('verify',{user_id:u.id})} className="h-7 px-2"><CheckCircle2 className="w-3 h-3 ml-1 text-green-600"/>توثيق</Button>}
                            {u.is_verified && <Button size="sm" variant="outline" onClick={()=>act('unverify',{user_id:u.id})} className="h-7 px-2"><XCircle className="w-3 h-3 ml-1"/>إلغاء</Button>}
                            <Button size="sm" variant="outline" onClick={()=>viewKYC(u.id)} className="h-7 px-2"><Eye className="w-3 h-3 ml-1"/>KYC</Button>
                            {!['banned_temp','banned_permanent'].includes(u.account_status) ? (
                              <Button size="sm" variant="outline" onClick={()=>act('ban',{user_id:u.id, permanent:false})} className="h-7 px-2"><Ban className="w-3 h-3 ml-1 text-amber-600"/>حظر</Button>
                            ) : (
                              <Button size="sm" variant="outline" onClick={()=>act('unban',{user_id:u.id})} className="h-7 px-2">فك الحظر</Button>
                            )}
                            <Button size="sm" variant="outline" onClick={()=>{setSelectedUser(u); setNotifyOpen(true);}} className="h-7 px-2"><Send className="w-3 h-3 ml-1"/>إشعار</Button>
                            {me.role==='super_admin' && u.role!=='super_admin' && (
                              <Button size="sm" variant="destructive" onClick={()=>{ if(confirm('حذف نهائي؟')) act('delete-user',{user_id:u.id}); }} className="h-7 px-2"><Trash2 className="w-3 h-3"/></Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filtered.length===0 && <div className="p-10 text-center text-muted-foreground">لا توجد نتائج</div>}
            </div>
          </TabsContent>

          <TabsContent value="vip">
            <Card><CardContent className="p-6 space-y-4 max-w-2xl">
              <div className="flex items-center gap-2"><Crown className="w-5 h-5 text-accent"/><h3 className="font-bold">منح VIP يدوي (هدية)</h3></div>
              <p className="text-sm text-muted-foreground">أدخل بريد إلكتروني أو UUID. سيتم تفعيل باقة VIP_MANUAL بشكل دائم ومجاني.</p>
              <div className="flex gap-2"><Input value={vipId} onChange={e=>setVipId(e.target.value)} placeholder="email@example.com أو UUID" className="h-11"/><Button onClick={grantVip} className="bg-accent text-foreground hover:bg-accent/90 h-11 gold-glow">منح VIP</Button></div>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="analytics">
            {stats && (
              <div className="space-y-4">
                <Card><CardContent className="p-5">
                  <h3 className="font-bold mb-3">توزيع حسب الدولة</h3>
                  <div className="space-y-2">
                    {Object.entries(stats.countryStats || {}).sort((a,b)=>b[1]-a[1]).slice(0,15).map(([c,n])=>(
                      <div key={c} className="flex items-center gap-3">
                        <div className="w-24 text-sm">{c}</div>
                        <div className="flex-1 bg-muted rounded-full h-6 overflow-hidden"><div className="luxury-gradient h-full" style={{width: `${Math.min(100, (n/(stats.total||1))*100*5)}%`}}></div></div>
                        <div className="w-12 text-sm font-medium text-left">{n}</div>
                      </div>
                    ))}
                  </div>
                </CardContent></Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* KYC Viewer */}
      <Dialog open={!!kycUrl} onOpenChange={()=>setKycUrl(null)}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader><DialogTitle>صورة KYC</DialogTitle></DialogHeader>
          {kycUrl && <img src={kycUrl} alt="kyc" className="w-full rounded-xl gold-border"/>}
        </DialogContent>
      </Dialog>

      {/* Notify Dialog */}
      <Dialog open={notifyOpen} onOpenChange={setNotifyOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>إرسال إشعار خاص - {selectedUser?.display_name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>العنوان</Label><Input value={notifyData.title} onChange={e=>setNotifyData({...notifyData, title: e.target.value})}/></div>
            <div><Label>الرسالة</Label><Textarea rows={4} value={notifyData.body} onChange={e=>setNotifyData({...notifyData, body: e.target.value})}/></div>
          </div>
          <DialogFooter><Button onClick={sendNotify} className="bg-foreground text-background">إرسال</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
