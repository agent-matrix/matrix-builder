import { AI_CODERS, BUNDLE_API_BASE } from "@/lib/constants";
import type { CoderId } from "@/types/coder";

export default function SendToCoderPanel({ bundleId, coder, onSend }: { bundleId: string; coder: CoderId; onSend: (coder: CoderId) => void }) {
  const fetchUrl = `${BUNDLE_API_BASE}/${bundleId}?open_file=coder-prompts/${coder}.md`;
  return (
    <section>
      <div className="bx-label">Send/fetch bundle URL pattern</div>
      <div className="fetch-url">{fetchUrl}</div>
      <div className="send-grid" style={{ marginTop: 14 }}>
        {AI_CODERS.filter((item) => item.id !== "generic-ai-coder").map((item) => (
          <button className="send-chip" type="button" key={item.id} onClick={() => onSend(item.id)} title={item.handoff}>
            {item.name}
          </button>
        ))}
      </div>
    </section>
  );
}
