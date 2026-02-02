"use client";

import React, {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import LoginModal from "@/components/auth/LoginModal";

type LoginModalContextValue = {
  open: () => void;
  close: () => void;
  isOpen: boolean;
};

const LoginModalContext = createContext<LoginModalContextValue | null>(null);

export function LoginModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const value = useMemo(
    () => ({
      open,
      close,
      isOpen,
    }),
    [open, close, isOpen]
  );

  return (
    <LoginModalContext.Provider value={value}>
      {children}
      <LoginModal open={isOpen} onClose={close} />
    </LoginModalContext.Provider>
  );
}

export function useLoginModal() {
  const ctx = useContext(LoginModalContext);
  if (!ctx) {
    throw new Error("useLoginModal must be used within <LoginModalProvider />");
  }
  return ctx;
}
