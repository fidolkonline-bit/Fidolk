// Client-side IndexedDB Cache and Offline Transaction Queue for Fido LK POS

import type { Action, Customer, Product, WorkspaceResponse } from "./types";

const DB_NAME = "fido_offline_db";
const DB_VERSION = 1;

export interface QueuedOfflineSale {
  id: string; // Internal local UUID or requestId
  action: Action;
  createdAt: string;
  offlineInvoiceNumber: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      return reject(
        new Error("IndexedDB is not available in this environment."),
      );
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("catalog")) {
        db.createObjectStore("catalog", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("customers")) {
        db.createObjectStore("customers", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("offline_sales")) {
        db.createObjectStore("offline_sales", { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function cacheCatalogOffline(
  products: Product[],
  customers: Customer[],
): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(["catalog", "customers"], "readwrite");
    const catalogStore = tx.objectStore("catalog");
    const customerStore = tx.objectStore("customers");

    catalogStore.clear();
    for (const p of products) {
      catalogStore.put(p);
    }

    customerStore.clear();
    for (const c of customers) {
      customerStore.put(c);
    }

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("Failed to cache catalog offline", err);
  }
}

export async function getOfflineCatalog(): Promise<{
  products: Product[];
  customers: Customer[];
}> {
  try {
    const db = await openDb();
    const tx = db.transaction(["catalog", "customers"], "readonly");
    const catalogStore = tx.objectStore("catalog");
    const customerStore = tx.objectStore("customers");

    const products: Product[] = await new Promise((resolve, reject) => {
      const req = catalogStore.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    const customers: Customer[] = await new Promise((resolve, reject) => {
      const req = customerStore.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    return { products, customers };
  } catch {
    return { products: [], customers: [] };
  }
}

export async function queueOfflineSale(
  action: Action,
  offlineInvoiceNumber: string,
): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("offline_sales", "readwrite");
  const store = tx.objectStore("offline_sales");

  const entry: QueuedOfflineSale = {
    id: action.requestId,
    action,
    createdAt: new Date().toISOString(),
    offlineInvoiceNumber,
  };

  store.put(entry);

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getQueuedOfflineSales(): Promise<QueuedOfflineSale[]> {
  try {
    const db = await openDb();
    const tx = db.transaction("offline_sales", "readonly");
    const store = tx.objectStore("offline_sales");

    return await new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function removeOfflineSale(id: string): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction("offline_sales", "readwrite");
    const store = tx.objectStore("offline_sales");
    store.delete(id);

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("Failed to remove offline sale from queue", err);
  }
}

export async function syncOfflineQueue(
  sendAction: (action: Action) => Promise<WorkspaceResponse>,
): Promise<{ syncedCount: number; errors: string[] }> {
  const queue = await getQueuedOfflineSales();
  if (!queue.length) return { syncedCount: 0, errors: [] };

  let syncedCount = 0;
  const errors: string[] = [];

  for (const item of queue) {
    try {
      await sendAction(item.action);
      await removeOfflineSale(item.id);
      syncedCount++;
    } catch (err: any) {
      const msg = err?.message || "Sync failed";
      errors.push(`Invoice ${item.offlineInvoiceNumber}: ${msg}`);
      // If error is duplicate or business error, we don't block subsequent items
    }
  }

  return { syncedCount, errors };
}
