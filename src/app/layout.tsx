import "@/styles/globals.css";

import { SpeedInsights } from "@vercel/speed-insights/next";
import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { ReactScan } from "@/components/react-scan-component";
import { ThemeProvider } from "@/components/theme-provider";
import { WebVitals } from "@/components/web-vitals";
import { TRPCReactProvider } from "@/trpc/react";

export const metadata: Metadata = {
  title: "CIFRA",
  description: "Built with security in mind.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={geist.variable} suppressHydrationWarning>
      <ReactScan />
      <body className="bg-background text-foreground scroll-smooth antialiased transition-colors">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          scriptProps={{ "data-cdasync": "false" }}
        >
          <TRPCReactProvider>{children}</TRPCReactProvider>
          <WebVitals />
          <SpeedInsights />
        </ThemeProvider>
      </body>
    </html>
  );
}
