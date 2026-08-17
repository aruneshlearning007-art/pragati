import type { Metadata } from "next";
import { Fredoka, Karla, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";

const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-fredoka",
});

const karla = Karla({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-karla",
});

const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-devanagari",
});

export const metadata: Metadata = {
  title: "Pragati",
  description: "Personalized learning for Class 3-8 students",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${fredoka.variable} ${karla.variable} ${notoDevanagari.variable} font-body`}
      >
        {children}
      </body>
    </html>
  );
}
