import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-8 px-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900">
          AgriTrust Protocol
        </h1>
        <p className="max-w-md text-lg leading-8 text-zinc-600">
          Decentralized agricultural trust fund management on Stellar Soroban.
        </p>
        <div className="flex gap-4">
          <Link
            href="/dashboard"
            className="rounded-lg bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-700"
          >
            Fleet Dashboard
          </Link>
        </div>
      </main>
    </div>
  );
}
