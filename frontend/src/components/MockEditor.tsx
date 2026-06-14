import { useStore } from "../store";
import { FieldRenderer } from "./FieldRenderer";

export function MockEditor() {
  const schemas = useStore((s) => s.schemas);
  const contextValues = useStore((s) => s.contextValues);
  const seedValues = useStore((s) => s.seedValues);
  const setContextValue = useStore((s) => s.setContextValue);
  const setSeedValue = useStore((s) => s.setSeedValue);

  if (!schemas) return <div className="empty">Loading…</div>;

  const seedFields = schemas.state_fields.filter((f) => f.seed);

  return (
    <div className="mocks">
      {/* Context / config */}
      <div>
        <div className="section-title">Mock context</div>
        {schemas.context_fields.length === 0 && (
          <div className="dim2" style={{ padding: "8px 0" }}>No context fields declared.</div>
        )}
        {schemas.context_fields.map((f) => (
          <div className="field" key={f.name} style={{ marginTop: 10 }}>
            <label>
              {f.title ?? f.name}
              <span className="ttag">{f.type}</span>
              {f.inject.map((i, k) => (
                <span key={k} className="ttag" title={i.import ?? i.key ?? ""}>
                  {i.target}
                </span>
              ))}
            </label>
            <FieldRenderer
              type={f.type}
              value={contextValues[f.name]}
              editable={f.editable}
              onChange={(v) => setContextValue(f.name, v)}
            />
          </div>
        ))}
      </div>

      {/* Seed state */}
      {seedFields.length > 0 && (
        <div>
          <div className="section-title">Seed initial state</div>
          {seedFields.map((f) => (
            <div className="field" key={f.name} style={{ marginTop: 10 }}>
              <label>
                {f.title ?? f.name}
                <span className="ttag">{f.type}</span>
              </label>
              <FieldRenderer
                type={f.type}
                value={seedValues[f.name]}
                editable={f.editable}
                onChange={(v) => setSeedValue(f.name, v)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Tool mocks (read-only view of declared stubs) */}
      {schemas.tools.length > 0 && (
        <div>
          <div className="section-title">Tool mocks</div>
          {schemas.tools.map((t) => (
            <div className="tool-mock" key={t.name} style={{ marginTop: 9 }}>
              <span className="tname">{t.name}</span>
              <span className="ttag" style={{ marginLeft: 8 }}>{t.mock.mode}</span>
              {t.description && <div className="tdesc">{t.description}</div>}
              {t.mock.default !== undefined && t.mock.default !== null && (
                <div className="dim mono" style={{ marginTop: 6, fontSize: 11 }}>
                  default → {String(t.mock.default).slice(0, 80)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* External mocks */}
      {schemas.external_mocks.length > 0 && (
        <div>
          <div className="section-title">External (DB / HTTP) mocks</div>
          {schemas.external_mocks.map((m) => (
            <div className="field" key={m.id} style={{ marginTop: 8 }}>
              <label>
                {m.id}
                <span className="ttag">{m.mode}</span>
              </label>
              <div className="dim2 mono" style={{ fontSize: 10.5, wordBreak: "break-all" }}>
                {m.patch}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
