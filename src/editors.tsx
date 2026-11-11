import { useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Droplets,
  Eye,
  Image,
  Monitor,
  RotateCcw,
  Smartphone,
  Sun,
  Tablet,
} from "lucide-react";
import type { FieldOverride, ThemeConfig } from "./contracts.ts";
import { demoPlant, presets } from "./data.ts";
import {
  entries,
  fields,
  logActivity,
  masterField,
  resolveField,
} from "./model.ts";
import type { EditableField, PlantEntry, Workspace } from "./model.ts";
import type { SaveGarden } from "./admin.tsx";
import { PageTitle } from "./admin.tsx";
import { PlantArt, PlantCard, Safety } from "./catalogue.tsx";
import { dateLabel, go, themeStyle } from "./ui.tsx";

const originLabels = {
  master: "Original de Green Digital",
  local: "Personalizado por este garden",
  "local-empty": "Vacío intencionado",
  missing: "Sin dato en la biblioteca",
};
export function Editor({
  garden,
  item,
  save,
}: {
  garden: Workspace;
  item: PlantEntry;
  save: SaveGarden;
}) {
  const { master } = item;
  const [draft, setDraft] = useState(item.local);
  const [editing, setEditing] = useState<EditableField[]>([]);
  const [imageError, setImageError] = useState("");
  const [readingImage, setReadingImage] = useState(false);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const dirty = JSON.stringify(draft) !== JSON.stringify(item.local);
  const prefix = `/admin/vista-previa/${item.local.localId}`;
  function write(field: EditableField, value: string) {
    const override: FieldOverride = {
      kind: value === "" ? "empty" : "value",
      value,
      changedAt: new Date().toISOString(),
    };
    setDraft((current) => ({
      ...current,
      overrides: { ...current.overrides, [field]: override },
    }));
  }
  function reset(field: EditableField) {
    setDraft((current) => {
      const overrides = { ...current.overrides };
      delete overrides[field];
      return { ...current, overrides };
    });
    setEditing((current) => current.filter((value) => value !== field));
  }
  function persist(publish = false) {
    const next = {
      ...draft,
      postStatus: publish ? ("publish" as const) : draft.postStatus,
      editedAt: new Date().toISOString(),
    };
    const updated = {
      ...garden,
      localPlants: garden.localPlants.map((plant) =>
        plant.localId === next.localId ? next : plant,
      ),
    };
    const title = publish ? "Ficha publicada" : "Adaptaciones guardadas";
    if (
      !save(logActivity(updated, title, master.common_name, "success"), title)
    )
      return false;
    setDraft(next);
    return true;
  }
  function readFile(file?: File) {
    if (!file) return;
    setImageError("");
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 1024 * 1024
    ) {
      setImageError("Elige JPG, PNG o WebP de hasta 1 MB.");
      return;
    }
    const reader = new FileReader();
    setReadingImage(true);
    reader.onload = () => {
      setDraft((current) => ({
        ...current,
        localImageUrl: String(reader.result),
      }));
      setReadingImage(false);
    };
    reader.onerror = () => {
      setImageError("No se ha podido leer el archivo.");
      setReadingImage(false);
    };
    reader.readAsDataURL(file);
  }
  return (
    <>
      <a className="back-link" href="#/admin/plantas">
        <ArrowLeft size={16} /> Volver a plantas
      </a>
      <PageTitle
        eyebrow="EDICIÓN LOCAL"
        title={master.common_name}
        text={`Tus adaptaciones se guardan en ${garden.metadata.name}.`}
      />
      <div className="editor-meta panel">
        <span
          className={`status ${draft.postStatus === "publish" ? "published" : ""}`}
        >
          {draft.postStatus === "publish" ? "Publicada" : "Borrador"}
        </span>
        <span>{draft.active ? "Activa" : "Inactiva"}</span>
        <span>
          Maestro v{master.version} · {dateLabel(garden.lastSyncedAt)}
        </span>
        <code title="UUID del taxón">{master.id}</code>
      </div>
      <div className="editor-bar">
        <span className="muted" role="status">
          {dirty ? "Cambios sin guardar" : "Al día"}
        </span>
        <div className="actions">
          <button
            className="button secondary"
            disabled={readingImage}
            onClick={() => {
              if (!dirty || persist()) go(prefix);
            }}
          >
            <Eye size={17} /> Vista pública previa
          </button>
          {draft.postStatus !== "publish" && (
            <button
              className="button secondary"
              disabled={readingImage}
              onClick={() => persist(true)}
            >
              Publicar
            </button>
          )}
          <button
            className="button"
            disabled={!dirty || readingImage}
            onClick={() => persist()}
          >
            <Check size={16} /> Guardar cambios
          </button>
        </div>
      </div>
      <div className="chips editor-tabs">
        <button aria-pressed={tab === "edit"} onClick={() => setTab("edit")}>
          Editar
        </button>
        <button
          aria-pressed={tab === "preview"}
          onClick={() => setTab("preview")}
        >
          Previsualizar
        </button>
      </div>
      <div className="editor-layout" data-tab={tab}>
        <div className="editor-fields">
          <section className="panel image-edit">
            <h2>
              <Image size={20} /> Fotografía local
            </h2>
            <p>
              La imagen que elijas se muestra primero en la ficha del garden.
            </p>
            <label>
              Imagen de la colección
              <select
                value={
                  master.images.some(
                    (image) => image.url === draft.localImageUrl,
                  )
                    ? (draft.localImageUrl ?? "")
                    : ""
                }
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    localImageUrl: event.target.value || null,
                  }))
                }
              >
                <option value="">Usar imagen principal de la biblioteca</option>
                {master.images.map((image, i) => (
                  <option key={image.id} value={image.url}>
                    Ilustración {i + 1}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Subir JPG, PNG o WebP (máx. 1 MB)
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  readFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </label>
            {imageError && (
              <p className="error-text" role="alert">
                {imageError}
              </p>
            )}
            {readingImage && <p role="status">Leyendo archivo…</p>}
            {draft.localImageUrl && (
              <button
                className="text-button"
                onClick={() =>
                  setDraft((current) => ({ ...current, localImageUrl: null }))
                }
              >
                Restablecer imagen original
              </button>
            )}
          </section>
          {(Object.entries(fields) as [EditableField, string][]).map(
            ([field, label]) => {
              const inherited = masterField(master, field);
              const resolved = resolveField(master, draft, field);
              const open =
                editing.includes(field) ||
                Object.hasOwn(draft.overrides, field);
              return (
                <section className="panel field-edit" key={field}>
                  <div className="field-head">
                    <h2>{label}</h2>
                    <span
                      className={`status ${resolved.source.startsWith("local") ? "custom" : ""}`}
                    >
                      {originLabels[resolved.source]}
                    </span>
                  </div>
                  <small>ORIGINAL DE GREEN DIGITAL</small>
                  <p className="original">
                    {inherited || "Sin dato en la biblioteca"}
                  </p>
                  {open ? (
                    <>
                      <label htmlFor={`field-${field}`}>
                        Tu versión de {label.toLowerCase()}
                      </label>
                      <textarea
                        id={`field-${field}`}
                        value={resolved.value ?? ""}
                        maxLength={3000}
                        rows={3}
                        onChange={(event) => write(field, event.target.value)}
                      />
                      <div className="actions">
                        <button
                          className="text-button"
                          onClick={() => write(field, "")}
                        >
                          Vaciar intencionadamente
                        </button>
                        <button
                          className="text-button"
                          onClick={() => reset(field)}
                        >
                          <RotateCcw size={14} /> Restablecer al original
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      className="button secondary"
                      onClick={() =>
                        setEditing((current) => [...current, field])
                      }
                    >
                      Personalizar {label.toLowerCase()}
                    </button>
                  )}
                </section>
              );
            },
          )}
          <section className="panel field-edit">
            <h2>Contacto</h2>
            <p>Texto local del botón de consulta simulada.</p>
            <label>
              Etiqueta del botón
              <input
                type="text"
                value={draft.cta.label}
                maxLength={70}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    cta: { ...current.cta, label: event.target.value },
                  }))
                }
              />
            </label>
          </section>
        </div>
        <aside className="editor-preview">
          <p className="eyebrow">VISTA PREVIA EN DIRECTO</p>
          <div
            className="catalog-surface preview-shell"
            style={themeStyle(garden.metadata.theme)}
          >
            <PlantCard
              item={{ local: draft, master }}
              theme={garden.metadata.theme}
              link={false}
            />
            <div className="preview-care">
              <h3>Cuidados</h3>
              {(["care.light", "care.watering"] as const).map((field) => {
                const value = resolveField(master, draft, field);
                return (
                  <div key={field}>
                    <strong>{fields[field]}</strong>
                    <p>
                      {value.value ||
                        (value.source === "local-empty"
                          ? "Vacío intencionado"
                          : "Sin dato")}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

export function Design({
  garden,
  save,
}: {
  garden: Workspace;
  save: SaveGarden;
}) {
  const [theme, setTheme] = useState(garden.metadata.theme);
  const [preset, setPreset] = useState<"natural" | "editorial">(
    garden.metadata.themePreset === "editorial" ? "editorial" : "natural",
  );
  const [view, setView] = useState<"catalog" | "detail">("catalog");
  const [device, setDevice] = useState("desktop");
  const previous = garden.metadata.theme;
  const dirty =
    JSON.stringify(theme) !== JSON.stringify(previous) ||
    preset !== garden.metadata.themePreset;
  const demoEntry: PlantEntry = {
    master: demoPlant,
    local: {
      localId: "preview",
      gardenId: garden.metadata.id,
      masterTaxonId: demoPlant.id,
      postStatus: "draft",
      active: true,
      overrides: {},
      cta: { label: "Consultar esta planta", target: "contact" },
      syncStatus: "current",
      createdAt: "",
    },
  };
  const visible = entries(garden, true);
  const plants = visible.length ? visible.slice(0, 4) : [demoEntry];
  const featured = plants[0];
  const set = <K extends keyof ThemeConfig>(key: K, value: ThemeConfig[K]) =>
    setTheme((current) => ({ ...current, [key]: value }));
  const reset = <K extends keyof ThemeConfig>(key: K) =>
    set(key, presets[preset][key]);
  const color = (key: "primary" | "accent", label: string) => (
    <div className="setting-row">
      <label>
        {label}
        <input
          type="color"
          value={theme[key]}
          onChange={(event) => set(key, event.target.value)}
        />
      </label>
      <code>{theme[key]}</code>
      <button
        className="icon-button"
        aria-label={`Restaurar ${label.toLowerCase()}`}
        onClick={() => reset(key)}
      >
        <RotateCcw size={16} />
      </button>
    </div>
  );
  return (
    <>
      <PageTitle
        eyebrow="IDENTIDAD DEL GARDEN"
        title="Personalizar catálogo"
        text="Prueba el aspecto de tus tarjetas y fichas. El catálogo público adopta el diseño al guardarlo."
      />
      <div className="editor-bar">
        <span role="status" className="muted">
          {dirty ? "Cambios sin guardar" : "Diseño guardado"}
        </span>
        <div className="actions">
          <button
            className="button secondary"
            disabled={!dirty}
            onClick={() => {
              setTheme(previous);
              setPreset(
                garden.metadata.themePreset === "editorial"
                  ? "editorial"
                  : "natural",
              );
            }}
          >
            Descartar cambios
          </button>
          <button
            className="button"
            disabled={!dirty}
            onClick={() =>
              save(
                logActivity(
                  {
                    ...garden,
                    metadata: {
                      ...garden.metadata,
                      theme,
                      themePreset: preset,
                    },
                  },
                  "Diseño actualizado",
                  garden.metadata.name,
                  "success",
                ),
                "Diseño guardado",
              )
            }
          >
            <Check size={16} /> Guardar diseño
          </button>
        </div>
      </div>
      <div className="design-layout">
        <div className="design-controls">
          <section className="panel">
            <h2>Estilo base</h2>
            <div className="chips">
              {(["natural", "editorial"] as const).map((name) => (
                <button
                  key={name}
                  aria-pressed={name === preset}
                  onClick={() => {
                    setPreset(name);
                    setTheme({ ...presets[name] });
                  }}
                >
                  {name === "natural" ? "Natural" : "Editorial"}
                </button>
              ))}
            </div>
            <button
              className="text-button"
              onClick={() => setTheme({ ...presets[preset] })}
            >
              Restaurar preset
            </button>
          </section>
          <section className="panel">
            <h2>Identidad</h2>
            {color("primary", "Color primario")}
            {color("accent", "Color de acento")}
            <label>
              Tipografía
              <select
                value={theme.font}
                onChange={(event) =>
                  set("font", event.target.value as ThemeConfig["font"])
                }
              >
                <option value="Instrument">Instrument Sans</option>
                <option value="Newsreader">Newsreader</option>
                <option value="system">Sistema</option>
              </select>
            </label>
          </section>
          <section className="panel">
            <h2>Tarjetas y filtros</h2>
            <div className="setting-row">
              <label>
                Radio de tarjeta · {theme.radius} px
                <input
                  type="range"
                  min={0}
                  max={30}
                  value={theme.radius}
                  onChange={(event) =>
                    set("radius", Number(event.target.value))
                  }
                />
              </label>
              <button
                className="icon-button"
                aria-label="Restaurar radio"
                onClick={() => reset("radius")}
              >
                <RotateCcw size={16} />
              </button>
            </div>
            <label>
              Columnas en escritorio
              <select
                value={theme.gridColumnsDesktop}
                onChange={(event) =>
                  set(
                    "gridColumnsDesktop",
                    Number(event.target.value) as 2 | 3 | 4,
                  )
                }
              >
                <option>2</option>
                <option>3</option>
                <option>4</option>
              </select>
            </label>
            <label>
              Proporción de imagen
              <select
                value={theme.cardRatio}
                onChange={(event) => set("cardRatio", event.target.value)}
              >
                <option>4:3</option>
                <option>1:1</option>
                <option>16:9</option>
              </select>
            </label>
            <label>
              Chips de categoría
              <select
                value={theme.chipStyle}
                onChange={(event) =>
                  set(
                    "chipStyle",
                    event.target.value as ThemeConfig["chipStyle"],
                  )
                }
              >
                <option value="soft">Fondo suave</option>
                <option value="outline">Contorno</option>
              </select>
            </label>
            <label className="check-line">
              <input
                type="checkbox"
                checked={theme.shadow}
                onChange={(event) => set("shadow", event.target.checked)}
              />{" "}
              Sombra suave
            </label>
          </section>
          <section className="panel">
            <h2>Contenido de la ficha</h2>
            {(
              [
                ["showScientificName", "Nombre científico"],
                ["showCareFacts", "Cuidados"],
                ["showTraits", "Características"],
                ["showFaqs", "Preguntas frecuentes"],
              ] as const
            ).map(([key, label]) => (
              <label className="check-line" key={key}>
                <input
                  type="checkbox"
                  checked={theme[key]}
                  onChange={(event) => set(key, event.target.checked)}
                />{" "}
                {label}
              </label>
            ))}
            <small>
              Las precauciones se mantienen visibles en cualquier diseño.
            </small>
          </section>
        </div>
        <aside className="design-preview">
          <div className="preview-toolbar">
            <div className="chips">
              <button
                aria-pressed={view === "catalog"}
                onClick={() => setView("catalog")}
              >
                Catálogo
              </button>
              <button
                aria-pressed={view === "detail"}
                onClick={() => setView("detail")}
              >
                Ficha
              </button>
            </div>
            <div className="device-buttons">
              {[
                ["desktop", "Escritorio", Monitor],
                ["tablet", "Tableta", Tablet],
                ["mobile", "Móvil", Smartphone],
              ].map(([value, label, Icon]) => {
                const Device = Icon as typeof Monitor;
                return (
                  <button
                    className="icon-button"
                    aria-label={String(label)}
                    aria-pressed={device === value}
                    key={String(value)}
                    onClick={() => setDevice(String(value))}
                  >
                    <Device size={17} />
                  </button>
                );
              })}
            </div>
          </div>
          <div
            className="preview-shell catalog-surface design-frame"
            style={themeStyle(theme)}
            data-chips={theme.chipStyle}
            data-device={device}
          >
            <div className="preview-brand">
              <span>{garden.metadata.name}</span>
              <ArrowUpRight size={15} />
            </div>
            {view === "catalog" ? (
              <>
                <p className="eyebrow">
                  VISTA PREVIA ·{" "}
                  {visible.length ? "SELECCIÓN PUBLICADA" : "EJEMPLO DE ESTILO"}
                </p>
                <h2>Explora la colección</h2>
                <span className="category-chip">
                  {featured.master.demo_facets.category_label}
                </span>
                <div className="plant-grid">
                  {plants.map((item) => (
                    <PlantCard
                      key={item.local.localId}
                      item={item}
                      theme={theme}
                      link={false}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="mini-detail">
                <PlantArt
                  url={
                    featured.local.localImageUrl ??
                    featured.master.images[0]?.url
                  }
                />
                <h2>{featured.master.common_name}</h2>
                {theme.showScientificName && (
                  <i>{featured.master.scientific_name}</i>
                )}
                <p>
                  {
                    resolveField(
                      featured.master,
                      featured.local,
                      "introduction",
                    ).value
                  }
                </p>
                <Safety plant={featured.master} />
                {theme.showCareFacts && (
                  <div className="preview-care">
                    <h3>Cuidados</h3>
                    <p>
                      <Sun size={16} />{" "}
                      {
                        resolveField(
                          featured.master,
                          featured.local,
                          "care.light",
                        ).value
                      }
                    </p>
                    <p>
                      <Droplets size={16} />{" "}
                      {
                        resolveField(
                          featured.master,
                          featured.local,
                          "care.watering",
                        ).value
                      }
                    </p>
                  </div>
                )}
                {theme.showTraits && (
                  <p>
                    <strong>Familia:</strong> {featured.master.family}
                  </p>
                )}
                {theme.showFaqs && featured.master.faqs[0] && (
                  <details className="faq">
                    <summary>{featured.master.faqs[0].question}</summary>
                    <p>{featured.master.faqs[0].answer}</p>
                  </details>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
