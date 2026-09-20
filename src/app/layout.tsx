import type { Metadata } from "next";
import { DM_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";

const body = DM_Sans({ subsets: ["latin"], variable: "--font-body", weight: ["400", "500", "700"] });
const num = Space_Grotesk({ subsets: ["latin"], variable: "--font-num", weight: ["500", "700"] });

export const metadata: Metadata = {
  title: "Betcha",
  description: "Bet your friends on anything. Odds set by your track record.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${num.variable}`}>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
