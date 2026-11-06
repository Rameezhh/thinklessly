export function PageLoading() {
  return (
    <div className="animate-fade space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-3">
        <div className="h-7 w-40 rounded-full bg-[#ECE9E1]" />
        <div className="h-11 w-72 max-w-full rounded-xl bg-[#ECE9E1]" />
        <div className="h-4 w-96 max-w-full rounded-full bg-[#F1F0EB]" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-32 rounded-[20px] border border-[#E5E4DE] bg-white p-6">
            <div className="animate-shimmer h-3 w-24 rounded-full bg-[linear-gradient(90deg,#F1F0EB_0%,#FAF9F5_50%,#F1F0EB_100%)]" />
            <div className="animate-shimmer mt-5 h-9 w-20 rounded-lg bg-[linear-gradient(90deg,#F1F0EB_0%,#FAF9F5_50%,#F1F0EB_100%)]" />
          </div>
        ))}
      </div>
      <div className="h-64 rounded-3xl border border-[#E5E4DE] bg-white p-6">
        <div className="animate-shimmer h-4 w-32 rounded-full bg-[linear-gradient(90deg,#F1F0EB_0%,#FAF9F5_50%,#F1F0EB_100%)]" />
        <div className="mt-6 space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="animate-shimmer h-10 rounded-lg bg-[linear-gradient(90deg,#F1F0EB_0%,#FAF9F5_50%,#F1F0EB_100%)]"
            />
          ))}
        </div>
      </div>
    </div>
  );
}