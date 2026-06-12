import { DEFAULT_ALLOWED_FILES, DEFAULT_VALIDATION_COMMANDS, MATRIX_CONTRACT_FILES } from "@/lib/constants";
import type { CoderId } from "@/types/coder";

export default function PromptCopyPanel({ coder, prompt, onCopy }: { coder: CoderId; prompt: string; onCopy: () => void }) {
  return (
    <section className="codeblock" aria-label="Controlled AI-coder prompt preview">
      <div className="codeblock-bar">
        <span className="fn">coder-prompts/{coder}.md</span>
        <button type="button" className="mini-copy" onClick={onCopy}>Copy prompt</button>
      </div>
      <pre>{prompt}</pre>
      <div className="allowed-box">
        <div className="allowed-title">Contract files</div>
        <div className="allowed-grid">
          {MATRIX_CONTRACT_FILES.slice(0, 4).map((file) => <span key={file}>{file}</span>)}
        </div>
        <div className="allowed-title">Allowed files</div>
        <div className="allowed-grid">
          {DEFAULT_ALLOWED_FILES.slice(0, 4).map((file) => <span key={file}>{file}</span>)}
        </div>
        <p>Validation before finish: {DEFAULT_VALIDATION_COMMANDS.join(" · ")}</p>
      </div>
    </section>
  );
}
