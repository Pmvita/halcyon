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
          background: "#f4f0e6",
        }}
      >
        <div
          style={{
            width: 110,
            height: 70,
            border: "3px solid #0c1014",
            borderBottom: "none",
            borderRadius: "110px 110px 0 0",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 70,
              height: 44,
              border: "2.5px solid #b08948",
              borderBottom: "none",
              borderRadius: "70px 70px 0 0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ width: 10, height: 10, background: "#b08948", borderRadius: 10 }} />
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
