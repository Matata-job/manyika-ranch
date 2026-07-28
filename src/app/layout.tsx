import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { SessionProvider } from "@/components/providers/session-provider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ya Buu Ranch — Livestock Management",
  description: "Livestock management system for Singida ranch operations",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Ya Buu Ranch",
  },
};

export const viewport: Viewport = {
  themeColor: "#2d5a3d",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
