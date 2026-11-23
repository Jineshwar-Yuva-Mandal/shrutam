import type { Metadata } from "next";
import { Lora, Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-body" });
const lora = Lora({ subsets: ["latin"], variable: "--font-display" });

export const metadata: Metadata = {
  title: "Shrutam",
  description: "A shared home for paathshala learning and community.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${lora.variable}`}>{children}</body>
    </html>
  );
}