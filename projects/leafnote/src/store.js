/**
 * Note storage. Persists notes to a localStorage-compatible backend
 * (pluggable so it is testable in Node). Pure serialization helpers
 * (`serialize` / `deserialize`) are exported separately.
 *
 * @module store
 */

import { uid, now } from './util.js';

const KEY = 'leafnote:v1';
const VERSION = 1;

/** Serialize a notes array to a versioned JSON string. */
export function serialize(notes) {
  return JSON.stringify({ version: VERSION, notes: notes || [] }, null, 2);
}

/** Parse a Leafnote backup string into a normalized notes array. */
export function deserialize(str) {
  let data;
  try {
    data = JSON.parse(str);
  } catch {
    throw new Error('Invalid Leafnote backup: not valid JSON');
  }
  if (data && !Array.isArray(data.notes)) {
    if (Array.isArray(data)) data = { notes: data };
    else throw new Error('Invalid Leafnote backup: missing notes array');
  }
  return (data.notes || []).map(normalizeNote);
}

function normalizeNote(n) {
  const note = n && typeof n === 'object' ? n : {};
  return {
    id: typeof note.id === 'string' && note.id ? note.id : uid(),
    title: typeof note.title === 'string' ? note.title : 'Untitled',
    body: typeof note.body === 'string' ? note.body : '',
    createdAt: typeof note.createdAt === 'number' ? note.createdAt : now(),
    updatedAt: typeof note.updatedAt === 'number' ? note.updatedAt : now(),
  };
}

/** A localStorage-backed notes store. */
export class Store {
  constructor(storage) {
    this.storage =
      storage || (typeof globalThis !== 'undefined' && globalThis.localStorage) || null;
    this.notes = [];
  }

  load() {
    if (!this.storage) return this.notes;
    const raw = this.storage.getItem(KEY);
    if (!raw) {
      this.notes = [];
      return this.notes;
    }
    try {
      this.notes = deserialize(raw);
    } catch {
      this.notes = [];
    }
    return this.notes;
  }

  _save() {
    if (this.storage) this.storage.setItem(KEY, serialize(this.notes));
  }

  all() {
    return this.notes;
  }

  get(id) {
    return this.notes.find((n) => n.id === id) || null;
  }

  create(data = {}) {
    const note = normalizeNote({ ...data, id: uid(), createdAt: now(), updatedAt: now() });
    this.notes.unshift(note);
    this._save();
    return note;
  }

  update(id, patch = {}) {
    const note = this.get(id);
    if (!note) return null;
    Object.assign(note, patch, { updatedAt: now() });
    this._save();
    return note;
  }

  remove(id) {
    const before = this.notes.length;
    this.notes = this.notes.filter((n) => n.id !== id);
    const removed = this.notes.length < before;
    if (removed) this._save();
    return removed;
  }

  exportJSON() {
    return serialize(this.notes);
  }

  /** Merge an imported backup into the current store (by id). */
  importJSON(str) {
    const incoming = deserialize(str);
    const byId = new Map(this.notes.map((n) => [n.id, n]));
    for (const n of incoming) {
      const existing = byId.get(n.id);
      if (existing) Object.assign(existing, n);
      else {
        this.notes.push(n);
        byId.set(n.id, n);
      }
    }
    this._save();
    return this.notes;
  }
}
