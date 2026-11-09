export function Issue({
  message,
  issue,
  debugId,
}: {
  message: string;
  issue?: string;
  debugId?: string | null;
}) {
  return (
    <div role="alert" className="border border-clay/30 bg-[#f8ebe7] px-4 py-3 text-sm text-clay">
      <p>{message}</p>
      {issue ? (
        <p className="mt-1 font-mono text-xs text-clay/80">
          {issue}
          {debugId ? ` · debug_id ${debugId}` : ""}
        </p>
      ) : null}
    </div>
  );
}
