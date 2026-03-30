import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import type { Message } from '../lib/supabase';

// ─── Single candle SVG ────────────────────────────────────────────────────────

function CandleSVG({ uid, lit }: { uid: string; lit: boolean }) {
  return (
    <svg
      viewBox="0 0 28 52"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
      aria-hidden
    >
      <defs>
        <radialGradient id={`fg-${uid}`} cx="50%" cy="72%">
          <stop offset="0%"   stopColor="#fffcc0" />
          <stop offset="38%"  stopColor="#ffcc44" />
          <stop offset="100%" stopColor="#ff7020" stopOpacity="0.6" />
        </radialGradient>
      </defs>

      {/* Plate */}
      <ellipse cx="14" cy="50" rx="11.5" ry="2" fill="#0c0a14" stroke="#221c30" strokeWidth="0.4" />
      {/* Candle body */}
      <rect x="9.5" y="26" width="9" height="24" rx="1.2"
            fill="#18162a" stroke="#28223c" strokeWidth="0.4" />
      {/* Top surface */}
      <ellipse cx="14" cy="26" rx="4.5" ry="1.3" fill="#1e1c2e" />
      {/* Wax melt drip — purely decorative */}
      <path d="M 9.5 32 Q 8 33.5 8.2 35.5 Q 8.4 37 9.5 37"
            fill="#201d30" opacity="0.5" />
      {/* Wick */}
      <path d="M 14 26 Q 13.5 23.5 14.1 21.5"
            stroke="#3a3050" strokeWidth="0.65" fill="none" strokeLinecap="round" />
      {/* Flame */}
      <path
        d="M 14 5 Q 10.5 11 12 17.5 Q 13 19.8 14 20.2 Q 15 19.8 16 17.5 Q 17.5 11 14 5 Z"
        fill={`url(#fg-${uid})`}
        opacity={lit ? 0.96 : 0.74}
        className="candle-flame"
      />
      {/* Bright inner core */}
      <ellipse cx="14" cy="15.5" rx="1.5" ry="2.1" fill="rgba(255,252,200,0.65)" />
      {/* Ambient halo (larger when lit) */}
      <ellipse
        cx="14" cy="12"
        rx={lit ? 9 : 5.5} ry={lit ? 10 : 6.5}
        fill="rgba(255,195,55,0.05)"
        opacity={lit ? 1 : 0.45}
      />
    </svg>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface LanternWallProps {
  messages:  Message[];
  tombId:    string;
  tombName:  string;
  canDelete: boolean;
  onRefresh: () => void;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LanternWall({ messages, tombId, canDelete, onRefresh }: LanternWallProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [text, setText]             = useState('');
  const [sending, setSending]       = useState(false);

  const toggle = (id: string) => setExpandedId(prev => (prev === id ? null : id));

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('确认熄灯？留言将永久删除。')) return;
    const { error } = await supabase.from('messages').delete().eq('id', id);
    if (error) {
      console.error('熄灯失败:', error);
      alert(`删除失败：${error.message}`);
      return;
    }
    if (expandedId === id) setExpandedId(null);
    onRefresh();
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      await supabase.from('messages').insert({ tomb_id: tombId, text: trimmed });
      setText('');
      onRefresh();
    } finally {
      setSending(false);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });

  return (
    <div className="space-y-10">

      {/* ── Section label ─────────────────────────────────────── */}
      <div className="text-center space-y-1.5">
        <p className="text-[9px] tracking-[0.45em] uppercase text-[#444]">留言 / Messages</p>
        <p className="text-[8px] tracking-[0.25em] text-[#333] font-light">
          每一条留言将以烛光的形式点亮于此
        </p>
      </div>

      {/* ── Candle grid ───────────────────────────────────────── */}
      {messages.length === 0 ? (
        <p className="text-center text-[9px] tracking-[0.3em] text-[#333] py-6">
          尚无留言 · 点亮第一盏烛光
        </p>
      ) : (
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-8">
          {messages.map((m, i) => {
            const uid  = `cnd-${m.id}`;
            const lit  = expandedId === m.id;
            return (
              <div key={m.id} className="relative flex flex-col items-center gap-1.5">

                {/* Message popup */}
                <AnimatePresence>
                  {lit && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.96 }}
                      transition={{ duration: 0.18 }}
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3
                                 w-44 bg-[#110f1a] border border-[#C0C6CF]/10
                                 p-3.5 shadow-2xl z-30"
                    >
                      <p className="text-[10px] font-light leading-relaxed text-[#a8a0c0] tracking-wide break-words">
                        {m.text}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-[7px] text-[#3a3848] font-mono shrink-0">
                          {formatDate(m.created_at)}
                        </span>
                        {canDelete && (
                          <button
                            onClick={e => handleDelete(m.id, e)}
                            className="text-[7px] tracking-wider text-[#3a3848] hover:text-red-400/60 transition-colors shrink-0"
                          >
                            熄灯
                          </button>
                        )}
                      </div>
                      {/* Caret */}
                      <div className="absolute -bottom-[5px] left-1/2 -translate-x-1/2
                                      w-2.5 h-2.5 bg-[#110f1a] border-r border-b
                                      border-[#C0C6CF]/10 rotate-45" />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Candle */}
                <motion.div
                  className={`cursor-pointer transition-all duration-400 ${lit ? 'candle-lit' : ''}`}
                  style={{ width: 28, height: 52 }}
                  onClick={() => toggle(m.id)}
                  whileHover={{ scale: 1.08 }}
                  animate={lit ? { scale: 1.06 } : { scale: 1 }}
                  custom={i}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.04, duration: 0.5 }}
                >
                  <CandleSVG uid={uid} lit={lit} />
                </motion.div>

                {/* Date label */}
                <span className="text-[6px] text-[#2e2c3c] font-mono tracking-wide whitespace-nowrap">
                  {formatDate(m.created_at)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Send form ─────────────────────────────────────────── */}
      <form onSubmit={handleSend} className="flex gap-3 items-end pt-2">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="写下你的留言…"
          rows={2}
          maxLength={200}
          className="flex-1 resize-none bg-transparent border border-[#C0C6CF]/10
                     focus:border-[#C0C6CF]/25 outline-none
                     text-[11px] font-light tracking-widest text-[#888]
                     placeholder:text-[#333] px-3 py-2.5 transition-colors duration-300"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="pb-2.5 text-[8px] tracking-[0.4em] uppercase text-[#555]
                     hover:text-[#888] disabled:text-[#282633]
                     transition-colors duration-300 whitespace-nowrap"
        >
          {sending ? '···' : '留言 / Send'}
        </button>
      </form>
    </div>
  );
}
