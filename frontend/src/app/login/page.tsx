'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import { Lock, User, Award, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0D0B18] text-white relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-purple-900/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-900/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative w-full max-w-md mx-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-purple-600/20 border border-purple-500/30 mb-4 shadow-lg shadow-purple-900/20">
            <Award size={32} className="text-purple-400" />
          </div>
          <h1 className="text-3xl font-bold text-white">Musabaqa</h1>
          <p className="text-gray-400 mt-1 text-sm">Competition Management System</p>
        </div>

        {/* Card */}
        <div className="bg-[#1E1B2E] border border-[#2D283E] rounded-3xl p-8 shadow-2xl shadow-black/50">
          <h2 className="text-xl font-bold mb-1 text-white">Sign In</h2>
          <p className="text-gray-400 text-sm mb-6">Enter your credentials to continue</p>
          
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl mb-5 text-sm flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
              {error}
            </div>
          )}
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Username or Email</label>
              <div className="relative">
                <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full pl-10 pr-4 py-3.5 rounded-xl bg-[#13111C] border border-[#2D283E] focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 outline-none text-white placeholder-gray-600 transition-all text-sm"
                  placeholder="admin@fest.com or mal_judge1"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-3.5 rounded-xl bg-[#13111C] border border-[#2D283E] focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 outline-none text-white placeholder-gray-600 transition-all text-sm"
                  placeholder="••••••••"
                  required
                />
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

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-lg shadow-purple-900/30 disabled:opacity-60 disabled:cursor-not-allowed transform active:scale-[0.98] mt-2"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-gray-600 text-xs mt-6">
            Admins use email · Judges use their username
          </p>
        </div>
      </div>
    </div>
  );
}
