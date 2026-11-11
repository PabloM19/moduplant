import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CircleAlert,
  CloudDownload,
  Database,
  Layers3,
  Leaf,
  RefreshCw,
  Search,
  Sprout,
} from "lucide-react";
import { api } from "./data.ts";
import type { LocalPlant, MasterPlant } from "./contracts.ts";
import {
  applyChanges,
  entries,
  fields,
  importPlants,
  isAdapted,
  isPublic,
  logActivity,
  matchesQuery,
  publishFeatured,
} from "./model.ts";
import type { Workspace } from "./model.ts";
import { ActionLink, Empty, dateLabel, editPath, samplePath } from "./ui.tsx";
import { PlantArt } from "./catalogue.tsx";
import demoFlow from "./demo-flow.json";

export type SaveGarden = (garden: Workspace, message?: string) => boolean;
export function PageTitle({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <header className="page-title">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{text}</p>
    </header>
  );
}

export function ActivityLog({ garden }: { garden: Workspace }) {
  return (
    <section className="panel activity">
      <h2>Actividad reciente</h2>
      {!garden.activity.length ? (
        <p>Todavía no hay actividad en este garden.</p>
      ) : (
        <ul>
          {garden.activity.map((activity, i) => (
            <li key={`${activity.date}-${i}`}>
              <span className={`activity-icon ${activity.kind}`}>
                {activity.kind === "error" ? (
                  <CircleAlert size={17} />
                ) : activity.kind === "success" ? (
                  <Check size={17} />
                ) : (
                  <RefreshCw size={16} />
                )}
              </span>
              <div>
                <strong>{activity.title}</strong>
                <p>{activity.detail}</p>
              </div>
              <time dateTime={activity.date}>{dateLabel(activity.date)}</time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function Dashboard({ garden }: { garden: Workspace }) {
  const total = garden.localPlants.length;
  const published = garden.localPlants.filter(isPublic).length;
  return (
    <>
      <PageTitle
        eyebrow="ESPACIO DE GESTIÓN"
        title="Tu catálogo, a tu manera."
        text={`Gestiona las fichas y la imagen pública de ${garden.metadata.name}.`}
      />
      <div className="stats-grid">
        <div className="panel stat">
          <Layers3 size={21} />
          <span>Fichas locales</span>
          <strong>{total}</strong>
        </div>
        <div className="panel stat">
          <Leaf size={21} />
          <span>Publicadas y activas</span>
          <strong>{published}</strong>
        </div>
        <div className="panel stat">
          <Database size={21} />
          <span>Biblioteca Green Digital</span>
          <strong className="stat-word">
            {garden.connected ? "Conectada" : "Sin conectar"}
          </strong>
        </div>
      </div>
      {total > 0 && (
        <div className="stats-note">
          <span>
            {
              garden.localPlants.filter((plant) => plant.postStatus === "draft")
                .length
            }{" "}
            borradores
          </span>
          <span>
            {
              garden.localPlants.filter(
                (plant) => plant.postStatus === "publish" && !plant.active,
              ).length
            }{" "}
            publicadas inactivas
          </span>
          <span>{garden.localPlants.filter(isAdapted).length} adaptadas</span>
        </div>
      )}
      <div className="dashboard-bento">
        <section className="panel primary-panel">
          <p className="eyebrow">
            {garden.connected ? "TU SIGUIENTE PASO" : "PRIMER PASO"}
          </p>
          <h2>
            {garden.connected
              ? published
                ? "Hazlo tuyo"
                : "Elige qué plantas mostrar"
              : "Trae tus primeras plantas"}
          </h2>
          <p>
            {garden.connected
              ? published
                ? "Adapta la apariencia de tu escaparate a la identidad de tu centro."
                : "Revisa las fichas importadas y publica una selección cuando esté preparada."
              : "Importa una copia de la biblioteca botánica Green Digital. Las fichas se guardan como borradores de tu garden."}
          </p>
          <ActionLink
            to={
              garden.connected
                ? published
                  ? "/admin/diseno"
                  : "/admin/plantas"
                : "/admin/biblioteca"
            }
          >
            {garden.connected
              ? published
                ? "Personalizar diseño"
                : "Revisar borradores"
              : "Conectar biblioteca Green Digital"}
          </ActionLink>
        </section>
        <section className="panel shortcut-panel">
          <p className="eyebrow">VISTA DE VISITANTE</p>
          <Sprout size={35} />
          <h2>Así se ve tu catálogo</h2>
          <p>Abre el escaparate público del garden.</p>
          <ActionLink to="/catalogo" secondary>
            Ver catálogo
          </ActionLink>
        </section>
      </div>
      <ActivityLog garden={garden} />
    </>
  );
}

type Operation = {
  mode: "idle" | "import" | "sync" | "done" | "error";
  progress: number;
  text: string;
  created?: number;
  existing?: number;
  published?: number;
};
const idle: Operation = { mode: "idle", progress: 0, text: "" };

export function Library({
  garden,
  save,
  failing,
  setFailing,
}: {
  garden: Workspace;
  save: SaveGarden;
  failing: boolean;
  setFailing: (value: boolean) => void;
}) {
  const [operation, setOperation] = useState<Operation>(idle);
  const active = useRef<AbortController | null>(null);
  const busy = operation.mode === "import" || operation.mode === "sync";
  useEffect(() => () => active.current?.abort(), []);

  async function run(kind: "import" | "sync") {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setOperation({
      mode: kind,
      progress: 0,
      text:
        kind === "import"
          ? "Solicitando catálogo…"
          : "Comprobando cambios del maestro…",
    });
    try {
      if (kind === "import") {
        const plants: MasterPlant[] = [];
        let cursor: string | null = null;
        do {
          const page = await api.list(cursor, controller.signal, failing);
          controller.signal.throwIfAborted();
          plants.push(...page.data);
          cursor = page.links.next;
          setOperation({
            mode: "import",
            progress: plants.length,
            text: `Recibidas ${plants.length} de 24 fichas`,
          });
        } while (cursor !== null);
        const result = importPlants(garden, plants);
        if (
          !save(
            result.garden,
            `${result.created} fichas nuevas guardadas como borradores.`,
          )
        )
          throw new Error(
            "No se pudo guardar la importación en este navegador.",
          );
        setOperation({
          mode: "done",
          progress: 24,
          text: "Importación completada",
          created: result.created,
          existing: result.existing,
          published: result.garden.localPlants.filter(isPublic).length,
        });
      } else {
        const scenario = await api.changes(controller.signal, failing);
        controller.signal.throwIfAborted();
        const result = applyChanges(garden, scenario);
        const message = result.rows.length
          ? `${result.rows.length} cambios revisados. Las adaptaciones del garden se conservan.`
          : "Sin novedades";
        const next =
          result.garden === garden
            ? logActivity(
                garden,
                "Sin novedades",
                "El maestro de demostración ya está al día.",
                "info",
              )
            : result.garden;
        if (!save(next, message))
          throw new Error("No se pudo guardar la sincronización.");
        setOperation({ mode: "done", progress: 0, text: message });
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        const message =
          error instanceof Error
            ? error.message
            : "No se pudo completar la operación.";
        save(logActivity(garden, "Operación interrumpida", message, "error"));
        setOperation({ mode: "error", progress: 0, text: message });
      }
    } finally {
      if (active.current === controller) active.current = null;
    }
  }

  return (
    <>
      <PageTitle
        eyebrow="FUENTE DE CONTENIDO"
        title="Biblioteca y sincronización"
        text="Trae fichas a tu garden y compara las novedades de la biblioteca con tus adaptaciones."
      />
      <section className="panel library-source">
        <div className="source-icon">
          <BookOpen />
        </div>
        <div>
          <p className="eyebrow">FUENTE SIMULADA</p>
          <h2>Biblioteca Green Digital</h2>
          <p>
            Copia local de solo lectura · 24 fichas de muestra · Última
            sincronización: {dateLabel(garden.lastSyncedAt)}
          </p>
        </div>
        <span className={`status ${garden.connected ? "published" : ""}`}>
          {garden.connected ? "Conectada · demo" : "Sin conectar"}
        </span>
      </section>
      <section className="panel wizard">
        <ol className="steps">
          {["Fuente", "Descarga", "Resultado"].map((label, i) => (
            <li
              key={label}
              aria-current={
                i ===
                (operation.mode === "import"
                  ? 1
                  : operation.created !== undefined
                    ? 2
                    : 0)
                  ? "step"
                  : undefined
              }
            >
              <span>{i + 1}</span>
              {label}
            </li>
          ))}
        </ol>
        <h2>
          {garden.connected
            ? "Gestiona tu copia local"
            : "Conecta la biblioteca"}
        </h2>
        <p>
          {garden.connected
            ? "Puedes volver a importar las fichas de muestra y comprobar novedades. Tus cambios y publicaciones se mantienen."
            : "La conexión simula una descarga en tres páginas. Las fichas se incorporan como borradores."}
        </p>
        <div className="actions">
          <button
            className="button"
            disabled={busy}
            onClick={() => void run("import")}
          >
            <CloudDownload size={18} />
            {garden.connected
              ? "Volver a importar"
              : "Iniciar conexión simulada"}
          </button>
          {garden.connected && (
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => void run("sync")}
            >
              <RefreshCw size={17} /> Comprobar novedades
            </button>
          )}
          {busy && (
            <button
              className="button secondary"
              onClick={() => {
                active.current?.abort();
                setOperation(idle);
              }}
            >
              Cancelar
            </button>
          )}
        </div>
        <label className="check-line">
          <input
            type="checkbox"
            checked={failing}
            disabled={busy}
            onChange={(event) => setFailing(event.target.checked)}
          />{" "}
          Simular caída de API
        </label>
        {operation.mode !== "idle" && (
          <div
            className={`operation ${operation.mode}`}
            role={operation.mode === "error" ? "alert" : "status"}
          >
            {operation.text}
            {operation.mode === "import" && (
              <progress
                max={24}
                value={operation.progress}
                aria-label="Progreso de importación"
              />
            )}
            {operation.created !== undefined && (
              <>
                <p>
                  {operation.created} creadas · {operation.existing} ya
                  existentes · {operation.published} publicadas y activas
                </p>
                <div className="actions">
                  <ActionLink to="/admin/plantas" secondary>
                    Revisar fichas
                  </ActionLink>
                </div>
              </>
            )}
          </div>
        )}
      </section>
      {!!garden.comparison.length && (
        <section className="panel comparison">
          <p className="eyebrow">COMPARACIÓN POR CAMPO</p>
          <h2>Qué ha cambiado</h2>
          <p>
            {garden.comparison.length} campos ·{" "}
            {
              garden.comparison.filter((row) => Object.hasOwn(row, "local"))
                .length
            }{" "}
            {garden.comparison.filter((row) => Object.hasOwn(row, "local"))
              .length === 1
              ? "adaptación conservada"
              : "adaptaciones conservadas"}
            .
          </p>
          {garden.comparison.map((row) => {
            const item = garden.localPlants.find(
              (plant) => plant.masterTaxonId === row.taxon,
            );
            return (
              <article
                className="compare-row"
                key={`${row.taxon}-${row.field}`}
              >
                <header>
                  <h3>
                    {row.plant} ·{" "}
                    {fields[row.field as keyof typeof fields] ?? row.field}
                  </h3>
                  {item && (
                    <a
                      href={`#${editPath(item.localId)}`}
                      className="back-link"
                    >
                      Abrir editor <ArrowUpRight size={15} />
                    </a>
                  )}
                </header>
                <div>
                  <section>
                    <small>MAESTRO ANTERIOR</small>
                    <p>{row.before ?? "Sin dato"}</p>
                  </section>
                  <section>
                    <small>MAESTRO NUEVO</small>
                    <p>{row.after}</p>
                  </section>
                  <section>
                    <small>VALOR LOCAL CONSERVADO</small>
                    <p>
                      {row.local === ""
                        ? "Vacío intencionado"
                        : (row.local ?? "Hereda el nuevo maestro")}
                    </p>
                  </section>
                </div>
              </article>
            );
          })}
        </section>
      )}
      <ActivityLog garden={garden} />
    </>
  );
}

const tabs = [
  "Todas",
  "Borradores",
  "Publicadas",
  "Inactivas",
  "Personalizadas",
] as const;
export function Manage({
  garden,
  save,
}: {
  garden: Workspace;
  save: SaveGarden;
}) {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Todas");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [origin, setOrigin] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const all = entries(garden);
  const categories = Object.fromEntries(
    all.map(({ master }) => [
      master.category,
      master.demo_facets.category_label,
    ]),
  );
  const visible = all.filter(
    ({ local, master }) =>
      matchesQuery(master, query) &&
      (!category || master.category === category) &&
      (!origin || isAdapted(local) === (origin === "local")) &&
      (tab === "Todas" ||
        (tab === "Borradores" && local.postStatus === "draft") ||
        (tab === "Publicadas" && local.postStatus === "publish") ||
        (tab === "Inactivas" && !local.active) ||
        (tab === "Personalizadas" && isAdapted(local))),
  );
  const selection = visible.filter(({ local }) =>
    selected.includes(local.localId),
  );
  const chosen = new Set(selection.map(({ local }) => local.localId));
  function batch(
    patch: Partial<Pick<LocalPlant, "postStatus" | "active">>,
    verb: string,
  ) {
    const next = {
      ...garden,
      localPlants: garden.localPlants.map((plant) =>
        chosen.has(plant.localId) ? { ...plant, ...patch } : plant,
      ),
    };
    if (
      save(
        logActivity(
          next,
          verb,
          `${chosen.size} fichas seleccionadas`,
          "success",
        ),
        `${verb} · ${chosen.size} fichas`,
      )
    )
      setSelected([]);
  }
  return (
    <>
      <PageTitle
        eyebrow="GESTIÓN EDITORIAL"
        title="Plantas del garden"
        text="Revisa los borradores, adapta las fichas y elige cuáles aparecen en el catálogo público."
      />
      {!all.length ? (
        <Empty title="Aún no hay fichas locales">
          <p>Conecta la biblioteca para empezar.</p>
          <ActionLink to="/admin/biblioteca">Cargar mi biblioteca</ActionLink>
        </Empty>
      ) : (
        <>
          <div className="panel manage-summary">
            <div>
              <strong>{all.length} fichas locales</strong>
              <p>
                {all.filter(({ local }) => local.postStatus === "draft").length}{" "}
                borradores · {all.filter(({ local }) => isPublic(local)).length}{" "}
                públicas y activas
              </p>
            </div>
            <button
              className="button"
              onClick={() =>
                save(
                  publishFeatured(garden),
                  "Colección de demostración publicada: ocho fichas activas.",
                )
              }
            >
              <Leaf size={17} /> Publicar colección de demostración
            </button>
          </div>
          <section className="panel manage-panel">
            <div className="chips admin-tabs" aria-label="Estado de ficha">
              {tabs.map((name) => (
                <button
                  key={name}
                  aria-pressed={tab === name}
                  onClick={() => {
                    setTab(name);
                    setSelected([]);
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
            <div className="manage-filters">
              <label className="search">
                <Search size={18} />
                <input
                  type="search"
                  aria-label="Buscar fichas"
                  placeholder="Buscar fichas"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <label className="select-label">
                Categoría
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                >
                  <option value="">Todas</option>
                  {Object.entries(categories).map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="select-label">
                Origen
                <select
                  value={origin}
                  onChange={(event) => setOrigin(event.target.value)}
                >
                  <option value="">Todos</option>
                  <option value="master">Biblioteca</option>
                  <option value="local">Adaptado</option>
                </select>
              </label>
            </div>
            <div className="bulk" aria-label="Acciones por lotes">
              <span role="status">{selection.length} seleccionadas</span>
              <button
                disabled={!selection.length}
                className="button secondary"
                onClick={() =>
                  batch({ postStatus: "publish" }, "Fichas publicadas")
                }
              >
                Publicar seleccionadas
              </button>
              <button
                disabled={!selection.length}
                className="button secondary"
                onClick={() =>
                  batch({ postStatus: "draft" }, "Fichas pasadas a borrador")
                }
              >
                Pasar a borrador
              </button>
              <button
                disabled={!selection.length}
                className="button secondary"
                onClick={() => batch({ active: true }, "Fichas activadas")}
              >
                Activar
              </button>
              <button
                disabled={!selection.length}
                className="button secondary"
                onClick={() => batch({ active: false }, "Fichas desactivadas")}
              >
                Desactivar
              </button>
            </div>
            {!visible.length ? (
              <Empty title="No hay fichas con esta selección">
                <button
                  className="button secondary"
                  onClick={() => {
                    setQuery("");
                    setCategory("");
                    setOrigin("");
                    setTab("Todas");
                  }}
                >
                  Limpiar filtros
                </button>
              </Empty>
            ) : (
              <div className="management-table">
                <div className="table-head">
                  <label>
                    <input
                      type="checkbox"
                      aria-label="Seleccionar todas las fichas visibles"
                      checked={selection.length === visible.length}
                      onChange={(event) =>
                        setSelected(
                          event.target.checked
                            ? visible.map(({ local }) => local.localId)
                            : [],
                        )
                      }
                    />{" "}
                    Planta
                  </label>
                  <span>Estado</span>
                  <span>Origen</span>
                  <span>Acción</span>
                </div>
                {visible.map(({ local, master }) => (
                  <div className="table-row" key={local.localId}>
                    <div className="plant-cell">
                      <input
                        type="checkbox"
                        aria-label={`Seleccionar ${master.common_name}`}
                        checked={selected.includes(local.localId)}
                        onChange={(event) =>
                          setSelected(
                            event.target.checked
                              ? [...selected, local.localId]
                              : selected.filter((id) => id !== local.localId),
                          )
                        }
                      />
                      <PlantArt
                        url={local.localImageUrl ?? master.images[0]?.url}
                      />
                      <div>
                        <strong>{master.common_name}</strong>
                        <i>{master.scientific_name}</i>
                        <small>{master.demo_facets.category_label}</small>
                      </div>
                    </div>
                    <div className="row-status">
                      <span
                        className={`status ${local.postStatus === "publish" ? "published" : ""}`}
                      >
                        {local.postStatus === "publish"
                          ? "Publicada"
                          : local.postStatus === "private"
                            ? "Privada"
                            : "Borrador"}
                      </span>
                      <small>{local.active ? "Activa" : "Inactiva"}</small>
                    </div>
                    <div className="row-origin">
                      {isAdapted(local) ? "Adaptada" : "Biblioteca"}
                      {local.editedAt && (
                        <small>{dateLabel(local.editedAt)}</small>
                      )}
                    </div>
                    <a
                      className="edit-link"
                      href={`#${editPath(local.localId)}`}
                      aria-label={`Editar ${master.common_name}`}
                    >
                      Editar <ArrowRight size={15} />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}

export function HowItWorks() {
  return (
    <div className="wrap how-wrap">
      <p className="eyebrow">DEMO PARA JARDINARIUM</p>
      <h1>
        Una biblioteca compartida.
        <br />
        <em>Un catálogo propio.</em>
      </h1>
      <p className="lead">
        ModuPlant ayuda a cada centro de jardinería a preparar un catálogo
        botánico con su selección, su criterio y su identidad.
      </p>
      <div className="actions sample-actions">
        <ActionLink to={samplePath}>
          Explorar las 8 fichas de muestra
        </ActionLink>
        <ActionLink to="/acceso" secondary>
          Configurar un catálogo desde cero
        </ActionLink>
      </div>
      <div className="how-grid">
        {[
          ["Conecta", "Importa fichas desde una biblioteca de referencia."],
          [
            "Publica",
            "Revisa la copia local y elige qué plantas ve el visitante.",
          ],
          [
            "Personaliza",
            "Ajusta los textos, las imágenes y el diseño de tu garden.",
          ],
          [
            "Actualiza",
            "Incorpora novedades sin perder lo que ya has personalizado.",
          ],
        ].map(([title, text], i) => (
          <section className="panel" key={title}>
            <small>0{i + 1}</small>
            <h2>{title}</h2>
            <p>{text}</p>
          </section>
        ))}
      </div>
      <details className="faq demo-tour">
        <summary>Guion de la demostración</summary>
        <ol>
          {demoFlow.steps.map((step) => (
            <li key={step.id}>{step.label}</li>
          ))}
        </ol>
      </details>
      <div className="notice">
        Esta presentación utiliza dos gardens ficticios. El acceso, la
        biblioteca y el contacto son simulados. Los cambios se guardan en este
        navegador.
      </div>
    </div>
  );
}
