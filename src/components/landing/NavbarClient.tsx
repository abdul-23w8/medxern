"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import LoginModal from "@/components/auth/LoginModal";

export default function NavbarClient() {
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-50 h-16 border-b border-border/60 bg-white/75 backdrop-blur supports-[backdrop-filter]:bg-white/60 shadow-[0_1px_0_rgba(15,23,42,0.06)]">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-3">
            <div className="relative h-11 w-11 overflow-hidden rounded-xl ring-1 ring-black/5 shadow-sm">
              <Image
                src="/brand/medxern.png"
                alt="MEDXERN App Icon"
                fill
                className="object-cover"
                priority
              />
            </div>

            <div className="leading-tight">
              <div className="text-sm font-semibold text-medx-navy">MEDXERN</div>
              <div className="text-xs text-muted-foreground">
                Medical Xchange & Records Network
              </div>
            </div>
          </Link>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Login opens modal */}
            <Button
              variant="ghost"
              className="text-medx-navy hover:bg-medx-navy/5"
              onClick={() => setLoginOpen(true)}
            >
              Login
            </Button>

            {/* Signup still goes to /signup */}
            <div className="relative">
              <div className="absolute -inset-1 rounded-xl bg-medx-teal/20 blur-md" />
              <Link href="/signup">
                <Button className="relative rounded-xl bg-medx-teal text-white hover:bg-medx-teal/90 shadow-sm">
                  Get MEDXERN ID
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Modal */}
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}
