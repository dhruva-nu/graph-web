import { useState } from "react";
import type { FieldType } from "../lib/types";

interface Props {
  type: FieldType;
  value: unknown;
  editable?: boolean;
  onChange: (v: unknown) => void;
}

export function FieldRenderer({ type, value, editable = true, onChange }: Props) {
  if (type === "json") return <JsonField value={value} editable={editable} onChange={onChange} />;

  if (type === "boolean") {
    return (
      <input
        type="checkbox"
        checked={!!value}
        disabled={!editable}
        onChange={(e) => onChange(e.target.checked)}
      />
    );
  }

  const isNum = type === "integer" || type === "number";
  return (
    <input
      className="gw"
      type={isNum ? "number" : "text"}
      value={value === null || value === undefined ? "" : String(value)}
      disabled={!editable}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === "") return onChange(null);
        onChange(isNum ? (type === "integer" ? parseInt(raw, 10) : parseFloat(raw)) : raw);
      }}
    />
  );
}

function JsonField({
  value,
  editable,
  onChange,
}: {
  value: unknown;
  editable: boolean;
  onChange: (v: unknown) => void;
}) {
  const [text, setText] = useState(() => JSON.stringify(value ?? null, null, 2));
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <textarea
        className="gw"
        style={{ width: "100%", minHeight: 90, lineHeight: 1.45 }}
        value={text}
        disabled={!editable}
        onChange={(e) => {
          setText(e.target.value);
          try {
            onChange(JSON.parse(e.target.value));
            setErr(null);
          } catch (x: any) {
            setErr(x.message);
          }
        }}
      />
      {err && <div style={{ color: "var(--c-error)", fontSize: 11 }}>{err}</div>}
    </div>
  );
}
