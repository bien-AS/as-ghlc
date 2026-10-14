import type { Metadata } from "next";
import { JetBrains_Mono, Poppins } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { COMPANY_NAME } from "@/lib/brand";
import { Providers } from "./providers";

const sans = Poppins({
  variable: "--font-poppins",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: COMPANY_NAME,
  description:
    "The sales workspace that takes a lead from web form to signed deal.",
};

// Runs while the HTML is parsed, before first paint. Vantage is dark-first with
// no prefers-color-scheme block, so a class is always written: without it a
// light-mode user on "System" is left in dark. Mirrors src/hooks/use-theme.ts.
const themeScript = `(function(){var t;try{t=localStorage.getItem("as-vantage-theme")}catch(e){}var d=t==="dark"||(t!=="light"&&!matchMedia("(prefers-color-scheme: light)").matches);var c=document.documentElement.classList;c.toggle("dark",d);c.toggle("light",!d)})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <Script id="theme-init" strategy="beforeInteractive">
          {themeScript}
        </Script>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
