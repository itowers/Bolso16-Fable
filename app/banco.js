// IndexedDB com try/catch. Se falhar, o app segue em memória e avisa uma vez (quem chama decide o aviso).
export class Banco {
  constructor(nome = 'bolso16') { this.nome = nome; this.db = null; this.ok = true; }
  abrir() {
    return new Promise(res => {
      try {
        const r = indexedDB.open(this.nome, 1);
        r.onupgradeneeded = () => { const d = r.result; for (const s of ['kv', 'amostras', 'biblio']) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s); };
        r.onsuccess = () => { this.db = r.result; res(true); };
        r.onerror = r.onblocked = () => { this.ok = false; res(false); };
      } catch (e) { this.ok = false; res(false); }
    });
  }
  _tx(store, modo, f) {
    return new Promise(res => {
      if (!this.db) return res(undefined);
      try {
        const tx = this.db.transaction(store, modo), st = tx.objectStore(store); let out; const rq = f(st);
        if (rq) rq.onsuccess = () => { out = rq.result; };
        tx.oncomplete = () => res(out); tx.onerror = tx.onabort = () => { this.ok = false; res(undefined); };
      } catch (e) { this.ok = false; res(undefined); }
    });
  }
  get(store, k) { return this._tx(store, 'readonly', s => s.get(k)); }
  set(store, k, v) { return this._tx(store, 'readwrite', s => { s.put(v, k); }); }
  del(store, k) { return this._tx(store, 'readwrite', s => { s.delete(k); }); }
  chaves(store) { return this._tx(store, 'readonly', s => s.getAllKeys()).then(x => x || []); }
  todos(store) { return this._tx(store, 'readonly', s => s.getAll()).then(x => x || []); }
  limpar(store) { return this._tx(store, 'readwrite', s => { s.clear(); }); }
}
