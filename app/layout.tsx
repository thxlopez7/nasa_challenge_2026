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

/**
 * Familia de texto corrido (Roboto, SIL OFL 1.1). Jerarquía por peso:
 *   900 Black   → títulos y énfasis (font-semibold/bold/black, h1–h3)
 *   200 ExtraLight → texto corrido (peso por defecto del body)
 *   300 Light   → texto pequeño (≤ 14 px), para que se lea sobre fondo oscuro
 *   100 Thin    → cifras grandes (font-thin)
 */
const robotoCondensed = localFont({
  src: [
    { path: "./fonts/roboto/Roboto_Condensed-Thin.ttf", weight: "100", style: "normal" },
    { path: "./fonts/roboto/Roboto_Condensed-ExtraLight.ttf", weight: "200", style: "normal" },
    { path: "./fonts/roboto/Roboto_Condensed-Light.ttf", weight: "300", style: "normal" },
    { path: "./fonts/roboto/Roboto_Condensed-Black.ttf", weight: "900", style: "normal" },
  ],
  variable: "--font-roboto-condensed",
  display: "swap",
});

/** Entradillas y textos de introducción grandes. */
const robotoSemiThin = localFont({
  src: "./fonts/roboto/Roboto_SemiCondensed-Thin.ttf",
  weight: "100",
  variable: "--font-roboto-semi",
  display: "swap",
});

/** Notas, aclaraciones y citas en cursiva. */
const robotoItalic = localFont({
  src: "./fonts/roboto/Roboto-ExtraLightItalic.ttf",
  weight: "200",
  style: "italic",
  variable: "--font-roboto-italic",
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
      className={`${geistSans.variable} ${geistMono.variable} ${montserrat.variable} ${space.variable} ${robotoCondensed.variable} ${robotoSemiThin.variable} ${robotoItalic.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <IntroGate />
      </body>
    </html>
  );
}
