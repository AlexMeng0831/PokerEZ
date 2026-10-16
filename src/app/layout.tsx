import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { Header } from "@/components/header";
import "./globals.css";
export const metadata: Metadata = {
  title: "PokerEZ — Make poker simple",
  description:
    "A friendly place to play, learn, and find your poker rhythm. Frontend demo.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          <div className="app-shell">
            <Header />
            {children}
            <footer>
              <span>
                ♠ PokerEZ <span className="footer-dot">·</span> A little
                practice. A better player.
              </span>
              <span>Made for learning. Play chips only.</span>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
