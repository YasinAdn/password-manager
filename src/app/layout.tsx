import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { VaultProvider } from "@/lib/vault-context";
import VelvetBackground from "@/components/VelvetBackground";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://passten.vercel.app";
const DESCRIPTION =
  "Vault is a free, open-source, self-hosted password manager with client-side AES-256-GCM encryption. Your master password never leaves your device.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Vault — Free Self-Hosted Password Manager",
    template: "%s — Vault",
  },
  description: DESCRIPTION,
  keywords: [
    "password manager",
    "self-hosted password manager",
    "open source password manager",
    "client-side encryption",
    "AES-256 password manager",
    "free password manager",
    "encrypted password vault",
    "Bitwarden alternative",
  ],
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Vault",
    title: "Vault — Free Self-Hosted Password Manager",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Vault — Free Self-Hosted Password Manager",
    description: DESCRIPTION,
  },
};

export const viewport = {
  themeColor: "#0f3d34",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Runs before paint so the light theme (if previously chosen) never
            flashes dark first. */}
        <Script id="theme-init" strategy="beforeInteractive">
          {`try {
            if (localStorage.getItem("theme") === "light") {
              document.documentElement.setAttribute("data-theme", "light");
            }
          } catch (e) {}`}
        </Script>
        <VelvetBackground />
        <VaultProvider>{children}</VaultProvider>
      </body>
    </html>
  );
}
