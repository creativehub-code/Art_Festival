'use client';

import { useEffect, useState } from 'react';
import { apiRequest, API_BASE_URL } from '@/lib/api';
import { Trash2, Plus, X, Layers, Globe, FileText, CheckCircle, Users, Edit, Hash, ArrowUpDown } from 'lucide-react';
import { usePrograms, useGroups, useParticipants, useInvalidate } from '@/lib/queries';
import ToastContainer from '@/components/ToastContainer';
import ConfirmModal from '@/components/ConfirmModal';
import { useToast } from '@/lib/useToast';

export default function ProgramsPage() {
  const { data: programs = [], isLoading: loadingPrograms } = usePrograms();
  const { data: groups = [] as any[] } = useGroups();
  const { invalidatePrograms } = useInvalidate();
  const { toasts, addToast, dismissToast } = useToast();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const loading = loadingPrograms;
  const [selectedGroupFilters, setSelectedGroupFilters] = useState<Record<string, string>>({});
  
  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [modalDefaultLanguage, setModalDefaultLanguage] = useState('');

  // Edit modal state
  const [editingProgram, setEditingProgram] = useState<any | null>(null);

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    try {
      await apiRequest(`/programs/${id}`, 'PATCH', { status: newStatus });
      invalidatePrograms();
      addToast({ title: 'Status Updated', message: `Program status changed to ${newStatus}`, type: 'success' });
    } catch (e: any) { addToast({ title: 'Update Error', message: e.message || 'Failed to update status', type: 'error' }); }
  };

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDeleteProgram = async () => {
    if (!deleteConfirmId) return;
    try {
      await apiRequest(`/programs/${deleteConfirmId}`, 'DELETE');
      invalidatePrograms();
      addToast({ title: 'Program Deleted', message: 'Program deleted successfully.', type: 'info' });
    } catch (e: any) { 
      addToast({ title: 'Delete Failed', message: e.message || 'Failed to delete program', type: 'error' }); 
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const openCreateModal = (language: string = '') => {
    setModalDefaultLanguage(language);
    setIsCreateModalOpen(true);
  };

  const languages = ['Malayalam', 'Arabic', 'Urdu', 'English'];

  // Expandable Row State
  const [expandedProgramId, setExpandedProgramId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'participants' | 'topics'>('participants');
  const { data: participants = [] as any[] } = useParticipants();

  /** Sort programs within a language by languagePosition (nulls last), then by name */
  const getProgramsByLanguage = (lang: string) => {
    const filtered = programs.filter((p: any) => {
      const matchesLang = (p.language || 'English') === lang;
      const filterGroupId = selectedGroupFilters[lang];
      const programGroupId = p.groupId?._id ? String(p.groupId._id) : (p.groupId ? String(p.groupId) : '');
      const matchesGroup = filterGroupId 
        ? programGroupId === String(filterGroupId)
        : true;
      return matchesLang && matchesGroup;
    });

    return [...filtered].sort((a: any, b: any) => {
      const aPos = a.languagePosition;
      const bPos = b.languagePosition;
      if (aPos !== null && aPos !== undefined && bPos !== null && bPos !== undefined) return aPos - bPos;
      if (aPos !== null && aPos !== undefined) return -1;
      if (bPos !== null && bPos !== undefined) return 1;
      return a.name.localeCompare(b.name);
    });
  };

  if (loading && programs.length === 0) {
      return <div className="p-10 text-white">Loading programs...</div>;
  }

  return (
    <div className="space-y-12 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-500">Manage Programs</h2>
            <p className="text-gray-400">Create, organize and track competition items.</p>
        </div>
        <button 
          onClick={() => openCreateModal()} 
          className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-purple-900/20 transition-all"
        >
          <Plus size={20} />
          Create New Program
        </button>
      </div>
      
      {/* List Sections */}
      <div className="space-y-12">
        {languages.map(language => {
            const langPrograms = getProgramsByLanguage(language);

            return (
                <div key={language}>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                        <div className="flex items-center gap-4">
                            <h3 className="text-3xl font-bold text-purple-400">{language} Programs</h3>
                            <button 
                                onClick={() => openCreateModal(language)}
                                className="bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white p-2 rounded-lg transition-colors border border-gray-700"
                                title={`Add ${language} Program`}
                            >
                                <Plus size={16} />
                            </button>
                        </div>
                        
                        <div className="flex gap-2 overflow-x-auto custom-scrollbar max-w-full pb-1">
                            <button
                                type="button"
                                onClick={() => setSelectedGroupFilters(prev => ({ ...prev, [language]: '' }))}
                                className={`px-3 py-1 rounded text-sm font-medium transition-colors whitespace-nowrap ${
                                    !selectedGroupFilters[language]
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                }`}
                            >
                                All
                            </button>
                            {groups.map((g: any) => {
                                const isSelected = selectedGroupFilters[language] === g._id;
                                return (
                                    <button
                                        key={g._id}
                                        type="button"
                                        onClick={() => setSelectedGroupFilters(prev => ({ ...prev, [language]: g._id }))}
                                        className={`px-3 py-1 rounded text-sm font-medium transition-colors whitespace-nowrap ${
                                            isSelected
                                            ? 'bg-purple-600 text-white'
                                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                        }`}
                                    >
                                        {g.name}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="space-y-2">
                        {/* Desktop Header */}
                        <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-2 mb-2 text-gray-500 text-[11px] font-bold uppercase tracking-wider items-center">
                            <div className="col-span-1">#</div>
                            <div className="col-span-4">Program Name</div>
                            <div className="col-span-2">Group</div>
                            <div className="col-span-2 flex items-center gap-1"><ArrowUpDown size={10} /> Order</div>
                            <div className="col-span-2">Status</div>
                            <div className="col-span-1 text-right">Actions</div>
                        </div>

                        {/* Desktop List */}
                        <div className="hidden md:block space-y-2.5">
                            {langPrograms.length > 0 ? (
                                langPrograms.map((p: any, index: number) => {
                                    const borderAccents = [
                                        'border-l-purple-500',
                                        'border-l-amber-500',
                                        'border-l-blue-500',
                                        'border-l-indigo-500',
                                    ];
                                    const leftBorderClass = borderAccents[index % borderAccents.length];

                                    return (
                                        <div key={p._id} className="flex flex-col mb-2" style={{ animationDelay: `${index * 50}ms` }}>
                                          <div 
                                              className={`card-animate grid grid-cols-12 gap-4 items-center px-6 py-3.5 bg-[#131629] border border-white/[0.06] border-l-2 ${leftBorderClass} ${expandedProgramId === p._id ? 'rounded-t-xl border-b-0' : 'rounded-xl'} cursor-pointer hover:border-purple-500/40 hover:bg-[#161830] transition-all duration-200 group shadow-sm`}
                                              onClick={() => {
                                                  setExpandedProgramId(expandedProgramId === p._id ? null : p._id);
                                                  setActiveTab('participants');
                                              }}
                                          >
                                            <div className="col-span-1 flex items-center">
                                                <span className="text-gray-400 font-mono text-xs font-bold">
                                                    {p.languagePosition != null ? String(p.languagePosition).padStart(2, '0') : '--'}
                                                </span>
                                            </div>
                                            
                                            <div className="col-span-4 flex items-center gap-2 min-w-0">
                                                <span className="font-semibold text-gray-200 group-hover:text-white transition-colors text-sm truncate tracking-tight">
                                                    {p.name}
                                                </span>
                                                {p.isConversation && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                                                        <Users size={10} /> Pair
                                                    </span>
                                                )}
                                                <Users size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hidden md:block" />
                                                {(p.topics && p.topics.length > 0) ? (
                                                    <span className="text-[10px] text-gray-400 font-bold px-2 py-0.5 rounded-full bg-gray-800/50 border border-gray-700/50">
                                                        {p.topics.length} Topic{p.topics.length !== 1 ? 's' : ''}
                                                    </span>
                                                ) : null}
                                            </div>

                                            <div className="col-span-2 flex items-center">
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border bg-purple-500/10 text-purple-400 border-purple-500/30 uppercase tracking-wider">
                                                    <span className="truncate">{p.groupId?.name || '-'}</span>
                                                </span>
                                            </div>

                                            {/* Position badges */}
                                            <div className="col-span-2 flex items-center gap-1.5">
                                                {p.globalPosition != null ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full whitespace-nowrap">
                                                        <Hash size={9} />G{p.globalPosition}
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] text-gray-600 font-mono">—</span>
                                                )}
                                                {p.languagePosition != null ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full whitespace-nowrap">
                                                        <Hash size={9} />{language.substring(0,2)}{p.languagePosition}
                                                    </span>
                                                ) : null}
                                            </div>

                                            <div className="col-span-2 flex items-center" onClick={e => e.stopPropagation()}>
                                                 <select 
                                                    value={p.status || 'upcoming'}
                                                    onChange={(e) => handleStatusUpdate(p._id, e.target.value)}
                                                    className={`p-1.5 pl-3 pr-8 rounded-lg text-[10px] font-bold uppercase tracking-wider outline-none cursor-pointer appearance-none transition-colors border ${
                                                        p.status === 'ongoing' ? 'text-yellow-500 border-yellow-500/30 bg-yellow-500/5' :
                                                        p.status === 'completed' ? 'text-green-500 border-green-500/30 bg-green-500/5' :
                                                        'text-blue-500 border-blue-500/30 bg-blue-500/5'
                                                    }`}
                                                >
                                                    <option value="upcoming" className="bg-[#13111C] text-gray-300">UPCOMING</option>
                                                    <option value="ongoing" className="bg-[#13111C] text-yellow-500">ONGOING</option>
                                                    <option value="completed" className="bg-[#13111C] text-green-500">COMPLETED</option>
                                                </select>
                                            </div>

                                            <div className="col-span-1 flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                                                 <button 
                                                    onClick={() => setEditingProgram(p)}
                                                    className="text-gray-600 hover:text-blue-400 p-2 rounded-lg hover:bg-blue-500/10 transition-colors opacity-0 group-hover:opacity-100"
                                                    title="Edit Program"
                                                >
                                                    <Edit size={15} />
                                                </button>
                                                 <button 
                                                    onClick={() => handleDelete(p._id)}
                                                    className="text-gray-600 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                                                    title="Delete Program"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                          </div>
                                          {expandedProgramId === p._id && (
                                              <div className={`border border-white/[0.06] border-t-0 border-l-2 ${leftBorderClass} bg-[#13111C]/80 rounded-b-xl p-6`}>
                                                  <div className="flex gap-4 border-b border-gray-800 mb-6">
                                                      <button 
                                                          onClick={(e) => { e.stopPropagation(); setActiveTab('participants'); }}
                                                          className={`pb-3 px-2 font-bold text-sm transition-colors border-b-2 ${activeTab === 'participants' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                                                      >
                                                          Participants
                                                      </button>
                                                      <button 
                                                          onClick={(e) => { e.stopPropagation(); setActiveTab('topics'); }}
                                                          className={`pb-3 px-2 font-bold text-sm transition-colors border-b-2 ${activeTab === 'topics' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                                                      >
                                                          Topics
                                                      </button>
                                                  </div>
                                                  {activeTab === 'participants' && <ParticipantsTab program={p} participants={participants} />}
                                                  {activeTab === 'topics' && <TopicsTab program={p} refreshPrograms={invalidatePrograms} addToast={addToast} participants={participants} />}
                                              </div>
                                          )}
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="py-16 text-center text-gray-500 bg-[#13111C]/30 rounded-xl border border-white/[0.06]">
                                    <div className="flex flex-col items-center justify-center gap-4">
                                        <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center border border-gray-800 shadow-inner">
                                            <FileText size={24} className="text-purple-500/50" />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-lg font-medium text-gray-300">No {language} programs created yet</p>
                                            <p className="text-sm">Click the + button above to add one.</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Mobile list view */}
                        <div className="md:hidden space-y-2">
                            {langPrograms.length > 0 ? (
                                langPrograms.map((p: any, index: number) => (
                                    <div key={p._id} className="flex flex-col">
                                      <div className={`flex items-center gap-3 px-4 py-3 bg-[#131629] border border-white/[0.07] ${expandedProgramId === p._id ? 'rounded-t-xl border-b-0' : 'rounded-xl'} cursor-pointer`} onClick={() => { setExpandedProgramId(expandedProgramId === p._id ? null : p._id); setActiveTab('participants'); }}>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-gray-200 text-sm truncate flex items-center gap-2">
                                                {p.name}
                                                {p.isConversation && (
                                                    <Users size={12} className="text-indigo-400" />
                                                )}
                                            </p>
                                            {/* Position badges on mobile */}
                                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                {p.globalPosition != null && (
                                                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded-full">
                                                        <Hash size={8} />G{p.globalPosition}
                                                    </span>
                                                )}
                                                {p.languagePosition != null && (
                                                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded-full">
                                                        <Hash size={8} />{language.substring(0,2)}{p.languagePosition}
                                                    </span>
                                                )}
                                                {(p.topics && p.topics.length > 0) && (
                                                    <p className="text-[10px] text-gray-400 font-bold">{p.topics.length} Topic{p.topics.length !== 1 ? 's' : ''}</p>
                                                )}
                                            </div>
                                            <p className="text-gray-500 text-xs mt-0.5">{p.groupId?.name || '-'}</p>
                                        </div>
                                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                            <button 
                                                onClick={() => setEditingProgram(p)}
                                                className="text-gray-600 hover:text-blue-400 p-1.5 rounded transition-colors"
                                            >
                                                <Edit size={14} />
                                            </button>
                                            <select 
                                                value={p.status || 'upcoming'}
                                                onChange={(e) => handleStatusUpdate(p._id, e.target.value)}
                                                className={`p-1 px-2 rounded border text-[10px] font-bold uppercase tracking-wider outline-none ${
                                                    p.status === 'ongoing' ? 'text-yellow-500 border-yellow-500/30 bg-yellow-500/5' :
                                                    p.status === 'completed' ? 'text-green-500 border-green-500/30 bg-green-500/5' :
                                                    'text-blue-500 border-blue-500/30 bg-blue-500/5'
                                                }`}
                                            >
                                                <option value="upcoming" className="bg-[#13111C]">UPCOMING</option>
                                                <option value="ongoing" className="bg-[#13111C]">ONGOING</option>
                                                <option value="completed" className="bg-[#13111C]">COMPLETED</option>
                                            </select>
                                            </div>
                                        </div>
                                      {expandedProgramId === p._id && (
                                          <div className="border border-white/[0.07] border-t-0 bg-[#13111C]/80 rounded-b-xl p-4">
                                              <div className="flex gap-4 border-b border-gray-800 mb-4">
                                                  <button onClick={(e) => { e.stopPropagation(); setActiveTab('participants'); }} className={`pb-2 px-1 font-bold text-xs transition-colors border-b-2 ${activeTab === 'participants' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-500'}`}>Participants</button>
                                                  <button onClick={(e) => { e.stopPropagation(); setActiveTab('topics'); }} className={`pb-2 px-1 font-bold text-xs transition-colors border-b-2 ${activeTab === 'topics' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-500'}`}>Topics</button>
                                              </div>
                                              {activeTab === 'participants' && <ParticipantsTab program={p} participants={participants} />}
                                              {activeTab === 'topics' && <TopicsTab program={p} refreshPrograms={invalidatePrograms} addToast={addToast} participants={participants} />}
                                          </div>
                                      )}
                                    </div>
                                ))
                            ) : (
                                <div className="py-8 text-center text-gray-500 bg-[#13111C]/30 rounded-xl border border-white/[0.06]">
                                    <FileText size={24} className="mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">No programs found.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )
        })}
      </div>

      {/* Create Modal */}
      <CreateProgramModal 
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          defaultLanguage={modalDefaultLanguage}
          groups={groups}
          refreshPrograms={invalidatePrograms}
          addToast={addToast}
      />

      {/* Edit Modal */}
      {editingProgram && (
          <EditProgramModal
              program={editingProgram}
              groups={groups}
              onClose={() => setEditingProgram(null)}
              refreshPrograms={invalidatePrograms}
              addToast={addToast}
          />
      )}

      <ConfirmModal
        isOpen={!!deleteConfirmId}
        title="Delete Program"
        message="Are you sure you want to delete this program? This action cannot be undone."
        confirmText="Delete"
        onConfirm={confirmDeleteProgram}
        onCancel={() => setDeleteConfirmId(null)}
      />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

    </div>
  );
}

// ---------------------------------------------------------------------------
// Position input helper
// ---------------------------------------------------------------------------
function PositionInput({ label, sublabel, value, onChange, id }: {
    label: string;
    sublabel: string;
    value: string;
    onChange: (v: string) => void;
    id: string;
}) {
    return (
        <div className="space-y-1">
            <label htmlFor={id} className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Hash size={11} className="text-purple-400" />{label}
            </label>
            <input
                id={id}
                type="number"
                min="1"
                step="1"
                placeholder="—"
                value={value}
                onChange={e => onChange(e.target.value)}
                className="w-full p-2.5 sm:p-3 rounded-xl bg-[#13111C] border border-[#2D283E] text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all placeholder:text-gray-600 text-sm"
            />
            <p className="text-[10px] text-gray-500">{sublabel}</p>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Create Program Modal
// ---------------------------------------------------------------------------
function CreateProgramModal({ isOpen, onClose, defaultLanguage, groups, refreshPrograms, addToast }: { 
    isOpen: boolean; 
    onClose: () => void; 
    defaultLanguage: string;
    groups: any[];
    refreshPrograms: () => void;
    addToast: any;
}) {
    const [form, setForm] = useState({
        name: '',
        groupId: '',
        status: 'upcoming',
        language: defaultLanguage || 'English',
        isConversation: false,
        globalPosition: '',
        languagePosition: '',
    });
    const [createMultiple, setCreateMultiple] = useState(false);
    const [loading, setLoading] = useState(false);

    // Body scroll lock
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            return () => { document.body.style.overflow = ''; };
        }
    }, [isOpen]);

    useEffect(() => {
        if (defaultLanguage) {
            setForm(prev => ({ ...prev, language: defaultLanguage }));
        }
    }, [defaultLanguage]);

    const languages = ['Malayalam', 'Arabic', 'Urdu', 'English'];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload: any = {
                name: form.name,
                groupId: form.groupId,
                status: form.status,
                language: form.language,
                isConversation: form.isConversation,
                globalPosition: form.globalPosition !== '' ? parseInt(form.globalPosition, 10) : null,
                languagePosition: form.languagePosition !== '' ? parseInt(form.languagePosition, 10) : null,
            };
            await apiRequest('/programs', 'POST', payload);
            refreshPrograms();
            addToast({ title: 'Success', message: 'Program created successfully!', type: 'success' });
            
            if (createMultiple) {
                setForm(prev => ({ ...prev, name: '', globalPosition: '', languagePosition: '' }));
                const nameInput = document.getElementById('program-name-input');
                if (nameInput) nameInput.focus();
            } else {
                onClose();
            }
        } catch (e: any) {
            addToast({ title: 'Creation Error', message: e.message || 'Failed to create program', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-5 animate-in fade-in duration-200"
            onClick={onClose}
        >
            {/* Modal shell: wider max-w-2xl and responsive vertical layout */}
            <div
                className="relative bg-[#1E1B2E] border border-[#2D283E] rounded-3xl shadow-2xl w-full max-w-2xl flex flex-col animate-in zoom-in-95 duration-200"
                style={{ maxHeight: 'calc(100vh - 2rem)' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Decorative glow */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-900/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none z-0" />

                {/* ── HEADER (never scrolls) ── */}
                <div className="relative z-10 flex-shrink-0 flex justify-between items-center px-6 py-4 sm:px-8 border-b border-[#2D283E] bg-[#13111C]/60 rounded-t-3xl">
                    <div>
                        <h3 className="text-lg sm:text-xl font-bold text-white leading-tight">Create Program</h3>
                        <p className="text-gray-400 text-xs sm:text-sm mt-0.5">Add a new competition item to the list.</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close dialog"
                        className="flex-shrink-0 ml-4 text-gray-500 hover:text-white transition-colors bg-gray-800/50 p-2 rounded-lg hover:bg-gray-700"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* ── CONTENT AREA ── */}
                <form
                    onSubmit={handleSubmit}
                    className="relative z-10 flex flex-col flex-1 min-h-0"
                >
                    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-6 py-4 sm:px-8 sm:py-5 space-y-4">

                        {/* Program Name */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                <FileText size={13} className="text-purple-400" /> Program Name
                            </label>
                            <input 
                                id="program-name-input"
                                placeholder="e.g. Speech, Song, Quiz"
                                value={form.name}
                                onChange={e => setForm({...form, name: e.target.value})} 
                                className="w-full p-3 sm:p-3.5 rounded-xl bg-[#13111C] border border-[#2D283E] text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all placeholder:text-gray-600 text-sm"
                                autoFocus
                                required
                            />
                        </div>

                        {/* Language + Group */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <Globe size={13} className="text-blue-400" /> Language
                                </label>
                                <select
                                    value={form.language}
                                    onChange={e => setForm({...form, language: e.target.value})}
                                    className="w-full p-3 sm:p-3.5 rounded-xl bg-[#13111C] border border-[#2D283E] text-white focus:border-purple-500 focus:outline-none transition-colors appearance-none text-sm"
                                >
                                    {languages.map(lang => <option key={lang} value={lang}>{lang}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <Layers size={13} className="text-green-400" /> Group
                                </label>
                                <select
                                    value={form.groupId}
                                    onChange={e => setForm({...form, groupId: e.target.value})}
                                    className="w-full p-3 sm:p-3.5 rounded-xl bg-[#13111C] border border-[#2D283E] text-white focus:border-purple-500 focus:outline-none transition-colors appearance-none text-sm"
                                    required
                                >
                                    <option value="">Select Group</option>
                                    {groups.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Status */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Status</label>
                            <div className="grid grid-cols-3 gap-2">
                                {['upcoming', 'ongoing', 'completed'].map(status => (
                                    <button
                                        key={status}
                                        type="button"
                                        onClick={() => setForm({...form, status})}
                                        className={`p-2.5 sm:p-3 rounded-xl border text-xs sm:text-sm capitalize font-bold transition-all ${
                                            form.status === status 
                                            ? 'bg-purple-600 border-purple-500 text-white shadow-md shadow-purple-900/20' 
                                            : 'bg-[#13111C] border-[#2D283E] text-gray-400 hover:border-gray-600'
                                        }`}
                                    >
                                        {status}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Group Program toggle */}
                        <label className="flex items-center gap-3 p-3.5 sm:p-4 rounded-xl bg-[#13111C] border border-[#2D283E] cursor-pointer hover:bg-[#1A1825] hover:border-indigo-500/30 transition-all group">
                            <div className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                                form.isConversation ? 'bg-indigo-600 border-indigo-500' : 'border-gray-600 group-hover:border-indigo-400'
                            }`}>
                                {form.isConversation && <CheckCircle size={12} className="text-white" />}
                            </div>
                            <input type="checkbox" checked={form.isConversation} onChange={e => setForm({...form, isConversation: e.target.checked})} className="hidden" />
                            <div className="flex-1 min-w-0">
                                <p className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                                    <Users size={14} className="text-indigo-400" /> Group Program
                                </p>
                                <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5">Requires multiple participants (same team &amp; group) registered as a group</p>
                            </div>
                        </label>

                        {/* Program Order */}
                        <div className="p-3.5 sm:p-4 rounded-xl bg-[#13111C] border border-[#2D283E] space-y-2.5">
                            <div className="flex items-center gap-2">
                                <ArrowUpDown size={13} className="text-purple-400" />
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Program Order</span>
                                <span className="text-[10px] text-gray-500 ml-auto">Optional</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <PositionInput
                                    id="create-global-pos"
                                    label="Global Position"
                                    sublabel="Order among ALL programs"
                                    value={form.globalPosition}
                                    onChange={v => setForm({...form, globalPosition: v})}
                                />
                                <PositionInput
                                    id="create-lang-pos"
                                    label={`${form.language} Position`}
                                    sublabel={`Order within ${form.language} programs`}
                                    value={form.languagePosition}
                                    onChange={v => setForm({...form, languagePosition: v})}
                                />
                            </div>
                        </div>

                        {/* Create another toggle */}
                        <label className="flex items-center gap-3 p-2.5 sm:p-3 rounded-xl bg-[#13111C] border border-[#2D283E] cursor-pointer hover:bg-[#1A1825] transition-colors group">
                            <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${createMultiple ? 'bg-purple-600 border-purple-600' : 'border-gray-600 group-hover:border-purple-400'}`}>
                                {createMultiple && <CheckCircle size={10} className="text-white" />}
                            </div>
                            <input type="checkbox" checked={createMultiple} onChange={e => setCreateMultiple(e.target.checked)} className="hidden" />
                            <span className="text-xs sm:text-sm text-gray-300 font-medium">Create another after submission</span>
                        </label>

                    </div>{/* end content */}

                    {/* ── FOOTER (never scrolls) ── */}
                    <div className="flex-shrink-0 px-6 py-3.5 sm:px-8 border-t border-[#2D283E] bg-[#13111C]/40 rounded-b-3xl flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-5 py-3 rounded-xl border border-gray-700 text-gray-300 text-xs sm:text-sm font-bold hover:bg-gray-800 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-[2] px-5 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-purple-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                        >
                            {loading ? 'Creating...' : 'Create Program'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Edit Program Modal
// ---------------------------------------------------------------------------
function EditProgramModal({ program, groups, onClose, refreshPrograms, addToast }: {
    program: any;
    groups: any[];
    onClose: () => void;
    refreshPrograms: () => void;
    addToast: any;
}) {
    const [form, setForm] = useState({
        name: program.name || '',
        groupId: program.groupId?._id || program.groupId || '',
        status: program.status || 'upcoming',
        language: program.language || 'English',
        isConversation: program.isConversation || false,
        globalPosition: program.globalPosition != null ? String(program.globalPosition) : '',
        languagePosition: program.languagePosition != null ? String(program.languagePosition) : '',
    });
    const [loading, setLoading] = useState(false);
    const languages = ['Malayalam', 'Arabic', 'Urdu', 'English'];

    // Body scroll lock
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload: any = {
                name: form.name,
                groupId: form.groupId,
                status: form.status,
                language: form.language,
                isConversation: form.isConversation,
                globalPosition: form.globalPosition !== '' ? parseInt(form.globalPosition, 10) : null,
                languagePosition: form.languagePosition !== '' ? parseInt(form.languagePosition, 10) : null,
            };
            await apiRequest(`/programs/${program._id}`, 'PATCH', payload);
            refreshPrograms();
            addToast({ title: 'Program Updated', message: 'Program saved successfully!', type: 'success' });
            onClose();
        } catch (e: any) {
            addToast({ title: 'Update Error', message: e.message || 'Failed to update program', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-5 animate-in fade-in duration-200"
            onClick={onClose}
        >
            {/* Modal shell: wider max-w-2xl and responsive vertical layout */}
            <div
                className="relative bg-[#1E1B2E] border border-[#2D283E] rounded-3xl shadow-2xl w-full max-w-2xl flex flex-col animate-in zoom-in-95 duration-200"
                style={{ maxHeight: 'calc(100vh - 2rem)' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Decorative glow */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-900/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none z-0" />

                {/* ── HEADER (never scrolls) ── */}
                <div className="relative z-10 flex-shrink-0 flex justify-between items-center px-6 py-4 sm:px-8 border-b border-[#2D283E] bg-[#13111C]/60 rounded-t-3xl">
                    <div className="min-w-0">
                        <h3 className="text-lg sm:text-xl font-bold text-white leading-tight">Edit Program</h3>
                        <p className="text-gray-400 text-xs sm:text-sm mt-0.5 truncate max-w-xs sm:max-w-md">{program.name}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close dialog"
                        className="flex-shrink-0 ml-4 text-gray-500 hover:text-white transition-colors bg-gray-800/50 p-2 rounded-lg hover:bg-gray-700"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* ── CONTENT AREA ── */}
                <form
                    onSubmit={handleSubmit}
                    className="relative z-10 flex flex-col flex-1 min-h-0"
                >
                    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-6 py-4 sm:px-8 sm:py-5 space-y-4">

                        {/* Program Name */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                <FileText size={13} className="text-purple-400" /> Program Name
                            </label>
                            <input
                                placeholder="e.g. Speech, Song, Quiz"
                                value={form.name}
                                onChange={e => setForm({...form, name: e.target.value})}
                                className="w-full p-3 sm:p-3.5 rounded-xl bg-[#13111C] border border-[#2D283E] text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all placeholder:text-gray-600 text-sm"
                                required
                            />
                        </div>

                        {/* Language + Group */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <Globe size={13} className="text-blue-400" /> Language
                                </label>
                                <select
                                    value={form.language}
                                    onChange={e => setForm({...form, language: e.target.value})}
                                    className="w-full p-3 sm:p-3.5 rounded-xl bg-[#13111C] border border-[#2D283E] text-white focus:border-purple-500 focus:outline-none transition-colors appearance-none text-sm"
                                >
                                    {languages.map(lang => <option key={lang} value={lang}>{lang}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <Layers size={13} className="text-green-400" /> Group
                                </label>
                                <select
                                    value={form.groupId}
                                    onChange={e => setForm({...form, groupId: e.target.value})}
                                    className="w-full p-3 sm:p-3.5 rounded-xl bg-[#13111C] border border-[#2D283E] text-white focus:border-purple-500 focus:outline-none transition-colors appearance-none text-sm"
                                    required
                                >
                                    <option value="">Select Group</option>
                                    {groups.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Status */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Status</label>
                            <div className="grid grid-cols-3 gap-2">
                                {['upcoming', 'ongoing', 'completed'].map(status => (
                                    <button
                                        key={status}
                                        type="button"
                                        onClick={() => setForm({...form, status})}
                                        className={`p-2.5 sm:p-3 rounded-xl border text-xs sm:text-sm capitalize font-bold transition-all ${
                                            form.status === status
                                            ? 'bg-purple-600 border-purple-500 text-white shadow-md shadow-purple-900/20'
                                            : 'bg-[#13111C] border-[#2D283E] text-gray-400 hover:border-gray-600'
                                        }`}
                                    >
                                        {status}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Group Program toggle */}
                        <label className="flex items-center gap-3 p-3.5 sm:p-4 rounded-xl bg-[#13111C] border border-[#2D283E] cursor-pointer hover:bg-[#1A1825] hover:border-indigo-500/30 transition-all group">
                            <div className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                                form.isConversation ? 'bg-indigo-600 border-indigo-500' : 'border-gray-600 group-hover:border-indigo-400'
                            }`}>
                                {form.isConversation && <CheckCircle size={12} className="text-white" />}
                            </div>
                            <input type="checkbox" checked={form.isConversation} onChange={e => setForm({...form, isConversation: e.target.checked})} className="hidden" />
                            <div className="flex-1 min-w-0">
                                <p className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                                    <Users size={14} className="text-indigo-400" /> Group Program
                                </p>
                                <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5">Requires multiple participants (same team &amp; group) registered as a group</p>
                            </div>
                        </label>

                        {/* Program Order */}
                        <div className="p-3.5 sm:p-4 rounded-xl bg-[#13111C] border border-blue-500/20 space-y-2.5">
                            <div className="flex items-center gap-2">
                                <ArrowUpDown size={13} className="text-blue-400" />
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Program Order</span>
                                <span className="text-[10px] text-gray-500 ml-auto">Leave blank to remove from ordering</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <PositionInput
                                    id="edit-global-pos"
                                    label="Global Position"
                                    sublabel="Order among ALL programs"
                                    value={form.globalPosition}
                                    onChange={v => setForm({...form, globalPosition: v})}
                                />
                                <PositionInput
                                    id="edit-lang-pos"
                                    label={`${form.language} Position`}
                                    sublabel={`Order within ${form.language} programs`}
                                    value={form.languagePosition}
                                    onChange={v => setForm({...form, languagePosition: v})}
                                />
                            </div>
                        </div>

                    </div>{/* end content */}

                    {/* ── FOOTER (never scrolls) ── */}
                    <div className="flex-shrink-0 px-6 py-3.5 sm:px-8 border-t border-[#2D283E] bg-[#13111C]/40 rounded-b-3xl flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-5 py-3 rounded-xl border border-gray-700 text-gray-300 text-xs sm:text-sm font-bold hover:bg-gray-800 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-[2] px-5 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                        >
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function ParticipantsTab({ program, participants }: { program: any; participants: any[] }) {
    const enrolledParticipants = participants.filter(p => p.programs?.some((prog: any) => prog._id === program._id || prog === program._id));
    
    if (enrolledParticipants.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-10 text-gray-500">
                <Users size={32} className="opacity-20 mb-3" />
                <p className="text-sm">No participants enrolled in this program yet.</p>
            </div>
        );
    }

    return (
        <div className="divide-y divide-[#2D283E] custom-scrollbar overflow-y-auto max-h-[400px] pr-2">
            {enrolledParticipants.map((p: any, i) => (
                <div key={p._id} className="flex items-center gap-4 py-3 hover:bg-white/[0.02] px-2 rounded-lg transition-colors">
                    <div className="font-mono text-gray-500 text-sm w-6">{i + 1}</div>
                    <div className="relative w-10 h-10 flex-shrink-0">
                        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-xs font-bold text-white border-2 border-white/10">
                            {p.name.charAt(0)}
                        </div>
                        <img 
                            src={`${API_BASE_URL}/participants/${p._id}/photo`} 
                            alt={p.name} 
                            loading="lazy"
                            className="absolute inset-0 w-full h-full rounded-full object-cover border-2 border-purple-500/30"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                    </div>
                    <div className="flex-1">
                        <h4 className="text-gray-200 font-bold text-sm">{p.name}</h4>
                        <p className="text-gray-500 text-xs flex items-center gap-2">
                            <span className="font-mono text-purple-400">{p.chestNumber}</span> &middot; 
                            <span>{p.teamId?.name || 'No Team'}</span>
                            {p.programTopics?.find((pt: any) => (pt.programId?._id || pt.programId) === program._id)?.topicId && (
                                <>
                                    &middot;
                                    <span className="text-purple-400/80 italic flex items-center gap-1">
                                        <FileText size={10} />
                                        {program.topics?.find((t:any) => t._id === p.programTopics.find((pt: any) => (pt.programId?._id || pt.programId) === program._id)?.topicId)?.title || 'Unknown Topic'}
                                    </span>
                                </>
                            )}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    );
}

function TopicsTab({ program, refreshPrograms, addToast, participants }: { program: any; refreshPrograms: () => void; addToast: any; participants: any[] }) {
    const [isAdding, setIsAdding] = useState(false);
    const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [loading, setLoading] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (editingTopicId) {
                await apiRequest(`/programs/${program._id}/topics/${editingTopicId}`, 'PUT', { title });
                addToast({ title: 'Topic Updated', message: 'Topic updated successfully.', type: 'success' });
            } else {
                await apiRequest(`/programs/${program._id}/topics`, 'POST', { title });
                addToast({ title: 'Topic Added', message: 'Topic added successfully.', type: 'success' });
            }
            refreshPrograms();
            setIsAdding(false);
            setEditingTopicId(null);
            setTitle('');
        } catch (error: any) {
            addToast({ title: 'Error', message: error.message || 'Failed to save topic', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const confirmDelete = async () => {
        if (!deleteConfirmId) return;
        try {
            await apiRequest(`/programs/${program._id}/topics/${deleteConfirmId}`, 'DELETE');
            refreshPrograms();
            addToast({ title: 'Topic Deleted', message: 'Topic removed successfully.', type: 'info' });
        } catch (error: any) {
            addToast({ title: 'Error', message: error.message || 'Failed to delete topic', type: 'error' });
        } finally {
            setDeleteConfirmId(null);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h4 className="text-gray-300 font-bold text-sm">Manage Topics</h4>
                {!isAdding && !editingTopicId && (
                    <button 
                        onClick={() => setIsAdding(true)}
                        className="bg-purple-600/20 text-purple-400 hover:bg-purple-600 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                    >
                        <Plus size={14} /> Add Topic
                    </button>
                )}
            </div>

            {(isAdding || editingTopicId) && (
                <form onSubmit={handleSubmit} className="flex gap-2">
                    <input 
                        type="text" 
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="e.g. Environmental Protection"
                        className="flex-1 bg-[#13111C] border border-[#2D283E] text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                        required
                        autoFocus
                    />
                    <button type="submit" disabled={loading} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50">
                        {loading ? 'Saving...' : 'Save'}
                    </button>
                    <button type="button" onClick={() => { setIsAdding(false); setEditingTopicId(null); setTitle(''); }} className="bg-gray-800 text-gray-300 px-4 py-2 rounded-lg text-sm font-bold">
                        Cancel
                    </button>
                </form>
            )}

            <div className="space-y-2">
                {(!program.topics || program.topics.length === 0) && !isAdding && (
                    <div className="text-gray-500 text-sm py-4 text-center border border-dashed border-[#2D283E] rounded-xl">
                        No topics added to this program yet.
                    </div>
                )}
                {program.topics?.map((topic: any, idx: number) => (
                    <div key={topic._id} className="flex justify-between items-center bg-[#131629] border border-white/[0.04] p-3 rounded-lg group">
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-3">
                                <span className="text-gray-500 text-xs font-mono">{idx + 1}.</span>
                                <span className="text-gray-200 text-sm font-medium">{topic.title}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] ml-6 text-gray-500">
                                <span className="bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded border border-purple-500/20 flex items-center gap-1">
                                    <Users size={10} />
                                    {participants.filter(p => p.programTopics?.some((pt:any) => (pt.programId?._id || pt.programId) === program._id && pt.topicId === topic._id)).length} participants
                                </span>
                            </div>
                        </div>
                        <div className="flex gap-1">
                            <button 
                                onClick={() => { setEditingTopicId(topic._id); setTitle(topic.title); setIsAdding(false); }}
                                className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                            >
                                <Edit size={14} />
                            </button>
                            <button 
                                onClick={() => setDeleteConfirmId(topic._id)}
                                className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <ConfirmModal
                isOpen={!!deleteConfirmId}
                title="Delete Topic"
                message="Are you sure you want to delete this topic?"
                confirmText="Delete"
                onConfirm={confirmDelete}
                onCancel={() => setDeleteConfirmId(null)}
            />
        </div>
    );
}
