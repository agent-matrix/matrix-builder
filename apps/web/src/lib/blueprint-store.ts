// C0 — Blueprint workspace store: one live state object, mutated in the browser.
//
// `useBlueprintWorkspace` is the single source of truth for the Details page. It generates the
// initial blueprint and applies chat instructions entirely via `blueprint-engine` (no network),
// so the workspace is instant and works fully offline. Two optional enhancements layer on top:
//   • C4 persistence — the state autosaves to localStorage and rehydrates on reload (no server).
//   • C3 AI refine   — one bounded, fail-open call may improve the explanation prose afterward.

import { useCallback, useEffect, useRef, useState } from "react";

import * as engine from "@/lib/blueprint-engine";
import { refineWithAI } from "@/lib/ai-refine";
import { loadWorkspace, saveWorkspace, workspaceKey } from "@/lib/blueprint-persistence";
import type { BlueprintDetailsData, ChatMessage } from "@/types/blueprint-state";

const now = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function messagesFrom(data: BlueprintDetailsData): ChatMessage[] {
  return (data.chat_history ?? []).map((m, i) => ({ id: m.id || `h-${i}`, role: m.role, content: m.content }));
}

export interface BlueprintWorkspace {
  data: BlueprintDetailsData;
  messages: ChatMessage[];
  dirty: boolean;
  busy: boolean;
  /** Apply a chat instruction locally (instant, no network) and patch the affected sections. */
  applyInstruction: (text: string) => void;
  /** Replace state with a refined version (optional AI/server enhancement). */
  setData: (next: BlueprintDetailsData) => void;
  markSaved: () => void;
}

export function useBlueprintWorkspace(candidateId: string, idea: string): BlueprintWorkspace {
  const [data, setDataState] = useState<BlueprintDetailsData>(() => engine.generate(candidateId, idea));
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);

  const dataRef = useRef(data); // latest state, so applyInstruction never reads a stale closure
  dataRef.current = data;
  const keyRef = useRef(workspaceKey(idea, candidateId));

  // C4 — rehydrate from localStorage if present, else generate locally. No fetch on the render path.
  useEffect(() => {
    const key = workspaceKey(idea, candidateId);
    keyRef.current = key;
    const saved = loadWorkspace(key);
    const next = saved ?? engine.generate(candidateId, idea);
    dataRef.current = next;
    setDataState(next);
    setMessages(saved ? messagesFrom(saved) : []);
    setDirty(false);
    setBusy(false);
  }, [candidateId, idea]);

  const setData = useCallback((next: BlueprintDetailsData) => {
    dataRef.current = next;
    setDataState(next);
    setMessages(messagesFrom(next));
    saveWorkspace(keyRef.current, next);
  }, []);

  const applyInstruction = useCallback((text: string) => {
    const clean = text.trim();
    if (!clean || busy) return;
    setMessages((m) => [...m, { id: `u-${Date.now()}`, role: "user", content: clean, time: now() }]);
    setBusy(true);
    // Defer a tick so the "thinking" affordance can paint — still zero network for the result.
    window.setTimeout(() => {
      const res = engine.apply(dataRef.current, clean);
      const stamp = new Date().toISOString();
      res.data.chat_history = [
        ...(dataRef.current.chat_history ?? []),
        { id: `uh-${Date.now()}`, role: "user", content: clean, timestamp: stamp },
        { id: `bh-${Date.now()}`, role: "blueprint", content: res.reply, timestamp: stamp },
      ];
      dataRef.current = res.data;
      setDataState(res.data);
      setMessages((m) => [...m, { id: `b-${Date.now()}`, role: "blueprint", content: res.reply, time: now() }]);
      setDirty(true);
      setBusy(false);
      saveWorkspace(keyRef.current, res.data); // C4 autosave

      // C3 — optional, bounded, fail-open AI refinement of the explanation only.
      void refineWithAI(res.data, clean)
        .then((ref) => {
          if (!ref) return;
          const patched: BlueprintDetailsData = {
            ...dataRef.current,
            overview: ref.overview ?? dataRef.current.overview,
            design_brain: ref.designBrain ?? dataRef.current.design_brain,
          };
          dataRef.current = patched;
          setDataState(patched);
          saveWorkspace(keyRef.current, patched);
          if (ref.reply) setMessages((m) => [...m, { id: `r-${Date.now()}`, role: "blueprint", content: `✦ ${ref.reply}`, time: now() }]);
        })
        .catch(() => undefined);
    }, 140);
  }, [busy]);

  const markSaved = useCallback(() => setDirty(false), []);

  return { data, messages, dirty, busy, applyInstruction, setData, markSaved };
}
