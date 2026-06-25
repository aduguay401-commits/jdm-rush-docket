"use client";

import Link from "next/link";

type PageHeaderProps = {
  micro: string;
  backHref?: string;
  backLabel?: string;
};

export function PageHeader({ micro, backHref, backLabel }: PageHeaderProps) {
  return (
    <div className="bg-black border-b border-white/[0.08] px-4 sm:px-6 lg:px-8 pt-7 pb-6 sm:pt-9 sm:pb-8">
      <div className="max-w-[1200px] mx-auto">
        {backHref && (
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-white/30 hover:text-white/70 text-[12px] font-medium transition-colors mb-4"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            {backLabel ?? "My JDM Garage"}
          </Link>
        )}
        <h1
          className="text-[#E55125] font-extrabold tracking-tight leading-none text-center"
          style={{ fontSize: "clamp(26px, 5vw, 36px)" }}
        >
          My JDM Garage
        </h1>
        <p className="text-white/40 text-[13px] sm:text-[14px] font-medium mt-2 leading-snug text-center">
          {micro}
        </p>
      </div>
    </div>
  );
}
