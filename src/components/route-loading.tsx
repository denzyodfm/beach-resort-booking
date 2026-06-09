export function RouteLoading() {
  return (
    <section className="mx-auto grid max-w-7xl gap-6 px-4 py-12 sm:px-6 lg:px-8">
      <div className="h-5 w-40 animate-pulse rounded-full bg-cyan-100" />
      <div className="h-10 w-full max-w-xl animate-pulse rounded-md bg-slate-200" />
      <div className="grid gap-6 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="h-52 animate-pulse rounded-md bg-cyan-50" />
            <div className="mt-5 h-5 w-2/3 animate-pulse rounded-md bg-slate-200" />
            <div className="mt-3 h-4 w-full animate-pulse rounded-md bg-slate-100" />
            <div className="mt-2 h-4 w-4/5 animate-pulse rounded-md bg-slate-100" />
          </div>
        ))}
      </div>
    </section>
  );
}
