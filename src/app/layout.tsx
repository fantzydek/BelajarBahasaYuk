import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const display = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "MikuAI — Learn Languages. Understand the World.",
    template: "%s · MikuAI",
  },
  description:
    "MikuAI adalah platform belajar bahasa berbasis AI: tutor percakapan, penerjemah pintar, academy terstruktur, kosakata, kuis, dan analitik belajar — ditenagai xAI Grok.",
  keywords: ["MikuAI", "language learning", "AI tutor", "belajar bahasa", "xAI Grok"],
  applicationName: "MikuAI",
};

export const viewport: Viewport = {
  themeColor: "#080B10",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${display.variable} font-sans antialiased bg-background text-foreground min-h-screen`}
      >
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
