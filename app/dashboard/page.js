'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { Heart, Sparkles, Bell, Settings, MessageCircle, Plus, Gift, LogOut, Crown, ShieldCheck, Coffee, Loader2 } from 'lucide-react';

const BG_STYLES = [
  { id:'gradient-charcoal', cls:'gradient-charcoal', label:'فحمي' },
  { id:'gradient-burgundy', cls:'gradient-burgundy', label:'عنابي' },
  { id:'gradient-emerald',  cls:'gradient-emerald',  label:'زمردي' },
  { id:'gradient-navy',     cls:'gradient-navy',     label:'لاجوردي' },
  { id:'gradient-rose',     cls:'gradient-rose',     label:'وردي' },
  { id:'gradient-gold',     cls:'gradient-gold',     label:'ذهبي' },
];

export default function Dashboard() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const [profile, setProfile] = useState(null);
  const [cards, setCards] = useState([]);
  const [members, setMembers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newCard, setNewCard] = useState({ content: '', background_style: 'gradient-charcoal' });
  const [openCard, setOpenCard] = useState(false);
  const [savingCard, setSavingCard] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/'); return; }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
      if (!p) { router.push('/'); return; }
      if (!p.onboarding_completed) { router.push('/onboarding'); return; }
      if (!p.is_verified && p.role === 'user') { router.push('/waiting'); return; }
      setProfile(p);
      await loadAll(p);
      setLoading(false);

      // Realtime: بطاقات جديدة
      const ch1 = supabase.channel('mc-live').on('postgres_changes', { event: '*', schema: 'public', table: 'mindset_cards' }, () => loadCards()).subscribe();
      const ch2 = supabase.channel(`notif-${session.user.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${session.user.id}` }, (payload) => {
        setNotifications(n => [payload.new, ...n]);
        toast(payload.new.title, { description: payload.new.body });
      }).subscribe();
      return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
    })();
  }, [router, supabase]);

  const loadAll = async (p) => {
    await Promise.all([loadCards(), loadMembers(p), loadNotifications(p)]);
  };

  const loadCards = async () => {
    const { data } = await supabase
      .from('mindset_cards')
      .select('id, content, background_style, created_at, user_id, profiles(display_name)')
      .order('created_at', { ascending: false }).limit(40);
    setCards(data || []);
  };

  const loadMembers = async (p) => {
    const oppositeGender = p.gender === 'male' ? 'female' : 'male';
    const { data } = await supabase.from('profiles')
      .select('id, display_name, age, country, bio, marriage_goal, profile_picture_url, subscription_status')
      .eq('is_verified', true).eq('gender', oppositeGender).neq('id', p.id).limit(20);
    setMembers(data || []);
  };

  const loadNotifications = async (p) => {
    const { data } = await supabase.from('notifications')
      .select('*').eq('user_id', p.id).order('created_at', { ascending: false }).limit(20);
    setNotifications(data || []);
  };

  const createCard = async () => {
    if (!newCard.content || newCard.content.length < 3) return toast.error('اكتب فكرتك');
    if (newCard.content.length > 280) return toast.error('الحد الأقصى 280 حرف');
    setSavingCard(true);
    const { error } = await supabase.from('mindset_cards').insert({
      user_id: profile.id, content: newCard.content, background_style: newCard.background_style
    });
    setSavingCard(false);
    if (error) return toast.error('خطأ: ' + error.message);
    setNewCard({ content:'', background_style:'gradient-charcoal' });
    setOpenCard(false);
    toast.success('تم نشر بطاقتك (تختفي خلال 24 ساعة)');
    loadCards();
  };

  const markAllRead = async () => {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', profile.id).eq('is_read', false);
    setNotifications(n => n.map(x => ({ ...x, is_read: true })));
  };

  const signOut = async () => { await supabase.auth.signOut(); router.push('/'); };

  if (loading || !profile) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-accent"/></div>;

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const isVip = profile.subscription_status === 'VIP_MANUAL' || profile.subscription_status === 'VIP';

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <a href="/dashboard" className="inline-flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-foreground flex items-center justify-center">
              <Heart className="w-4 h-4 text-accent" strokeWidth={1.6}/>
            </div>
            <div className="hidden sm:block text-right leading-tight">
              <div className="text-lg font-bold gold-text" style={{fontFamily:'Cormorant Garamond'}}>Vayah</div>
              <div className="text-[10px] text-muted-foreground -mt-0.5">وَيَّاه</div>
            </div>
          </a>
          <div className="flex items-center gap-1">
            {isVip && <Badge className="bg-accent text-accent-foreground gap-1 hidden sm:inline-flex"><Crown className="w-3 h-3"/>VIP</Badge>}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="w-5 h-5"/>
                  {unreadCount>0 && <span className="absolute top-1 left-1 bg-destructive text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{unreadCount}</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-80 p-0">
                <div className="p-3 border-b flex justify-between items-center">
                  <h3 className="font-semibold text-sm">الإشعارات</h3>
                  {unreadCount>0 && <button onClick={markAllRead} className="text-xs text-accent hover:underline">تحديد الكل كمقروء</button>}
                </div>
                <div className="max-h-80 overflow-auto">
                  {notifications.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">لا توجد إشعارات</div>}
                  {notifications.map(n=>(
                    <div key={n.id} className={`p-3 border-b text-sm ${!n.is_read ? 'bg-accent/5' : ''}`}>
                      <div className="flex items-start gap-2">
                        {n.from_admin && <ShieldCheck className="w-4 h-4 text-accent flex-shrink-0 mt-0.5"/>}
                        <div className="flex-1">
                          <div className="font-medium">{n.title}</div>
                          {n.body && <div className="text-muted-foreground text-xs mt-0.5">{n.body}</div>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="icon" onClick={()=>router.push('/profile')}><Settings className="w-5 h-5"/></Button>
            <Button variant="ghost" size="icon" onClick={signOut} className="text-muted-foreground hover:text-destructive"><LogOut className="w-5 h-5"/></Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-8">
        {/* Welcome */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">أهلاً بك ، <span className="gold-text">{profile.display_name}</span></h1>
            <p className="text-sm text-muted-foreground mt-1">حسابك موثوق · أهلاً بك في عالم ويّاه</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={()=>router.push('/soul-cafe')} variant="outline" className="gold-border"><Coffee className="w-4 h-4 ml-1.5"/>مقهى الروح</Button>
            <Button onClick={()=>router.push('/messages')} variant="outline"><MessageCircle className="w-4 h-4 ml-1.5"/>المحادثات</Button>
          </div>
        </div>

        {/* Mindset Cards Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2"><Sparkles className="w-5 h-5 text-accent"/>بطاقات الحالة الفكرية</h2>
              <p className="text-xs text-muted-foreground">تختفي تلقائياً خلال 24 ساعة</p>
            </div>
            <Dialog open={openCard} onOpenChange={setOpenCard}>
              <DialogTrigger asChild><Button className="bg-foreground text-background hover:bg-foreground/90"><Plus className="w-4 h-4 ml-1"/>جديد</Button></DialogTrigger>
              <DialogContent className="max-w-md" dir="rtl">
                <DialogHeader><DialogTitle>بطاقة حالة فكرية</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <Textarea rows={4} maxLength={280} value={newCard.content} onChange={e=>setNewCard({...newCard, content: e.target.value})} placeholder="اكتب فكرتك أو مبدأك في الحياة والارتباط..." />
                  <div className="text-xs text-muted-foreground text-left">{newCard.content.length}/280</div>
                  <div>
                    <div className="text-sm font-medium mb-2">اختر الخلفية</div>
                    <div className="grid grid-cols-3 gap-2">
                      {BG_STYLES.map(b=>(
                        <button key={b.id} type="button" onClick={()=>setNewCard({...newCard, background_style:b.id})}
                          className={`${b.cls} h-16 rounded-lg text-white text-xs flex items-center justify-center transition ${newCard.background_style===b.id?'ring-2 ring-accent gold-glow':''}`}>
                          {b.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Preview */}
                  <div className={`${BG_STYLES.find(b=>b.id===newCard.background_style)?.cls} rounded-2xl p-6 min-h-32 flex items-center justify-center text-white text-center text-lg font-medium`}>
                    {newCard.content || 'معاينة بطاقتك...'}
                  </div>
                  <Button onClick={createCard} disabled={savingCard} className="w-full bg-foreground text-background">
                    {savingCard ? <Loader2 className="w-4 h-4 animate-spin"/> : 'نشر البطاقة'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          {cards.length === 0 ? (
            <Card className="premium-shadow"><CardContent className="p-12 text-center text-muted-foreground">
              <Sparkles className="w-10 h-10 mx-auto mb-3 text-accent/50"/>
              <p>لا توجد بطاقات حاليًا. كن أول من يشارك فكرة.</p>
            </CardContent></Card>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {cards.map(c=>(
                <div key={c.id} className={`${c.background_style || 'gradient-charcoal'} rounded-2xl p-5 aspect-square flex flex-col justify-between text-white premium-shadow hover:scale-[1.02] transition`}>
                  <p className="text-sm md:text-base leading-relaxed">{c.content}</p>
                  <div className="text-xs text-white/70 mt-2">— {c.profiles?.display_name || 'عضو'}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Members Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2"><Heart className="w-5 h-5 text-accent"/>أعضاء موثوقون</h2>
          </div>
          {members.length === 0 ? (
            <Card><CardContent className="p-10 text-center text-muted-foreground">لا يوجد أعضاء حالياً. عد لاحقاً.</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {members.map(m=>(
                <Card key={m.id} className="premium-shadow hover:shadow-lg transition cursor-pointer" onClick={()=>router.push(`/messages?to=${m.id}`)}>
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-14 h-14 gold-border"><AvatarFallback className="luxury-gradient text-accent text-lg">{m.display_name?.[0]}</AvatarFallback></Avatar>
                      <div className="flex-1">
                        <div className="font-semibold flex items-center gap-1.5">
                          {m.display_name}, {m.age}
                          {m.subscription_status==='VIP_MANUAL' && <Crown className="w-3.5 h-3.5 text-accent"/>}
                        </div>
                        <div className="text-xs text-muted-foreground">{m.country}</div>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground line-clamp-2">{m.bio}</div>
                    <Badge variant="outline" className="gold-border text-xs">{m.marriage_goal}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Bottom Nav Mobile */}
      <nav className="fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur-md border-t border-border md:hidden z-40">
        <div className="grid grid-cols-4 max-w-md mx-auto">
          <button onClick={()=>router.push('/dashboard')} className="py-3 text-center"><Heart className="w-5 h-5 mx-auto text-accent"/><div className="text-[10px] mt-0.5">الرئيسية</div></button>
          <button onClick={()=>router.push('/soul-cafe')} className="py-3 text-center"><Coffee className="w-5 h-5 mx-auto"/><div className="text-[10px] mt-0.5">مقهى</div></button>
          <button onClick={()=>router.push('/messages')} className="py-3 text-center"><MessageCircle className="w-5 h-5 mx-auto"/><div className="text-[10px] mt-0.5">رسائل</div></button>
          <button onClick={()=>router.push('/profile')} className="py-3 text-center"><Settings className="w-5 h-5 mx-auto"/><div className="text-[10px] mt-0.5">إعدادات</div></button>
        </div>
      </nav>
    </div>
  );
}
