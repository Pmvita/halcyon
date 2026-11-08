import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** Meridian arc on paper — original Halcyon mark. */
export default function Icon() {
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
            width: 22,
            height: 14,
            border: "1.5px solid #0c1014",
            borderBottom: "none",
            borderRadius: "22px 22px 0 0",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 14,
              height: 9,
              border: "1.25px solid #b08948",
              borderBottom: "none",
              borderRadius: "14px 14px 0 0",
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}
