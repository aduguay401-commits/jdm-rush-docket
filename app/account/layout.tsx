import { Manrope } from "next/font/google";
import type { ReactNode } from "react";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <div className={manrope.variable} style={{ fontFamily: "var(--font-manrope), sans-serif" }}>
      {children}
    </div>
  );
}
