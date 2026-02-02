// src/app/share/[shareId]/loading.tsx
export default function LoadingSharePage() {
  return (
    <main className="min-h-screen bg-[#050609] text-white">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="h-6 w-64 animate-pulse rounded bg-white/10" />
          <div className="mt-3 flex flex-wrap gap-2">
            <div className="h-5 w-28 animate-pulse rounded-full bg-white/10" />
            <div className="h-5 w-40 animate-pulse rounded-full bg-white/10" />
            <div className="h-5 w-44 animate-pulse rounded-full bg-white/10" />
          </div>
          <div className="mt-6 h-4 w-40 animate-pulse rounded bg-white/10" />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-white/10 bg-white/5 p-4"
            >
              <div className="h-4 w-40 animate-pulse rounded bg-white/10" />
              <div className="mt-4 space-y-2">
                <div className="h-3 w-full animate-pulse rounded bg-white/10" />
                <div className="h-3 w-11/12 animate-pulse rounded bg-white/10" />
                <div className="h-3 w-10/12 animate-pulse rounded bg-white/10" />
                <div className="h-3 w-8/12 animate-pulse rounded bg-white/10" />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="h-4 w-44 animate-pulse rounded bg-white/10" />
          <div className="mt-4 space-y-2">
            <div className="h-12 w-full animate-pulse rounded-xl bg-white/10" />
            <div className="h-12 w-full animate-pulse rounded-xl bg-white/10" />
            <div className="h-12 w-full animate-pulse rounded-xl bg-white/10" />
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-white/40">
          Loading doctor snapshot…
        </div>
      </div>
    </main>
  );
}
