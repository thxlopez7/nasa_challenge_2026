import type { Metadata } from "next";
import { Geist, Geist_Mono, Montserrat } from "next/font/google";
import "./globals.css";
import IntroGate from "../components/landing/IntroGate";
import { I18nProvider } from "../i18n/I18nContext";
import { StoreHydrator } from "../hooks/useHydrated";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  weight: ["700"],
  subsets: ["latin"],
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
      className={`${geistSans.variable} ${geistMono.variable} ${montserrat.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <I18nProvider>
          <StoreHydrator />
          {children}
          <IntroGate />
        </I18nProvider>
      </body>
    </html>
  );
}
