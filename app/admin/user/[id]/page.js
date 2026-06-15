'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ArrowRight, User, Mail, Phone, Globe2, Heart, Cake, Shield, Crown, MessageSquare, Image as ImageIcon, Gift as GiftIcon, AlertTriangle, FileText, Lock, CheckCircle2, Ban, Trash2, Send, Loader2, Coffee, Calendar, Camera } from 'lucide-react';

async function authedFetch(supabase, url, options={}) {
  const { data: { session } } = await supabase.auth.getSession();
  return fetch(url, { ...options, headers: { ...(options.headers||{}), 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' } });
}

export default function AdminUserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id;
  const supabase = getSupabaseClient();
  const [me, setMe] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewImage, setViewImage] = useState(null);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyData, setNotifyData] = useState({ title:'', body:'' });
  const [chatModal, setChatModal] = useState(null); // userB for chat thread
  const [chatMessages, setChatMessages] = useState([]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/vayah-hidden-secure-vault-gate'); return; }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
      if (!p || !['admin','super_admin','moderator'].includes(p.role)) { router.push('/'); return; }
      setMe(p);
      await loadData();
      setLoading(false);
    })();
  }, [userId, router, supabase]); // eslint-disable-line

  const loadData = async () => {
    const r = await authedFetch(supabase, '/api/admin/user-detail/'+userId);
    setData(await r.json());
  };

  const act = async (apath, body={}) => {
    const r = await authedFetch(supabase, '/api/admin/'+apath, { method: 'POST', body: JSON.stringify({ user_id: userId, ...body }) });
    const j = await r.json();
    if (!r.ok) { toast.error(j.error || 'خطأ'); return; }
    toast.success('تمت العملية');
    await loadData();
  };

  const sendNotify = async () => {
    if (!notifyData.title) return;
    await act('notify', { title: notifyData.title, body: notifyData.body });
    setNotifyOpen(false); setNotifyData({ title:'', body:'' });
  };

  const loadChatThread = async (otherId) => {
    setChatModal(otherId);
    const r = await authedFetch(supabase, `/api/admin/chat-thread/${userId}/${otherId}`);
    const j = await r.json();
    setChatMessages(j.messages || []);
  };

  const viewPhotoUrl = async (exchangeId) => {
    const r = await authedFetch(supabase, '/api/photos/url/' + exchangeId);
    const j = await r.json();
    if (j.url) setViewImage(j.url);
    else toast.error('لا يمكن عرض الصورة');
  };

  if (loading || !data?.profile) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-accent"/></div>;
  const p = data.profile;

  const InfoIcon = ({icon:Icon, label, value, color='text-accent'}) => (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-card border">
      <div className="w-10 h-10 rounded-lg luxury-gradient flex items-center justify-center flex-shrink-0"><Icon className={`w-5 h-5 ${color}`} /></div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-muted-foreground">{label}</div>
        <div className="font-medium truncate">{value || '—'}</div>
      </div>
    </div>
  );

  // الأعضاء الذين تواصل معهم (لعرض الدردشات الفردية)
  const partnerIds = new Set();
  (data.messages || []).forEach(m => {
    const other = m.sender_id === userId ? m.receiver_id : m.sender_id;
    if (other) partnerIds.add(other);
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="luxury-gradient text-white sticky top-0 z-30 border-b border-accent/20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={()=>router.push('/admin')} className="text-white hover:bg-white/10"><ArrowRight className="w-5 h-5"/></Button>
          <Shield className="w-6 h-6 text-accent"/>
          <div className="flex-1">
            <div className="font-bold">ملف العضو الذكي</div>
            <div className="text-[10px] text-stone-400 font-mono">{userId}</div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-5">
        {/* بطاقة الهوية */}
        <Card className="luxury-gradient text-white overflow-hidden border-accent/30">
          <CardContent className="p-6">
            <div className="flex items-start gap-5 flex-wrap">
              <div className="w-24 h-24 rounded-2xl bg-white/10 gold-border flex items-center justify-center text-5xl text-accent overflow-hidden">
                {p.profile_picture_url ? <img src={p.profile_picture_url} alt="" className="w-full h-full object-cover"/> : (p.display_name?.[0] || '?')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h1 className="text-2xl font-bold">{p.display_name || 'بدون اسم'}</h1>
                  {p.is_verified && <Badge className="bg-green-600"><CheckCircle2 className="w-3 h-3 ml-1"/>موثّق</Badge>}
                  {p.subscription_status?.startsWith('VIP') && <Badge className="bg-accent text-foreground"><Crown className="w-3 h-3 ml-1"/>VIP</Badge>}
                  {p.role!=='user' && <Badge className="bg-stone-700">{p.role}</Badge>}
                  {['banned_temp','banned_permanent'].includes(p.account_status) && <Badge variant="destructive">محظور</Badge>}
                </div>
                <div className="text-stone-300 text-sm space-y-0.5">
                  <div>{p.age && `${p.age} سنة • `}{p.gender === 'male' ? 'ذكر' : p.gender === 'female' ? 'أنثى' : '—'} • {p.country || '—'}</div>
                  <div className="text-xs text-stone-400">{p.email}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {!p.is_verified && <Button onClick={()=>act('verify')} className="bg-green-600 hover:bg-green-700 text-white"><CheckCircle2 className="w-4 h-4 ml-1"/>توثيق</Button>}
                {p.is_verified && <Button variant="outline" onClick={()=>act('unverify')} className="text-white border-white/20 hover:bg-white/10">إلغاء توثيق</Button>}
                {!['banned_temp','banned_permanent'].includes(p.account_status) ? <Button onClick={()=>act('ban',{permanent:false})} className="bg-amber-600 hover:bg-amber-700"><Ban className="w-4 h-4 ml-1"/>حظر</Button> : <Button onClick={()=>act('unban')} className="bg-green-600">فك الحظر</Button>}
                <Button onClick={()=>setNotifyOpen(true)} variant="outline" className="text-white border-white/20 hover:bg-white/10"><Send className="w-4 h-4 ml-1"/>إشعار</Button>
                {me.role==='super_admin' && p.subscription_status !== 'VIP_MANUAL' && <Button onClick={()=>act('vip-grant',{identifier:p.id})} className="bg-accent text-foreground gold-glow"><Crown className="w-4 h-4 ml-1"/>منح VIP</Button>}
                {me.role==='super_admin' && p.role!=='super_admin' && <Button onClick={()=>{ if(confirm('حذف نهائي؟')) act('delete-user'); }} variant="destructive"><Trash2 className="w-4 h-4"/></Button>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* أيقونات المعلومات المنظمة */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <InfoIcon icon={Mail} label="البريد الإلكتروني" value={p.email}/>
          <InfoIcon icon={Phone} label="رقم الهاتف" value={p.phone_number}/>
          <InfoIcon icon={Cake} label="العمر" value={p.age && `${p.age} سنة`}/>
          <InfoIcon icon={User} label="الجنس" value={p.gender === 'male' ? 'ذكر' : p.gender === 'female' ? 'أنثى' : null}/>
          <InfoIcon icon={Globe2} label="الدولة" value={p.country}/>
          <InfoIcon icon={Heart} label="هدف الزواج" value={p.marriage_goal}/>
          <InfoIcon icon={Calendar} label="تاريخ التسجيل" value={new Date(p.created_at).toLocaleDateString('ar')}/>
          <InfoIcon icon={Crown} label="الاشتراك" value={p.subscription_status}/>
        </div>

        {/* النبذة + الاهتمامات */}
        <Card><CardContent className="p-5 space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">النبذة الذاتية</Label>
            <p className="text-sm mt-1 leading-relaxed">{p.bio || 'لا توجد نبذة'}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">الاهتمامات</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">{(p.interests||[]).map(i=>(<Badge key={i} variant="outline" className="gold-border">{i}</Badge>))} {(!p.interests || p.interests.length===0) && <span className="text-xs text-muted-foreground">—</span>}</div>
          </div>
        </CardContent></Card>

        <Tabs defaultValue="identity">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="identity"><FileText className="w-4 h-4 ml-1"/>التحقق KYC</TabsTrigger>
            <TabsTrigger value="chats"><MessageSquare className="w-4 h-4 ml-1"/>المحادثات ({data.messageCount})</TabsTrigger>
            <TabsTrigger value="photos"><ImageIcon className="w-4 h-4 ml-1"/>الصور المرسلة ({(data.photos||[]).length})</TabsTrigger>
            <TabsTrigger value="gifts"><GiftIcon className="w-4 h-4 ml-1"/>الهدايا</TabsTrigger>
            <TabsTrigger value="leaks"><AlertTriangle className="w-4 h-4 ml-1 text-destructive"/>محاولات التسريب ({(data.leaks||[]).length})</TabsTrigger>
            <TabsTrigger value="ai"><Coffee className="w-4 h-4 ml-1"/>ملاذ الروح</TabsTrigger>
          </TabsList>

          <TabsContent value="identity">
            <Card><CardContent className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-bold mb-2 flex items-center gap-2"><Camera className="w-4 h-4 text-accent"/>سيلفي التحقّق الحيوي</h4>
                  {data.kycSelfieUrl ? <img src={data.kycSelfieUrl} alt="selfie" className="rounded-2xl gold-border w-full max-w-md cursor-pointer" onClick={()=>setViewImage(data.kycSelfieUrl)}/> : <div className="text-sm text-muted-foreground p-8 bg-muted rounded-2xl text-center">لا توجد صورة</div>}
                </div>
                <div>
                  <h4 className="font-bold mb-2 flex items-center gap-2"><FileText className="w-4 h-4 text-accent"/>وثيقة الهوية</h4>
                  {data.kycDocUrl ? <img src={data.kycDocUrl} alt="doc" className="rounded-2xl gold-border w-full max-w-md cursor-pointer" onClick={()=>setViewImage(data.kycDocUrl)}/> : <div className="text-sm text-muted-foreground p-8 bg-muted rounded-2xl text-center">لم يتم رفع وثيقة</div>}
                </div>
              </div>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="chats">
            <Card><CardContent className="p-5">
              <h4 className="font-bold mb-3">المحادثات الفردية مع الأعضاء (مراقبة)</h4>
              {partnerIds.size === 0 ? <div className="text-center py-8 text-muted-foreground text-sm">لا توجد محادثات</div> : (
                <div className="space-y-2">
                  {[...partnerIds].map(pid=>(
                    <div key={pid} className="flex items-center gap-3 p-3 border rounded-xl hover:bg-muted/30">
                      <MessageSquare className="w-5 h-5 text-accent"/>
                      <div className="flex-1 text-sm">محادثة مع <span className="font-mono text-xs">{pid.slice(0,8)}…</span></div>
                      <Button size="sm" variant="outline" onClick={()=>loadChatThread(pid)}>عرض</Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="photos">
            <Card><CardContent className="p-5">
              <h4 className="font-bold mb-3">سجل الصور (واردة + صادرة)</h4>
              {(data.photos||[]).length === 0 ? <div className="text-center py-8 text-muted-foreground text-sm">لا توجد صور</div> : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {data.photos.map(ph=>(
                    <div key={ph.id} className="rounded-xl border overflow-hidden bg-card">
                      <div className="aspect-square bg-muted flex items-center justify-center cursor-pointer" onClick={()=>viewPhotoUrl(ph.id)}>
                        <ImageIcon className="w-8 h-8 text-muted-foreground"/>
                      </div>
                      <div className="p-2 text-xs">
                        <Badge variant={ph.status==='approved'?'default':ph.status==='rejected'?'destructive':'outline'} className="text-[10px]">{ph.status}</Badge>
                        <div className="text-muted-foreground mt-1">{ph.sender_id===userId ? '↗ صادرة' : '↙ واردة'}</div>
                        <div className="text-[10px] text-muted-foreground">{new Date(ph.created_at).toLocaleDateString('ar')}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="gifts">
            <Card><CardContent className="p-5">
              <h4 className="font-bold mb-3">الهدايا المرسلة</h4>
              {(data.gifts||[]).length === 0 ? <div className="text-center py-8 text-muted-foreground text-sm">لا توجد هدايا</div> : (
                <div className="space-y-2">
                  {data.gifts.map(g=>(
                    <div key={g.id} className="flex items-center gap-3 p-3 border rounded-xl">
                      <div className="text-2xl">{g.gift_emoji || '🎁'}</div>
                      <div className="flex-1"><div className="font-medium">{g.gift_type}</div><div className="text-xs text-muted-foreground">إلى: {g.receiver?.display_name || g.receiver_id?.slice(0,8)}</div></div>
                      <div className="text-xs text-muted-foreground">{new Date(g.created_at).toLocaleDateString('ar')}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="leaks">
            <Card><CardContent className="p-5">
              <h4 className="font-bold mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-destructive"/>محاولات تسريب الأرقام / السوشال</h4>
              {(data.leaks||[]).length === 0 ? <div className="text-center py-8 text-muted-foreground text-sm">لا توجد محاولات (سجل نظيف ✨)</div> : (
                <div className="space-y-2">
                  {data.leaks.map(l=>(
                    <div key={l.id} className="p-3 border rounded-xl bg-destructive/5">
                      <div className="flex justify-between items-start mb-1">
                        <Badge variant={l.severity==='high'?'destructive':l.severity==='medium'?'default':'outline'}>{l.severity}</Badge>
                        <span className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString('ar')}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">السياق: {l.context}</div>
                      <div className="text-xs mt-1">المحجوب: <span className="font-mono text-destructive">{(l.blocked_matches||[]).join(' | ')}</span></div>
                      <div className="text-xs mt-1 italic">النص: {l.original_content}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="ai">
            <Card><CardContent className="p-5">
              <h4 className="font-bold mb-3 flex items-center gap-2"><Coffee className="w-4 h-4 text-accent"/>محادثات ملاذ الروح (Soul Cafe)</h4>
              {(data.aiConvs||[]).length === 0 ? <div className="text-center py-8 text-muted-foreground text-sm">لا توجد محادثات</div> : (
                <div className="space-y-2">
                  {data.aiConvs.map(c=>(
                    <div key={c.id} className="flex items-center gap-3 p-3 border rounded-xl">
                      <Coffee className="w-5 h-5 text-accent"/>
                      <div className="flex-1"><div className="font-medium">{c.persona_id}</div><div className="text-xs text-muted-foreground">آخر تفاعل: {new Date(c.updated_at).toLocaleString('ar')}</div></div>
                      {c.in_vault && <Badge variant="outline" className="gold-border"><Lock className="w-3 h-3 ml-1"/>سرية</Badge>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Image Viewer */}
      <Dialog open={!!viewImage} onOpenChange={()=>setViewImage(null)}>
        <DialogContent className="max-w-2xl" dir="rtl"><DialogHeader><DialogTitle>عرض الصورة</DialogTitle></DialogHeader>{viewImage && <img src={viewImage} alt="" className="w-full rounded-xl"/>}</DialogContent>
      </Dialog>

      {/* Chat Thread Viewer */}
      <Dialog open={!!chatModal} onOpenChange={()=>setChatModal(null)}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader><DialogTitle>سجل المحادثة الكامل</DialogTitle></DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-2 bg-stone-50 p-3 rounded-xl">
            {chatMessages.map(m=>(
              <div key={m.id} className={`flex ${m.sender_id===userId?'justify-end':'justify-start'}`}>
                <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${m.sender_id===userId?'bg-foreground text-background':'bg-white border'} ${m.is_deleted_by_user?'opacity-60 italic':''}`}>
                  {m.content}
                  {m.is_deleted_by_user && <div className="text-[10px] mt-1">(محذوفة من المستخدم - مرئية للأدمن فقط)</div>}
                </div>
              </div>
            ))}
            {chatMessages.length===0 && <div className="text-center text-muted-foreground py-6">لا توجد رسائل</div>}
          </div>
        </DialogContent>
      </Dialog>

      {/* Notify */}
      <Dialog open={notifyOpen} onOpenChange={setNotifyOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>إرسال إشعار خاص</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>العنوان</Label><Input value={notifyData.title} onChange={e=>setNotifyData({...notifyData, title: e.target.value})}/></div>
            <div><Label>الرسالة</Label><Textarea rows={4} value={notifyData.body} onChange={e=>setNotifyData({...notifyData, body: e.target.value})}/></div>
            <Button onClick={sendNotify} className="w-full bg-foreground text-background">إرسال</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
