import { DocumentItem, DocType } from "./documents";
import { extractReviewDate } from "./reviewDateExtractor";

// ---------- IndexedDB persistence for directory handle ----------
const DB_NAME = "docvigil";
const STORE = "handles";
const KEY = "rootDir";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveRootHandle(handle: FileSystemDirectoryHandle) {
  const db = await openDb();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(handle, KEY);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export async function loadRootHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openDb();
    return await new Promise((res, rej) => {
      const tx = db.transaction(STORE, "readonly");
      const r = tx.objectStore(STORE).get(KEY);
      r.onsuccess = () => res(r.result ?? null);
      r.onerror = () => rej(r.error);
    });
  } catch {
    return null;
  }
}

export async function clearRootHandle() {
  const db = await openDb();
  await new Promise<void>((res) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(KEY);
    tx.oncomplete = () => res();
  });
}

export async function ensurePermission(
  handle: FileSystemDirectoryHandle,
  mode: "read" | "readwrite" = "read"
): Promise<boolean> {
  const opts = { mode } as const;
  const h = handle as unknown as {
    queryPermission: (o: unknown) => Promise<PermissionState>;
    requestPermission: (o: unknown) => Promise<PermissionState>;
  };
  const q = await h.queryPermission(opts);
  if (q === "granted") return true;
  const r = await h.requestPermission(opts);
  return r === "granted";
}

// ---------- Scanning ----------
const SUPPORTED: Record<string, DocType> = {
  docx: "docx",
  xlsx: "xlsx",
  pptx: "pptx",
  pdf: "pdf",
};

export const SUPPORTED_EXTENSIONS = Object.keys(SUPPORTED);

export interface ScannedFile {
  id: string; // path
  name: string;
  type: DocType;
  location: string; // relative folder path
  lastModified: number; // epoch ms
  size: number;
  reviewDate: string | null; // ISO — extracted "Última Revisão"
  reviewFound: boolean;
}

function getExt(name: string) {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i + 1).toLowerCase();
}

function isTempFile(name: string) {
  return name.startsWith("~$") || name.startsWith(".~");
}

interface FileEntryRaw {
  id: string;
  name: string;
  type: DocType;
  location: string;
  file: File;
}

async function collectEntries(root: FileSystemDirectoryHandle): Promise<FileEntryRaw[]> {
  const out: FileEntryRaw[] = [];
  async function walk(dir: FileSystemDirectoryHandle, prefix: string) {
    const iter = (dir as unknown as { entries: () => AsyncIterable<[string, FileSystemHandle]> }).entries();
    for await (const [name, entry] of iter) {
      if (name.startsWith(".")) continue;
      if (entry.kind === "directory") {
        await walk(entry as FileSystemDirectoryHandle, prefix ? `${prefix}/${name}` : name);
      } else {
        if (isTempFile(name)) continue;
        const type = SUPPORTED[getExt(name)];
        if (!type) continue;
        try {
          const file = await (entry as FileSystemFileHandle).getFile();
          out.push({
            id: prefix ? `${prefix}/${name}` : name,
            name,
            type,
            location: prefix || root.name,
            file,
          });
        } catch {
          // skip
        }
      }
    }
  }
  await walk(root, "");
  return out;
}

export async function scanDirectory(
  root: FileSystemDirectoryHandle,
  prevByPath?: Map<string, ScannedFile>
): Promise<ScannedFile[]> {
  const raw = await collectEntries(root);
  const out: ScannedFile[] = [];
  for (const r of raw) {
    const prev = prevByPath?.get(r.id);
    let reviewIso: string | null = prev?.reviewDate ?? null;
    let reviewFound = prev?.reviewFound ?? false;
    // Re-parse only when file changed or never parsed
    const changed =
      !prev || prev.lastModified !== r.file.lastModified || prev.size !== r.file.size;
    if (changed) {
      const date = await extractReviewDate(r.file, r.type);
      if (date) {
        reviewIso = date.toISOString();
        reviewFound = true;
      } else {
        reviewIso = null;
        reviewFound = false;
        console.info(`[DocVigil] Data de revisão não identificada: ${r.id}`);
      }
    }
    out.push({
      id: r.id,
      name: r.name,
      type: r.type,
      location: r.location,
      lastModified: r.file.lastModified,
      size: r.file.size,
      reviewDate: reviewIso,
      reviewFound,
    });
  }
  return out;
}

// Variant for fallback (input element) — accepts pre-fetched File list
export async function scanFiles(items: { id: string; name: string; type: DocType; location: string; file: File }[]): Promise<ScannedFile[]> {
  const out: ScannedFile[] = [];
  for (const r of items) {
    const date = await extractReviewDate(r.file, r.type);
    out.push({
      id: r.id,
      name: r.name,
      type: r.type,
      location: r.location,
      lastModified: r.file.lastModified,
      size: r.file.size,
      reviewDate: date ? date.toISOString() : null,
      reviewFound: !!date,
    });
    if (!date) console.info(`[DocVigil] Data de revisão não identificada: ${r.id}`);
  }
  return out;
}

// ---------- Diff ----------
export type ChangeKind = "added" | "modified" | "removed";

export interface ChangeEvent {
  kind: ChangeKind;
  path: string;
  name: string;
  at: number;
}

export function diffSnapshots(prev: ScannedFile[], next: ScannedFile[]): ChangeEvent[] {
  const prevMap = new Map(prev.map((f) => [f.id, f]));
  const nextMap = new Map(next.map((f) => [f.id, f]));
  const events: ChangeEvent[] = [];
  const now = Date.now();
  for (const [id, f] of nextMap) {
    const old = prevMap.get(id);
    if (!old) events.push({ kind: "added", path: id, name: f.name, at: now });
    else if (old.lastModified !== f.lastModified || old.size !== f.size)
      events.push({ kind: "modified", path: id, name: f.name, at: now });
  }
  for (const [id, f] of prevMap) {
    if (!nextMap.has(id)) events.push({ kind: "removed", path: id, name: f.name, at: now });
  }
  return events;
}

// ---------- Mapping to DocumentItem ----------
export function toDocumentItems(files: ScannedFile[], rootName: string): DocumentItem[] {
  const lower = rootName.toLowerCase();
  const source: DocumentItem["source"] = lower.includes("sharepoint")
    ? "SharePoint"
    : lower.includes("onedrive")
    ? "OneDrive"
    : "Pasta local";
  return files.map((f) => ({
    id: f.id,
    name: f.name,
    type: f.type,
    location: `${rootName}/${f.location}`.replace(/\/+$/, ""),
    owner: "—",
    lastReview: f.reviewDate,
    reviewFound: f.reviewFound,
    lastModified: f.lastModified,
    source,
  }));
}

export function isFileSystemAccessSupported() {
  return typeof (window as any).showDirectoryPicker === "function";
}
