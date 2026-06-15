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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Crown, Shield, Users, CheckCircle2, XCircle, Ban, Send, Eye, Trash2, Search, Loader2, LogOut, BarChart3, AlertTriangle, MessageSquare, ChevronRight, ChevronLeft, FileText, Image as ImageIcon } from 'lucide-react';

async function authedFetch(supabase, url, options={}) {
  const { data: { session } } = await supabase.auth.getSession();
  return fetch(url, { ...options, headers: { ...(options.headers||{}), 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' } });
}

export default function AdminPage() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const [me, setMe] = useState(null);
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize] = useState(25);
  const [stats, setStats] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [vipId, setVipId] = useState('');
  const [leakLogs, setLeakLogs] = useState([]);
  const [allMessages, setAllMessages] = useState([]);
  const [msgPage, setMsgPage] = useState(0);

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

  useEffect(() => { if (me) loadUsers(); }, [page, filter, search]); // eslint-disable-line

  const refresh = async () => {
    await Promise.all([loadUsers(), loadStats()]);
  };

  const loadUsers = async () => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), filter, search });
    const r = await authedFetch(supabase, '/api/admin/users?' + params);
    const j = await r.json();
    setUsers(j.users || []); setTotal(j.total || 0);
  };

  const loadStats = async () => {
    const r = await authedFetch(supabase, '/api/admin/stats');
    setStats(await r.json());
  };

  const loadLeaks = async () => {
    const r = await authedFetch(supabase, '/api/admin/leak-logs');
    const j = await r.json();
    setLeakLogs(j.logs || []);
  };

  const loadMessages = async (p=0) => {
    const r = await authedFetch(supabase, '/api/admin/all-messages?page=' + p);
    const j = await r.json();
    setAllMessages(j.messages || []);
    setMsgPage(p);
  };

  const act = async (apath, body) => {
    const r = await authedFetch(supabase, '/api/admin/'+apath, { method: 'POST', body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) { toast.error(j.error || 'خطأ'); return false; }
    toast.success('تمت العملية');
    await refresh();
    return true;
  };

  const grantVip = async () => {
    if (!vipId.trim()) return;
    const r = await authedFetch(supabase, '/api/admin/vip-grant', { method: 'POST', body: JSON.stringify({ identifier: vipId.trim() }) });
    const j = await r.json();
    if (!r.ok) toast.error(j.error || 'غير موجود');
    else { toast.success('تم منح VIP'); setVipId(''); refresh(); }
  };

  if (loading || !me) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-accent"/></div>;

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="min-h-screen bg-background">
      <header className="luxury-gradient text-white sticky top-0 z-30 border-b border-accent/20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Shield className="w-7 h-7 text-accent"/>
            <div>
              <div className="font-bold flex items-center gap-2">قلعة الإدارة (Admin Citadel) <Badge className="bg-accent text-foreground text-[10px]">{me.role}</Badge></div>
              <div className="text-[10px] text-stone-400">{me.email}</div>
            </div>
          </div>
          <Button variant="ghost" onClick={async()=>{await supabase.auth.signOut(); router.push('/');}} className="text-white hover:bg-white/10"><LogOut className="w-4 h-4 ml-1"/>خروج</Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            {[
              {l:'الإجمالي',v:stats.total||0,i:Users,c:'text-blue-600'},
              {l:'موثّقين',v:stats.verified||0,i:CheckCircle2,c:'text-green-600'},
              {l:'بانتظار',v:stats.pending||0,i:Eye,c:'text-amber-600'},
              {l:'VIP',v:stats.vip||0,i:Crown,c:'text-accent'},
              {l:'تسريب (7أ)',v:stats.leaks_7d||0,i:AlertTriangle,c:'text-destructive'},
            ].map((s,i)=>(
              <Card key={i}><CardContent className="p-4 flex items-center justify-between">
                <div><div className="text-2xl font-bold">{s.v}</div><div className="text-xs text-muted-foreground">{s.l}</div></div>
                <s.i className={`w-7 h-7 ${s.c}`}/>
              </CardContent></Card>
            ))}
          </div>
        )}

        <Tabs defaultValue="users">
          <TabsList className="mb-4 flex-wrap h-auto">
            <TabsTrigger value="users"><Users className="w-4 h-4 ml-1"/>إدارة الأعضاء</TabsTrigger>
            <TabsTrigger value="vip"><Crown className="w-4 h-4 ml-1"/>منح VIP</TabsTrigger>
            <TabsTrigger value="leaks" onClick={loadLeaks}><AlertTriangle className="w-4 h-4 ml-1"/>محاولات التسريب</TabsTrigger>
            <TabsTrigger value="messages" onClick={()=>loadMessages(0)}><MessageSquare className="w-4 h-4 ml-1"/>كل المحادثات</TabsTrigger>
            <TabsTrigger value="analytics"><BarChart3 className="w-4 h-4 ml-1"/>التحليلات</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              <div className="relative flex-1 min-w-64">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
                <Input value={search} onChange={e=>{setSearch(e.target.value); setPage(0);}} placeholder="بحث بالاسم/الإيميل" className="pr-10"/>
              </div>
              <div className="flex gap-1 flex-wrap">
                {[['all','الكل'],['pending','بانتظار'],['verified','موثّق'],['banned','محظور'],['vip','VIP']].map(([k,l])=>(
                  <Button key={k} variant={filter===k?'default':'outline'} size="sm" onClick={()=>{setFilter(k); setPage(0);}}>{l}</Button>
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
                    {users.map(u=>(
                      <tr key={u.id} className="hover:bg-muted/30">
                        <td className="p-3 cursor-pointer" onClick={()=>router.push('/admin/user/'+u.id)}>
                          <div className="font-medium hover:text-accent">{u.display_name || 'بدون اسم'}</div>
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
                            <Button size="sm" variant="outline" onClick={()=>router.push('/admin/user/'+u.id)} className="h-7 px-2 gold-border"><Eye className="w-3 h-3 ml-1 text-accent"/>عرض</Button>
                            {!u.is_verified && <Button size="sm" variant="outline" onClick={()=>act('verify',{user_id:u.id})} className="h-7 px-2"><CheckCircle2 className="w-3 h-3 text-green-600"/></Button>}
                            {!['banned_temp','banned_permanent'].includes(u.account_status) ? (
                              <Button size="sm" variant="outline" onClick={()=>act('ban',{user_id:u.id, permanent:false})} className="h-7 px-2"><Ban className="w-3 h-3 text-amber-600"/></Button>
                            ) : (
                              <Button size="sm" variant="outline" onClick={()=>act('unban',{user_id:u.id})} className="h-7 px-2">فك</Button>
                            )}
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
              {users.length===0 && <div className="p-10 text-center text-muted-foreground">لا توجد نتائج</div>}
              {totalPages > 1 && (
                <div className="p-3 border-t flex justify-between items-center bg-muted/20">
                  <div className="text-xs text-muted-foreground">صفحة {page+1} من {totalPages} • إجمالي {total}</div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" disabled={page===0} onClick={()=>setPage(p=>p-1)}><ChevronRight className="w-4 h-4"/></Button>
                    <Button size="sm" variant="outline" disabled={page>=totalPages-1} onClick={()=>setPage(p=>p+1)}><ChevronLeft className="w-4 h-4"/></Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="vip">
            <Card><CardContent className="p-6 space-y-4 max-w-2xl">
              <div className="flex items-center gap-2"><Crown className="w-5 h-5 text-accent"/><h3 className="font-bold">منح VIP يدوي (هدية)</h3></div>
              <p className="text-sm text-muted-foreground">أدخل بريد إلكتروني أو UUID. سيتم تفعيل باقة VIP_MANUAL بشكل دائم ومجاني.</p>
              <div className="flex gap-2"><Input value={vipId} onChange={e=>setVipId(e.target.value)} placeholder="email@example.com أو UUID" className="h-11"/><Button onClick={grantVip} className="bg-accent text-foreground hover:bg-accent/90 h-11 gold-glow">منح VIP</Button></div>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="leaks">
            <Card><CardContent className="p-5">
              <h3 className="font-bold mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-destructive"/>محاولات تسريب الأرقام / السوشال ميديا</h3>
              {leakLogs.length === 0 ? <div className="text-center py-8 text-muted-foreground text-sm">لا توجد محاولات</div> : (
                <div className="space-y-2">
                  {leakLogs.map(l=>(
                    <div key={l.id} className="p-3 rounded-lg border bg-card">
                      <div className="flex justify-between items-start mb-1">
                        <div>
                          <span className="font-medium">{l.profile?.display_name || l.user_id.slice(0,8)}</span>
                          <span className="text-xs text-muted-foreground mr-2">({l.context})</span>
                          <Badge variant={l.severity==='high'?'destructive':l.severity==='medium'?'default':'outline'} className="text-[10px] mr-1">{l.severity}</Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString('ar')}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">المحجوب: <span className="font-mono text-destructive">{(l.blocked_matches||[]).join(' | ')}</span></div>
                      <div className="text-xs mt-1 text-muted-foreground line-clamp-2">النص الأصلي: {l.original_content}</div>
                      <Button size="sm" variant="outline" onClick={()=>router.push('/admin/user/'+l.user_id)} className="mt-2 h-7 text-xs">عرض العضو</Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="messages">
            <Card><CardContent className="p-5">
              <h3 className="font-bold mb-3 flex items-center gap-2"><MessageSquare className="w-4 h-4 text-accent"/>سجل كل المحادثات (للرقابة)</h3>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {allMessages.map(m=>(
                  <div key={m.id} className="p-3 rounded-lg border bg-card text-sm">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>من <b className="text-foreground">{m.sender?.display_name || '?'}</b> ← إلى <b className="text-foreground">{m.receiver?.display_name || '?'}</b></span>
                      <span>{new Date(m.created_at).toLocaleString('ar')}</span>
                    </div>
                    <div className={m.is_deleted_by_user ? 'text-muted-foreground italic' : ''}>{m.content} {m.is_deleted_by_user && '(محذوفة من المستخدم)'}</div>
                  </div>
                ))}
                {allMessages.length === 0 && <div className="text-center py-8 text-muted-foreground text-sm">لا توجد محادثات</div>}
              </div>
              <div className="flex justify-center gap-2 mt-3">
                <Button size="sm" variant="outline" disabled={msgPage===0} onClick={()=>loadMessages(msgPage-1)}><ChevronRight className="w-4 h-4"/></Button>
                <span className="text-xs flex items-center px-2">صفحة {msgPage+1}</span>
                <Button size="sm" variant="outline" disabled={allMessages.length<50} onClick={()=>loadMessages(msgPage+1)}><ChevronLeft className="w-4 h-4"/></Button>
              </div>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="analytics">
            {stats && (
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
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
