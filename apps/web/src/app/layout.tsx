import type { ReactNode } from "react";

// Root layout is intentionally minimal; <html> lives in [locale]/layout.tsx
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
