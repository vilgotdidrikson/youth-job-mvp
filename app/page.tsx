import Link from "next/link";

export default function Home() {
  return (
    <main className="mobile-shell pb-8">
      <section className="glass-card overflow-hidden">
        <div className="bg-gradient-to-br from-[#d7f0ff] via-[#e8f3ff] to-[#ffe9e0] px-6 pb-6 pt-7">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2d5689]">WorkSpot</p>
          <h1 className="mt-3 text-[1.95rem] font-semibold leading-tight text-[#10243f]">
            Jobs for youth.
            <br />
            Simple for companies.
          </h1>
          <p className="mt-3 max-w-[32ch] text-sm leading-relaxed text-[#31567f]">
            Mobile-first platform for Swedish part-time and summer jobs. Sign up in minutes and get
            matched quickly.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2 text-[0.72rem] font-medium text-[#214a79]">
            <div className="rounded-xl border border-[#cfe2ff] bg-white/70 px-3 py-2">12-20 years</div>
            <div className="rounded-xl border border-[#cfe2ff] bg-white/70 px-3 py-2">SE/SV + EN</div>
            <div className="rounded-xl border border-[#cfe2ff] bg-white/70 px-3 py-2">Youth profiles</div>
            <div className="rounded-xl border border-[#cfe2ff] bg-white/70 px-3 py-2">Company profiles</div>
          </div>
        </div>

        <div className="space-y-3 p-5 text-sm text-[#2f4663]">
          <Link href="/auth" className="cta-btn block w-full px-4 py-4 text-center text-base">
            Create account / Sign in
          </Link>
          <Link href="/dashboard" className="secondary-btn block w-full px-4 py-4 text-center text-base">
            Open dashboard
          </Link>
        </div>
      </section>

      <section className="mt-5 grid gap-3">
        <article className="glass-card p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4c6887]">For youth</p>
          <h2 className="mt-1 text-lg font-semibold text-[#132742]">Build profile and start applying</h2>
          <p className="mt-1 text-sm text-[#3f5f82]">
            Register with Supabase Auth and get a role-based profile in one flow.
          </p>
        </article>

        <article className="glass-card p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4c6887]">For companies</p>
          <h2 className="mt-1 text-lg font-semibold text-[#132742]">Review candidates fast</h2>
          <p className="mt-1 text-sm text-[#3f5f82]">
            Company accounts are separated from youth users for clean matching and permission rules.
          </p>
        </article>
      </section>

      <p className="mt-5 text-center text-xs text-[#58708b]">Optimized for mobile screens and touch use.</p>
    </main>
  );
}
