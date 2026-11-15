import type { Metadata } from "next";
import { Geist, Geist_Mono, Montserrat } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import IntroGate from "../components/landing/IntroGate";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  weight: ["700"],
  subsets: ["latin"],
});

/** Tipografía principal de la marca (título de la intro y logo). */
const space = localFont({
  src: "./fonts/SPACE.ttf",
  variable: "--font-space",
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ExoVitals · Medicina de vuelo autónoma",
  description:
    "Monitorización clínica a bordo para misiones de larga duración. NASA Space Apps Challenge 2026.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} ${montserrat.variable} ${space.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <IntroGate />
      </body>
    </html>
  );
}
