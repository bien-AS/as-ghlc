import type { Metadata } from "next";

import { SiteFooter } from "@/components/ui/site-footer";
import { SiteNav } from "@/components/ui/site-nav";
import { ENDORSER_NAME, PRODUCT_NAME } from "@/lib/brand";

import {
  ClosingCta,
  Control,
  Features,
  Hero,
  HowItWorks,
  PipelineStrip,
  ProductFacts,
  WorksOnTop,
} from "./_landing/sections";

const title = `${PRODUCT_NAME}: from new lead to signed proposal`;
const description = `${PRODUCT_NAME} by ${ENDORSER_NAME} is a sales workspace that sits on top of the CRM you already use. AI vets each inbound lead, and a rep works it through one pipeline.`;

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, type: "website", siteName: PRODUCT_NAME },
};

const SECTION_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#control", label: "Control" },
];

/**
 * The public landing page (spec 01). Static: it reads no session and fetches
 * nothing, so signed-in and signed-out visitors get the same page.
 */
export default function LandingPage() {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only z-50 rounded-control bg-card px-3 py-2 font-semibold ring-1 ring-border focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <SiteNav links={SECTION_LINKS} />
      <main id="main-content" tabIndex={-1} className="outline-none">
        <Hero />
        <PipelineStrip />
        <HowItWorks />
        <Features />
        <Control />
        <WorksOnTop />
        <ProductFacts />
        <ClosingCta />
      </main>
      <SiteFooter
        columns={[
          { title: "Product", links: SECTION_LINKS },
          {
            title: "Account",
            links: [
              { href: "/sign-in", label: "Sign in" },
              { href: "/sign-up", label: "Sign up" },
              { href: "/reset-password", label: "Reset password" },
            ],
          },
        ]}
      />
    </>
  );
}
