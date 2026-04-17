import { randomUUID } from "node:crypto";

export interface StoredComponent {
  id: string;
  source: string;
  createdAt: string;
  updatedAt: string;
}

type ComponentStore = Record<string, StoredComponent>;

declare global {
  var __websiteEditorStore: ComponentStore | undefined;
}

function getStore(): ComponentStore {
  if (!globalThis.__websiteEditorStore) {
    globalThis.__websiteEditorStore = {};
  }

  return globalThis.__websiteEditorStore;
}

export async function createComponent(source: string): Promise<StoredComponent> {
  const now = new Date().toISOString();
  const created: StoredComponent = {
    id: randomUUID(),
    source,
    createdAt: now,
    updatedAt: now,
  };

  const store = getStore();
  store[created.id] = created;

  return created;
}

export async function getComponent(id: string): Promise<StoredComponent | null> {
  const store = getStore();

  return store[id] ?? null;
}

export async function updateComponent(
  id: string,
  source: string,
): Promise<StoredComponent | null> {
  const store = getStore();
  const existing = store[id];

  if (!existing) {
    return null;
  }

  const updated: StoredComponent = {
    ...existing,
    source,
    updatedAt: new Date().toISOString(),
  };

  store[id] = updated;

  return updated;
}
