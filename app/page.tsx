export default function Home() {
  return (
    <div className="mobile-shell flex flex-col justify-center">
      <div className="glass-card overflow-hidden">
        <div className="bg-gradient-to-br from-[#d7f0ff] via-[#e5f2ff] to-[#ffe7dc] p-6">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#285182]">
            WorkSpot
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-[#11233f]">
            Supabase auth
            <br />
            wired end to end.
          </h1>
          <p className="mt-3 text-sm text-[#2f4f72]">
            This build only includes signup, login, and profile role loading from Supabase.
          </p>
        </div>

        <div className="space-y-3 p-6 text-sm text-[#2f4663]">
          <div className="rounded-2xl bg-[#f5faff] px-4 py-3">
            Users are created with Supabase Auth, then linked to <code>profiles</code>,{" "}
            <code>youth_profiles</code>, or <code>company_profiles</code>.
          </div>
          <a href="/auth" className="cta-btn block w-full px-4 py-4 text-center text-base">
            Open auth
          </a>
        </div>
      </div>
    </div>
  );
}
