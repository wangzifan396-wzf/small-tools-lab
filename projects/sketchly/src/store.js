/**
 * Scene persistence to a localStorage-compatible backend (pluggable for
 * testing in Node). Pure serialization lives in scene.js.
 *
 * @module store
 */

import { serializeScene, deserializeScene } from './scene.js';

const KEY = 'sketchly:v1';

export class Store {
  constructor(storage) {
    this.storage =
      storage || (typeof globalThis !== 'undefined' && globalThis.localStorage) || null;
  }

  load() {
    if (!this.storage) return { elements: [], view: { x: 0, y: 0, zoom: 1 } };
    const raw = this.storage.getItem(KEY);
    if (!raw) return { elements: [], view: { x: 0, y: 0, zoom: 1 } };
    try {
      return deserializeScene(raw);
    } catch {
      return { elements: [], view: { x: 0, y: 0, zoom: 1 } };
    }
  }

  save(scene) {
    if (!this.storage) return;
    try {
      this.storage.setItem(KEY, serializeScene(scene));
    } catch {
      /* quota / private mode — ignore */
    }
  }

  clear() {
    if (this.storage) this.storage.removeItem(KEY);
  }
}
