import type { Metadata } from "next";

import { ContactPageContent } from "@/components/website/contact-page-content";
import { WebsiteFooter } from "@/components/website/website-footer";
import { WebsiteHeader } from "@/components/website/website-header";

export const metadata: Metadata = {
  title: "Contact Grace AI",
  description:
    "Reach the Grace AI team for demos, pricing, and questions about AI voice agents for your business.",
};

export default function ContactPage(): JSX.Element {
  return (
    <div className="website-light min-h-screen bg-bgBase text-textPrimary antialiased selection:bg-accentDim selection:text-textPrimary">
      <WebsiteHeader />
      <ContactPageContent />
      <WebsiteFooter />
    </div>
  );
}
