import { useEffect, useState } from "react";
import type { ConfigInput, ConfigView } from "@/types/config";

type ConfigFormProps = {
  initialValue: ConfigView;
  providerOptions: string[];
  onSubmit: (input: ConfigInput) => Promise<void>;
};

export function ConfigForm({ initialValue, providerOptions, onSubmit }: ConfigFormProps) {
  const [draft, setDraft] = useState(initialValue);

  useEffect(() => {
    setDraft(initialValue);
  }, [initialValue]);

  return (
    <form
      className="rounded-2xl border border-black/5 bg-white p-5 shadow-[0_4px_18px_rgba(15,23,42,0.04)]"
      onSubmit={(event) => {
        event.preventDefault();

        void onSubmit({
          model: draft.model,
          modelProvider: draft.modelProvider,
          approvalPolicy: draft.approvalPolicy,
          sandboxMode: draft.sandboxMode,
          webSearch: draft.webSearch,
          toolsViewImage: draft.toolsViewImage,
          historyPersistence: draft.historyPersistence,
          historyMaxBytes: Number(draft.historyMaxBytes)
        });
      }}
    >
      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="mb-2 text-sm font-medium text-[var(--color-text-primary)]">model</div>
          <input
            className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
            value={draft.model}
            onChange={(event) => setDraft({ ...draft, model: event.target.value })}
          />
        </div>
        <div>
          <div className="mb-2 text-sm font-medium text-[var(--color-text-primary)]">
            model_provider
          </div>
          <select
            className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
            value={draft.modelProvider}
            onChange={(event) => setDraft({ ...draft, modelProvider: event.target.value })}
          >
            {providerOptions.map((providerId) => (
              <option key={providerId} value={providerId}>
                {providerId}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="text-sm text-[var(--color-text-secondary)]">
          <div className="mb-2 font-medium text-[var(--color-text-primary)]">approval_policy</div>
          <select
            className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
            value={draft.approvalPolicy}
            onChange={(event) => setDraft({ ...draft, approvalPolicy: event.target.value })}
          >
            <option value="on-request">on-request</option>
            <option value="never">never</option>
          </select>
        </label>
        <label className="text-sm text-[var(--color-text-secondary)]">
          <div className="mb-2 font-medium text-[var(--color-text-primary)]">web_search</div>
          <select
            className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
            value={draft.webSearch}
            onChange={(event) => setDraft({ ...draft, webSearch: event.target.value })}
          >
            <option value="disabled">disabled</option>
            <option value="cached">cached</option>
            <option value="live">live</option>
          </select>
        </label>
        <label className="text-sm text-[var(--color-text-secondary)]">
          <div className="mb-2 font-medium text-[var(--color-text-primary)]">sandbox_mode</div>
          <select
            className={`w-full rounded-xl border px-3 py-2 text-sm ${
              draft.sandboxMode === "danger-full-access"
                ? "border-red-300 bg-red-50 text-red-700"
                : "border-black/10 bg-white"
            }`}
            value={draft.sandboxMode}
            onChange={(event) => setDraft({ ...draft, sandboxMode: event.target.value })}
          >
            <option value="read-only">read-only</option>
            <option value="workspace-write">workspace-write</option>
            <option value="danger-full-access">danger-full-access</option>
          </select>
        </label>
        <label className="text-sm text-[var(--color-text-secondary)]">
          <div className="mb-2 font-medium text-[var(--color-text-primary)]">
            history.persistence
          </div>
          <select
            className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
            value={draft.historyPersistence}
            onChange={(event) => setDraft({ ...draft, historyPersistence: event.target.value })}
          >
            <option value="save-all">save-all</option>
            <option value="save-none">save-none</option>
          </select>
        </label>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="text-sm text-[var(--color-text-secondary)]">
          <div className="mb-2 font-medium text-[var(--color-text-primary)]">
            history.max_bytes
          </div>
          <input
            className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
            type="number"
            value={draft.historyMaxBytes}
            onChange={(event) =>
              setDraft({ ...draft, historyMaxBytes: Number(event.target.value) || 0 })
            }
          />
        </label>
        <label className="flex items-center gap-3 rounded-2xl border border-black/10 px-4 py-3 text-sm text-[var(--color-text-secondary)]">
          <input
            type="checkbox"
            checked={draft.toolsViewImage}
            onChange={(event) =>
              setDraft({ ...draft, toolsViewImage: event.target.checked })
            }
          />
          tools.view_image
        </label>
      </div>

      <button
        className="mt-5 rounded-xl bg-[var(--color-text-primary)] px-4 py-2 text-sm text-white"
        type="submit"
      >
        保存全局配置
      </button>
    </form>
  );
}
