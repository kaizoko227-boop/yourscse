import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Delete, Lock, KeyRound } from 'lucide-react';
import type { UserProfile } from '../types/models';
import { verifyPin } from '../lib/crypto';
import { formatKathmanduDate, formatKathmanduTime } from '../lib/dateUtils';

interface LockScreenProps {
  profile: UserProfile;
  onUnlock: () => void;
  autoLockedReason?: boolean;
}

const KEYPAD_KEYS: { num: string; letters: string }[] = [
  { num: '1', letters: '' },
  { num: '2', letters: 'ABC' },
  { num: '3', letters: 'DEF' },
  { num: '4', letters: 'GHI' },
  { num: '5', letters: 'JKL' },
  { num: '6', letters: 'MNO' },
  { num: '7', letters: 'PQRS' },
  { num: '8', letters: 'TUV' },
  { num: '9', letters: 'WXYZ' },
];

export function LockScreen({ profile, onUnlock, autoLockedReason }: LockScreenProps) {
  const [digits, setDigits] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [shaking, setShaking] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(t);
  }, []);

  const attemptVerify = async (candidate: string) => {
    setVerifying(true);
    const ok = await verifyPin(candidate, profile.pinSalt, profile.pinHash);
    setVerifying(false);
    if (ok) {
      setError('');
      setDigits('');
      onUnlock();
    } else {
      setError('Incorrect Passcode. Try again.');
      setShaking(true);
      window.setTimeout(() => {
        setShaking(false);
        setDigits('');
      }, 420);
    }
  };

  const pressDigit = (d: string) => {
    if (verifying || digits.length >= 4) return;
    setError('');
    const next = digits + d;
    setDigits(next);
    if (next.length === 4) {
      void attemptVerify(next);
    }
  };

  const backspace = () => {
    if (verifying) return;
    setDigits((prev) => prev.slice(0, -1));
    setError('');
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        pressDigit(e.key);
      } else if (e.key === 'Backspace') {
        backspace();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits, verifying]);

  const timeString = formatKathmanduTime(now).replace(/\s?(AM|PM)$/i, '');
  const meridiem = formatKathmanduTime(now).match(/(AM|PM)$/i)?.[0] || '';

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-5 relative overflow-hidden">
      {/* Living Apple iOS 26 Silk Refractive Wallpaper */}
      <div className="liquid-wallpaper">
        <div className="liquid-orb liquid-orb-1" />
        <div className="liquid-orb liquid-orb-2" />
        <div className="liquid-orb liquid-orb-3" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-[360px] flex flex-col items-center"
      >
        {/* Dynamic Island Status Pill */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-950/90 dark:bg-black/82 text-white border border-white/15 shadow-[0_12px_30px_-8px_rgba(0,0,0,0.45)] mb-7 backdrop-blur-2xl">
          <Lock className="w-3 h-3 text-cyan-400" />
          <span className="text-[11px] font-medium tracking-wide">My Life OS</span>
          <span className="w-1 h-1 rounded-full bg-white/30" />
          <span className="text-[11px] text-cyan-300 font-mono">NPT</span>
        </div>

        {/* Iconic iOS 26 Ultra-Light Glass Clock & Greeting */}
        <div className="text-center mb-6">
          <p className="text-[13px] font-medium tracking-wide text-slate-700/80 dark:text-cyan-100/75">
            {formatKathmanduDate(now)}
          </p>
          <div className="mt-1 flex items-baseline justify-center gap-1.5">
            <span className="text-[68px] leading-none font-extralight tracking-[-0.04em] tabular-nums text-slate-900/90 dark:text-white/95 drop-shadow-[0_4px_24px_rgba(14,165,233,0.18)]">
              {timeString}
            </span>
            <span className="text-sm font-medium text-slate-600 dark:text-cyan-200/80">
              {meridiem}
            </span>
          </div>
          <h1 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mt-2">
            Welcome back, {profile.name}
          </h1>
          {autoLockedReason && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300 liquid-dock rounded-full px-3.5 py-1 inline-block">
              Auto-locked due to inactivity
            </p>
          )}
        </div>

        {/* Passcode Indicator + Liquid Glass Circular Keypad */}
        <div className="w-full flex flex-col items-center">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-3.5">
            Enter Passcode
          </p>

          {/* Liquid Glass Passcode Dots */}
          <div
            className={`flex items-center justify-center gap-4.5 mb-4 ${shaking ? 'animate-shake' : ''}`}
            aria-label="PIN entry dots"
          >
            {[0, 1, 2, 3].map((i) => {
              const filled = i < digits.length;
              return (
                <div
                  key={i}
                  className={`w-3.5 h-3.5 rounded-full transition-all duration-150 border ${
                    filled
                      ? 'bg-cyan-500 dark:bg-cyan-300 border-cyan-400 scale-115 shadow-[0_0_16px_rgba(6,182,212,0.75)]'
                      : 'bg-white/35 dark:bg-white/10 border-slate-500/40 dark:border-white/35'
                  }`}
                />
              );
            })}
          </div>

          {error ? (
            <p className="text-center text-xs text-rose-600 dark:text-rose-400 font-semibold mb-4">
              {error}
            </p>
          ) : profile.pinIsDefault ? (
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-700 dark:text-cyan-100/85 liquid-dock rounded-full py-1.5 px-3.5 mb-5">
              <KeyRound className="w-3 h-3 text-cyan-600 dark:text-cyan-300 shrink-0" />
              <span>
                Default PIN: <strong className="font-mono">1234</strong> (change in Settings)
              </span>
            </div>
          ) : (
            <div className="h-5 mb-4" />
          )}

          {/* Classic iPhone 3x4 Circular Liquid Glass Keypad */}
          <div className="grid grid-cols-3 gap-x-5 gap-y-3.5">
            {KEYPAD_KEYS.map(({ num, letters }) => (
              <button
                key={num}
                type="button"
                onClick={() => pressDigit(num)}
                disabled={verifying}
                className="w-[76px] h-[76px] rounded-full liquid-key flex flex-col items-center justify-center text-slate-900 dark:text-white cursor-pointer select-none"
              >
                <span className="text-[28px] leading-none font-light tabular-nums">{num}</span>
                {letters && (
                  <span className="text-[9px] font-semibold tracking-[0.16em] text-slate-500 dark:text-white/60 mt-1">
                    {letters}
                  </span>
                )}
              </button>
            ))}

            <div className="w-[76px] h-[76px]" />

            <button
              type="button"
              onClick={() => pressDigit('0')}
              disabled={verifying}
              className="w-[76px] h-[76px] rounded-full liquid-key flex items-center justify-center text-[28px] font-light tabular-nums text-slate-900 dark:text-white cursor-pointer select-none"
            >
              0
            </button>

            <button
              type="button"
              onClick={backspace}
              disabled={verifying || digits.length === 0}
              className="w-[76px] h-[76px] rounded-full hover:bg-white/40 dark:hover:bg-white/10 disabled:opacity-30 text-slate-700 dark:text-white flex items-center justify-center transition-all cursor-pointer"
              aria-label="Backspace"
            >
              <Delete className="w-5.5 h-5.5" />
            </button>
          </div>
        </div>

        <p className="text-[11px] text-slate-600/80 dark:text-slate-400 mt-6 text-center">
          My Life OS • {profile.college}
        </p>
      </motion.div>
    </div>
  );
}
