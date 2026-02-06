import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { DAppKitProvider } from "@/components/providers/DAppKitProvider";
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
  title: "Oshio - Margin Trading on Sui",
  description: "Decentralized margin trading platform powered by DeepBook V3",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <DAppKitProvider>{children}</DAppKitProvider>
      </body>
    </html>
  );
}
