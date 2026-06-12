import AiCoderSegment from "./AiCoderSegment";
import PromptCopyPanel from "./PromptCopyPanel";
import SendToCoderPanel from "./SendToCoderPanel";
import BundleFileTree from "./BundleFileTree";
import type { BlueprintCandidate } from "@/types/blueprint";
import type { BundleFile } from "@/types/bundle";
import type { CoderId } from "@/types/coder";

export default function BundleResult({
  candidate,
  bundleId,
  coder,
  prompt,
  files,
  onCoderChange,
  onCopy,
  onSend,
  onDownload,
}: {
  candidate: BlueprintCandidate;
  bundleId: string;
  coder: CoderId;
  prompt: string;
  files: BundleFile[];
  onCoderChange: (coder: CoderId) => void;
  onCopy: () => void;
  onSend: (coder: CoderId) => void;
  onDownload: () => void;
}) {
  return (
    <article className="darkpanel bundle reveal">
      <div className="bundle-top">
        <div>
          <span className="mb-eyebrow"><span className="d" />Your Matrix Bundle is ready</span>
          <h2 className="bundle-h">{candidate.name}</h2>
          <div className="bundle-id">Bundle <b>{bundleId}</b> · AI coders are workers, not architects.</div>
        </div>
      </div>
      <div className="bundle-grid">
        <div>
          <div className="bx-label">Copy a controlled prompt for your AI coder</div>
          <AiCoderSegment coder={coder} onChange={onCoderChange} />
          <PromptCopyPanel coder={coder} prompt={prompt} onCopy={onCopy} />
          <SendToCoderPanel bundleId={bundleId} coder={coder} onSend={onSend} />
        </div>
        <div>
          <div className="bx-label">Bundle contents · {files.length} files</div>
          <BundleFileTree files={files} />
        </div>
      </div>
      <div className="build-opts">
        <button className="bo-btn primary" type="button" onClick={onDownload}>Download ZIP</button>
        <button className="bo-btn" type="button" onClick={onCopy}>Copy prompt</button>
      </div>
    </article>
  );
}
