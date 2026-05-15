import { useEffect, useState } from "react";
import type { ProviderRecord } from "@/types/provider";

type ProviderFormProps = {
  initialValue: ProviderRecord;
  isEditing?: boolean;
  onSubmit: (provider: ProviderRecord) => Promise<void>;
  onCancelEdit?: () => void;
};

export function ProviderForm({
  initialValue,
  isEditing = false,
  onSubmit,
  onCancelEdit
}: ProviderFormProps) {
  const [draft, setDraft] = useState(initialValue);

  useEffect(() => {
    setDraft(initialValue);
  }, [initialValue]);

  return (
    <form
      className="rounded-2xl border border-black/5 bg-white p-5 shadow-[0_4px_18px_rgba(15,23,42,0.04)]"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(draft);
      }}
    >
      <div className="mb-4 text-sm font-medium text-[var(--color-text-primary)]">
        {isEditing ? "修改模型服务" : "添加模型服务"}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <input
          className={`rounded-xl border px-3 py-2 text-sm ${
            isEditing
              ? "border-stone-200 bg-stone-100 text-stone-500"
              : "border-black/10 bg-white"
          }`}
          value={draft.id}
          onChange={(event) => setDraft({ ...draft, id: event.target.value })}
          placeholder="服务标识，例如 jobmd"
          readOnly={isEditing}
        />
        <input
          className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          placeholder="显示名称，例如 jobmd"
        />
      </div>
      <input
        className="mt-3 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
        value={draft.baseUrl}
        onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })}
        placeholder="服务地址，例如 https://api.example.com/v1"
      />
      <input
        className="mt-3 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
        value={draft.model}
        onChange={(event) => setDraft({ ...draft, model: event.target.value })}
        placeholder="默认模型，例如 gpt-5.5"
      />
      <textarea
        className="mt-3 min-h-24 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
        value={draft.apiKey}
        onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })}
        placeholder="密钥，例如 sk-..."
      />
      <label className="mt-3 flex items-center gap-3 rounded-xl border border-black/10 bg-stone-50 px-3 py-2 text-sm text-[var(--color-text-primary)]">
        <input
          className="h-4 w-4 rounded border-black/20"
          type="checkbox"
          checked={draft.supportsWebsockets}
          onChange={(event) =>
            setDraft({ ...draft, supportsWebsockets: event.target.checked })
          }
        />
        <span>是否使用 WebSockets</span>
      </label>
      <button
        className="mt-4 rounded-xl bg-[var(--color-text-primary)] px-4 py-2 text-sm text-white"
        type="submit"
      >
        {isEditing ? "保存修改" : "保存服务"}
      </button>
      {isEditing && onCancelEdit ? (
        <button
          className="mt-4 ml-2 rounded-xl border border-black/10 px-4 py-2 text-sm text-[var(--color-text-primary)]"
          type="button"
          onClick={onCancelEdit}
        >
          取消
        </button>
      ) : null}
    </form>
  );
}
