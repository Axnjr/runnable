import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export interface StoredComponent {
  id: string;
  source: string;
  createdAt: string;
  updatedAt: string;
}

type ComponentStore = Record<string, StoredComponent>;

const dataDir = path.join(process.cwd(), "data");
const dataFile = path.join(dataDir, "components.json");

async function ensureDataFile() {
  await fs.mkdir(dataDir, { recursive: true });

  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, JSON.stringify({}), "utf-8");
  }
}

async function readStore(): Promise<ComponentStore> {
  await ensureDataFile();

  const raw = await fs.readFile(dataFile, "utf-8");

  try {
    const parsed = JSON.parse(raw) as ComponentStore;
    return parsed;
  } catch {
    return {};
  }
}

async function writeStore(store: ComponentStore) {
  await ensureDataFile();
  await fs.writeFile(dataFile, JSON.stringify(store, null, 2), "utf-8");
}

export async function createComponent(source: string): Promise<StoredComponent> {
  const now = new Date().toISOString();
  const created: StoredComponent = {
    id: randomUUID(),
    source,
    createdAt: now,
    updatedAt: now,
  };

  const store = await readStore();
  store[created.id] = created;
  await writeStore(store);

  return created;
}

export async function getComponent(id: string): Promise<StoredComponent | null> {
  const store = await readStore();

  return store[id] ?? null;
}

export async function updateComponent(
  id: string,
  source: string,
): Promise<StoredComponent | null> {
  const store = await readStore();
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
  await writeStore(store);

  return updated;
}
