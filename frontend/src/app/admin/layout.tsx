'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Users, LayoutGrid, Award, Calendar, FileText, LogOut, CheckSquare, PanelLeftClose, PanelLeftOpen, BarChart3, Shield, UsersRound, Gavel, BookOpen, Plus } from 'lucide-react';
import { apiRequest } from '@/lib/api';

import { AdminProvider } from './AdminContext';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const data = await apiRequest('/auth/me', 'GET');
        if (data.role !== 'admin') {
          router.push('/login');
        } else {
          setAuthorized(true);
        }
      } catch (error) {
        router.push('/login');
      }
    };

    checkAuth();
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('user');
    router.push('/login');
  };

  if (!authorized) return <div className="text-white p-10">Checking authorization...</div>;

  return (
    <AdminProvider>
      <div className="flex min-h-screen bg-[#080A12] text-white font-sans pb-20 md:pb-0 overflow-x-hidden">
        
        {/* Toggle Button explicitly when closed */}
        <div className={`hidden md:flex fixed top-6 left-6 z-40 transition-opacity duration-300 ${isSidebarOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 bg-[#12152A]/80 border border-white/10 rounded-lg text-gray-400 hover:text-white backdrop-blur-xl transition hover:bg-[#1C2040] shadow-lg"
          >
            <PanelLeftOpen size={24} />
          </button>
        </div>

        {/* Sidebar - Hidden on Mobile, togglable on desktop */}
        <aside className={`hidden md:flex w-64 bg-[#0D0F1E] border-r border-white/[0.06] flex-col fixed h-full z-50 transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          
          {/* App Header */}
          <div className="px-6 pt-7 pb-6 flex items-center justify-between border-b border-white/[0.06]">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Admin Panel</h2>
              <p className="text-xs text-gray-500 mt-0.5 font-medium">Art Festival Admin</p>
            </div>
            <button 
              onClick={() => setIsSidebarOpen(false)} 
              className="text-gray-600 hover:text-gray-400 transition p-1 hover:bg-white/5 rounded-md"
            >
              <PanelLeftClose size={20} />
            </button>
          </div>
          
          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
            <NavLink href="/admin/dashboard" icon={<LayoutGrid size={18}/>}>Dashboard</NavLink>
            <NavLink href="/admin/participants" icon={<Users size={18}/>}>Participants</NavLink>
            <NavLink href="/admin/teams" icon={<Shield size={18}/>}>Teams</NavLink>
            <NavLink href="/admin/groups" icon={<UsersRound size={18}/>}>Groups</NavLink>
            <NavLink href="/admin/programs" icon={<BookOpen size={18}/>}>Programs</NavLink>
            <NavLink href="/admin/judges" icon={<Gavel size={18}/>}>Judges</NavLink>
            <NavLink href="/admin/marks" icon={<CheckSquare size={18}/>}>Review Marks</NavLink>
            <NavLink href="/admin/export" icon={<BarChart3 size={18}/>}>Individual Marks</NavLink>
          </nav>

          {/* Bottom actions */}
          <div className="px-3 pb-4 pt-2 border-t border-white/[0.06] space-y-2">
            <Link
              href="/admin/participants"
              className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-sm transition-all shadow-lg shadow-purple-900/30 hover:shadow-purple-900/50"
            >
              <Plus size={16} />
              Create New
            </Link>
            <button 
              onClick={handleLogout} 
              className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-red-500/10 hover:text-red-400 transition text-gray-500 text-sm font-medium"
            >
              <LogOut size={18} />
              Logout
            </button>
          </div>
        </aside>

        {/* Mobile Bottom Navigation */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0D0F1E]/95 backdrop-blur-xl border-t border-white/[0.06] z-50 px-6 py-4 flex justify-between items-center pb-safe">
            <MobileNavLink href="/admin/dashboard" icon={<LayoutGrid size={24}/>} label="Dashboard" />
            <MobileNavLink href="/admin/teams" icon={<Shield size={24}/>} label="Teams" />
            <div className="relative -top-8">
               <Link href="/admin/programs" className="w-16 h-16 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-900/50 hover:scale-105 transition-transform">
                  <Calendar size={28} />
               </Link>
            </div>
             <MobileNavLink href="/admin/participants" icon={<Users size={24}/>} label="People" />
             <button onClick={handleLogout} className="flex flex-col items-center gap-1 text-gray-500 hover:text-red-400">
                 <LogOut size={24} />
                 <span className="text-[10px] font-medium">Logout</span>
             </button>
        </div>

        {/* Main Content - Adjusted Margin */}
        <main className={`flex-1 transition-all duration-300 p-2 md:p-8 ${isSidebarOpen ? 'md:ml-64' : 'md:ml-0'}`}>
          {children}
        </main>
      </div>
    </AdminProvider>
  );
}

function NavLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link 
      href={href} 
      className={`relative flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group text-sm font-medium ${
        isActive 
          ? 'bg-[#1C1F35] text-white shadow-sm' 
          : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]'
      }`}
    >
      {/* Active left accent */}
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-purple-500" />
      )}
      
      <span className={`transition-colors duration-200 ${isActive ? 'text-purple-400' : 'text-gray-600 group-hover:text-gray-400'}`}>
        {icon}
      </span>
      <span className="tracking-wide">{children}</span>
      
      {/* Active dot */}
      {isActive && (
         <div className="ml-auto w-1.5 h-1.5 rounded-full bg-purple-500" />
      )}
    </Link>
  );
}

function MobileNavLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
    const pathname = usePathname();
    const isActive = pathname === href;
  
    return (
      <Link href={href} className={`flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-purple-400' : 'text-gray-500 hover:text-gray-300'}`}>
          {icon}
          <span className="text-[10px] font-medium">{label}</span>
      </Link>
    );
  }
