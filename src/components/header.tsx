"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Moon, Sun, Spade, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
export function Header() {
  const path = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <header className="header">
      <Link href="/" className="brand">
        <Spade fill="currentColor" size={28} />
        <span>
          Poker<span className="brand-ez">EZ</span>
        </span>
      </Link>
      <nav aria-label="Main navigation">
        {[
          ["/", "Play"],
          ["/learn", "Learn"],
          ["/profile", "Profile"],
        ].map(([url, label]) => (
          <Link
            key={url}
            href={url}
            className={
              path === url || (url === "/" && path === "/table")
                ? "nav-link active"
                : "nav-link"
            }
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="header-actions">
        <Link href="/preview" className="local-badge">
          <i /> Animation preview
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          aria-label="Toggle color theme"
        >
          <Sun className="sun" size={19} />
          <Moon className="moon" size={19} />
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/profile">
            Guest profile <ArrowUpRight size={14} />
          </Link>
        </Button>
      </div>
    </header>
  );
}
