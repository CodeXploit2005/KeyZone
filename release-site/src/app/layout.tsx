import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Ambient3DBackground } from "@/components/Ambient3DBackground";

export const metadata: Metadata = {
  title: "KeyZone Video Studio — Windows & Android",
  description:
    "Tải KeyZone Video Studio cho Windows và Android. Viết kịch bản, tạo nhân vật xuyên suốt, dựng và xuất video ngay trên thiết bị của bạn.",
  icons: {
    icon: "./keyzone-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0c0821",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="dark">
      <body className="relative isolate min-h-screen selection:bg-fuchsia-500/30 selection:text-fuchsia-100">
        <Ambient3DBackground />
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
