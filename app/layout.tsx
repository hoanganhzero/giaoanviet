import PwaRegister from "./pwa-register";
import type { Metadata } from "next";
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource/be-vietnam-pro/700.css";
import "@fontsource/be-vietnam-pro/800.css";
import "@fontsource/be-vietnam-pro/900.css";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "Giáo án Việt",
  manifest: "/manifest.webmanifest",
  metadataBase: new URL("https://khbd.giaovienso.id.vn"),
  title: "Tạo Giáo Án Việt | Nền tảng giáo án số",
  description: "Nền tảng tạo KHBD và PPCT tích hợp Năng lực số, Trí tuệ nhân tạo dành cho giáo viên Việt Nam.",
  icons: {
    icon: [{ url: "/brand-icon.png", type: "image/png" }],
    shortcut: "/brand-icon.png",
    apple: "/icons/icon-192.png",
  },
  openGraph: {
    title: "Tạo Giáo Án Việt",
    description: "Nền tảng giáo án số — tạo KHBD và PPCT tích hợp Năng lực số, Trí tuệ nhân tạo.",
    url: "https://khbd.giaovienso.id.vn",
    siteName: "Tạo Giáo Án Việt",
    locale: "vi_VN",
    type: "website",
    images: [{ url: "/og.png", width: 1536, height: 1024, alt: "Tạo Giáo Án Việt — Nền tảng giáo án số" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tạo Giáo Án Việt",
    description: "Nền tảng giáo án số dành cho giáo viên Việt Nam.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body>
        <PwaRegister />
        {children}
        <div
          aria-label="Phiên bản AI Engine"
          title="Chuẩn tích hợp NLS &amp; AI: Phần 1 bảng định hướng + khối 🔴 5 phân khối + Quality Gate"
          style={{
            position: "fixed",
            right: 12,
            bottom: 10,
            zIndex: 9999,
            padding: "5px 9px",
            borderRadius: 999,
            background: "rgba(15, 23, 42, 0.88)",
            color: "#fff",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: ".02em",
            boxShadow: "0 4px 18px rgba(15, 23, 42, .18)",
            pointerEvents: "none",
          }}
        >
          AI Engine v3.0
        </div>
      </body>
    </html>
  );
}
