import { hasJobDraftContent, restoreJobBuilderDraft, type JobBuilderDraft } from "./job-copy";

export type JobDraftStep = 1 | 2 | 3;
interface DraftImage { blob: Blob; name: string; lastModified: number }
export interface StoredJobDraft {
  version: 1;
  revision?: string;
  ownerId: string;
  form: JobBuilderDraft;
  builderStep: JobDraftStep;
  savedAt: string | null;
  images: DraftImage[];
}

export interface JobDraftState { snapshot: StoredJobDraft | null; revision: string | null }
interface DeletedJobDraft { version: 1; ownerId: string; revision: string; deleted: true }
export class JobDraftConflictError extends Error {
  constructor() { super("Utkastet har ändrats i en annan flik. Dina ändringar finns kvar här. Öppna det sparade utkastet innan du fortsätter."); this.name = "JobDraftConflictError"; }
}
function storedRevision(value: StoredJobDraft | DeletedJobDraft | undefined): string | null {
  if (!value) return null;
  // Older complete records receive a stable comparison token without being rewritten on read.
  return value.revision ?? `legacy:${(value as StoredJobDraft).savedAt ?? "undated"}`;
}

export function jobDraftSnapshot(ownerId: string, form: JobBuilderDraft, files: File[], builderStep: JobDraftStep): StoredJobDraft {
  if (!ownerId) throw new Error("Logga in för att spara utkastet.");
  if (files.reduce((size, file) => size + file.size, 0) > 20 * 1024 * 1024) throw new Error("Bilderna är för stora för att spara lokalt. Välj en mindre bild eller publicera direkt.");
  if (form.imagePending && files.length === 0) throw new Error("Texten finns kvar, men bilden saknas. Välj bilden igen eller ta bort bildvalet innan hela utkastet kan sparas.");
  return {
    version: 1, revision: crypto.randomUUID(), ownerId, form: restoreJobBuilderDraft(structuredClone(form)), builderStep,
    savedAt: new Date().toISOString(),
    images: files.map(file => ({ blob: file, name: file.name, lastModified: file.lastModified })),
  };
}

export function readLegacyJobDraft(ownerId: string, raw: string | null): StoredJobDraft | null {
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Det äldre utkastet kunde inte läsas.");
  const form = restoreJobBuilderDraft(parsed.form ?? parsed);
  if (!hasJobDraftContent(form)) return null;
  return { version: 1, ownerId, form, builderStep: [1, 2, 3].includes(parsed.builderStep) ? parsed.builderStep : 1, images: [], savedAt: null };
}

/** One atomic record contains the cropped image bytes, text and current step.
 * Operations are ordered per account, including deletion after publication. */
export class JobDraftStore {
  private queues = new Map<string, Promise<unknown>>();
  constructor(private factory: () => IDBFactory = () => globalThis.indexedDB, private databaseName = "matchnwork-company-drafts") {}

  private ordered<T>(ownerId: string, action: () => Promise<T>): Promise<T> {
    if (!ownerId) return Promise.reject(new Error("Logga in för att hantera utkastet."));
    const next = (this.queues.get(ownerId) ?? Promise.resolve()).catch(() => {}).then(action);
    this.queues.set(ownerId, next);
    void next.finally(() => { if (this.queues.get(ownerId) === next) this.queues.delete(ownerId); }).catch(() => {});
    return next;
  }

  private async transaction<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const factory = this.factory();
    if (!factory) throw new Error("Webbläsaren tillåter inte lokal bildlagring. Behåll sidan öppen eller försök i en annan webbläsare.");
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(this.databaseName, 1);
      let blocked = false;
      request.onupgradeneeded = () => { request.result.createObjectStore("drafts", { keyPath: "ownerId" }); };
      request.onsuccess = () => { if (blocked) request.result.close(); else resolve(request.result); };
      request.onerror = () => reject(request.error);
      request.onblocked = () => { blocked = true; reject(new Error("Stäng andra flikar som använder annonsutkast och försök igen.")); };
    });
    return new Promise<T>((resolve, reject) => {
      let transaction: IDBTransaction;
      try {
        transaction = db.transaction("drafts", mode);
        const request = run(transaction.objectStore("drafts"));
        transaction.oncomplete = () => { db.close(); resolve(request.result); };
        transaction.onabort = transaction.onerror = () => { db.close(); reject(transaction.error ?? request.error ?? new Error("Utkastet kunde inte sparas.")); };
      } catch (error) { db.close(); reject(error); }
    });
  }

  read(ownerId: string): Promise<JobDraftState> {
    return this.ordered(ownerId, async () => {
      const value = await this.transaction<StoredJobDraft | DeletedJobDraft | undefined>("readonly", store => store.get(ownerId));
      if (!value) return { snapshot: null, revision: null };
      if (value.ownerId === ownerId && value.version === 1 && "deleted" in value && value.deleted === true && typeof value.revision === "string") {
        return { snapshot: null, revision: value.revision };
      }
      if ("deleted" in value) throw new Error("Utkastet har ett format som inte kunde läsas.");
      if (value.ownerId !== ownerId || value.version !== 1 || !Array.isArray(value.images)
        || value.images.some(image => !(image.blob instanceof Blob) || typeof image.name !== "string")
        || !value.form || typeof value.form !== "object" || ![1, 2, 3].includes(value.builderStep)) {
        throw new Error("Utkastet har ett format som inte kunde läsas.");
      }
      return { snapshot: { ...value, form: restoreJobBuilderDraft(value.form) }, revision: storedRevision(value) };
    });
  }
  async load(ownerId: string): Promise<StoredJobDraft | null> { return (await this.read(ownerId)).snapshot; }

  /** The comparison and write share one transaction, including across browser tabs.
   * A content-free deletion marker prevents an old empty tab from resurrecting a published draft. */
  private mutate(ownerId: string, expectedRevision: string | null, next: StoredJobDraft | DeletedJobDraft): Promise<string> {
    return this.ordered(ownerId, async () => {
      const factory = this.factory();
      if (!factory) throw new Error("Webbläsaren tillåter inte lokal bildlagring.");
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = factory.open(this.databaseName, 1);
        let blocked = false;
        request.onupgradeneeded = () => { request.result.createObjectStore("drafts", { keyPath: "ownerId" }); };
        request.onsuccess = () => { if (blocked) request.result.close(); else resolve(request.result); };
        request.onerror = () => reject(request.error);
        request.onblocked = () => { blocked = true; reject(new Error("Stäng andra flikar som använder annonsutkast och försök igen.")); };
      });
      return new Promise<string>((resolve, reject) => {
        let failure: unknown;
        try {
          const tx = db.transaction("drafts", "readwrite");
          tx.oncomplete = () => { db.close(); resolve(next.revision!); };
          tx.onabort = () => { db.close(); reject(failure ?? tx.error ?? new Error("Utkastet kunde inte sparas.")); };
          const store = tx.objectStore("drafts"), request = store.get(ownerId);
          request.onsuccess = () => {
            try {
              if (storedRevision(request.result) !== expectedRevision) throw new JobDraftConflictError();
              store.put(next);
            } catch (error) { failure = error; tx.abort(); }
          };
        } catch (error) { db.close(); reject(error); }
      });
    });
  }
  save(snapshot: StoredJobDraft, expectedRevision: string | null): Promise<string> {
    // Clone before queueing so later form edits cannot mutate an earlier save.
    const copy = structuredClone(snapshot);
    copy.revision = crypto.randomUUID();
    return this.mutate(copy.ownerId, expectedRevision, copy);
  }
  remove(ownerId: string, expectedRevision: string | null): Promise<string> {
    return this.mutate(ownerId, expectedRevision, { version: 1, ownerId, revision: crypto.randomUUID(), deleted: true });
  }
}

export const jobDraftStore = new JobDraftStore();
