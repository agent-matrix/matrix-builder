import { AI_CODERS } from "@/lib/constants";
import type { CoderId } from "@/types/coder";

export default function AiCoderSegment({ coder, onChange }: { coder: CoderId; onChange: (coder: CoderId) => void }) {
  return (
    <div className="coder-seg" aria-label="Choose AI coder prompt format">
      {AI_CODERS.map((item) => (
        <button type="button" key={item.id} className={coder === item.id ? "on" : ""} onClick={() => onChange(item.id)} title={item.handoff}>
          {item.short}
        </button>
      ))}
    </div>
  );
}
