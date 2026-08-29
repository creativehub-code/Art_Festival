'use client';

import React from 'react';
import { AlertTriangle, Trash2, HelpCircle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  title = "Confirm Action",
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const styles = {
    danger: {
      icon: <Trash2 size={24} className="text-red-400" />,
      iconBg: 'bg-red-500/15 border-red-500/30',
      buttonBg: 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 shadow-red-950/40',
      titleColor: 'text-red-400',
    },
    warning: {
      icon: <AlertTriangle size={24} className="text-amber-400" />,
      iconBg: 'bg-amber-500/15 border-amber-500/30',
      buttonBg: 'bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 shadow-amber-950/40',
      titleColor: 'text-amber-400',
    },
    info: {
      icon: <HelpCircle size={24} className="text-purple-400" />,
      iconBg: 'bg-purple-500/15 border-purple-500/30',
      buttonBg: 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-purple-950/40',
      titleColor: 'text-purple-400',
    },
  }[variant];

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-[#1E1B2E] border border-[#2D283E] rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200 relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-2 text-gray-500 hover:text-white rounded-full hover:bg-white/10 transition-colors"
        >
          <X size={18} />
        </button>

        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 shadow-inner ${styles.iconBg}`}>
            {styles.icon}
          </div>
          <div>
            <h3 className={`text-lg font-bold ${styles.titleColor}`}>{title}</h3>
            <p className="text-sm text-gray-300 mt-1.5 leading-relaxed">{message}</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-white/[0.06]">
          <button
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl border border-gray-700 hover:border-gray-600 text-gray-300 hover:text-white text-sm font-semibold transition-all"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-5 py-2.5 rounded-xl text-white text-sm font-bold transition-all shadow-lg active:scale-95 ${styles.buttonBg}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
