import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Voxa",
  description: "Realtime audio, transcription, and AI-assisted workspace",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full font-sans antialiased dark`}
    >
      <body
        className="voxa-app-bg flex min-h-dvh min-h-0 flex-col text-zinc-100"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
