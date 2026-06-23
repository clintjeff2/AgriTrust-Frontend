import { InternationalizedText } from "@/src/components/common/InternationalizedText";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <InternationalizedText as="h1" id="settings.title" className="text-2xl font-bold" />
      <InternationalizedText as="p" id="settings.subtitle" className="text-zinc-500" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <a
          href="/settings/devices"
          className="rounded-xl border border-zinc-200 p-6 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
        >
          <InternationalizedText as="h3" id="settings.devices.title" className="font-semibold" />
          <InternationalizedText as="p" id="settings.devices.desc" className="mt-1 text-sm text-zinc-500" />
        </a>
      </div>
    </div>
  );
}
