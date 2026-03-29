import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BreathingLine } from './components/BreathingLine';
import { useAuth } from './contexts/AuthContext';
import { supabase, Tombstone, Message, TombShape } from './lib/supabase';

type Page = 'index' | 'create' | 'detail' | 'messages' | 'share' | 'access';

const SHAPES: { id: TombShape; label: string; style: string }[] = [
  { id: 'arch', label: '穹顶', style: 'rounded-t-full' },
  { id: 'rect', label: '方正', style: 'rounded-none' },
  { id: 'pillar', label: '立柱', style: 'w-24 h-48' },
  { id: 'rounded', label: '圆融', style: 'rounded-3xl' },
];

function generateShareCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ─── Auth Screen ──────────────────────────────────────────────────────────────

function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [signupDone, setSignupDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'signin') {
        await signIn(email, password);
      } else {
        await signUp(email, password);
        setSignupDone(true);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1A1A1D] text-[#F5F5F5] flex flex-col items-center justify-center p-8 font-sans overflow-hidden">
      <BreathingLine />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.5, ease: 'easeOut' }}
        className="text-center space-y-16 max-w-xs w-full relative z-10"
      >
        <div className="space-y-4">
          <h1 className="text-4xl tracking-[0.5em] font-extralight">归处</h1>
          <div className="h-[1px] w-12 bg-[#C0C6CF] mx-auto opacity-30" />
          <p className="text-[#999999] text-[10px] tracking-[0.6em] uppercase font-light">
            The Return / Digital Memorial
          </p>
        </div>

        {signupDone ? (
          <div className="space-y-6">
            <p className="text-[#999999] text-xs tracking-[0.3em] font-light leading-loose">
              注册成功。<br />请查收邮件并验证后登录。
            </p>
            <button
              onClick={() => { setMode('signin'); setSignupDone(false); }}
              className="text-[10px] tracking-[0.4em] uppercase text-[#F5F5F5]/50 hover:text-[#F5F5F5] transition-colors"
            >
              返回登录
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-6">
              <div className="space-y-2 text-left">
                <label className="text-[#999999] text-[9px] tracking-[0.5em] uppercase font-light">
                  邮箱 / Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full bg-transparent border-b border-[#C0C6CF]/20 py-3 text-sm focus:border-[#F5F5F5] outline-none transition-colors font-light tracking-wider"
                />
              </div>
              <div className="space-y-2 text-left">
                <label className="text-[#999999] text-[9px] tracking-[0.5em] uppercase font-light">
                  密码 / Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full bg-transparent border-b border-[#C0C6CF]/20 py-3 text-sm focus:border-[#F5F5F5] outline-none transition-colors font-light tracking-wider"
                />
              </div>
            </div>

            {error && (
              <p className="text-[#C0C6CF]/70 text-[9px] tracking-[0.3em] text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="group relative w-full py-5 overflow-hidden border border-[#C0C6CF]/30 transition-all duration-700 hover:border-[#F5F5F5] disabled:opacity-40"
            >
              <span className="relative z-10 text-[10px] tracking-[0.5em] uppercase font-light group-hover:text-[#1A1A1D] transition-colors duration-500">
                {loading ? '···' : mode === 'signin' ? '开启访问' : '建立账户'}
              </span>
              <motion.div className="absolute inset-0 bg-[#F5F5F5] -translate-x-full group-hover:translate-x-0 transition-transform duration-700 ease-in-out" />
            </button>

            <button
              type="button"
              onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}
              className="block w-full text-[9px] tracking-[0.4em] uppercase text-[#999999] hover:text-[#F5F5F5] transition-colors"
            >
              {mode === 'signin' ? '没有账户？注册' : '已有账户？登录'}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}

// ─── Access Screen (通过分享码访问) ──────────────────────────────────────────

function AccessScreen({ onFound }: { onFound: (tomb: Tombstone) => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { data, error: dbErr } = await supabase
      .from('tombstones')
      .select('*')
      .eq('share_code', code.trim())
      .single();
    setLoading(false);
    if (dbErr || !data) {
      setError('未找到对应的纪念空间，请确认访问码是否正确');
      return;
    }
    onFound(data as Tombstone);
  };

  return (
    <div className="min-h-screen bg-[#1A1A1D] text-[#F5F5F5] flex flex-col items-center justify-center p-8 font-sans overflow-hidden">
      <BreathingLine />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        className="text-center space-y-16 max-w-xs w-full relative z-10"
      >
        <div className="space-y-4">
          <h1 className="text-4xl tracking-[0.5em] font-extralight">归处</h1>
          <div className="h-[1px] w-12 bg-[#C0C6CF] mx-auto opacity-30" />
          <p className="text-[#999999] text-[10px] tracking-[0.6em] uppercase font-light">
            Private Access / 私密访问
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-3 text-left">
            <label className="text-[#999999] text-[9px] tracking-[0.5em] uppercase font-light">
              访问码 / Access Code
            </label>
            <input
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="请输入六位访问码"
              maxLength={6}
              required
              className="w-full bg-transparent border-b border-[#C0C6CF]/20 py-3 text-2xl tracking-[0.4em] text-center focus:border-[#F5F5F5] outline-none transition-colors font-extralight"
            />
          </div>
          {error && (
            <p className="text-[#C0C6CF]/70 text-[9px] tracking-[0.3em] text-center">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="group relative w-full py-5 overflow-hidden border border-[#C0C6CF]/30 transition-all duration-700 hover:border-[#F5F5F5] disabled:opacity-40"
          >
            <span className="relative z-10 text-[10px] tracking-[0.5em] uppercase font-light group-hover:text-[#1A1A1D] transition-colors duration-500">
              {loading ? '···' : '进入'}
            </span>
            <motion.div className="absolute inset-0 bg-[#F5F5F5] -translate-x-full group-hover:translate-x-0 transition-transform duration-700 ease-in-out" />
          </button>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const { user, loading: authLoading, signOut } = useAuth();

  const [currentPage, setCurrentPage] = useState<Page>('index');
  const [history, setHistory] = useState<Page[]>(['index']);
  const [tombstones, setTombstones] = useState<Tombstone[]>([]);
  const [selectedTombId, setSelectedTombId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [guestTomb, setGuestTomb] = useState<Tombstone | null>(null);

  // Create Form State
  const [tempImageFiles, setTempImageFiles] = useState<File[]>([]);
  const [tempImagePreviews, setTempImagePreviews] = useState<string[]>([]);
  const [selectedShape, setSelectedShape] = useState<TombShape>('arch');
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Navigation ──────────────────────────────────────────────────────────────

  const navigate = (page: Page, params?: { id?: string }) => {
    if (params?.id) setSelectedTombId(params.id);
    setHistory(prev => [...prev, page]);
    setCurrentPage(page);
  };

  const goBack = () => {
    if (history.length > 1) {
      const newHistory = [...history];
      newHistory.pop();
      setHistory(newHistory);
      setCurrentPage(newHistory[newHistory.length - 1]);
    }
  };

  // ── Data Fetching ────────────────────────────────────────────────────────────

  const fetchTombstones = useCallback(async () => {
    if (!user) return;
    setDataLoading(true);
    const { data } = await supabase
      .from('tombstones')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setTombstones((data as Tombstone[]) ?? []);
    setDataLoading(false);
  }, [user]);

  const fetchMessages = useCallback(async (tombId: string) => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('tomb_id', tombId)
      .order('created_at', { ascending: false });
    setMessages((data as Message[]) ?? []);
  }, []);

  useEffect(() => {
    fetchTombstones();
  }, [fetchTombstones]);

  useEffect(() => {
    if (selectedTombId) fetchMessages(selectedTombId);
  }, [selectedTombId, fetchMessages]);

  // ── Image Upload ─────────────────────────────────────────────────────────────

  const MAX_IMAGES = 3;

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const remaining = MAX_IMAGES - tempImageFiles.length;
    if (remaining <= 0) return;
    const newFiles = Array.from(files).slice(0, remaining);
    setTempImageFiles(prev => [...prev, ...newFiles]);
    const previews = newFiles.map(f => URL.createObjectURL(f as Blob));
    setTempImagePreviews(prev => [...prev, ...previews]);
    e.target.value = '';
  };

  const removeImage = (idx: number) => {
    URL.revokeObjectURL(tempImagePreviews[idx]);
    setTempImageFiles(prev => prev.filter((_, i) => i !== idx));
    setTempImagePreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const uploadImages = async (userId: string): Promise<string[]> => {
    const urls: string[] = [];
    for (const file of tempImageFiles) {
      const ext = file.name.split('.').pop();
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage
        .from('memorial-images')
        .upload(path, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage
        .from('memorial-images')
        .getPublicUrl(path);
      urls.push(publicUrl);
    }
    return urls;
  };

  // ── Create Tombstone ─────────────────────────────────────────────────────────

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      const formData = new FormData(e.currentTarget);
      const imageUrls = await uploadImages(user.id);
      const { error } = await supabase.from('tombstones').insert({
        user_id: user.id,
        name: formData.get('name') as string,
        birth_date: formData.get('birthDate') as string,
        death_date: formData.get('deathDate') as string,
        epitaph: formData.get('epitaph') as string,
        images: imageUrls,
        shape: selectedShape,
        share_code: generateShareCode(),
      });
      if (error) throw error;
      tempImagePreviews.forEach(url => URL.revokeObjectURL(url));
      setTempImageFiles([]);
      setTempImagePreviews([]);
      setSelectedShape('arch');
      await fetchTombstones();
      navigate('index');
    } catch (err) {
      console.error('创建失败：', err);
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      alert(`创建失败：${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Send Message ─────────────────────────────────────────────────────────────

  const handleSendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input = e.currentTarget.elements.namedItem('message') as HTMLInputElement;
    const text = input.value.trim();
    if (!text || !selectedTombId) return;
    const { error } = await supabase.from('messages').insert({
      tomb_id: selectedTombId,
      text,
    });
    if (!error) {
      input.value = '';
      await fetchMessages(selectedTombId);
    }
  };

  // ── Copy share link ──────────────────────────────────────────────────────────

  const copyShareLink = (shareCode: string) => {
    const url = `${window.location.origin}?access=${shareCode}`;
    navigator.clipboard.writeText(url).catch(() => {});
  };

  // ── Handle access code in URL ────────────────────────────────────────────────

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('access');
    if (code) {
      supabase
        .from('tombstones')
        .select('*')
        .eq('share_code', code)
        .single()
        .then(({ data }) => {
          if (data) {
            setGuestTomb(data as Tombstone);
          }
        });
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#1A1A1D] flex items-center justify-center">
        <BreathingLine />
      </div>
    );
  }

  // 游客通过分享码访问时，直接展示该纪念页
  if (guestTomb) {
    return <GuestView tomb={guestTomb} onBack={() => setGuestTomb(null)} />;
  }

  // 未登录时，检查 URL 是否有访问码，没有则进入认证
  if (!user) {
    const params = new URLSearchParams(window.location.search);
    if (params.get('access')) {
      return <AccessScreen onFound={tomb => setGuestTomb(tomb)} />;
    }
    return <AuthScreen />;
  }

  const selectedTomb = tombstones.find(t => t.id === selectedTombId);

  return (
    <div className="min-h-screen bg-[#1A1A1D] text-[#F5F5F5] font-sans selection:bg-[#C0C6CF] selection:text-[#1A1A1D] overflow-x-hidden">
      <BreathingLine />

      <AnimatePresence mode="wait">
        <motion.main
          key={currentPage}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="min-h-screen p-8 md:p-24 max-w-5xl mx-auto relative z-10 flex flex-col"
        >
          {/* Top Navigation */}
          <nav className="flex justify-between items-center mb-20">
            {currentPage !== 'index' ? (
              <button
                onClick={goBack}
                className="text-[#999999] text-[10px] tracking-[0.3em] uppercase hover:text-[#F5F5F5] transition-colors flex items-center gap-2"
              >
                <span className="text-lg font-thin">←</span> 返回
              </button>
            ) : (
              <div className="text-[#999999] text-[10px] tracking-[0.3em] uppercase opacity-50">
                Index / 索引
              </div>
            )}
            <div className="flex items-center gap-6">
              <div className="text-[10px] tracking-[0.3em] text-[#999999] uppercase">
                {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
              <button
                onClick={signOut}
                className="text-[9px] tracking-[0.3em] uppercase text-[#999999]/40 hover:text-[#999999] transition-colors"
              >
                退出
              </button>
            </div>
          </nav>

          {/* Page Content */}
          <div className="flex-1">

            {/* ── Index Page ── */}
            {currentPage === 'index' && (
              <div className="space-y-24">
                <header className="space-y-6">
                  <div className="flex justify-between items-end">
                    <h1 className="text-4xl md:text-6xl tracking-[0.2em] font-extralight">归处</h1>
                    <button
                      onClick={() => {
                        setTempImageFiles([]);
                        setTempImagePreviews([]);
                        setSelectedShape('arch');
                        navigate('create');
                      }}
                      className="text-[10px] tracking-[0.4em] uppercase border border-[#C0C6CF]/30 px-6 py-2 hover:bg-[#F5F5F5] hover:text-[#1A1A1D] transition-all duration-500"
                    >
                      建立纪念 +
                    </button>
                  </div>
                  <p className="text-[#999999] text-[10px] tracking-[0.5em] uppercase font-light">
                    Quiet Space / 寂静之地
                  </p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-16">
                  {dataLoading ? (
                    <div className="col-span-full py-32 flex justify-center">
                      <p className="text-[#999999] text-[10px] tracking-[0.5em] font-light">···</p>
                    </div>
                  ) : tombstones.length === 0 ? (
                    <div className="col-span-full py-32 border-y border-[#C0C6CF]/10 flex flex-col items-center justify-center space-y-4">
                      <p className="text-[#999999] text-xs tracking-[0.4em] font-light italic">万籁俱寂</p>
                      <div className="h-[1px] w-8 bg-[#C0C6CF]/20" />
                    </div>
                  ) : (
                    tombstones.map((t, i) => (
                      <motion.div
                        key={t.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1, duration: 1 }}
                        onClick={() => navigate('detail', { id: t.id })}
                        className="group cursor-pointer space-y-6 border-b border-[#C0C6CF]/10 pb-8 hover:border-[#F5F5F5]/40 transition-colors"
                      >
                        <div className="aspect-[3/4] w-full bg-[#151517] overflow-hidden relative border border-[#C0C6CF]/5">
                          {t.images[0] ? (
                            <img
                              src={t.images[0]}
                              className="w-full h-full object-cover grayscale opacity-40 group-hover:opacity-60 transition-opacity duration-1000"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[8px] tracking-[0.5em] text-[#999999] uppercase opacity-20">
                              No Image
                            </div>
                          )}
                          <div className="absolute top-4 left-4 text-[9px] text-[#999999] tracking-widest font-mono">
                            0{i + 1}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <h2 className="text-2xl tracking-[0.2em] font-light group-hover:translate-x-2 transition-transform duration-1000 ease-out">
                            {t.name}
                          </h2>
                          <p className="text-[#999999] text-[10px] tracking-[0.3em] font-light uppercase">
                            {t.birth_date.replace(/-/g, '.')} — {t.death_date.replace(/-/g, '.')}
                          </p>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ── Create Page ── */}
            {currentPage === 'create' && (
              <div className="max-w-4xl space-y-16">
                <header className="space-y-4">
                  <h1 className="text-3xl tracking-[0.3em] font-extralight uppercase">建立纪念</h1>
                  <div className="h-[1px] w-full bg-gradient-to-r from-[#C0C6CF] to-transparent opacity-30" />
                </header>

                <form className="grid grid-cols-1 md:grid-cols-2 gap-16" onSubmit={handleCreate}>
                  {/* Left Column */}
                  <div className="space-y-10">
                    <div className="space-y-3">
                      <label className="text-[#999999] text-[10px] tracking-[0.5em] uppercase font-light">
                        姓名 / Name
                      </label>
                      <input
                        name="name"
                        required
                        className="w-full bg-transparent border-b border-[#C0C6CF]/20 py-3 text-lg focus:border-[#F5F5F5] outline-none transition-colors font-light tracking-widest"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-3">
                        <label className="text-[#999999] text-[10px] tracking-[0.5em] uppercase font-light">
                          出生 / Birth
                        </label>
                        <input
                          name="birthDate"
                          type="date"
                          required
                          className="w-full bg-transparent border-b border-[#C0C6CF]/20 py-3 text-sm focus:border-[#F5F5F5] outline-none transition-colors font-light"
                        />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[#999999] text-[10px] tracking-[0.5em] uppercase font-light">
                          离去 / Departure
                        </label>
                        <input
                          name="deathDate"
                          type="date"
                          required
                          className="w-full bg-transparent border-b border-[#C0C6CF]/20 py-3 text-sm focus:border-[#F5F5F5] outline-none transition-colors font-light"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[#999999] text-[10px] tracking-[0.5em] uppercase font-light">
                        墓志铭 / Epitaph
                      </label>
                      <textarea
                        name="epitaph"
                        rows={4}
                        required
                        className="w-full bg-transparent border-b border-[#C0C6CF]/20 py-3 text-sm focus:border-[#F5F5F5] outline-none transition-colors resize-none font-light leading-relaxed tracking-wide"
                      />
                    </div>

                    <div className="space-y-6">
                      <label className="text-[#999999] text-[10px] tracking-[0.5em] uppercase font-light">
                        选择形状 / Select Shape
                      </label>
                      <div className="grid grid-cols-4 gap-4">
                        {SHAPES.map(s => (
                          <div
                            key={s.id}
                            onClick={() => setSelectedShape(s.id)}
                            className={`aspect-square border flex flex-col items-center justify-center cursor-pointer transition-all duration-500 ${selectedShape === s.id ? 'border-[#F5F5F5] bg-[#F5F5F5]/5' : 'border-[#C0C6CF]/10 hover:border-[#C0C6CF]/30'}`}
                          >
                            <div className={`w-8 h-10 border border-[#C0C6CF]/40 mb-2 ${s.style}`} />
                            <span className="text-[8px] tracking-widest">{s.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-8">
                    <label className="text-[#999999] text-[10px] tracking-[0.5em] uppercase font-light">
                      影像 / Images
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      {tempImagePreviews.map((img, i) => (
                        <div
                          key={i}
                          className="aspect-square bg-[#151517] border border-[#C0C6CF]/10 overflow-hidden relative group"
                        >
                          <img src={img} className="w-full h-full object-cover grayscale opacity-60" />
                          <button
                            type="button"
                            onClick={() => removeImage(i)}
                            className="absolute inset-0 bg-[#1A1A1D]/80 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[8px] tracking-widest transition-opacity"
                          >
                            移除
                          </button>
                        </div>
                      ))}
                      {tempImagePreviews.length < MAX_IMAGES && (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="aspect-square border border-dashed border-[#C0C6CF]/20 flex flex-col items-center justify-center hover:border-[#F5F5F5]/40 transition-colors"
                        >
                          <span className="text-xl font-thin mb-2">+</span>
                          <span className="text-[8px] tracking-widest">添加图片</span>
                        </button>
                      )}
                    </div>
                    <p className="text-[#999999] text-[9px] tracking-[0.3em] font-light">
                      {tempImagePreviews.length} / {MAX_IMAGES} 张
                      {tempImagePreviews.length >= MAX_IMAGES && '　已达上限'}
                    </p>
                    <input
                      type="file"
                      ref={fileInputRef}
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageSelect}
                    />

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-5 border border-[#C0C6CF]/30 text-[10px] tracking-[0.5em] uppercase font-light hover:bg-[#F5F5F5] hover:text-[#1A1A1D] transition-all duration-700 mt-12 disabled:opacity-40"
                    >
                      {submitting ? '上传中···' : '完成建立 / Finalize'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ── Detail Page ── */}
            {currentPage === 'detail' && selectedTomb && (
              <TombDetail
                tomb={selectedTomb}
                onMessage={() => navigate('messages')}
                onShare={() => navigate('share')}
              />
            )}

            {/* ── Messages Page ── */}
            {currentPage === 'messages' && selectedTomb && (
              <div className="max-w-2xl space-y-16">
                <header className="space-y-4">
                  <h1 className="text-3xl tracking-[0.3em] font-extralight uppercase">留言板</h1>
                  <p className="text-[#999999] text-[10px] tracking-[0.5em] uppercase font-light">
                    Messages for {selectedTomb.name}
                  </p>
                  <div className="h-[1px] w-full bg-[#C0C6CF]/10" />
                </header>

                <div className="space-y-12 max-h-[50vh] overflow-y-auto pr-8 scrollbar-hide">
                  {messages.length === 0 ? (
                    <div className="py-20 text-center">
                      <p className="text-[#999999] text-xs tracking-[0.4em] font-light italic">尚无只言片语</p>
                    </div>
                  ) : (
                    messages.map((m, i) => (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="space-y-3 border-l border-[#C0C6CF]/10 pl-6 relative"
                      >
                        <div className="absolute left-[-1px] top-0 h-4 w-[1px] bg-[#F5F5F5]" />
                        <p className="text-sm font-light leading-relaxed tracking-wide text-[#F5F5F5]/80">
                          {m.text}
                        </p>
                        <span className="text-[9px] text-[#999999] tracking-[0.3em] uppercase block font-mono">
                          {new Date(m.created_at).toLocaleDateString('zh-CN', {
                            year: 'numeric', month: '2-digit', day: '2-digit'
                          }).replace(/\//g, '.')}
                        </span>
                      </motion.div>
                    ))
                  )}
                </div>

                <form className="pt-12 space-y-6" onSubmit={handleSendMessage}>
                  <div className="relative">
                    <input
                      name="message"
                      placeholder="在此输入..."
                      className="w-full bg-transparent border-b border-[#C0C6CF]/20 py-4 text-sm focus:border-[#F5F5F5] outline-none transition-all font-light tracking-widest placeholder:text-[#999999]/30"
                    />
                    <button
                      type="submit"
                      className="absolute right-0 bottom-4 text-[10px] tracking-[0.4em] uppercase text-[#999999] hover:text-[#F5F5F5] transition-colors"
                    >
                      发送 / Send
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ── Share Page ── */}
            {currentPage === 'share' && selectedTomb && (
              <div className="flex flex-col items-center justify-center space-y-24 py-20 text-center">
                <div className="space-y-6">
                  <h1 className="text-3xl tracking-[0.4em] font-extralight uppercase">私密分享</h1>
                  <div className="h-[1px] w-12 bg-[#C0C6CF] mx-auto opacity-30" />
                  <p className="text-[#999999] text-[10px] tracking-[0.6em] uppercase font-light">
                    Access Code
                  </p>
                </div>

                <div className="relative group">
                  <div className="text-6xl md:text-8xl tracking-[0.4em] font-extralight text-[#F5F5F5] pl-8">
                    {selectedTomb.share_code}
                  </div>
                  <div className="absolute -inset-8 border border-[#C0C6CF]/5 scale-110 group-hover:scale-100 transition-transform duration-1000" />
                </div>

                <div className="max-w-xs mx-auto space-y-8">
                  <p className="text-[#999999] text-[10px] leading-loose tracking-[0.4em] uppercase font-light">
                    请将此代码或链接分享给您信任的人。此纪念空间默认保持私密。
                  </p>
                  <button
                    onClick={() => copyShareLink(selectedTomb.share_code)}
                    className="w-full py-4 border border-[#C0C6CF]/20 text-[9px] tracking-[0.4em] uppercase font-light hover:bg-[#F5F5F5] hover:text-[#1A1A1D] transition-all duration-500"
                  >
                    复制访问链接 / Copy Link
                  </button>
                  <div className="flex justify-center gap-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-[1px] w-4 bg-[#C0C6CF]/20" />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <footer className="mt-auto pt-20 flex justify-between items-center text-[8px] tracking-[0.5em] text-[#999999] uppercase font-light opacity-30">
            <div>© 2026 THE RETURN / 归处</div>
            <div className="flex gap-8">
              <span>Privacy / 隐私</span>
              <span>Terms / 条款</span>
            </div>
          </footer>
        </motion.main>
      </AnimatePresence>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@200;300&display=swap');
        body { cursor: crosshair; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); opacity: 0.3; }
        ::selection { background: #C0C6CF; color: #1A1A1D; }
      `}</style>
    </div>
  );
}

// ─── Tomb Detail（登录用户 & 游客共用） ────────────────────────────────────────

function TombDetail({
  tomb,
  onMessage,
  onShare,
}: {
  tomb: Tombstone;
  onMessage: () => void;
  onShare?: () => void;
}) {
  const shapeStyle = SHAPES.find(s => s.id === tomb.shape)?.style ?? 'rounded-t-full';

  return (
    <div className="flex flex-col items-center text-center space-y-24 py-12">
      <div className="space-y-12 w-full max-w-2xl">
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 2, ease: 'easeOut' }}
          className={`mx-auto bg-[#151517] border border-[#C0C6CF]/20 relative overflow-hidden shadow-2xl shadow-black/50 ${shapeStyle} ${tomb.shape === 'pillar' ? 'w-48 h-80' : 'w-64 h-96 md:w-80 md:h-[30rem]'}`}
        >
          {tomb.images[0] ? (
            <img
              src={tomb.images[0]}
              className="w-full h-full object-cover grayscale opacity-30 mix-blend-luminosity"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[#999999] text-[9px] tracking-[0.8em] uppercase font-light opacity-20">VOID</span>
            </div>
          )}
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 space-y-6">
            <div className="h-[1px] w-8 bg-[#C0C6CF]/20" />
            <h1 className="text-3xl md:text-4xl tracking-[0.3em] font-extralight uppercase">{tomb.name}</h1>
            <div className="text-[#999999] text-[9px] tracking-[0.4em] font-light">
              {tomb.birth_date.split('-')[0]} — {tomb.death_date.split('-')[0]}
            </div>
            <div className="h-[1px] w-8 bg-[#C0C6CF]/20" />
          </div>
        </motion.div>

        <div className="space-y-4">
          <h2 className="text-4xl md:text-6xl tracking-[0.2em] font-extralight uppercase">{tomb.name}</h2>
          <div className="flex items-center justify-center gap-4 text-[#999999] text-[11px] tracking-[0.4em] font-light">
            <span>{tomb.birth_date.replace(/-/g, '.')}</span>
            <div className="h-[1px] w-6 bg-[#C0C6CF]/30" />
            <span>{tomb.death_date.replace(/-/g, '.')}</span>
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto relative px-12">
        <div className="absolute left-0 top-0 text-4xl text-[#C0C6CF]/20 font-serif">"</div>
        <p className="text-base leading-loose text-[#F5F5F5]/90 italic font-light tracking-widest py-4">
          {tomb.epitaph}
        </p>
        <div className="absolute right-0 bottom-0 text-4xl text-[#C0C6CF]/20 font-serif rotate-180">"</div>
      </div>

      {tomb.images.length > 1 && (
        <div className="w-full max-w-4xl grid grid-cols-2 md:grid-cols-4 gap-4 px-8">
          {tomb.images.slice(1).map((img, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              className="aspect-square bg-[#151517] border border-[#C0C6CF]/10 overflow-hidden"
            >
              <img
                src={img}
                className="w-full h-full object-cover grayscale opacity-50 hover:opacity-80 transition-opacity duration-700"
              />
            </motion.div>
          ))}
        </div>
      )}

      <div className="pt-12 flex flex-col items-center space-y-8">
        <button
          onClick={onMessage}
          className="group relative px-10 py-3 text-[10px] tracking-[0.4em] uppercase font-light"
        >
          <span className="relative z-10">留言 / Message</span>
          <div className="absolute bottom-0 left-0 w-full h-[1px] bg-[#C0C6CF]/30 group-hover:h-full group-hover:bg-[#F5F5F5] transition-all duration-500 -z-0" />
        </button>
        {onShare && (
          <button
            onClick={onShare}
            className="text-[9px] tracking-[0.4em] uppercase text-[#999999] hover:text-[#F5F5F5] transition-colors border-b border-transparent hover:border-[#F5F5F5]/30 pb-1"
          >
            私密分享 / Private Share
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Guest View（游客通过分享码访问后的完整体验） ─────────────────────────────

function GuestView({ tomb, onBack }: { tomb: Tombstone; onBack: () => void }) {
  const [page, setPage] = useState<'detail' | 'messages'>('detail');
  const [messages, setMessages] = useState<Message[]>([]);

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('tomb_id', tomb.id)
      .order('created_at', { ascending: false });
    setMessages((data as Message[]) ?? []);
  }, [tomb.id]);

  useEffect(() => {
    if (page === 'messages') fetchMessages();
  }, [page, fetchMessages]);

  const handleSend = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input = e.currentTarget.elements.namedItem('message') as HTMLInputElement;
    const text = input.value.trim();
    if (!text) return;
    await supabase.from('messages').insert({ tomb_id: tomb.id, text });
    input.value = '';
    await fetchMessages();
  };

  return (
    <div className="min-h-screen bg-[#1A1A1D] text-[#F5F5F5] font-sans overflow-x-hidden">
      <BreathingLine />
      <AnimatePresence mode="wait">
        <motion.main
          key={page}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="min-h-screen p-8 md:p-24 max-w-5xl mx-auto relative z-10 flex flex-col"
        >
          <nav className="flex justify-between items-center mb-20">
            <button
              onClick={page === 'messages' ? () => setPage('detail') : onBack}
              className="text-[#999999] text-[10px] tracking-[0.3em] uppercase hover:text-[#F5F5F5] transition-colors flex items-center gap-2"
            >
              <span className="text-lg font-thin">←</span> 返回
            </button>
            <div className="text-[10px] tracking-[0.3em] text-[#999999] uppercase">
              {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </nav>

          <div className="flex-1">
            {page === 'detail' && (
              <TombDetail tomb={tomb} onMessage={() => setPage('messages')} />
            )}

            {page === 'messages' && (
              <div className="max-w-2xl space-y-16">
                <header className="space-y-4">
                  <h1 className="text-3xl tracking-[0.3em] font-extralight uppercase">留言板</h1>
                  <p className="text-[#999999] text-[10px] tracking-[0.5em] uppercase font-light">
                    Messages for {tomb.name}
                  </p>
                  <div className="h-[1px] w-full bg-[#C0C6CF]/10" />
                </header>
                <div className="space-y-12 max-h-[50vh] overflow-y-auto pr-8 scrollbar-hide">
                  {messages.length === 0 ? (
                    <div className="py-20 text-center">
                      <p className="text-[#999999] text-xs tracking-[0.4em] font-light italic">尚无只言片语</p>
                    </div>
                  ) : (
                    messages.map((m, i) => (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="space-y-3 border-l border-[#C0C6CF]/10 pl-6 relative"
                      >
                        <div className="absolute left-[-1px] top-0 h-4 w-[1px] bg-[#F5F5F5]" />
                        <p className="text-sm font-light leading-relaxed tracking-wide text-[#F5F5F5]/80">{m.text}</p>
                        <span className="text-[9px] text-[#999999] tracking-[0.3em] uppercase block font-mono">
                          {new Date(m.created_at).toLocaleDateString('zh-CN', {
                            year: 'numeric', month: '2-digit', day: '2-digit'
                          }).replace(/\//g, '.')}
                        </span>
                      </motion.div>
                    ))
                  )}
                </div>
                <form className="pt-12 space-y-6" onSubmit={handleSend}>
                  <div className="relative">
                    <input
                      name="message"
                      placeholder="在此输入..."
                      className="w-full bg-transparent border-b border-[#C0C6CF]/20 py-4 text-sm focus:border-[#F5F5F5] outline-none transition-all font-light tracking-widest placeholder:text-[#999999]/30"
                    />
                    <button type="submit" className="absolute right-0 bottom-4 text-[10px] tracking-[0.4em] uppercase text-[#999999] hover:text-[#F5F5F5] transition-colors">
                      发送 / Send
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          <footer className="mt-auto pt-20 flex justify-between items-center text-[8px] tracking-[0.5em] text-[#999999] uppercase font-light opacity-30">
            <div>© 2026 THE RETURN / 归处</div>
          </footer>
        </motion.main>
      </AnimatePresence>
      <style>{`
        body { cursor: crosshair; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        ::selection { background: #C0C6CF; color: #1A1A1D; }
      `}</style>
    </div>
  );
}
