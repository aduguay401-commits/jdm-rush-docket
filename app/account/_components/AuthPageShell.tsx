import { type ReactNode } from "react";

export function AuthPageShell({ subtitle, children }: { subtitle: string; children: ReactNode }) {
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
            <p className="text-white/60 text-[14px] mt-2">{subtitle}</p>
          </div>

          {children}
        </div>
      </main>
    </div>
  );
}
