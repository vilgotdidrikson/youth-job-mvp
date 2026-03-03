export default function Home() {
  return (
    <div className="mobile-shell flex flex-col justify-between">
      <main className="space-y-5">
        <div className="glass-card overflow-hidden">
          <div className="bg-gradient-to-br from-[#d7f0ff] via-[#e5f2ff] to-[#ffe7dc] p-5">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#285182]">
              WorkSpot Sweden
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-[#11233f]">
              Jobb för ungdomar.
              <br />
              Matchningar för företag.
            </h1>
            <p className="mt-3 text-sm text-[#2f4f72]">
              En mobilanpassad MVP för 12-20-åringar i Sverige som vill hitta
              deltidsjobb, tillfälliga jobb och sommarjobb med snabb profilbaserad matchning.
            </p>
          </div>
          <div className="space-y-3 p-5 text-sm text-[#2f4663]">
            <div className="flex items-center justify-between rounded-2xl bg-[#f5faff] px-3 py-2">
              <span>Ungdom: onboarding + AI-CV (demo)</span>
              <span className="chip">MVP</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-[#f5faff] px-3 py-2">
              <span>Företag: publicera jobb + granska kandidater</span>
              <span className="chip">MVP</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-[#f5faff] px-3 py-2">
              <span>Matchning + notiser</span>
              <span className="chip">Aktiv</span>
            </div>
          </div>
        </div>

        <div className="glass-card space-y-3 p-4 text-sm text-[#304f73]">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#4f6986]">
            Demokonton
          </p>
          <p>Ungdom: `demo@youth.se` / `demo123`</p>
          <p>Företag: `demo@company.se` / `demo123`</p>
          <p>Admin: `admin@workspot.se` / `admin123`</p>
        </div>
      </main>

      <div className="pb-2 pt-4">
        <a
          href="/auth"
          className="cta-btn block w-full px-4 py-4 text-center text-base"
        >
          Öppna WorkSpot
        </a>
      </div>
    </div>
  );
}

