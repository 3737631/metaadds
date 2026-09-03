import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Nav from "@/components/nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Meta Winners",
  description:
    "Encuentra productos con las señales publicitarias más fuertes en Meta.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-bg text-text">
        <Nav />
        <div className="md:pl-[220px]">
          <div className="mx-auto flex w-full max-w-[520px] flex-col px-4 pt-6 pb-24 md:max-w-[900px] md:px-8 md:pt-10 md:pb-16">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
