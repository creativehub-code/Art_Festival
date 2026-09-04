'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Award, LogOut } from 'lucide-react';
import { apiRequest } from '@/lib/api';

export default function JudgeLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const data = await apiRequest('/auth/me', 'GET');
        if (data.role !== 'judge') {
          router.push('/login');
        } else {
          setAuthorized(true);
          setUser(data.user);
        }
      } catch (error) {
        router.push('/login');
      }
    };

    checkAuth();
  }, [router]);

  const handleLogout = async () => {
    try {
      await apiRequest('/auth/logout', 'POST');
    } catch (e) {
      // Ignore
    }
    localStorage.removeItem('role');
    localStorage.removeItem('user');
    localStorage.removeItem('csrfToken');
    router.push('/login');
  };

  if (!authorized) return <div className="text-white p-10 flex justify-center items-center min-h-screen bg-[#0D0B14]">Checking authorization...</div>;

  return (
    <div className="min-h-screen bg-[#0D0B14] text-white font-sans selection:bg-purple-500/30">
      <header className="px-6 py-3 bg-[#13111C] border-b border-[#2D283E] flex justify-between items-center sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <Award size={18} />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-white tracking-tight">Judge Panel</h1>
            <span className="text-gray-500 text-xs font-medium">| {user?.name || 'Judge'}</span>
          </div>
        </div>
        <button 
          onClick={handleLogout} 
          className="text-xs font-medium border border-gray-800 hover:border-red-500/30 bg-[#1A1825] hover:bg-red-500/10 text-gray-400 hover:text-red-400 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5"
        >
          <LogOut size={13} /> Logout
        </button>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        {children}
      </main>
    </div>
  );
}
