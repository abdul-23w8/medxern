"use client";

import React, { createContext, useCallback, useMemo, useState } from "react";

type PatientUIContextValue = {
  isUploadOpen: boolean;
  openUpload: () => void;
  closeUpload: () => void;
  toggleUpload: () => void;
};

export const PatientUIContext = createContext<PatientUIContextValue | null>(null);

export default function PatientUIProvider({ children }: { children: React.ReactNode }) {
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  const openUpload = useCallback(() => setIsUploadOpen(true), []);
  const closeUpload = useCallback(() => setIsUploadOpen(false), []);
  const toggleUpload = useCallback(() => setIsUploadOpen((v) => !v), []);

  const value = useMemo(
    () => ({ isUploadOpen, openUpload, closeUpload, toggleUpload }),
    [isUploadOpen, openUpload, closeUpload, toggleUpload]
  );

  return <PatientUIContext.Provider value={value}>{children}</PatientUIContext.Provider>;
}
