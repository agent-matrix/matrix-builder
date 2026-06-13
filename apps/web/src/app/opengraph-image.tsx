import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Matrix Builder — Give AI coders a contract, not a prompt";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px 88px",
          background:
            "radial-gradient(900px 500px at 88% 6%, rgba(34,200,120,0.20), transparent 60%), linear-gradient(160deg, #03190f, #02170f 60%, #01100b)",
          color: "#f7fff9",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 46,
              height: 46,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "3px solid #22c878",
              borderRadius: 10,
              transform: "rotate(45deg)",
            }}
          >
            <div style={{ width: 14, height: 14, background: "#53f39d", borderRadius: 3 }} />
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: "#a7c9b8" }}>Matrix Builder</div>
        </div>
        <div style={{ fontSize: 78, fontWeight: 800, lineHeight: 1.04, marginTop: 44, letterSpacing: -2 }}>
          Give AI coders a contract,
        </div>
        <div style={{ fontSize: 78, fontWeight: 800, lineHeight: 1.04, letterSpacing: -2, color: "#53f39d" }}>
          not a prompt.
        </div>
        <div style={{ fontSize: 28, color: "#a7c9b8", marginTop: 36, maxWidth: 920, lineHeight: 1.4 }}>
          Turn one sentence into a controlled, signed, validated build — for Claude Code, Codex, Cursor, GitPilot, or IBM Bob.
        </div>
      </div>
    ),
    { ...size },
  );
}
