'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { 
  CheckCircle, 
  X, 
  Bell, 
  Gavel, 
  Trophy, 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  CheckCheck, 
  Trash2,
  Clock,
  ChevronDown,
  Sparkles
} from 'lucide-react';

export interface ToastData {
  id: string;
  judgeName?: string;
  programName?: string;
  language?: string;
  title?: string;
  message?: string;
  type?: 'success' | 'warning' | 'error' | 'info' | 'mark' | 'result';
  timestamp?: number | string;
  isRead?: boolean;
  isImportant?: boolean;
}

interface ToastContainerProps {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
  onClearAll?: () => void;
  onMarkAllAsRead?: () => void;
  isLoading?: boolean;
  title?: string;
  subtitle?: string;
  isFeedView?: boolean;
}

// Language badge colors matching existing app palette
const langColor: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  arabic:    { bg: 'bg-green-500/10',  text: 'text-green-300',  dot: 'bg-green-400',  border: 'border-green-500/20' },
  english:   { bg: 'bg-blue-500/10',   text: 'text-blue-300',   dot: 'bg-blue-400',   border: 'border-blue-500/20'  },
  malayalam: { bg: 'bg-orange-500/10', text: 'text-orange-300', dot: 'bg-orange-400', border: 'border-orange-500/20' },
  urdu:      { bg: 'bg-purple-500/10', text: 'text-purple-300', dot: 'bg-purple-400', border: 'border-purple-500/20' },
};

function getLangStyle(lang?: string) {
  if (!lang) return null;
  return langColor[lang.toLowerCase()] ?? { bg: 'bg-gray-700/40', text: 'text-gray-300', dot: 'bg-gray-400', border: 'border-gray-600/30' };
}

// Format relative time safely
function getRelativeTime(timestamp?: number | string): string {
  if (!timestamp) return 'Just now';
  const time = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
  if (isNaN(time)) return 'Just now';
  const diff = Math.floor((Date.now() - time) / 1000);
  if (diff < 30) return 'Just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// Determine icon and style based on alert properties or toast attributes
function getAlertIconAndStyle(toast: ToastData) {
  const type = toast.type || (
    toast.judgeName && toast.judgeName !== 'System' ? 'mark' :
    toast.programName?.toLowerCase().includes('recalculate') || toast.programName?.toLowerCase().includes('scores') ? 'result' :
    toast.programName?.toLowerCase().includes('reject') ? 'error' :
    toast.programName?.toLowerCase().includes('pending') ? 'warning' :
    'success'
  );

  switch (type) {
    case 'mark':
      return {
        icon: <Gavel size={15} className="text-purple-400" />,
        iconBg: 'bg-purple-500/15 border-purple-500/30',
        badgeColor: 'text-purple-400',
        defaultTitle: 'Mark Submitted',
        accentBorder: 'border-l-purple-500'
      };
    case 'result':
      return {
        icon: <Trophy size={15} className="text-yellow-400" />,
        iconBg: 'bg-yellow-500/15 border-yellow-500/30',
        badgeColor: 'text-yellow-400',
        defaultTitle: 'Result Updated',
        accentBorder: 'border-l-yellow-500'
      };
    case 'warning':
      return {
        icon: <AlertTriangle size={15} className="text-amber-400" />,
        iconBg: 'bg-amber-500/15 border-amber-500/30',
        badgeColor: 'text-amber-400',
        defaultTitle: 'Attention Required',
        accentBorder: 'border-l-amber-500'
      };
    case 'error':
      return {
        icon: <AlertCircle size={15} className="text-red-400" />,
        iconBg: 'bg-red-500/15 border-red-500/30',
        badgeColor: 'text-red-400',
        defaultTitle: 'Alert Exception',
        accentBorder: 'border-l-red-500'
      };
    case 'info':
      return {
        icon: <Info size={15} className="text-blue-400" />,
        iconBg: 'bg-blue-500/15 border-blue-500/30',
        badgeColor: 'text-blue-400',
        defaultTitle: 'System Notification',
        accentBorder: 'border-l-blue-500'
      };
    case 'success':
    default:
      return {
        icon: <CheckCircle size={15} className="text-green-400" />,
        iconBg: 'bg-green-500/15 border-green-500/30',
        badgeColor: 'text-green-400',
        defaultTitle: 'Action Successful',
        accentBorder: 'border-l-green-500'
      };
  }
}

function ToastCard({ 
  toast, 
  onDismiss,
  onToggleRead,
  autoDismiss = true 
}: { 
  toast: ToastData; 
  onDismiss: (id: string) => void;
  onToggleRead?: (id: string) => void;
  autoDismiss?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [isRead, setIsRead] = useState(!!toast.isRead);
  const langStyle = getLangStyle(toast.language);
  const { icon, iconBg, badgeColor, defaultTitle, accentBorder } = getAlertIconAndStyle(toast);

  // Mount animation
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  // Auto dismiss after 5s if enabled
  useEffect(() => {
    if (!autoDismiss) return;
    const t = setTimeout(() => onDismiss(toast.id), 5000);
    return () => clearTimeout(t);
  }, [toast.id, onDismiss, autoDismiss]);

  const handleCardClick = () => {
    setIsRead(true);
    if (onToggleRead) onToggleRead(toast.id);
  };

  const titleText = toast.title || (
    toast.judgeName && toast.judgeName !== 'System' ? 'Mark Submitted' :
    toast.programName || defaultTitle
  );

  const messageContent = toast.message || (
    toast.judgeName && toast.judgeName !== 'System' ? (
      <>
        <span className="text-purple-300 font-semibold">Judge {toast.judgeName}</span>
        <span className="text-gray-400 font-normal"> submitted a mark</span>
      </>
    ) : (
      <span className="text-gray-300">{toast.programName || 'System update processed.'}</span>
    )
  );

  const relativeTime = getRelativeTime(toast.timestamp);

  return (
    <div
      onClick={handleCardClick}
      className={`
        relative group overflow-hidden w-full sm:w-96 p-4 rounded-2xl shadow-2xl
        border transition-all duration-300 cursor-pointer
        ${isRead 
          ? 'bg-[#13111C]/90 border-[#2D283E] hover:border-gray-600/50' 
          : 'bg-[#1C182E] border-purple-500/30 hover:border-purple-500/50 shadow-purple-950/20'
        }
        ${toast.isImportant ? `border-l-4 ${accentBorder}` : ''}
        ${visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95'}
      `}
    >
      {/* Top Header Row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Alert Type Icon */}
          <div className={`shrink-0 w-8 h-8 rounded-xl border flex items-center justify-center shadow-inner ${iconBg}`}>
            {icon}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${badgeColor}`}>
                {titleText}
              </span>
              {!isRead && (
                <span className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.8)] animate-pulse shrink-0" />
              )}
            </div>
            <p className="text-xs text-gray-200 font-medium leading-snug truncate mt-0.5">
              {messageContent}
            </p>
          </div>
        </div>

        {/* Dismiss Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(toast.id);
          }}
          className="shrink-0 p-1 text-gray-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          aria-label="Dismiss alert"
        >
          <X size={14} />
        </button>
      </div>

      {/* Footer Info Row */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/[0.04]">
        {/* Language Badge */}
        {langStyle && toast.language ? (
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${langStyle.border} ${langStyle.bg} ${langStyle.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${langStyle.dot}`} />
            {toast.language}
          </span>
        ) : (
          <span className="text-[10px] text-purple-400/70 font-semibold uppercase tracking-wider">
            {toast.programName && toast.judgeName === 'System' ? 'System Notification' : 'Musabaqa Event'}
          </span>
        )}

        {/* Time Badge */}
        <div className="flex items-center gap-1 text-[10px] text-gray-500 font-mono">
          <Clock size={10} className="text-gray-600" />
          <span>{relativeTime}</span>
        </div>
      </div>

      {/* Progress Bar for Auto Dismiss */}
      {autoDismiss && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-800/80 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 animate-[shrink_5s_linear_forwards]" />
        </div>
      )}
    </div>
  );
}

// Main Toast / Alert Notification Center Container
export default function ToastContainer({ 
  toasts, 
  onDismiss, 
  onClearAll, 
  onMarkAllAsRead, 
  isLoading = false,
  title = "Alerts",
  subtitle = "Recent updates and important notifications",
  isFeedView = false
}: ToastContainerProps) {
  const [readState, setReadState] = useState<Record<string, boolean>>({});
  const [isMinimized, setIsMinimized] = useState(false);

  const unreadCount = useMemo(() => {
    return toasts.filter(t => !t.isRead && !readState[t.id]).length;
  }, [toasts, readState]);

  const handleToggleRead = (id: string) => {
    setReadState(prev => ({ ...prev, [id]: true }));
  };

  const handleMarkAllRead = () => {
    const updated: Record<string, boolean> = {};
    toasts.forEach(t => { updated[t.id] = true; });
    setReadState(updated);
    if (onMarkAllAsRead) onMarkAllAsRead();
  };

  const handleClearAll = () => {
    if (onClearAll) {
      onClearAll();
    } else {
      toasts.forEach(t => onDismiss(t.id));
    }
  };

  if (!toasts.length && !isLoading && !isFeedView) return null;

  return (
    <div className={`fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 items-end max-w-full px-4 sm:px-0 ${isFeedView ? 'relative bottom-0 right-0 z-0 items-stretch w-full' : ''}`}>
      
      {/* Premium Notification Center Panel Container */}
      <div className="w-full sm:w-96 bg-[#1E1B2E] border border-[#2D283E] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden backdrop-blur-xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-4">
        
        {/* Container Header */}
        <div className="p-4 bg-gradient-to-r from-[#26203D] to-[#1E1B2E] border-b border-[#2D283E] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shadow-inner">
              <Bell size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight">{title}</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <p className="text-[10px] text-gray-400 font-medium">{subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {toasts.length > 0 && (
              <>
                <button
                  onClick={handleMarkAllRead}
                  title="Mark all as read"
                  className="p-1.5 text-gray-400 hover:text-purple-300 hover:bg-white/5 rounded-lg transition-colors text-[10px] font-bold flex items-center gap-1"
                >
                  <CheckCheck size={14} />
                </button>
                <button
                  onClick={handleClearAll}
                  title="Clear all alerts"
                  className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors text-[10px] font-bold flex items-center gap-1"
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
            {!isFeedView && (
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              >
                <ChevronDown size={16} className={`transition-transform duration-300 ${isMinimized ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>
        </div>

        {/* Container Body Feed */}
        {!isMinimized && (
          <div className="p-3 space-y-2.5 max-h-[70vh] overflow-y-auto custom-scrollbar bg-[#0F0D15]/40">
            {/* Loading Skeleton State */}
            {isLoading ? (
              <div className="space-y-2.5">
                {[1, 2, 3].map(i => (
                  <div key={i} className="p-4 bg-[#13111C] border border-[#2D283E] rounded-2xl animate-pulse flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-gray-800 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-gray-800 rounded w-1/3" />
                      <div className="h-3 bg-gray-800/60 rounded w-3/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : toasts.length === 0 ? (
              /* Polished Empty State */
              <div className="flex flex-col items-center justify-center p-8 text-center bg-[#13111C]/40 rounded-xl border border-[#2D283E]/50 my-1">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-3 shadow-inner">
                  <Sparkles size={22} />
                </div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">No new alerts</h4>
                <p className="text-[11px] text-gray-500 mt-1">You're all caught up.</p>
              </div>
            ) : (
              /* Stacked Alert Cards */
              toasts.map(toast => (
                <ToastCard
                  key={toast.id}
                  toast={{ ...toast, isRead: toast.isRead || readState[toast.id] }}
                  onDismiss={onDismiss}
                  onToggleRead={handleToggleRead}
                  autoDismiss={!isFeedView}
                />
              ))
            )}
          </div>
        )}

      </div>
    </div>
  );
}
