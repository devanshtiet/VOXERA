"use client";

import { useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  MessageSquare,
  Database,
  Settings,
  LogOut,
  Sparkles,
  Users,
  PhoneCall,
  Menu,
  X,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/admin/try-call", icon: PhoneCall, label: "Try a Call" },
  { href: "/admin/tenants", icon: Users, label: "Tenants" },
  { href: "/admin/sessions", icon: MessageSquare, label: "Sessions" },
  { href: "/admin/knowledge", icon: Database, label: "Knowledge Base" },
  { href: "/admin/rag", icon: Sparkles, label: "RAG Debugger" },
  { href: "/admin/settings", icon: Settings, label: "Settings" },
];

export function AdminMobileNav({ userEmail }: { userEmail: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]">
      <div className="flex items-center justify-between p-4">
        <Link href="/" className="font-display font-bold text-xl text-gradient">
          VOXERA
        </Link>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="p-2 rounded-lg text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]"
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {open && (
        <nav className="px-4 pb-4 space-y-1">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)] transition-all"
            >
              <Icon className="w-4 h-4 text-[var(--color-text-muted)]" />
              {label}
            </Link>
          ))}
          <div className="pt-3 mt-2 border-t border-[var(--color-border-subtle)]">
            <p className="text-[12px] text-[var(--color-text-secondary)] truncate mb-2 px-3">{userEmail}</p>
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                className="flex items-center gap-2 w-full text-left px-3 py-2 text-[13px] text-red-400 hover:text-red-300 font-semibold transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </form>
          </div>
        </nav>
      )}
    </div>
  );
}
