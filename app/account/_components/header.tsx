"use client";

import Link from "next/link";

export const MOCK_CUSTOMER_NAME = "Sarah";
const UNREAD_COUNT = 2;

function MessageIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function AccountHeader() {
  return (
    <header className="sticky top-0 z-50 bg-black border-b border-white/[0.08]">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <a href="https://jdmrushimports.ca" aria-label="JDM Rush Imports home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://scfezjqjbzqbtfsveedl.supabase.co/storage/v1/object/public/docket-files/Assets/JDMRUSH_Imports_RGB_Colour-white_png.png"
              alt="JDM Rush Imports"
              style={{ height: "32px", width: "auto", display: "block" }}
            />
          </a>

          <div className="flex items-center gap-3 sm:gap-4">
            {/* Messages bubble */}
            <Link
              href="/account/messages"
              className="relative text-white/40 hover:text-white/80 transition-colors"
              aria-label={`Messages — ${UNREAD_COUNT} unread`}
            >
              <MessageIcon />
              {UNREAD_COUNT > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-[17px] h-[17px] bg-[#E55125] flex items-center justify-center text-[9px] font-bold text-white leading-none rounded-full">
                  {UNREAD_COUNT}
                </span>
              )}
            </Link>

            <div className="w-px h-4 bg-white/[0.08]" />

            {/* Avatar + name */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-[#E55125]/20 border border-[#E55125]/40 flex items-center justify-center shrink-0">
                <span className="text-[#E55125] text-[13px] font-bold uppercase">
                  {MOCK_CUSTOMER_NAME.charAt(0)}
                </span>
              </div>
              <span className="hidden sm:block text-white/70 text-[13px] font-medium">
                {MOCK_CUSTOMER_NAME}
              </span>
            </div>

            <div className="hidden sm:block w-px h-4 bg-white/[0.12]" />

            <button
              type="button"
              className="text-white/50 hover:text-white text-[13px] font-medium transition-colors duration-200"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
