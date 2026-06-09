import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Providers } from "@/components/auth-provider";
import { FloatingChat } from "@/components/chat/floating-chat";
import "./globals.css";

export const metadata: Metadata = {
  title: "BOLIHON Beach Resort",
  description: "Modern beach resort booking app built with Next.js, Supabase, and Tailwind CSS.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <Providers>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
          <FloatingChat />
        </Providers>
      </body>
    </html>
  );
}
