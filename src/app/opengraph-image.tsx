import { ImageResponse } from "next/og";

export const alt = "Vault — Free Self-Hosted Password Manager";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundImage: "linear-gradient(135deg, #0f3d34, #134e43 45%, #0f3d34 100%)",
          padding: 80,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: 8,
              background: "#c8a96a",
              boxShadow: "0 0 24px #c8a96a",
            }}
          />
          <div
            style={{
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: "#a9c2b8",
            }}
          >
            Vault
          </div>
        </div>
        <div
          style={{
            marginTop: 36,
            fontSize: 64,
            fontWeight: 700,
            color: "#f7f6f1",
            textAlign: "center",
            lineHeight: 1.15,
            maxWidth: 960,
          }}
        >
          A password manager that can&rsquo;t read your passwords
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: 28,
            color: "#a9c2b8",
            textAlign: "center",
            maxWidth: 860,
          }}
        >
          Free, open-source, self-hosted. AES-256-GCM encryption, client-side.
        </div>
      </div>
    ),
    { ...size },
  );
}
