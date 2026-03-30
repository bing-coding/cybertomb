import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BreathingLine } from './components/BreathingLine';
import { TombstoneRenderer } from './components/TombstoneRenderer';
import { ShapeEditor } from './components/ShapeEditor';
import { LanternWall } from './components/LanternWall';
import { useAuth } from './contexts/AuthContext';
import {
  supabase,
  DEFAULT_SHAPE_CONFIG,
  getEffectiveConfig,
} from './lib/supabase';
import type { Tombstone, Message, TombShape, TombShapeConfig } from './lib/supabase';

type Page = 'index' | 'create' | 'detail' | 'edit' | 'share' | 'access';

const MAX_IMAGES = 3;

function generateShareCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const legacyShapeMap: Record<TombShapeConfig['headType'], TombShape> = {
  arch: 'arch', pointed: 'arch', flat: 'rect', cross: 'rect', obelisk: 'pillar',
};

// ─── Auth Screen ──────────────────────────────────────────────────────────────

function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode]         = useState<'signin' | 'signup'>('signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username.trim()) { setError('用户名不能为空'); return; }
    setLoading(true);
    try {
      if (mode === 'signin') await signIn(username, password);
      else                    await signUp(username, password);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'USERNAME_TAKEN')             setError('该用户名已被注册');
      else if (msg === 'INVALID_CREDENTIALS')   setError('用户名或密码错误');
      else if (msg === 'USERNAME_EMAIL_LEGACY') setError('用户名含 @ 字符暂不支持，请联系管理员完成数据库升级');
      else if (msg === 'SYSTEM_ERROR')          setError('系统繁忙，请稍后重试');
      else if (msg.includes('Invalid login'))   setError('用户名或密码错误');
      else if (msg.includes('Password'))        setError('密码至少需要 6 位');
      else setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090910] text-[#F5F5F5] flex flex-col items-center justify-center p-8 font-sans overflow-hidden">
      <BreathingLine />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.5, ease: 'easeOut' }}
        className="text-center space-y-16 max-w-xs w-full relative z-10"
      >
        <div className="space-y-4">
          <h1 className="text-4xl tracking-[0.5em] font-extralight">归处</h1>
          <div className="h-px w-12 bg-[#C0C6CF] mx-auto opacity-30" />
          <p className="text-[#666] text-[10px] tracking-[0.6em] uppercase font-light">
            The Return · Digital Memorial
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-6">
            <div className="space-y-2 text-left">
              <label className="text-[#666] text-[9px] tracking-[0.5em] uppercase font-light">
                用户名 / Username
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                className="w-full bg-transparent border-b border-[#C0C6CF]/20 py-3 text-sm focus:border-[#F5F5F5] outline-none transition-colors font-light tracking-wider"
              />
            </div>
            <div className="space-y-2 text-left">
              <label className="text-[#666] text-[9px] tracking-[0.5em] uppercase font-light">
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
            <p className="text-[#C0C6CF]/60 text-[9px] tracking-[0.3em] text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="group relative w-full py-5 overflow-hidden border border-[#C0C6CF]/30 transition-all duration-700 hover:border-[#F5F5F5] disabled:opacity-40"
          >
            <span className="relative z-10 text-[10px] tracking-[0.5em] uppercase font-light group-hover:text-[#090910] transition-colors duration-500">
              {loading ? '···' : mode === 'signin' ? '开启访问' : '建立账户'}
            </span>
            <motion.div className="absolute inset-0 bg-[#F5F5F5] -translate-x-full group-hover:translate-x-0 transition-transform duration-700 ease-in-out" />
          </button>

          <button
            type="button"
            onClick={() => { setMode(m => m === 'signin' ? 'signup' : 'signin'); setError(''); }}
            className="block w-full text-[9px] tracking-[0.4em] uppercase text-[#555] hover:text-[#F5F5F5] transition-colors"
          >
            {mode === 'signin' ? '没有账户？注册' : '已有账户？登录'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Access Screen ────────────────────────────────────────────────────────────

function AccessScreen({ onFound }: { onFound: (tomb: Tombstone) => void }) {
  const [code, setCode]       = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { data, error: dbErr } = await supabase
      .rpc('get_tomb_by_share_code', { p_code: code.trim() })
      .single();
    setLoading(false);
    if (dbErr || !data) { setError('未找到对应的纪念空间，请确认访问码'); return; }
    onFound(data as Tombstone);
  };

  return (
    <div className="min-h-screen bg-[#090910] text-[#F5F5F5] flex flex-col items-center justify-center p-8 font-sans overflow-hidden">
      <BreathingLine />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        className="text-center space-y-16 max-w-xs w-full relative z-10"
      >
        <div className="space-y-4">
          <h1 className="text-4xl tracking-[0.5em] font-extralight">归处</h1>
          <div className="h-px w-12 bg-[#C0C6CF] mx-auto opacity-30" />
          <p className="text-[#666] text-[10px] tracking-[0.6em] uppercase font-light">
            Private Access · 私密访问
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-3 text-left">
            <label className="text-[#666] text-[9px] tracking-[0.5em] uppercase font-light">
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
          {error && <p className="text-[#C0C6CF]/60 text-[9px] tracking-[0.3em] text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="group relative w-full py-5 overflow-hidden border border-[#C0C6CF]/30 transition-all duration-700 hover:border-[#F5F5F5] disabled:opacity-40"
          >
            <span className="relative z-10 text-[10px] tracking-[0.5em] uppercase font-light group-hover:text-[#090910] transition-colors duration-500">
              {loading ? '···' : '进入'}
            </span>
            <motion.div className="absolute inset-0 bg-[#F5F5F5] -translate-x-full group-hover:translate-x-0 transition-transform duration-700 ease-in-out" />
          </button>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Tomb Detail ──────────────────────────────────────────────────────────────

function TombDetail({
  tomb,
  messages,
  canDelete = false,
  onRefresh,
  onShare,
  onEdit,
  onDelete,
}: {
  tomb:      Tombstone;
  messages:  Message[];
  canDelete?: boolean;
  onRefresh: () => void;
  onShare?:  () => void;
  onEdit?:   () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="flex flex-col items-center space-y-16 py-8">

      {/* ── Tombstone visual ── */}
      <TombstoneRenderer tomb={tomb} size="detail" animated />

      {/* ── Name (single line, clean) ── */}
      <div className="text-center space-y-4">
        <h2 className="text-2xl md:text-3xl tracking-[0.35em] font-extralight uppercase">
          {tomb.name}
        </h2>
        {tomb.epitaph && (
          <p className="text-[#666] text-xs font-light italic tracking-widest max-w-sm mx-auto leading-loose mt-2">
            {tomb.epitaph}
          </p>
        )}
      </div>

      {/* ── Additional images ── */}
      {tomb.images.length > 1 && (
        <div className="w-full max-w-2xl grid grid-cols-3 md:grid-cols-4 gap-3 px-4">
          {tomb.images.slice(1).map((img, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="aspect-square bg-[#0e0c14] border border-[#C0C6CF]/8 overflow-hidden"
            >
              <img
                src={img}
                alt=""
                className="w-full h-full object-cover grayscale opacity-50 hover:opacity-70 transition-opacity duration-700"
              />
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Candle / messages section ── */}
      <div className="w-full max-w-2xl px-4">
        <div className="h-px bg-gradient-to-r from-transparent via-[#C0C6CF]/8 to-transparent mb-10" />
        <LanternWall
          messages={messages}
          tombId={tomb.id}
          tombName={tomb.name}
          canDelete={canDelete}
          onRefresh={onRefresh}
        />
      </div>

      {/* ── Footer actions ── */}
      <div className="flex flex-col items-center gap-5 pb-8">
        <div className="flex gap-8">
          {onShare && (
            <button
              onClick={onShare}
              className="text-[9px] tracking-[0.4em] uppercase text-[#555] hover:text-[#888] transition-colors border-b border-transparent hover:border-[#555]/30 pb-0.5"
            >
              私密分享 / Share
            </button>
          )}
          {onEdit && (
            <button
              onClick={onEdit}
              className="text-[9px] tracking-[0.4em] uppercase text-[#555] hover:text-[#888] transition-colors border-b border-transparent hover:border-[#555]/30 pb-0.5"
            >
              编辑 / Edit
            </button>
          )}
        </div>
        {onDelete && (
          <button
            onClick={onDelete}
            className="text-[8px] tracking-[0.4em] uppercase text-[#2a2838] hover:text-red-400/50 transition-colors duration-700 mt-2"
          >
            删除此纪念空间 / Delete
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Image thumbnail factory ──────────────────────────────────────────────────

function makeImageThumb(src: string, onRemove: () => void) {
  return (
    <div className="aspect-square bg-[#0e0c14] border border-[#C0C6CF]/8 overflow-hidden relative group">
      <img src={src} alt="" className="w-full h-full object-cover grayscale opacity-60" />
      <button
        type="button"
        onClick={onRemove}
        className="absolute inset-0 bg-[#090910]/80 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[8px] tracking-widest transition-opacity"
      >
        移除
      </button>
    </div>
  );
}

// ─── Edit Page ────────────────────────────────────────────────────────────────

function EditPage({
  tomb,
  onDone,
  onCancel,
}: {
  tomb:     Tombstone;
  onDone:   () => Promise<void>;
  onCancel: () => void;
}) {
  const { user } = useAuth();

  const [keptImageUrls,    setKeptImageUrls]    = useState<string[]>(tomb.images);
  const [newImageFiles,    setNewImageFiles]    = useState<File[]>([]);
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);
  const [shapeConfig,      setShapeConfig]      = useState<TombShapeConfig>(getEffectiveConfig(tomb));
  const [submitting,       setSubmitting]       = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalImages = keptImageUrls.length + newImageFiles.length;

  const removeKeptImage = (url: string) =>
    setKeptImageUrls(prev => prev.filter(u => u !== url));

  const removeNewImage = (idx: number) => {
    URL.revokeObjectURL(newImagePreviews[idx]);
    setNewImageFiles(prev => prev.filter((_, i) => i !== idx));
    setNewImagePreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const remaining = MAX_IMAGES - totalImages;
    if (remaining <= 0) return;
    const chosen = Array.from(files).slice(0, remaining);
    setNewImageFiles(prev => [...prev, ...chosen]);
    setNewImagePreviews(prev => [...prev, ...chosen.map(f => URL.createObjectURL(f as Blob))]);
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      const fd = new FormData(e.currentTarget);

      // Upload new images
      const newUrls: string[] = [];
      for (const file of newImageFiles) {
        const ext  = file.name.split('.').pop();
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from('memorial-images').upload(path, file);
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from('memorial-images').getPublicUrl(path);
        newUrls.push(publicUrl);
      }

      // Delete removed existing images from storage (best-effort)
      const removedUrls = tomb.images.filter(url => !keptImageUrls.includes(url));
      if (removedUrls.length > 0) {
        await supabase.storage.from('memorial-images').remove(
          removedUrls.map(url => url.split('/memorial-images/')[1]).filter(Boolean)
        );
      }

      const { error: updateError } = await supabase.from('tombstones').update({
        name:         fd.get('name') as string,
        birth_date:   (fd.get('birthDate') as string) || null,
        death_date:   (fd.get('deathDate') as string) || null,
        epitaph:      fd.get('epitaph') as string,
        images:       [...keptImageUrls, ...newUrls],
        shape:        legacyShapeMap[shapeConfig.headType],
        shape_config: shapeConfig,
      }).eq('id', tomb.id);

      if (updateError) throw updateError;

      newImagePreviews.forEach(url => URL.revokeObjectURL(url));
      await onDone();
    } catch (err) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      alert(`更新失败：${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-16">
      <header className="space-y-4">
        <h1 className="text-3xl tracking-[0.3em] font-extralight uppercase">编辑纪念</h1>
        <div className="h-px w-full bg-gradient-to-r from-[#C0C6CF]/30 to-transparent" />
      </header>

      <form className="space-y-16" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16">

          {/* Left: text fields */}
          <div className="space-y-10">
            <div className="space-y-3">
              <label className="text-[#666] text-[10px] tracking-[0.5em] uppercase font-light">
                姓名 / Name
              </label>
              <input
                name="name"
                required
                defaultValue={tomb.name}
                className="w-full bg-transparent border-b border-[#C0C6CF]/20 py-3 text-lg focus:border-[#F5F5F5] outline-none transition-colors font-light tracking-widest"
              />
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-[#666] text-[10px] tracking-[0.5em] uppercase font-light">
                  出生 / Birth
                </label>
                <input
                  name="birthDate"
                  type="date"
                  defaultValue={tomb.birth_date ?? ''}
                  className="w-full bg-transparent border-b border-[#C0C6CF]/20 py-3 text-sm focus:border-[#F5F5F5] outline-none transition-colors font-light"
                />
                <p className="text-[#444] text-[8px] tracking-wider">可留空</p>
              </div>
              <div className="space-y-3">
                <label className="text-[#666] text-[10px] tracking-[0.5em] uppercase font-light">
                  离去 / Departure
                </label>
                <input
                  name="deathDate"
                  type="date"
                  defaultValue={tomb.death_date ?? ''}
                  className="w-full bg-transparent border-b border-[#C0C6CF]/20 py-3 text-sm focus:border-[#F5F5F5] outline-none transition-colors font-light"
                />
                <p className="text-[#444] text-[8px] tracking-wider">可留空</p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[#666] text-[10px] tracking-[0.5em] uppercase font-light">
                墓志铭 / Epitaph
              </label>
              <textarea
                name="epitaph"
                rows={4}
                required
                defaultValue={tomb.epitaph}
                className="w-full bg-transparent border-b border-[#C0C6CF]/20 py-3 text-sm focus:border-[#F5F5F5] outline-none transition-colors resize-none font-light leading-relaxed tracking-wide"
              />
            </div>
          </div>

          {/* Right: image management */}
          <div className="space-y-8">
            <label className="text-[#666] text-[10px] tracking-[0.5em] uppercase font-light">
              影像 / Images
            </label>
            <div className="grid grid-cols-2 gap-4">
              {keptImageUrls.map(url => (
                <React.Fragment key={url}>
                  {makeImageThumb(url, () => removeKeptImage(url))}
                </React.Fragment>
              ))}
              {newImagePreviews.map((preview, i) => (
                <React.Fragment key={`new-${i}`}>
                  {makeImageThumb(preview, () => removeNewImage(i))}
                </React.Fragment>
              ))}
              {totalImages < MAX_IMAGES && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square border border-dashed border-[#C0C6CF]/15 flex flex-col items-center justify-center hover:border-[#F5F5F5]/35 transition-colors"
                >
                  <span className="text-xl font-thin mb-2">+</span>
                  <span className="text-[8px] tracking-widest text-[#555]">添加图片</span>
                </button>
              )}
            </div>
            <p className="text-[#444] text-[9px] tracking-[0.3em]">
              {totalImages} / {MAX_IMAGES} 张{totalImages >= MAX_IMAGES && '　已达上限'}
            </p>
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
            />
          </div>
        </div>

        {/* Shape editor */}
        <div className="space-y-8">
          <div className="space-y-4">
            <h2 className="text-[10px] tracking-[0.5em] uppercase text-[#666] font-light">
              碑形定制 / Tombstone Shape
            </h2>
            <div className="h-px w-full bg-gradient-to-r from-[#C0C6CF]/20 to-transparent" />
          </div>
          <ShapeEditor value={shapeConfig} onChange={setShapeConfig} />
        </div>

        {/* Buttons */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 py-5 border border-[#C0C6CF]/25 text-[10px] tracking-[0.5em] uppercase font-light hover:bg-[#F5F5F5] hover:text-[#090910] transition-all duration-700 disabled:opacity-40"
          >
            {submitting ? '保存中···' : '保存修改 / Save'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-10 py-5 border border-[#C0C6CF]/12 text-[10px] tracking-[0.4em] uppercase font-light hover:border-[#C0C6CF]/30 transition-colors"
          >
            取消
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Guest View ───────────────────────────────────────────────────────────────

function GuestView({ tomb, onBack }: { tomb: Tombstone; onBack: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase
      .from('messages').select('*').eq('tomb_id', tomb.id)
      .order('created_at', { ascending: false });
    setMessages((data as Message[]) ?? []);
  }, [tomb.id]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  return (
    <div className="min-h-screen bg-[#090910] text-[#F5F5F5] font-sans overflow-x-hidden">
      <BreathingLine />
      <motion.main
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="min-h-screen p-8 md:p-24 max-w-5xl mx-auto relative z-10 flex flex-col"
      >
        <nav className="flex justify-between items-center mb-16">
          <button
            onClick={onBack}
            className="text-[#666] text-[10px] tracking-[0.3em] uppercase hover:text-[#F5F5F5] transition-colors flex items-center gap-2"
          >
            <span className="text-lg font-thin">←</span> 返回
          </button>
          <div className="text-[10px] tracking-[0.3em] text-[#555] uppercase">
            {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </nav>

        <div className="flex-1">
          <TombDetail
            tomb={tomb}
            messages={messages}
            canDelete={false}
            onRefresh={fetchMessages}
          />
        </div>

        <footer className="mt-auto pt-20 flex justify-center text-[8px] tracking-[0.5em] text-[#444] uppercase font-light">
          © 2026 THE RETURN / 归处
        </footer>
      </motion.main>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const { user, loading: authLoading, signOut } = useAuth();

  const [currentPage,      setCurrentPage]      = useState<Page>('index');
  const [history,          setHistory]          = useState<Page[]>(['index']);
  const [tombstones,       setTombstones]       = useState<Tombstone[]>([]);
  const [selectedTombId,   setSelectedTombId]   = useState<string | null>(null);
  const [messages,         setMessages]         = useState<Message[]>([]);
  const [dataLoading,      setDataLoading]      = useState(false);
  const [guestTomb,        setGuestTomb]        = useState<Tombstone | null>(null);

  // Create-form state
  const [selectedShapeConfig, setSelectedShapeConfig] = useState<TombShapeConfig>(DEFAULT_SHAPE_CONFIG);
  const [tempImageFiles,      setTempImageFiles]      = useState<File[]>([]);
  const [tempImagePreviews,   setTempImagePreviews]   = useState<string[]>([]);
  const [submitting,          setSubmitting]          = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Navigation ─────────────────────────────────────────────────────────────

  const navigate = (page: Page, params?: { id?: string }) => {
    if (params?.id) setSelectedTombId(params.id);
    setHistory(prev => [...prev, page]);
    setCurrentPage(page);
  };

  const goBack = () => {
    if (history.length > 1) {
      const next = [...history];
      next.pop();
      setHistory(next);
      setCurrentPage(next[next.length - 1]);
    }
  };

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchTombstones = useCallback(async () => {
    if (!user) return;
    setDataLoading(true);
    const { data } = await supabase
      .from('tombstones').select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setTombstones((data as Tombstone[]) ?? []);
    setDataLoading(false);
  }, [user]);

  const fetchMessages = useCallback(async (tombId: string) => {
    const { data } = await supabase
      .from('messages').select('*').eq('tomb_id', tombId)
      .order('created_at', { ascending: false });
    setMessages((data as Message[]) ?? []);
  }, []);

  useEffect(() => { fetchTombstones(); }, [fetchTombstones]);

  useEffect(() => {
    if (selectedTombId) fetchMessages(selectedTombId);
  }, [selectedTombId, fetchMessages]);

  // ── Image upload (create form) ─────────────────────────────────────────────

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const remaining = MAX_IMAGES - tempImageFiles.length;
    if (remaining <= 0) return;
    const newFiles = Array.from(files).slice(0, remaining);
    setTempImageFiles(prev => [...prev, ...newFiles]);
    setTempImagePreviews(prev => [...prev, ...newFiles.map(f => URL.createObjectURL(f as Blob))]);
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
      const ext  = file.name.split('.').pop();
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('memorial-images').upload(path, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('memorial-images').getPublicUrl(path);
      urls.push(publicUrl);
    }
    return urls;
  };

  // ── Create tombstone ───────────────────────────────────────────────────────

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      const fd        = new FormData(e.currentTarget);
      const imageUrls = await uploadImages(user.id);

      const { error } = await supabase.from('tombstones').insert({
        user_id:      user.id,
        name:         fd.get('name') as string,
        birth_date:   (fd.get('birthDate') as string) || null,
        death_date:   (fd.get('deathDate') as string) || null,
        epitaph:      fd.get('epitaph') as string,
        images:       imageUrls,
        shape:        legacyShapeMap[selectedShapeConfig.headType],
        shape_config: selectedShapeConfig,
        share_code:   generateShareCode(),
      });

      if (error) throw error;

      tempImagePreviews.forEach(url => URL.revokeObjectURL(url));
      setTempImageFiles([]);
      setTempImagePreviews([]);
      setSelectedShapeConfig(DEFAULT_SHAPE_CONFIG);
      await fetchTombstones();
      navigate('index');
    } catch (err) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      alert(`创建失败：${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Share link ─────────────────────────────────────────────────────────────

  const copyShareLink = (code: string) => {
    navigator.clipboard.writeText(`${window.location.origin}?access=${code}`).catch(() => {});
  };

  // ── URL-based guest access ─────────────────────────────────────────────────

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('access');
    if (code) {
      supabase.rpc('get_tomb_by_share_code', { p_code: code })
        .single()
        .then(({ data }) => { if (data) setGuestTomb(data as Tombstone); });
    }
  }, []);

  // ── Delete tombstone ───────────────────────────────────────────────────────

  const handleDelete = async (tomb: Tombstone) => {
    if (!confirm(`确认删除「${tomb.name}」的纪念空间？此操作不可撤销。`)) return;
    await supabase.from('messages').delete().eq('tomb_id', tomb.id);
    await supabase.storage.from('memorial-images').remove(
      tomb.images.map(url => url.split('/memorial-images/')[1]).filter(Boolean)
    );
    await supabase.from('tombstones').delete().eq('id', tomb.id);
    await fetchTombstones();
    navigate('index');
  };

  // ── Render guards ──────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#090910] flex items-center justify-center">
        <BreathingLine />
      </div>
    );
  }

  if (guestTomb) return <GuestView tomb={guestTomb} onBack={() => setGuestTomb(null)} />;

  if (!user) {
    const code = new URLSearchParams(window.location.search).get('access');
    if (code) return <AccessScreen onFound={t => setGuestTomb(t)} />;
    return <AuthScreen />;
  }

  const selectedTomb = tombstones.find(t => t.id === selectedTombId);

  return (
    <div
      className="min-h-screen text-[#F5F5F5] font-sans selection:bg-[#C0C6CF] selection:text-[#090910] overflow-x-hidden"
      style={{
        background: `
          radial-gradient(ellipse 75% 45% at 50% -5%, rgba(160,180,220,0.06) 0%, transparent 70%),
          #090910
        `,
      }}
    >
      <BreathingLine />

      <AnimatePresence mode="wait">
        <motion.main
          key={currentPage}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="min-h-screen p-8 md:p-24 max-w-6xl mx-auto relative z-10 flex flex-col"
        >
          {/* Top nav */}
          <nav className="flex justify-between items-center mb-16 md:mb-20">
            {currentPage !== 'index' ? (
              <button
                onClick={goBack}
                className="text-[#666] text-[10px] tracking-[0.3em] uppercase hover:text-[#F5F5F5] transition-colors flex items-center gap-2"
              >
                <span className="text-lg font-thin">←</span> 返回
              </button>
            ) : (
              <div className="text-[#555] text-[10px] tracking-[0.3em] uppercase opacity-50">
                Index / 索引
              </div>
            )}
            <div className="flex items-center gap-6">
              <div className="text-[10px] tracking-[0.3em] text-[#555] uppercase">
                {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
              <button
                onClick={signOut}
                className="text-[9px] tracking-[0.3em] uppercase text-[#444] hover:text-[#888] transition-colors"
              >
                退出
              </button>
            </div>
          </nav>

          {/* ── Page content ── */}
          <div className="flex-1">

            {/* ── Index / Cemetery ── */}
            {currentPage === 'index' && (
              <div className="space-y-16">
                <header className="space-y-6">
                  <div className="flex justify-between items-end">
                    <h1 className="text-4xl md:text-6xl tracking-[0.2em] font-extralight">归处</h1>
                    <button
                      onClick={() => {
                        setTempImageFiles([]);
                        setTempImagePreviews([]);
                        setSelectedShapeConfig(DEFAULT_SHAPE_CONFIG);
                        navigate('create');
                      }}
                      className="text-[10px] tracking-[0.4em] uppercase border border-[#C0C6CF]/25 px-6 py-2 hover:bg-[#F5F5F5] hover:text-[#090910] transition-all duration-500"
                    >
                      建立纪念 +
                    </button>
                  </div>
                  <p className="text-[#555] text-[10px] tracking-[0.5em] uppercase font-light">
                    Quiet Space · 寂静之地
                  </p>
                </header>

                <div className="relative pb-8">
                  <div className="fog-layer" />

                  {dataLoading ? (
                    <div className="py-32 flex justify-center relative z-10">
                      <p className="text-[#444] text-[10px] tracking-[0.5em] font-light">···</p>
                    </div>
                  ) : tombstones.length === 0 ? (
                    <div className="py-32 border-y border-[#C0C6CF]/8 flex flex-col items-center justify-center space-y-4 relative z-10">
                      <p className="text-[#555] text-xs tracking-[0.4em] font-light italic">万籁俱寂</p>
                      <div className="h-px w-8 bg-[#C0C6CF]/15" />
                      <p className="text-[#444] text-[9px] tracking-[0.3em]">此地尚无纪念，点击右上角建立</p>
                    </div>
                  ) : (
                    <div className="flex flex-wrap justify-center gap-8 lg:gap-12 relative z-10">
                      {tombstones.map((t, i) => (
                        <motion.div
                          key={t.id}
                          initial={{ opacity: 0, y: 24 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.08, duration: 1.2 }}
                          className="tomb-card-hover"
                          style={{
                            width: 'clamp(100px, 16vw, 150px)',
                            marginTop: i % 3 === 1 ? '22px' : i % 3 === 2 ? '10px' : '0',
                          }}
                          onClick={() => navigate('detail', { id: t.id })}
                        >
                          <TombstoneRenderer tomb={t} size="card" />
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {tombstones.length > 0 && (
                    <div className="mt-12 h-px bg-gradient-to-r from-transparent via-[#C0C6CF]/10 to-transparent relative z-10" />
                  )}
                </div>
              </div>
            )}

            {/* ── Create page ── */}
            {currentPage === 'create' && (
              <div className="space-y-16">
                <header className="space-y-4">
                  <h1 className="text-3xl tracking-[0.3em] font-extralight uppercase">建立纪念</h1>
                  <div className="h-px w-full bg-gradient-to-r from-[#C0C6CF]/30 to-transparent" />
                </header>

                <form className="space-y-16" onSubmit={handleCreate}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                    <div className="space-y-10">
                      <div className="space-y-3">
                        <label className="text-[#666] text-[10px] tracking-[0.5em] uppercase font-light">
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
                          <label className="text-[#666] text-[10px] tracking-[0.5em] uppercase font-light">
                            出生 / Birth
                          </label>
                          <input
                            name="birthDate"
                            type="date"
                            className="w-full bg-transparent border-b border-[#C0C6CF]/20 py-3 text-sm focus:border-[#F5F5F5] outline-none transition-colors font-light"
                          />
                          <p className="text-[#444] text-[8px] tracking-wider">可留空</p>
                        </div>
                        <div className="space-y-3">
                          <label className="text-[#666] text-[10px] tracking-[0.5em] uppercase font-light">
                            离去 / Departure
                          </label>
                          <input
                            name="deathDate"
                            type="date"
                            className="w-full bg-transparent border-b border-[#C0C6CF]/20 py-3 text-sm focus:border-[#F5F5F5] outline-none transition-colors font-light"
                          />
                          <p className="text-[#444] text-[8px] tracking-wider">可留空</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-[#666] text-[10px] tracking-[0.5em] uppercase font-light">
                          墓志铭 / Epitaph
                        </label>
                        <textarea
                          name="epitaph"
                          rows={4}
                          required
                          className="w-full bg-transparent border-b border-[#C0C6CF]/20 py-3 text-sm focus:border-[#F5F5F5] outline-none transition-colors resize-none font-light leading-relaxed tracking-wide"
                        />
                      </div>
                    </div>

                    <div className="space-y-8">
                      <label className="text-[#666] text-[10px] tracking-[0.5em] uppercase font-light">
                        影像 / Images
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        {tempImagePreviews.map((img, i) => (
                          <React.Fragment key={i}>
                            {makeImageThumb(img, () => removeImage(i))}
                          </React.Fragment>
                        ))}
                        {tempImagePreviews.length < MAX_IMAGES && (
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="aspect-square border border-dashed border-[#C0C6CF]/15 flex flex-col items-center justify-center hover:border-[#F5F5F5]/35 transition-colors"
                          >
                            <span className="text-xl font-thin mb-2">+</span>
                            <span className="text-[8px] tracking-widest text-[#555]">添加图片</span>
                          </button>
                        )}
                      </div>
                      <p className="text-[#444] text-[9px] tracking-[0.3em]">
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
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div className="space-y-4">
                      <h2 className="text-[10px] tracking-[0.5em] uppercase text-[#666] font-light">
                        碑形定制 / Tombstone Shape
                      </h2>
                      <div className="h-px w-full bg-gradient-to-r from-[#C0C6CF]/20 to-transparent" />
                    </div>
                    <ShapeEditor value={selectedShapeConfig} onChange={setSelectedShapeConfig} />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-5 border border-[#C0C6CF]/25 text-[10px] tracking-[0.5em] uppercase font-light hover:bg-[#F5F5F5] hover:text-[#090910] transition-all duration-700 disabled:opacity-40"
                  >
                    {submitting ? '上传中···' : '完成建立 / Finalize'}
                  </button>
                </form>
              </div>
            )}

            {/* ── Detail page ── */}
            {currentPage === 'detail' && selectedTomb && (
              <TombDetail
                tomb={selectedTomb}
                messages={messages}
                canDelete={true}
                onRefresh={() => fetchMessages(selectedTombId!)}
                onShare={() => navigate('share')}
                onEdit={() => navigate('edit')}
                onDelete={() => handleDelete(selectedTomb)}
              />
            )}

            {/* ── Edit page ── */}
            {currentPage === 'edit' && selectedTomb && (
              <EditPage
                tomb={selectedTomb}
                onDone={async () => {
                  await fetchTombstones();
                  // Also refresh messages and go back to detail
                  if (selectedTombId) fetchMessages(selectedTombId);
                  goBack();
                }}
                onCancel={goBack}
              />
            )}

            {/* ── Share page ── */}
            {currentPage === 'share' && selectedTomb && (
              <div className="flex flex-col items-center justify-center space-y-24 py-20 text-center">
                <div className="space-y-6">
                  <h1 className="text-3xl tracking-[0.4em] font-extralight uppercase">私密分享</h1>
                  <div className="h-px w-12 bg-[#C0C6CF] mx-auto opacity-25" />
                  <p className="text-[#666] text-[10px] tracking-[0.6em] uppercase font-light">Access Code</p>
                </div>

                <div className="relative group">
                  <div className="text-4xl md:text-7xl tracking-[0.3em] md:tracking-[0.4em] font-extralight text-[#F5F5F5] pl-4 md:pl-8">
                    {selectedTomb.share_code}
                  </div>
                  <div className="absolute -inset-8 border border-[#C0C6CF]/5 scale-110 group-hover:scale-100 transition-transform duration-1000" />
                </div>

                <div className="max-w-xs mx-auto space-y-8">
                  <p className="text-[#555] text-[10px] leading-loose tracking-[0.4em] uppercase font-light">
                    请将此代码或链接分享给您信任的人。此纪念空间默认保持私密。
                  </p>
                  <button
                    onClick={() => copyShareLink(selectedTomb.share_code)}
                    className="w-full py-4 border border-[#C0C6CF]/20 text-[9px] tracking-[0.4em] uppercase font-light hover:bg-[#F5F5F5] hover:text-[#090910] transition-all duration-500"
                  >
                    复制访问链接 / Copy Link
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <footer className="mt-auto pt-20 flex flex-col md:flex-row justify-between items-center gap-4 text-[8px] tracking-[0.5em] text-[#444] uppercase font-light opacity-40">
            <div>© 2026 THE RETURN / 归处</div>
            <div className="flex gap-8">
              <span>Privacy / 隐私</span>
              <span>Terms / 条款</span>
            </div>
          </footer>
        </motion.main>
      </AnimatePresence>
    </div>
  );
}
