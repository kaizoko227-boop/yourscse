import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Download,
  Paperclip,
  Plus,
  Search,
  Star,
  StickyNote,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { db, enqueueSync } from '../db/database';
import { generateId } from '../lib/crypto';
import { formatShortDate } from '../lib/dateUtils';
import type { LifeNote, NoteAttachment, NoteCategory } from '../types/models';
import { EmptyState, Modal, PageHeader } from '../components/ui/Modal';

const CATEGORIES: NoteCategory[] = [
  'Personal Memories',
  'Motivation',
  'Ideas',
  'Important Events',
  'Lessons',
  'General',
];

export function LifeNotesPage() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<NoteCategory>('Ideas');
  const [tagsInput, setTagsInput] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [attachments, setAttachments] = useState<NoteAttachment[]>([]);

  const notes = useLiveQuery(() => db.lifeNotes.toArray(), []) ?? [];

  const filteredNotes = useMemo(() => {
    return [...notes]
      .filter((n) => {
        if (favoritesOnly && !n.isFavorite) return false;
        if (categoryFilter !== 'all' && n.category !== categoryFilter) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          return (
            n.title.toLowerCase().includes(q) ||
            n.content.toLowerCase().includes(q) ||
            n.tags.some((t) => t.toLowerCase().includes(q))
          );
        }
        return true;
      })
      .sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite) || b.updatedAt.localeCompare(a.updatedAt));
  }, [notes, favoritesOnly, categoryFilter, search]);

  const openNewNote = () => {
    setEditingId(null);
    setTitle('');
    setContent('');
    setCategory('Ideas');
    setTagsInput('');
    setIsFavorite(false);
    setAttachments([]);
    setEditorOpen(true);
  };

  const openEditNote = (note: LifeNote) => {
    setEditingId(note.id);
    setTitle(note.title);
    setContent(note.content);
    setCategory(note.category);
    setTagsInput(note.tags.join(', '));
    setIsFavorite(note.isFavorite);
    setAttachments(note.attachments || []);
    setEditorOpen(true);
  };

  const handleAttachFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Please keep note attachments under 5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAttachments((prev) => [
        ...prev,
        {
          id: generateId('att'),
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl: String(reader.result),
        },
      ]);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const now = new Date().toISOString();
    const existing = editingId ? notes.find((n) => n.id === editingId) : null;
    const tags = tagsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const record: LifeNote = {
      id: existing?.id || generateId('note'),
      title: title.trim(),
      content: content.trim(),
      category,
      tags,
      isFavorite,
      attachments,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    await db.lifeNotes.put(record);
    await enqueueSync('lifeNotes', record.id, 'upsert', record);
    setEditorOpen(false);
  };

  const toggleFavorite = async (note: LifeNote) => {
    const updated: LifeNote = {
      ...note,
      isFavorite: !note.isFavorite,
      updatedAt: new Date().toISOString(),
    };
    await db.lifeNotes.put(updated);
    await enqueueSync('lifeNotes', updated.id, 'upsert', updated);
  };

  const deleteNote = async (id: string) => {
    await db.lifeNotes.delete(id);
    await enqueueSync('lifeNotes', id, 'delete');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Life Notes"
        subtitle="Personal memories, motivation, ideas, important events, lessons, and attachments"
        actions={
          <button type="button" onClick={openNewNote} className="os-btn-primary text-xs py-2 px-3.5">
            <Plus className="w-3.5 h-3.5" />
            New Note
          </button>
        }
      />

      {/* Search & Filter Bar */}
      <div className="os-card p-3.5 flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes, tags, memories, ideas..."
            className="os-input !pl-9 py-2 text-xs"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="os-input py-2 text-xs !w-auto"
        >
          <option value="all">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setFavoritesOnly((f) => !f)}
          className={`px-3 py-2 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-colors cursor-pointer ${
            favoritesOnly
              ? 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400'
              : 'border-white/70 dark:border-white/[0.12] text-slate-600 dark:text-slate-300'
          }`}
        >
          <Star className={`w-3.5 h-3.5 ${favoritesOnly ? 'fill-current' : ''}`} />
          Favourites
        </button>
      </div>

      {/* Notes Grid */}
      {filteredNotes.length === 0 ? (
        <div className="os-card p-6">
          <EmptyState
            icon={<StickyNote className="w-5 h-5" />}
            title={notes.length === 0 ? 'Your personal vault is ready' : 'No notes match your search'}
            description="Capture ideas, life lessons, motivating quotes, memories, or attach photos and documents."
            action={
              <button type="button" onClick={openNewNote} className="os-btn-primary text-xs">
                <Plus className="w-3.5 h-3.5" />
                Write First Note
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNotes.map((note) => (
            <div
              key={note.id}
              onClick={() => openEditNote(note)}
              className="os-card p-4 hover:border-cyan-400/60 dark:hover:border-cyan-400/40 transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                    {note.category}
                  </span>
                  <div
                    className="flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => toggleFavorite(note)}
                      className={`p-1 rounded-lg transition-colors cursor-pointer ${
                        note.isFavorite
                          ? 'text-amber-500'
                          : 'text-slate-300 dark:text-slate-600 hover:text-amber-500'
                      }`}
                      title="Toggle favourite"
                    >
                      <Star className={`w-4 h-4 ${note.isFavorite ? 'fill-current' : ''}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteNote(note.id)}
                      className="p-1 rounded-lg text-slate-300 dark:text-slate-600 hover:text-rose-500 cursor-pointer"
                      title="Delete note"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                  {note.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 line-clamp-4 whitespace-pre-line leading-relaxed">
                  {note.content || 'Empty note'}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-white/50 dark:border-white/[0.08] flex items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1 min-w-0">
                  {note.tags.slice(0, 3).map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-white/60 dark:bg-white/[0.09] text-slate-500 dark:text-slate-400"
                    >
                      <Tag className="w-2.5 h-2.5" />
                      {t}
                    </span>
                  ))}
                  {note.attachments?.length > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400">
                      <Paperclip className="w-2.5 h-2.5" />
                      {note.attachments.length}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-mono text-slate-400 shrink-0">
                  {formatShortDate(note.updatedAt.slice(0, 10))}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* NOTE EDITOR MODAL */}
      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editingId ? 'Edit Life Note' : 'Create Life Note'}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1">Title</label>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Note title..."
                className="os-input"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as NoteCategory)}
                className="os-input"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Content</label>
            <textarea
              rows={7}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your thoughts, memories, ideas, or lessons..."
              className="os-input leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Tags (comma separated)
              </label>
              <input
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="e.g. university, mindset, nepal, project"
                className="os-input text-xs"
              />
            </div>

            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer pb-2">
              <input
                type="checkbox"
                checked={isFavorite}
                onChange={(e) => setIsFavorite(e.target.checked)}
                className="rounded accent-amber-500 w-4 h-4"
              />
              Mark as Favourite
            </label>
          </div>

          {/* Attachments */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">
              Attachments (Images, PDFs, Documents — stored offline)
            </label>
            <input
              type="file"
              onChange={handleAttachFile}
              className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-medium file:bg-slate-100 dark:file:bg-white/[0.08] file:text-slate-700 dark:file:text-slate-200 cursor-pointer"
            />

            {attachments.length > 0 && (
              <div className="mt-2.5 space-y-2">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white/55 dark:bg-white/[0.05] border border-white/65 dark:border-white/[0.1]"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {att.type.startsWith('image/') && (
                        <img
                          src={att.dataUrl}
                          alt={att.name}
                          className="w-9 h-9 rounded-lg object-cover shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <div className="text-xs font-medium truncate">{att.name}</div>
                        <div className="text-[10px] font-mono text-slate-400">
                          {Math.round(att.size / 1024)} KB
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href={att.dataUrl}
                        download={att.name}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-cyan-500"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={() => setAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setEditorOpen(false)} className="os-btn-secondary">
              Cancel
            </button>
            <button type="submit" className="os-btn-primary">
              Save Note
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
