export default function Loading() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col items-center px-4 py-24 sm:py-32">
      <div
        className="mb-6 h-3 w-24 rounded-full bg-edge animate-pulse"
        aria-hidden="true"
      />
      <div
        className="h-16 w-3/4 max-w-xl rounded-2xl bg-edge-strong animate-pulse sm:h-24"
        aria-hidden="true"
      />
      <div
        className="mt-8 h-4 w-full max-w-md rounded-full bg-edge animate-pulse"
        aria-hidden="true"
      />
      <div
        className="mt-3 h-4 w-2/3 max-w-sm rounded-full bg-edge animate-pulse"
        aria-hidden="true"
      />
      <div
        className="mt-14 h-40 w-full max-w-xl rounded-2xl border border-edge bg-panel-2 animate-pulse"
        aria-hidden="true"
      />
    </div>
  );
}
