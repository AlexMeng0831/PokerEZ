"use client";
import Link from "next/link";
import { useEffect } from "react";
import {
  refreshRoomMembership,
  useMultiplayer,
} from "@/lib/multiplayer/client";
import { resumableRoom } from "@/lib/multiplayer/resume-room";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Moon, Sun, Spade, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
export function Header() {
  const path = usePathname();
  const connection = useMultiplayer();
  const room = resumableRoom(connection);
  const showResume = !!room && path !== "/table";
  useEffect(() => {
    const sync = () => {
      if (document.visibilityState !== "hidden") void refreshRoomMembership();
    };
    void refreshRoomMembership();
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [path]);
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <header className={`header ${showResume ? "has-active-room" : ""}`}>
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
        {showResume ? (
          <Button asChild size="sm" className="resume-game">
            <Link href="/table" title={`Return to ${room.name}`}>
              Resume Game <ArrowUpRight size={14} />
            </Link>
          </Button>
        ) : (
          !connection.snapshot && (
            <Link href="/preview" className="local-badge">
              <i /> Animation preview
            </Link>
          )
        )}
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
