import { HomeWebsiteSuite } from "@/components/website/home-website";
import { websiteHomeMetadata } from "@/lib/website-home-metadata";

export const metadata = websiteHomeMetadata;

export default function HomePage(): JSX.Element {
  return <HomeWebsiteSuite />;
}
