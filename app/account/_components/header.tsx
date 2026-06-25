import Link from "next/link";

export const MOCK_CUSTOMER_NAME = "Sarah";
const DEFAULT_UNREAD_COUNT = 0;

function MessageIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function AccountHeader({
  customerName = MOCK_CUSTOMER_NAME,
  messagesHref = "/account/messages",
  unreadCount = DEFAULT_UNREAD_COUNT,
}: {
  customerName?: string;
  messagesHref?: string;
  unreadCount?: number;
}) {
  const safeName = customerName.trim() || MOCK_CUSTOMER_NAME;

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
            <Link
              href={messagesHref}
              className="flex items-center gap-1.5 px-1.5 py-1 hover:opacity-75 transition-opacity duration-150"
              aria-label={`Messages — ${unreadCount} unread`}
            >
              <span className="text-[#E55125]">
                <MessageIcon />
              </span>
              {unreadCount > 0 && (
                <span className="bg-[#E55125] text-white text-[9px] font-bold leading-none w-[18px] h-[18px] flex items-center justify-center rounded-full shrink-0">
                  {unreadCount}
                </span>
              )}
            </Link>

            <div className="w-px h-4 bg-white/[0.08]" />

            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-[#E55125]/20 border border-[#E55125]/40 flex items-center justify-center shrink-0">
                <span className="text-[#E55125] text-[13px] font-bold uppercase">
                  {safeName.charAt(0)}
                </span>
              </div>
              <span className="hidden sm:block text-white/70 text-[13px] font-medium">
                {safeName}
              </span>
            </div>

            <div className="hidden sm:block w-px h-4 bg-white/[0.12]" />

            <form action="/api/customer/auth/logout" method="post">
              <button
                type="submit"
                className="text-white/50 hover:text-white text-[13px] font-medium transition-colors duration-200"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </div>
    </header>
  );
}
