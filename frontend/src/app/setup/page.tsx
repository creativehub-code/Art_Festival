'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import { Shield, Smartphone, ArrowRight, User, Mail, Lock } from 'lucide-react';
import ToastContainer from '@/components/ToastContainer';
import { useToast } from '@/lib/useToast';

export default function SetupPage() {
  const router = useRouter();
  const { toasts, addToast, dismissToast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiRequest('/auth/setup', 'POST', formData);
      addToast({ title: 'Setup Complete', message: 'Admin created successfully! Please login.', type: 'success' });
      setTimeout(() => {
        router.push('/login');
      }, 1000);
    } catch (err: any) {
      addToast({ title: 'Setup Error', message: err.message || 'Failed to complete setup', type: 'error' });
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/20 rounded-full blur-3xl"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-3xl"></div>
        </div>

        <div className="w-full max-w-md bg-gray-900/50 backdrop-blur-xl border border-gray-800 p-8 rounded-3xl shadow-2xl relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-500">
            <div className="mb-8 text-center">
                <div className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 shadow-lg shadow-purple-500/30 mb-4">
                    <Shield size={32} className="text-white" />
                </div>
                <h1 className="text-3xl font-bold text-white mb-2">Initial Setup</h1>
                <p className="text-gray-400">Create the first Admin account to get started.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-300 ml-1">Full Name</label>
                    <div className="relative group">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-purple-400 transition-colors" size={18} />
                        <input 
                            type="text"
                            required
                            className="w-full bg-gray-950/50 border border-gray-800 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all outline-none"
                            placeholder="John Doe"
                            value={formData.name}
                            onChange={e => setFormData({...formData, name: e.target.value})}
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-300 ml-1">Email Address</label>
                    <div className="relative group">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-purple-400 transition-colors" size={18} />
                        <input 
                            type="email"
                            required
                            className="w-full bg-gray-950/50 border border-gray-800 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all outline-none"
                            placeholder="admin@example.com"
                            value={formData.email}
                            onChange={e => setFormData({...formData, email: e.target.value})}
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-300 ml-1">Password</label>
                    <div className="relative group">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-purple-400 transition-colors" size={18} />
                        <input 
                            type="password"
                            required
                            className="w-full bg-gray-950/50 border border-gray-800 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all outline-none"
                            placeholder="••••••••"
                            value={formData.password}
                            onChange={e => setFormData({...formData, password: e.target.value})}
                        />
                    </div>
                </div>

                <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full bg-white text-black font-bold py-3.5 rounded-xl hover:bg-gray-100 transition-all transform active:scale-[0.98] shadow-lg shadow-white/10 flex items-center justify-center gap-2 mt-4"
                >
                    {loading ? (
                        <span className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></span>
                    ) : (
                        <>Complete Setup <ArrowRight size={18} /></>
                    )}
                </button>
            </form>
        </div>
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
