/**
 * Page-level loading state in the shared session-card style (DA-12).
 * Same look as AuthGateMessage's checking state, so every product page waits the same way.
 * Plain markup without hooks: usable in Suspense fallbacks and in client pages.
 */
export function PageLoading({ label }: { label: string }) {
  return (
    <main className="mobile-shell mnw-session-state">
      <div className="mnw-session-card" role="status">
        <span className="mnw-session-spinner" aria-hidden="true" />
        <p>{label}</p>
      </div>
    </main>
  );
}
