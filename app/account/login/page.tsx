import { LoginClient } from "./LoginClient";

function getSingleParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function normalizeNextPath(value: string | string[] | undefined) {
  const raw = getSingleParam(value);
  if (!raw || !raw.startsWith("/")) return "/account";
  if (raw.startsWith("//")) return "/account";
  return raw;
}

export default async function AccountLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const nextPath = normalizeNextPath(params.next);
  const errorMessage = getSingleParam(params.message);

  return (
    <div className="min-h-screen bg-[#111111]">
      <main id="main-content">
        <div className="max-w-[520px] mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <div className="mb-8 text-center">
            <a href="https://jdmrushimports.ca" aria-label="JDM Rush Imports home" className="inline-flex justify-center mb-8">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://scfezjqjbzqbtfsveedl.supabase.co/storage/v1/object/public/docket-files/Assets/JDMRUSH_Imports_RGB_Colour-white_png.png"
                alt="JDM Rush Imports"
                style={{ height: "40px", width: "auto", display: "block" }}
              />
            </a>
            <h1
              className="text-[#E55125] font-extrabold tracking-tight leading-none text-center"
              style={{ fontSize: "clamp(26px, 5vw, 36px)" }}
            >
              My JDM Garage
            </h1>
            <p className="text-white/80 text-[14px] sm:text-[15px] font-semibold mt-2.5 leading-snug text-center">
              Enter your email and we will send a secure login link.
            </p>
          </div>

          <LoginClient nextPath={nextPath} errorMessage={errorMessage} />
        </div>
      </main>
    </div>
  );
}
