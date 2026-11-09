import Link from "next/link";

export default function NotFound() {
  return (
    <div>
      <h1 className="font-display text-4xl">Page not found</h1>
      <Link href="/" className="mt-6 inline-block text-sm text-gold">
        Back to files
      </Link>
    </div>
  );
}
