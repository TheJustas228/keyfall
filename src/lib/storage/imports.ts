/** Imported MIDI files live in IndexedDB so they survive app restarts and work offline. */
export interface ImportMeta {
  id: string;
  title: string;
  addedAt: number;
}
interface ImportRecord extends ImportMeta {
  bytes: Uint8Array;
}

const DB = 'keyfall';
const STORE = 'imports';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    t.oncomplete = () => db.close();
  });
}

export async function listImports(): Promise<ImportMeta[]> {
  try {
    const all = await tx<ImportRecord[]>('readonly', (s) => s.getAll() as IDBRequest<ImportRecord[]>);
    return all.map(({ id, title, addedAt }) => ({ id, title, addedAt })).sort((a, b) => b.addedAt - a.addedAt);
  } catch {
    return [];
  }
}

export async function addImport(title: string, bytes: Uint8Array): Promise<string> {
  const id = 'import-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  await tx('readwrite', (s) => s.put({ id, title, addedAt: Date.now(), bytes } satisfies ImportRecord));
  return id;
}

export async function getImport(id: string): Promise<Uint8Array> {
  const rec = await tx<ImportRecord | undefined>('readonly', (s) => s.get(id) as IDBRequest<ImportRecord | undefined>);
  if (!rec) throw new Error('Imported song not found');
  return new Uint8Array(rec.bytes);
}

export async function renameImport(id: string, title: string): Promise<void> {
  const rec = await tx<ImportRecord | undefined>('readonly', (s) => s.get(id) as IDBRequest<ImportRecord | undefined>);
  if (rec) await tx('readwrite', (s) => s.put({ ...rec, title }));
}

export async function deleteImport(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id));
}
