import { LandingPageContent } from "@/components/website/landing-page";
import { WebsiteFooter } from "@/components/website/website-footer";
import { WebsiteHeader } from "@/components/website/website-header";

export function HomeWebsiteSuite(): JSX.Element {
  return (
    <div className="website-light min-h-screen bg-bgBase text-textPrimary antialiased selection:bg-accentDim selection:text-textPrimary">
      <WebsiteHeader />
      <LandingPageContent />
      <WebsiteFooter />
    </div>
  );
}
