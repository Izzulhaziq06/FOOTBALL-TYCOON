import React, { useState } from 'react';
import { ArrowLeft, FolderOpen, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { useCareerStore } from '../store/careerStore';
import { useUiStore } from '../store/uiStore';
import { ConfirmModal } from '../components/shared/ConfirmModal';

export const SavesManager: React.FC = () => {
  const {
    career,
    saves,
    loadSavedCareer,
    saveCurrentCareer,
    renameSave,
    deleteSave,
  } = useCareerStore();
  const { navigate, pushToast } = useUiStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const handleLoad = async (id: string) => {
    const ok = await loadSavedCareer(id);
    if (ok) {
      pushToast('success', 'Career loaded successfully.');
      navigate('dashboard');
    } else {
      pushToast('error', 'Could not load career save.');
    }
  };

  const handleRenameSubmit = async (id: string) => {
    const ok = await renameSave(id, editValue);
    if (ok) {
      pushToast('success', 'Save renamed.');
      setEditingId(null);
    } else {
      pushToast('error', 'Save name cannot be empty.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteSave(deleteTarget.id);
    pushToast('info', `Deleted save "${deleteTarget.name}".`);
    setDeleteTarget(null);
  };

  return (
    <div className={career ? 'space-y-6' : 'min-h-screen bg-[#0B0F17] text-slate-100 p-6 max-w-4xl mx-auto space-y-6'}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {!career && (
            <button
              type="button"
              onClick={() => navigate('main_menu')}
              className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Main Menu</span>
            </button>
          )}
          <div>
            <h1 className="font-display text-3xl font-bold text-white">Career Saves</h1>
            <p className="text-xs text-slate-400">
              Stored locally in IndexedDB · Multiple careers supported
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {career && (
            <button
              type="button"
              onClick={async () => {
                await saveCurrentCareer();
                pushToast('success', 'Current career saved.');
              }}
              className="inline-flex items-center gap-2 rounded-md bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-semibold text-white"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Save Current Career</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate('new_career')}
            className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900 hover:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Career</span>
          </button>
        </div>
      </div>

      {saves.length === 0 ? (
        <div className="rounded-lg border border-slate-800 bg-[#121824] p-10 text-center space-y-3">
          <div className="text-base font-semibold text-white">No saved careers yet</div>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Start a new career to create your first persistent browser save.
          </p>
          <button
            type="button"
            onClick={() => navigate('new_career')}
            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            <span>Start New Career</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {saves.map((s) => {
            const isCurrent = career?.id === s.id;
            const isEditing = editingId === s.id;

            return (
              <div
                key={s.id}
                className={`rounded-lg border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  isCurrent
                    ? 'border-emerald-500/50 bg-emerald-500/5'
                    : 'border-slate-800 bg-[#121824]'
                }`}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  {isEditing ? (
                    <div className="flex items-center gap-2 max-w-sm">
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="flex-1 rounded-md border border-slate-600 bg-[#0B0F17] px-3 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleRenameSubmit(s.id)}
                        className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white truncate">{s.saveName}</span>
                      {isCurrent && (
                        <span className="text-xs text-emerald-400 font-medium">· Active</span>
                      )}
                    </div>
                  )}
                  <div className="text-xs text-slate-400 tabular-nums">
                    {s.clubName} · {s.currentSeason} · MD {s.currentMatchday} · Manager {s.managerName}
                  </div>
                  <div className="text-xs text-slate-500 font-mono">
                    Last played: {new Date(s.lastPlayedAt).toLocaleString()} · Save v{s.saveVersion}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleLoad(s.id)}
                    className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-white"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    <span>Load</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(s.id);
                      setEditValue(s.saveName);
                    }}
                    aria-label={`Rename ${s.saveName}`}
                    className="inline-flex items-center justify-center rounded-md border border-slate-700 bg-slate-900 hover:bg-slate-800 p-2 text-slate-300"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget({ id: s.id, name: s.saveName })}
                    aria-label={`Delete ${s.saveName}`}
                    className="inline-flex items-center justify-center rounded-md border border-red-900/60 bg-red-950/30 hover:bg-red-900/40 p-2 text-red-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete Career Save"
        description={`Are you sure you want to permanently delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete Save"
        destructive
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
