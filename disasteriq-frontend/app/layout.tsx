import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CRISP — Crisis Response Intelligence & Prediction System",
  description: "Real-time AI disaster prediction and relief optimization for India.",
  manifest: "/manifest.json",
  keywords: ["disaster", "AI", "India", "relief", "prediction", "NDMA", "CRISP"],
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ background: '#000', color: '#f0f0f0', fontFamily: "'Inter', -apple-system, sans-serif", margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
