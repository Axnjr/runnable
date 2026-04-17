"use client";

import {
  createElement,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";

import {
  findElementById,
  getElementText,
  parseComponentSource,
  serializeComponent,
  setElementStyle,
  setElementText,
} from "@/lib/editor/jsx-editor";
import type { EditorElementNode, EditorNode } from "@/lib/editor/types";

type SaveMode = "idle" | "saving" | "saved" | "error";

interface StoredComponentResponse {
  id: string;
  source: string;
  createdAt: string;
  updatedAt: string;
}

const LAST_COMPONENT_ID_KEY = "website-editor:last-component-id";

const Icons = {
  Preview: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  Code: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  ),
  Save: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  ),
};

export function WebsiteEditor({
  initialSource,
  onSave,
  autoSave = true,
}: {
  initialSource: string;
  onSave?: (serializedComponent: string) => void;
  autoSave?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<"preview" | "code">("preview");
  const [sourceInput, setSourceInput] = useState(initialSource);
  const [saveMode, setSaveMode] = useState<SaveMode>("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const [componentId, setComponentId] = useState<string | null>(null);
  const [componentIdInput, setComponentIdInput] = useState("");

  const initialParsed = useMemo(() => {
    try {
      const parsed = parseComponentSource(initialSource);
      return {
        rootNode: parsed,
        selectedId: parsed.id,
        parseError: null as string | null,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to parse component source.";

      return {
        rootNode: null,
        selectedId: null,
        parseError: message,
      };
    }
  }, [initialSource]);

  const [rootNode, setRootNode] = useState<EditorElementNode | null>(
    initialParsed.rootNode,
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    initialParsed.selectedId,
  );
  const [parseError, setParseError] = useState<string | null>(initialParsed.parseError);
  const [hasEdits, setHasEdits] = useState(false);

  const serialized = useMemo(
    () => (rootNode ? serializeComponent(rootNode) : ""),
    [rootNode],
  );

  const selectedNode = useMemo(() => {
    if (!rootNode || !selectedId) {
      return null;
    }

    return findElementById(rootNode, selectedId);
  }, [rootNode, selectedId]);

  const parseAndLoadSource = useCallback((source: string): boolean => {
    try {
      const parsed = parseComponentSource(source);
      setRootNode(parsed);
      setSelectedId(parsed.id);
      setParseError(null);
      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to parse component source.";
      setParseError(message);
      return false;
    }
  }, []);

  const ensureComponentRecord = useCallback(
    async (source: string): Promise<string> => {
      if (componentId) {
        persistLastComponentId(componentId);
        return componentId;
      }

      const response = await fetch("/component", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ source }),
      });

      if (!response.ok) {
        throw new Error("Failed to create component record.");
      }

      const created = (await response.json()) as StoredComponentResponse;
      setComponentId(created.id);
      setComponentIdInput(created.id);
      persistLastComponentId(created.id);
      return created.id;
    },
    [componentId],
  );

  const persist = useCallback(
    async (isAuto: boolean) => {
      setSaveMode("saving");

      try {
        let nextSerialized = serialized;

        if (activeTab === "code") {
          const parsed = parseComponentSource(sourceInput);
          setRootNode(parsed);
          setSelectedId(parsed.id);
          setParseError(null);
          nextSerialized = sourceInput;
        } else if (rootNode) {
          nextSerialized = serializeComponent(rootNode);
        }

        if (!nextSerialized.trim()) {
          throw new Error("Nothing to save.");
        }

        const targetId = await ensureComponentRecord(nextSerialized);
        const response = await fetch(`/component/${targetId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ source: nextSerialized }),
        });

        if (!response.ok) {
          throw new Error("Failed to sync component changes.");
        }

        const saved = (await response.json()) as StoredComponentResponse;
        setComponentId(saved.id);
        setComponentIdInput(saved.id);
        persistLastComponentId(saved.id);

        setSaveMode("saved");
        setHasEdits(false);
        setSaveMessage(isAuto ? "Autosaved" : "Saved");
        onSave?.(nextSerialized);

        window.setTimeout(() => {
          setSaveMode((current) => (current === "saved" ? "idle" : current));
        }, 1600);
      } catch (error) {
        setSaveMode("error");
        const message =
          error instanceof Error ? error.message : "Unable to save component.";
        setSaveMessage(message);
      }
    },
    [activeTab, ensureComponentRecord, onSave, rootNode, serialized, sourceInput],
  );

  useEffect(() => {
    if (!autoSave || !hasEdits) {
      return;
    }

    const timer = window.setTimeout(() => {
      void persist(true);
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [autoSave, hasEdits, persist, serialized]);

  useEffect(() => {
    let cancelled = false;

    const restoreLastComponent = async () => {
      const lastId = readLastComponentId();
      if (!lastId) {
        return;
      }

      setComponentIdInput(lastId);
      setSaveMode("saving");

      try {
        const response = await fetch(`/preview/${lastId}`);
        if (!response.ok) {
          throw new Error("Unable to restore last component.");
        }
        const data = (await response.json()) as StoredComponentResponse;

        if (cancelled) {
          return;
        }

        setSourceInput(data.source);
        setComponentId(data.id);
        setComponentIdInput(data.id);
        persistLastComponentId(data.id);

        const isValid = parseAndLoadSource(data.source);
        if (!isValid) {
          throw new Error("Stored component source is invalid JSX.");
        }

        setHasEdits(false);
        setSaveMode("saved");
        setSaveMessage(`Restored ${data.id.slice(0, 8)}...`);
      } catch {
        if (cancelled) {
          return;
        }

        clearLastComponentId();
        setSaveMode("idle");
        setSaveMessage("");
      }
    };

    void restoreLastComponent();

    return () => {
      cancelled = true;
    };
  }, [parseAndLoadSource]);

  const applySource = useCallback(() => {
    const isValid = parseAndLoadSource(sourceInput);
    if (!isValid) {
      return;
    }

    setHasEdits(true);
    setSaveMode("idle");
    setSaveMessage("Source applied to preview.");
    setActiveTab("preview");
  }, [parseAndLoadSource, sourceInput]);

  const loadById = useCallback(async () => {
    const id = componentIdInput.trim();
    if (!id) {
      return;
    }

    setSaveMode("saving");

    try {
      const response = await fetch(`/preview/${id}`);
      if (!response.ok) {
        throw new Error("Component id not found.");
      }
      const data = (await response.json()) as StoredComponentResponse;

      setSourceInput(data.source);
      setComponentId(data.id);
      setComponentIdInput(data.id);
      persistLastComponentId(data.id);

      const isValid = parseAndLoadSource(data.source);
      if (!isValid) {
        throw new Error("Stored component source is invalid JSX.");
      }

      setHasEdits(false);
      setSaveMode("saved");
      setSaveMessage(`Loaded ${data.id.slice(0, 8)}...`);
    } catch (error) {
      setSaveMode("error");
      const message =
        error instanceof Error ? error.message : "Unable to load component by id.";
      setSaveMessage(message);
    }
  }, [componentIdInput, parseAndLoadSource]);

  const updateStyle = useCallback(
    (key: string, value: string) => {
      if (!rootNode || !selectedId) {
        return;
      }

      const nextRoot = setElementStyle(rootNode, selectedId, key, value);
      setRootNode(nextRoot);
      setSourceInput(serializeComponent(nextRoot));
      setHasEdits(true);
      setSaveMode("idle");
    },
    [rootNode, selectedId],
  );

  const updateText = useCallback(
    (value: string) => {
      if (!rootNode || !selectedId) {
        return;
      }

      const nextRoot = setElementText(rootNode, selectedId, value);
      setRootNode(nextRoot);
      setSourceInput(serializeComponent(nextRoot));
      setHasEdits(true);
      setSaveMode("idle");
    },
    [rootNode, selectedId],
  );

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-start min-h-[640px] animate-minimal-in">
      <div className="flex-1 flex flex-col bg-white border border-zinc-100 rounded-3xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-50 gap-4">
          <div className="flex bg-zinc-50 p-1 rounded-xl border border-zinc-100">
            <button
              onClick={() => setActiveTab("preview")}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                activeTab === "preview"
                  ? "bg-white text-accent shadow-sm"
                  : "text-neutral-400 hover:text-neutral-600"
              }`}
              type="button"
            >
              <Icons.Preview /> PREVIEW
            </button>
            <button
              onClick={() => setActiveTab("code")}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                activeTab === "code"
                  ? "bg-white text-accent shadow-sm"
                  : "text-neutral-400 hover:text-neutral-600"
              }`}
              type="button"
            >
              <Icons.Code /> SOURCE
            </button>
          </div>

          <div className="flex items-center gap-3">
            {activeTab === "code" ? (
              <button
                onClick={applySource}
                className="px-4 py-2 rounded-xl border border-zinc-200 text-[10px] font-mono font-black text-neutral-500 uppercase tracking-widest hover:bg-zinc-50 transition-colors"
                type="button"
              >
                Apply Source
              </button>
            ) : null}
            {saveMode !== "idle" ? (
              <span
                className={`text-[10px] font-mono font-bold uppercase tracking-widest ${
                  saveMode === "error" ? "text-red-500" : "text-accent"
                }`}
              >
                {saveMode === "saving" ? "Syncing..." : saveMessage}
              </span>
            ) : null}
            <button
              onClick={() => void persist(false)}
              className="flex items-center gap-2 px-5 py-2 bg-accent text-white rounded-xl text-xs font-mono font-bold hover:brightness-105 active:scale-95 transition-all shadow-sm shadow-accent/20"
              type="button"
            >
              <Icons.Save /> SAVE
            </button>
          </div>
        </div>

        <div className="flex-1 relative bg-white">
          {activeTab === "preview" ? (
            <div className="h-full overflow-auto p-12 pattern-dots bg-zinc-50/30">
              {rootNode ? (
                <div className="max-w-2xl mx-auto shadow-2xl shadow-zinc-200/50">
                  <PreviewNode node={rootNode} selectedId={selectedId} onSelect={setSelectedId} />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-neutral-300 gap-2">
                  <Icons.Code />
                  <p className="text-xs font-mono font-bold uppercase tracking-widest">
                    Awaiting Definition
                  </p>
                </div>
              )}
            </div>
          ) : (
            <textarea
              className="w-full h-screen p-8 font-mono text-xs text-neutral-700 outline-none resize-none leading-relaxed bg-zinc-50/20"
              value={sourceInput}
              onChange={(event) => {
                setSourceInput(event.target.value);
                setHasEdits(true);
                setSaveMode("idle");
              }}
              spellCheck={false}
              placeholder="// Paste JSX here..."
            />
          )}
        </div>
      </div>

      <aside className="w-full lg:w-[340px] flex flex-col gap-6">
        <div className="bg-white border border-zinc-100 rounded-3xl p-6 flex flex-col gap-8 shadow-sm">
          <header className="flex items-center justify-between">
            <h3 className="text-[10px] font-mono font-bold text-accent uppercase tracking-[0.2em]">
              Inspector
            </h3>
            {selectedNode ? (
              <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase">
                {selectedNode.tag}
              </span>
            ) : null}
          </header>

          {parseError ? (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-3 text-[10px] font-mono font-bold uppercase tracking-widest text-red-600">
              {parseError}
            </div>
          ) : null}

          {!selectedNode ? (
            <div className="py-12 flex flex-col items-center text-center gap-3">
              <div className="w-10 h-10 rounded-full bg-zinc-50 flex items-center justify-center text-neutral-300">
                <Icons.Preview />
              </div>
              <p className="text-[11px] font-mono font-bold text-neutral-400 uppercase tracking-widest leading-relaxed">
                Choose an element <br /> to refine
              </p>
            </div>
          ) : (
            <div className="space-y-8 animate-minimal-in">
              <div className="space-y-3">
                <label className="text-[10px] font-mono font-black text-neutral-400 uppercase tracking-widest">
                  Content
                </label>
                <textarea
                  className="w-full bg-zinc-50 border-none rounded-2xl p-4 text-xs font-mono font-bold text-neutral-800 focus:ring-2 focus:ring-accent/10 outline-none transition-all min-h-[120px]"
                  value={getElementText(selectedNode)}
                  onChange={(event) => updateText(event.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-mono font-black text-neutral-400 uppercase tracking-widest">
                    Color
                  </label>
                  <div className="relative">
                    <div
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border border-black/5"
                      style={{ backgroundColor: selectedNode.style.color || "#000" }}
                    />
                    <input
                      className="w-full bg-zinc-50 border-none rounded-xl pl-8 pr-3 py-2 text-[11px] font-mono font-bold text-neutral-800 focus:ring-2 focus:ring-accent/10 outline-none transition-all"
                      value={selectedNode.style.color || ""}
                      onChange={(event) => updateStyle("color", event.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-mono font-black text-neutral-400 uppercase tracking-widest">
                    Surface
                  </label>
                  <div className="relative">
                    <div
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border border-black/5"
                      style={{ backgroundColor: selectedNode.style.backgroundColor || "#fff" }}
                    />
                    <input
                      className="w-full bg-zinc-50 border-none rounded-xl pl-8 pr-3 py-2 text-[11px] font-mono font-bold text-neutral-800 focus:ring-2 focus:ring-accent/10 outline-none transition-all"
                      value={selectedNode.style.backgroundColor || ""}
                      onChange={(event) =>
                        updateStyle("backgroundColor", event.target.value)
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-mono font-black text-neutral-400 uppercase tracking-widest">
                    Size
                  </label>
                  <input
                    className="w-full bg-zinc-50 border-none rounded-xl px-4 py-2 text-[11px] font-mono font-bold text-neutral-800 focus:ring-2 focus:ring-accent/10 outline-none transition-all"
                    value={selectedNode.style.fontSize || ""}
                    onChange={(event) => updateStyle("fontSize", event.target.value)}
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-mono font-black text-neutral-400 uppercase tracking-widest">
                    Weight
                  </label>
                  <select
                    className="w-full bg-zinc-50 border-none rounded-xl px-4 py-2 text-[11px] font-mono font-bold text-neutral-800 focus:ring-2 focus:ring-accent/10 outline-none transition-all appearance-none"
                    value={selectedNode.style.fontWeight || "400"}
                    onChange={(event) => updateStyle("fontWeight", event.target.value)}
                  >
                    {[300, 400, 500, 600, 700, 800, 900].map((weight) => (
                      <option key={weight} value={weight}>
                        {weight}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-mono font-black text-neutral-400 uppercase tracking-widest">
              Load Existing Component
            </label>
            <div className="flex gap-2">
              <input
                className="min-w-0 flex-1 bg-zinc-50 border-none rounded-xl px-3 py-2 text-[11px] font-mono font-bold text-neutral-700 focus:ring-2 focus:ring-accent/10 outline-none transition-all"
                value={componentIdInput}
                onChange={(event) => setComponentIdInput(event.target.value)}
                placeholder="component id"
              />
              <button
                className="px-3 py-2 rounded-xl bg-zinc-900 text-white text-[10px] font-mono font-black uppercase tracking-widest"
                type="button"
                onClick={() => void loadById()}
              >
                Load
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 flex items-center justify-between text-[10px] font-mono font-bold text-neutral-300 uppercase tracking-[0.2em]">
          <span>{componentId ? `Component ${componentId.slice(0, 8)}...` : "Unsaved Draft"}</span>
          <div className="flex gap-2">
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                hasEdits ? "bg-accent animate-pulse" : "bg-neutral-200"
              }`}
            />
            <div className="w-1.5 h-1.5 rounded-full bg-neutral-100" />
          </div>
        </div>
      </aside>
    </div>
  );
}

const VOID_ELEMENTS = new Set([
  "br",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "area",
  "base",
  "col",
  "embed",
  "param",
  "source",
  "track",
  "wbr",
]);

function PreviewNode({
  node,
  selectedId,
  onSelect,
}: {
  node: EditorElementNode;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return <>{renderNode(node, selectedId, onSelect)}</>;
}

function renderNode(
  node: EditorNode,
  selectedId: string | null,
  onSelect: (id: string) => void,
): ReactNode {
  if (node.type === "text") {
    return node.value;
  }

  const isSelected = node.id === selectedId;

  const props = {
    ...node.attributes,
    key: node.id,
    onClick: (event: MouseEvent) => {
      event.stopPropagation();
      onSelect(node.id);
    },
    style: {
      ...toReactStyle(node.style),
      cursor: "pointer",
      outline: isSelected ? "2px solid var(--accent)" : "none",
      outlineOffset: isSelected ? "4px" : "0",
      transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
      boxShadow: isSelected ? "0 0 0 12px rgba(56, 190, 207, 0.05)" : "none",
      position: "relative",
      zIndex: isSelected ? 10 : "auto",
    } as CSSProperties,
  };

  if (VOID_ELEMENTS.has(node.tag)) {
    return createElement(node.tag, props);
  }

  const children = node.children.map((child) => renderNode(child, selectedId, onSelect));
  return createElement(node.tag, props, ...children);
}

function toReactStyle(style: Record<string, string>): CSSProperties {
  const reactStyle: Record<string, string> = {};

  for (const [key, value] of Object.entries(style)) {
    const reactKey = key.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
    reactStyle[reactKey] = value;
  }

  return reactStyle;
}

function readLastComponentId(): string | null {
  try {
    return window.localStorage.getItem(LAST_COMPONENT_ID_KEY);
  } catch {
    return null;
  }
}

function persistLastComponentId(componentId: string) {
  try {
    window.localStorage.setItem(LAST_COMPONENT_ID_KEY, componentId);
  } catch {
    // Ignore storage errors (private mode/storage disabled).
  }
}

function clearLastComponentId() {
  try {
    window.localStorage.removeItem(LAST_COMPONENT_ID_KEY);
  } catch {
    // Ignore storage errors (private mode/storage disabled).
  }
}
