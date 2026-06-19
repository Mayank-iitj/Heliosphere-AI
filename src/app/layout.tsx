import type { Metadata, Viewport } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import SmoothScroll from "@/components/providers/SmoothScroll";

const display = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-space-grotesk",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "HelioSphere AI — Solar Weather Intelligence",
  description:
    "Real-time solar activity monitoring, ML flare forecasting and an interactive 3D digital twin of the Sun. Built for space-weather operations.",
  keywords: [
    "space weather",
    "solar flare forecasting",
    "Kp index",
    "ISRO",
    "heliophysics",
    "digital twin",
  ],
  openGraph: {
    title: "HelioSphere AI",
    description: "Solar weather intelligence, forecasting and a 3D digital twin of the Sun.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#04060d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={display.variable}>
      <body>
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
