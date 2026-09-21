'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import { Lock, User, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  // ─── ALL EXISTING AUTH STATE & LOGIC — UNCHANGED ───────────────────────────
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // 1. Fetch CSRF Token first
      const csrfRes = await apiRequest('/csrf-token', 'GET');
      if (csrfRes && csrfRes.csrfToken) {
        localStorage.setItem('csrfToken', csrfRes.csrfToken);
      }

      // 2. Login (Backend sets HttpOnly cookie for auth)
      // Send as 'email' — backend handles both email and username lookups
      await apiRequest('/auth/login', 'POST', { email: identifier, password });

      // 3. Get authenticated user details
      const authData = await apiRequest('/auth/me', 'GET');

      localStorage.setItem('role', authData.role);
      localStorage.setItem('user', JSON.stringify(authData.user));

      if (authData.role === 'admin') {
        router.push('/admin/dashboard');
      } else if (authData.role === 'judge') {
        router.push('/judge/dashboard');
      } else {
        router.push('/');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };
  // ─── END AUTH LOGIC ─────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0D0B18] p-4 md:p-6 relative overflow-hidden">

      {/* ── Full-page background ambient glows ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 left-1/4 w-[600px] h-[600px] bg-purple-900/20 rounded-full blur-[140px]" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-indigo-900/15 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-0 w-[350px] h-[350px] bg-violet-900/10 rounded-full blur-[100px]" />
      </div>

      {/* ── Main split-screen card ── */}
      <div className="relative z-10 w-full max-w-5xl mx-auto flex flex-col lg:flex-row rounded-3xl overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.6)] border border-white/[0.06]">

        {/* ═══════════════════════════════════════════
            LEFT PANEL — Branding / Visual
        ═══════════════════════════════════════════ */}
        <div className="relative lg:w-[44%] flex flex-col items-center justify-center bg-gradient-to-br from-[#1A1640] via-[#1C1830] to-[#110F20] overflow-hidden
                        py-4 px-8 lg:py-8 lg:px-12">

          {/* Decorative blob shapes — purple/indigo, NOT green */}
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-purple-600/20 rounded-full blur-[70px] pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-indigo-700/20 rounded-full blur-[80px] pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 bg-violet-600/8 rounded-full blur-[60px] pointer-events-none" />

          {/* Corner curved accent shapes (structural ref from Image 2) */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-purple-500/10 via-purple-600/5 to-transparent rounded-bl-[100px] pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-indigo-500/10 via-indigo-600/5 to-transparent rounded-tr-[100px] pointer-events-none" />

          {/* Inner card glow ring */}
          <div className="absolute inset-[1px] rounded-3xl lg:rounded-none lg:rounded-l-3xl border border-purple-500/10 pointer-events-none" />

          {/* ── Branding content ── */}
          <div className="relative z-10 flex flex-col items-center text-center">

            {/* Al Mahsan Logo */}
            <div className="mb-3 lg:mb-4 flex items-center justify-center">
              <img
                src="/al-mahsan-logo.png"
                alt="Al Mahsan Logo"
                className="w-36 h-36 md:w-44 md:h-44 lg:w-72 lg:h-72 object-contain drop-shadow-[0_12px_32px_rgba(168,85,247,0.30)]"
              />
            </div>

            {/* Brand text */}
            <div className="space-y-1.5">
              <p className="text-purple-300/60 text-xs font-semibold uppercase tracking-[0.2em]">Welcome to</p>
              <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight leading-tight">
                Al Mahsan
              </h1>
              <p className="text-purple-200/50 text-sm lg:text-base font-medium">
                Art Festival Competition
              </p>

              {/* Divider accent */}
              <div className="flex items-center justify-center gap-2 pt-3">
                <div className="h-px w-8 bg-gradient-to-r from-transparent to-purple-500/50 rounded-full" />
                <div className="w-1.5 h-1.5 rounded-full bg-purple-500/60" />
                <div className="h-px w-8 bg-gradient-to-l from-transparent to-purple-500/50 rounded-full" />
              </div>

            </div>

            {/* Decorative pill tags — desktop only */}
            <div className="hidden lg:flex items-center gap-2 mt-8">
              <span className="px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300/70 text-[10px] font-semibold tracking-wider uppercase">Admins</span>
              <span className="w-1 h-1 rounded-full bg-gray-700" />
              <span className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300/70 text-[10px] font-semibold tracking-wider uppercase">Judges</span>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════
            RIGHT PANEL — Login Form
        ═══════════════════════════════════════════ */}
        <div className="flex-1 flex flex-col justify-center bg-[#1E1B2E] px-8 py-10 lg:px-14 lg:py-16 relative">

          {/* Subtle top-right glow inside form panel */}
          <div className="absolute top-0 right-0 w-56 h-56 bg-purple-600/5 rounded-full blur-[60px] pointer-events-none" />

          <div className="relative z-10 w-full max-w-sm mx-auto">

            {/* Form header */}
            <div className="mb-8">
              <h2 className="text-2xl lg:text-3xl font-bold text-white leading-tight mb-1.5">
                Welcome Back!
              </h2>
              <p className="text-gray-400 text-sm">
                Enter your credentials to continue
              </p>
            </div>

            {/* ── Error message — preserved exactly ── */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl mb-5 text-sm flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                {error}
              </div>
            )}

            {/* ── Login form — all fields preserved exactly ── */}
            <form onSubmit={handleLogin} className="space-y-5">

              {/* Username or Email — UNCHANGED */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Username or Email
                </label>
                <div className="relative group">
                  <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-purple-400 transition-colors pointer-events-none" />
                  <input
                    id="login-identifier"
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="w-full pl-10 pr-4 py-3.5 rounded-xl bg-[#13111C] border border-[#2D283E] focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 outline-none text-white placeholder-gray-600 transition-all text-sm"
                    placeholder="admin@fest.com or mal_judge1"
                    required
                    autoComplete="username"
                  />
                </div>
              </div>

              {/* Password — UNCHANGED */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative group">
                  <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-purple-400 transition-colors pointer-events-none" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-11 py-3.5 rounded-xl bg-[#13111C] border border-[#2D283E] focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 outline-none text-white placeholder-gray-600 transition-all text-sm"
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                  />
                  {/* Password toggle — UNCHANGED */}
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 focus:outline-none transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Sign In button — UNCHANGED colors/behavior */}
              <button
                id="login-submit"
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-lg shadow-purple-900/30 disabled:opacity-60 disabled:cursor-not-allowed transform active:scale-[0.98] mt-1"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

          </div>
        </div>

      </div>
    </div>
  );
}
