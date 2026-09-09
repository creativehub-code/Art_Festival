'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Users, LayoutGrid, Award, Calendar, FileText, LogOut, CheckSquare, PanelLeftClose, PanelLeftOpen, BarChart3, Shield, UsersRound, Gavel, BookOpen, Plus, Menu, X } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';


export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute default
        refetchOnWindowFocus: false,
      },
    },
  }));

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

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

  const handleLogout = async () => {
    try {
      await apiRequest('/auth/logout', 'POST');
    } catch (e) {
      // Ignore errors on logout
    }
    localStorage.removeItem('role');
    localStorage.removeItem('user');
    localStorage.removeItem('csrfToken');
    router.push('/login');
  };

  if (!authorized) return <div className="text-white p-10">Checking authorization...</div>;

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-screen bg-[#080A12] text-white font-sans pb-28 pt-14 md:py-0 overflow-x-hidden w-full max-w-full min-w-0">
        
        {/* Sidebar - Hidden on Mobile, togglable on desktop */}
        <aside className={`hidden md:flex bg-[#0D0F1E] border-r border-white/[0.06] flex-col fixed h-full z-50 transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
          
          {/* App Header */}
          <div className={`pt-7 pb-6 flex items-center border-b border-white/[0.06] ${isSidebarOpen ? 'px-6 justify-between' : 'px-0 justify-center'}`}>
            {isSidebarOpen && (
              <div className="overflow-hidden transition-all duration-300 whitespace-nowrap">
                <h2 className="text-xl font-bold text-white tracking-tight">Admin Panel</h2>
                <p className="text-xs text-gray-500 mt-0.5 font-medium">Art Festival Admin</p>
              </div>
            )}
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
              className="text-gray-600 hover:text-gray-400 transition p-1 hover:bg-white/5 rounded-md"
            >
              {isSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
            </button>
          </div>
          
          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto no-scrollbar">
            <NavLink href="/admin/dashboard" icon={<LayoutGrid size={18}/>} isSidebarOpen={isSidebarOpen}>Dashboard</NavLink>
            <NavLink href="/admin/participants" icon={<Users size={18}/>} isSidebarOpen={isSidebarOpen}>Participants</NavLink>
            <NavLink href="/admin/teams" icon={<Shield size={18}/>} isSidebarOpen={isSidebarOpen}>Teams</NavLink>
            <NavLink href="/admin/groups" icon={<UsersRound size={18}/>} isSidebarOpen={isSidebarOpen}>Groups</NavLink>
            <NavLink href="/admin/programs" icon={<BookOpen size={18}/>} isSidebarOpen={isSidebarOpen}>Programs</NavLink>
            <NavLink href="/admin/judges" icon={<Gavel size={18}/>} isSidebarOpen={isSidebarOpen}>Judges</NavLink>
            <NavLink href="/admin/marks" icon={<CheckSquare size={18}/>} isSidebarOpen={isSidebarOpen}>Review Marks</NavLink>
            <NavLink href="/admin/export" icon={<BarChart3 size={18}/>} isSidebarOpen={isSidebarOpen}>Individual Marks</NavLink>
          </nav>

          {/* Bottom actions */}
          <div className="px-3 pb-4 pt-2 border-t border-white/[0.06] space-y-2">
            <Link
              href="/admin/participants"
              className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-sm transition-all shadow-lg shadow-purple-900/30 hover:shadow-purple-900/50 group relative ${isSidebarOpen ? 'px-4' : 'px-0'}`}
            >
              <Plus size={16} />
              {isSidebarOpen && <span>Create New</span>}
              {!isSidebarOpen && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity bg-gray-800 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-50 shadow-xl">
                  Create New
                </div>
              )}
            </Link>
            <button 
              onClick={handleLogout} 
              className={`flex items-center gap-3 w-full p-3 rounded-xl hover:bg-red-500/10 hover:text-red-400 transition text-gray-500 text-sm font-medium group relative ${isSidebarOpen ? '' : 'justify-center'}`}
            >
              <LogOut size={18} />
              {isSidebarOpen && <span>Logout</span>}
              {!isSidebarOpen && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity bg-gray-800 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-50 shadow-xl">
                  Logout
                </div>
              )}
            </button>
          </div>
        </aside>

        {/* Mobile Top Header with Top-Left Three-Line Menu Button */}
        <div className="md:hidden fixed top-0 left-0 right-0 bg-[#0D0F1E]/95 backdrop-blur-xl border-b border-white/[0.06] z-40 px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
              className={`p-2 rounded-xl border transition-all ${
                isMobileMenuOpen 
                  ? 'bg-purple-600/20 text-purple-400 border-purple-500/40 shadow-sm' 
                  : 'bg-[#13111C] text-gray-300 border-white/[0.08] hover:text-white'
              }`}
              aria-label="Toggle Mobile Navigation Menu"
            >
              {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            <div className="flex flex-col">
              <span className="text-sm font-bold text-white tracking-tight leading-none">Admin Panel</span>
              <span className="text-[10px] text-purple-400 font-medium mt-0.5">Art Festival</span>
            </div>
          </div>
        </div>

        {/* Mobile Top-Left Hamburger Drawer Menu Popover */}
        {isMobileMenuOpen && (
          <>
            {/* Backdrop overlay */}
            <div 
              className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-in fade-in duration-200" 
              onClick={() => setIsMobileMenuOpen(false)}
            />
            
            {/* Compact glassmorphism popover menu positioned under top-left button */}
            <div className="md:hidden fixed top-14 left-4 z-50 w-60 bg-[#13111C]/95 backdrop-blur-2xl border border-purple-500/30 rounded-2xl p-2 shadow-[0_10px_30px_rgba(0,0,0,0.8)] animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06] mb-1">
                <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">Navigation</span>
                <button 
                  onClick={() => setIsMobileMenuOpen(false)} 
                  className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-1">
                <Link
                  href="/admin/teams"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    pathname === '/admin/teams' ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30' : 'text-gray-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Shield size={18} className="text-indigo-400" />
                  <span>Teams</span>
                </Link>

                <Link
                  href="/admin/participants"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    pathname === '/admin/participants' ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30' : 'text-gray-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Users size={18} className="text-purple-400" />
                  <span>People</span>
                </Link>

                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-all text-left"
                >
                  <LogOut size={18} />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* Mobile Bottom Navigation */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0D0F1E]/95 backdrop-blur-xl border-t border-white/[0.06] z-40 px-1 py-3 sm:px-4 flex justify-around items-center pb-safe">
            {/* Dashboard */}
            <MobileNavLink href="/admin/dashboard" icon={<LayoutGrid size={20}/>} label="Dashboard" />

            {/* Judge Panel */}
            <MobileNavLink href="/admin/judges" icon={<Gavel size={20}/>} label="Judges" />

            {/* Center Floating Button */}
            <div className="relative -top-6 shrink-0">
               <Link href="/admin/programs" className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-900/50 hover:scale-105 transition-transform border-2 border-[#0D0F1E]">
                  <Calendar size={24} />
               </Link>
            </div>

            {/* Review Marks */}
            <MobileNavLink href="/admin/marks" icon={<CheckSquare size={20}/>} label="Review" />

            {/* Individual Marks */}
            <MobileNavLink href="/admin/export" icon={<BarChart3 size={20}/>} label="Individual" />
        </div>

        {/* Main Content - Adjusted Margin */}
        <main className={`flex-1 transition-all duration-300 px-4 py-4 md:p-8 w-full max-w-full min-w-0 ${isSidebarOpen ? 'md:ml-64' : 'md:ml-20'}`}>
          {children}
        </main>
      </div>
    </QueryClientProvider>
  );
}

function NavLink({ href, icon, children, isSidebarOpen }: { href: string; icon: React.ReactNode; children: React.ReactNode; isSidebarOpen: boolean }) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link 
      href={href} 
      className={`relative flex items-center gap-3 py-2.5 rounded-xl transition-all duration-200 group text-sm font-medium ${
        isActive 
          ? 'bg-[#1C1F35] text-white shadow-sm' 
          : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]'
      } ${isSidebarOpen ? 'px-4' : 'px-0 justify-center'}`}
    >
      {/* Active left accent */}
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-purple-500" />
      )}
      
      <span className={`transition-colors duration-200 ${isActive ? 'text-purple-400' : 'text-gray-600 group-hover:text-gray-400'}`}>
        {icon}
      </span>
      {isSidebarOpen && (
        <span className="tracking-wide">{children}</span>
      )}
      
      {/* Active dot */}
      {isActive && isSidebarOpen && (
         <div className="ml-auto w-1.5 h-1.5 rounded-full bg-purple-500" />
      )}
      {isActive && !isSidebarOpen && (
         <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-purple-500" />
      )}

      {/* Tooltip */}
      {!isSidebarOpen && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity bg-gray-800 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-50 shadow-xl">
          {children}
        </div>
      )}
    </Link>
  );
}

function MobileNavLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
    const pathname = usePathname();
    const isActive = pathname === href;
  
    return (
      <Link href={href} className={`flex flex-col items-center gap-1 transition-colors px-0.5 text-center min-w-0 ${isActive ? 'text-purple-400' : 'text-gray-500 hover:text-gray-300'}`}>
          {icon}
          <span className="text-[9px] sm:text-[10px] font-medium leading-none text-center whitespace-nowrap tracking-tight">{label}</span>
      </Link>
    );
  }
