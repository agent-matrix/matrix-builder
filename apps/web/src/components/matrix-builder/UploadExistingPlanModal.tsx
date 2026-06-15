"use client";

// Import modal — calm, Apple-minimal. Import a brief/blueprint or start from one template.
// Portals to <body> so it centers regardless of the header's backdrop-filter. UI only: the parent
// routes the selection (doc → brief, JSON → skip-AI, template → brief).

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { TEMPLATES, templateDownloadName, templateUrl, type TemplateId } from "@/lib/templates";

export type UploadSelection = { file?: File; templateId?: TemplateId };

// Accepted uploads: documents + Blueprint JSON (images/vision intentionally not supported).
const ACCEPT = ".pdf,.docx,.md,.markdown,.txt,.json";
const FEATURED = TEMPLATES[0]; // one template in the dialog; keep it import-dialog, not marketplace

const I = {
  close: <path d="M6 6l12 12M18 6L6 18" />,
  upload: (<><path d="M12 16V4" /><path d="M7 9l5-5 5 5" /><path d="M5 20h14" /></>),
  cube: (<><path d="M12 2.7l8 4.6v9.4l-8 4.6-8-4.6V7.3z" /><path d="M4 7.3l8 4.7 8-4.7M12 12v8.6" /></>),
};
function Ic({ d, size = 18 }: { d: ReactNode; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
}

export default function UploadExistingPlanModal({
  open,
  onClose,
  onContinue,
  onUseTemplate,
}: {
  open: boolean;
  onClose: () => void;
  onContinue: (selection: UploadSelection) => void;
  onUseTemplate: (id: TemplateId) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => { if (!open) { setFile(null); setDragOver(false); } }, [open]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted || !open || typeof document === "undefined") return null;

  const isJson = Boolean(file && /\.json$/i.test(file.name));

  return createPortal(
    <div className="auth-scrim" role="dialog" aria-modal="true" aria-label="Import"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="upl-card">
        <button className="auth-x" type="button" aria-label="Close" onClick={onClose}><Ic d={I.close} size={16} /></button>
        <h2 className="upl-title">Import</h2>
        <p className="upl-sub">Use a brief, design, or Blueprint JSON.</p>

        <div
          className={`upl-drop${dragOver ? " over" : ""}${file ? " has-file" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) setFile(f); }}
          onClick={() => inputRef.current?.click()}
          role="button" tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
        >
          <input ref={inputRef} type="file" accept={ACCEPT} hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f); }} />
          <span className="upl-up"><Ic d={I.upload} size={24} /></span>
          {file ? <div className="upl-file">{file.name}</div> : <div className="upl-drop-t">Drop file or <span className="upl-browse">browse</span></div>}
        </div>
        <p className="upl-formats">PDF, DOCX, Markdown, Blueprint JSON</p>

        {isJson && (
          <p className="upl-note"><b>Blueprint JSON detected. AI skipped.</b> Matrix Builder will validate and follow your blueprint.</p>
        )}

        <div className="upl-tpl-h">Template</div>
        <div className="upl-tpl-one">
          <span className="upl-tpl-ic"><Ic d={I.cube} size={18} /></span>
          <div className="upl-tpl-b">
            <span className="upl-tpl-n">{FEATURED.name}</span>
            <span className="upl-tpl-d">{FEATURED.summary}</span>
          </div>
          <div className="upl-tpl-actions">
            <button type="button" className="upl-tpl-use" onClick={() => onUseTemplate(FEATURED.id)}>Use template</button>
            <a className="upl-tpl-dl" href={templateUrl(FEATURED.id)} download={templateDownloadName(FEATURED.id)}>Download JSON</a>
          </div>
        </div>

        <div className="upl-actions">
          <button className="bo-btn upl-cancel" type="button" onClick={onClose}>Cancel</button>
          <button className="upl-continue" type="button" disabled={!file} onClick={() => { if (file) onContinue({ file }); }}>Continue</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
