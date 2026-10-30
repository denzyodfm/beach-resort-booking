import type { Metadata } from "next";
import { Outfit, Plus_Jakarta_Sans } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Providers } from "@/components/auth-provider";
import { FloatingChat } from "@/components/chat/floating-chat";
import "./globals.css";

// Outfit's rounded geometric shapes echo the "bolihon" wordmark; Plus Jakarta Sans stays readable at small sizes.
const heading = Outfit({ subsets: ["latin"], variable: "--font-heading", display: "swap" });
const body = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: "BOLIHON Beach Resort",
  description: "Book a beachfront cottage at BOLIHON Cove, Carmen, Agusan del Norte.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${heading.variable} ${body.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <Providers>
          <a
            href="#main-content"
            className="sr-only z-[100] rounded-lg bg-bolihon-green px-4 py-2 font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
          >
            Skip to main content
          </a>
          <SiteHeader />
          <main id="main-content" className="flex-1">{children}</main>
          <SiteFooter />
          <FloatingChat />
        </Providers>
      </body>
    </html>
  );
}
