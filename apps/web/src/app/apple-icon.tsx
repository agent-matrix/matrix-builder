import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#02170f",
        }}
      >
        <div
          style={{
            width: 92,
            height: 92,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "8px solid #22c878",
            borderRadius: 18,
            transform: "rotate(45deg)",
          }}
        >
          <div style={{ width: 30, height: 30, background: "#53f39d", borderRadius: 6 }} />
        </div>
      </div>
    ),
    { ...size },
  );
}
