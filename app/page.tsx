export default function Home() {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center bg-[#0d0d0d] px-6 text-center text-white">
      <div className="flex w-full max-w-3xl flex-col items-center gap-6">
        <div className="h-1.5 w-20 rounded-full bg-[#E55125]" />
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.35em] text-[#E55125]">
            JDM Rush
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
            JDM Rush Docket System
          </h1>
          <p className="text-base text-white/72 sm:text-xl">
            Private — Authorized Access Only
          </p>
        </div>
      </div>
    </main>
  );
}
