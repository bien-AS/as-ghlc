import type { Metadata } from "next";
import {
  Bricolage_Grotesque,
  IBM_Plex_Mono,
  Source_Sans_3,
} from "next/font/google";
import "./globals.css";
import { ENDORSER_NAME, PRODUCT_NAME } from "@/lib/brand";
import { Providers } from "./providers";

const heading = Bricolage_Grotesque({
  variable: "--font-bricolage",
  weight: ["600", "700"],
  subsets: ["latin"],
});

const body = Source_Sans_3({
  variable: "--font-source-sans",
  weight: ["400", "600"],
  subsets: ["latin"],
});

const label = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: PRODUCT_NAME,
  description: `${PRODUCT_NAME} by ${ENDORSER_NAME} is a sales workspace that takes a lead from web form to signed deal.`,
};

// Runs while the HTML is parsed, before first paint, so the stored choice (or
// the device setting) never flashes the wrong theme. Mirrors src/hooks/use-theme.ts.
const themeScript = `(function(){var t;try{t=localStorage.getItem("theme")}catch(e){}var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${heading.variable} ${body.variable} ${label.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static string, the documented way to set the theme before paint */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
