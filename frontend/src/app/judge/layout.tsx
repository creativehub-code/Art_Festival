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

  if (!authorized) return <div className="text-white p-10">Checking authorization...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans">
      <header className="p-4 bg-gray-900 border-b border-gray-800 flex justify-between items-center bg-opacity-80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <Award className="text-purple-500" />
          <h1 className="text-xl font-bold">Judge Panel <span className="text-gray-500 text-sm font-normal">| {user?.name || 'Judge'}</span></h1>
        </div>
        <button 
          onClick={handleLogout} 
          className="text-sm border border-gray-700 hover:bg-red-500/10 hover:text-red-400 px-3 py-1 rounded transition text-gray-400 flex items-center gap-2"
        >
          <LogOut size={16} /> Logout
        </button>
      </header>

      <main className="p-6 max-w-4xl mx-auto">
        {children}
      </main>
    </div>
  );
}
