export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="text-zinc-500">Manage your account and application preferences.</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <a
          href="/settings/devices"
          className="rounded-xl border border-zinc-200 p-6 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
        >
          <h3 className="font-semibold">Devices</h3>
          <p className="mt-1 text-sm text-zinc-500">Pair and manage IoT devices</p>
        </a>
      </div>
    </div>
  );
}
