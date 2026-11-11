import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Droplets,
  Eye,
  Leaf,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Sun,
} from "lucide-react";
import type { MasterPlant, ThemeConfig } from "./contracts.ts";
import { asset } from "./data.ts";
import {
  entries,
  isAdapted,
  matchesQuery,
  related,
  resolveField,
} from "./model.ts";
import type { PlantEntry, Workspace } from "./model.ts";
import {
  ActionLink,
  Empty,
  Modal,
  editPath,
  publicPath,
  samplePath,
  themeStyle,
} from "./ui.tsx";

export const exposureLabels: Record<string, string> = {
  sol: "Sol",
  semisombra: "Semisombra",
  sombra: "Sombra",
  "luz-filtrada": "Luz filtrada",
};
export const waterLabels: Record<string, string> = {
  bajo: "Bajo",
  moderado: "Moderado",
  frecuente: "Frecuente",
};
const careLabels: Record<string, string> = {
  light: "Luz",
  watering: "Riego",
  substrate: "Sustrato",
  maintenance: "Mantenimiento",
  environment: "Ambiente",
  pruning: "Poda",
  fertilizing: "Abonado",
  propagation: "Multiplicación",
};

export function PlantArt({
  url,
  alt = "",
  className = "",
}: {
  url?: string | null;
  alt?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState("");
  return (
    <div className={`plant-art ${className}`}>
      {url && failed !== url ? (
        <img src={asset(url)} alt={alt} onError={() => setFailed(url)} />
      ) : (
        <Leaf size={40} aria-hidden="true" />
      )}
    </div>
  );
}
export function PlantCard({
  item,
  theme,
  link = true,
  sample = false,
}: {
  item: PlantEntry;
  theme: ThemeConfig;
  link?: boolean;
  sample?: boolean;
}) {
  const { master, local } = item;
  const light = resolveField(master, local, "care.light");
  const watering = resolveField(master, local, "care.watering");
  const lightText =
    light.source === "master"
      ? master.exposure.map((value) => exposureLabels[value]).join(" · ")
      : light.value;
  const wateringText =
    watering.source === "master"
      ? waterLabels[master.demo_facets.watering_level]
      : watering.value;
  const content = (
    <>
      <PlantArt
        url={local.localImageUrl ?? master.images[0]?.url}
        alt={`Ilustración de ${master.common_name}`}
      />
      <div className="card-copy">
        <span className="category-chip">
          {master.demo_facets.category_label}
        </span>
        <h3>{local.localTitle ?? master.common_name}</h3>
        {isAdapted(local) && (
          <span className="card-adapted">Adaptada por el garden</span>
        )}
        {theme.showScientificName && <i>{master.scientific_name}</i>}
        <p className="card-intro">
          {resolveField(master, local, "introduction").value}
        </p>
        {theme.showCareFacts && (
          <div className="card-facts">
            {lightText && (
              <span>
                <Sun size={14} /> {lightText}
              </span>
            )}
            {wateringText && (
              <span>
                <Droplets size={14} /> {wateringText}
              </span>
            )}
          </div>
        )}
        {link && (
          <span className="card-link">
            Ver ficha <ArrowRight size={16} />
          </span>
        )}
      </div>
    </>
  );
  return (
    <article className="plant-card">
      {link ? (
        <a href={`#${publicPath(local.localId, sample)}`}>{content}</a>
      ) : (
        content
      )}
    </article>
  );
}

export interface Filters {
  query: string;
  environment: string;
  categories: string[];
  exposure: string[];
  watering: string[];
}
export const cleanFilters = (): Filters => ({
  query: "",
  environment: "",
  categories: [],
  exposure: [],
  watering: [],
});
const pageSize = 9;
export function Catalog({
  garden,
  admin,
  filters,
  setFilters: onFilterChange,
  sample = false,
}: {
  garden: Workspace;
  admin: boolean;
  filters: Filters;
  setFilters: (f: Filters) => void;
  sample?: boolean;
}) {
  const items = entries(garden, true);
  const [mobileFilters, setMobileFilters] = useState(false);
  const [page, setPage] = useState(1);
  function setFilters(next: Filters) {
    onFilterChange(next);
    setPage(1);
  }
  const categories = Object.fromEntries(
    items.map(({ master }) => [
      master.category,
      master.demo_facets.category_label,
    ]),
  );
  const filtered = items.filter(
    ({ master }) =>
      matchesQuery(master, filters.query) &&
      (!filters.environment ||
        master.demo_facets.environment === filters.environment) &&
      (!filters.categories.length ||
        filters.categories.includes(master.category)) &&
      (!filters.exposure.length ||
        master.exposure.some((value) => filters.exposure.includes(value))) &&
      (!filters.watering.length ||
        filters.watering.includes(master.demo_facets.watering_level)),
  );
  const filterCount =
    filters.categories.length +
    filters.exposure.length +
    filters.watering.length;
  const theme = garden.metadata.theme;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageItems = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const toggle = (
    group: "categories" | "exposure" | "watering",
    value: string,
  ) => {
    const current = filters[group];
    setFilters({
      ...filters,
      [group]: current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    });
  };
  const options = (
    <>
      <div className="filter-title">
        <h3>Filtrar plantas</h3>
        <button
          className="text-button"
          onClick={() => setFilters(cleanFilters())}
        >
          Limpiar
        </button>
      </div>
      {(
        [
          ["categories", "Categoría", categories],
          ["exposure", "Exposición", exposureLabels],
          ["watering", "Riego orientativo", waterLabels],
        ] as const
      ).map(([group, name, labels]) => (
        <fieldset key={group} className="filter-group">
          <legend>{name}</legend>
          {Object.entries(labels).map(([value, label]) => (
            <label key={value}>
              <input
                type="checkbox"
                checked={filters[group].includes(value)}
                onChange={() => toggle(group, value)}
              />
              {label}
            </label>
          ))}
        </fieldset>
      ))}
      <small>Los niveles de riego son etiquetas de esta demostración.</small>
    </>
  );
  return (
    <div
      className="catalog-surface"
      style={themeStyle(theme)}
      data-chips={theme.chipStyle}
    >
      <div className="wrap catalog-wrap">
        <section className={`catalog-hero ${items.length ? "populated" : ""}`}>
          <div className="hero-copy">
            <p className="eyebrow">
              <i className="hero-leaf" aria-hidden="true" />
              {sample ? "CATÁLOGO DE MUESTRA" : "CATÁLOGO BOTÁNICO"} ·{" "}
              {garden.metadata.name}
            </p>
            <h1>
              Cada planta,
              <br />
              <em>su lugar.</em>
            </h1>
          </div>
          <div className="hero-summary">
            <p>
              Explora la selección de {garden.metadata.name}, descubre sus
              cuidados y encuentra una planta para tu espacio.
            </p>
            <div className="hero-foot">
              <span className="hero-count">
                <i aria-hidden="true" /> {items.length}{" "}
                {items.length === 1 ? "ficha publicada" : "fichas publicadas"}
              </span>
              <span>{garden.metadata.city}</span>
            </div>
          </div>
          {!items.length && (
            <figure className="hero-figure">
              <PlantArt url="/demo-images/monstera-deliciosa.svg" />
              <figcaption>ILUSTRACIÓN DE DEMOSTRACIÓN</figcaption>
            </figure>
          )}
        </section>
        {!items.length ? (
          <Empty title="La colección aún está por descubrir">
            <p>
              Este garden todavía no ha publicado sus fichas. Aquí aparecerán
              las plantas que elija mostrar.
            </p>
            <div className="actions sample-actions">
              <ActionLink to={samplePath}>
                Ver las 8 plantas de muestra
              </ActionLink>
              <ActionLink
                to={admin ? "/admin/biblioteca" : "/acceso"}
                secondary
              >
                {admin
                  ? "Cargar mi biblioteca"
                  : "Configurar un catálogo desde cero"}
              </ActionLink>
            </div>
          </Empty>
        ) : (
          <section className="catalog-list">
            <div className="section-head">
              <div>
                <p className="eyebrow">LA SELECCIÓN DEL GARDEN</p>
                <h2>Explora la colección</h2>
              </div>
              <span className="muted" role="status">
                {filtered.length} de {items.length} plantas
              </span>
            </div>
            <div className="chips" aria-label="Ambiente">
              {[
                ["", "Todas las plantas"],
                ["interior", "Interior"],
                ["exterior", "Exterior"],
              ].map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={filters.environment === value}
                  onClick={() => setFilters({ ...filters, environment: value })}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="catalog-search-caption">
              Buscar por nombre común, científico o sinónimo
            </div>
            <div className="search-row">
              <label className="search">
                <Search size={20} />
                <input
                  type="search"
                  value={filters.query}
                  placeholder="Por ejemplo, monstera o lavanda"
                  aria-label="Buscar plantas"
                  onChange={(event) =>
                    setFilters({ ...filters, query: event.target.value })
                  }
                />
              </label>
              <button
                className="button secondary mobile-filter"
                onClick={() => setMobileFilters(true)}
              >
                <SlidersHorizontal size={17} /> Filtros
                {filterCount ? ` (${filterCount})` : ""}
              </button>
            </div>
            <div className="catalog-body">
              <aside className="desktop-filter">{options}</aside>
              <div>
                {filtered.length ? (
                  <div className="plant-grid">
                    {pageItems.map((item) => (
                      <PlantCard
                        key={item.local.localId}
                        item={item}
                        theme={theme}
                        sample={sample}
                      />
                    ))}
                  </div>
                ) : (
                  <Empty
                    title="No hay plantas con esos filtros"
                    icon={<Search size={24} />}
                  >
                    <p>Prueba otro nombre o amplía la búsqueda.</p>
                    <button
                      className="button secondary"
                      onClick={() => setFilters(cleanFilters())}
                    >
                      Limpiar filtros
                    </button>
                  </Empty>
                )}
                {pageCount > 1 && (
                  <nav
                    className="catalog-pages"
                    aria-label="Paginación del catálogo"
                  >
                    <button
                      className="button secondary"
                      disabled={currentPage === 1}
                      onClick={() => setPage(currentPage - 1)}
                    >
                      Anterior
                    </button>
                    <span role="status">
                      Página {currentPage} de {pageCount}
                    </span>
                    <button
                      className="button secondary"
                      disabled={currentPage === pageCount}
                      onClick={() => setPage(currentPage + 1)}
                    >
                      Siguiente
                    </button>
                  </nav>
                )}
              </div>
            </div>
            {mobileFilters && (
              <Modal
                title="Filtros del catálogo"
                close={() => setMobileFilters(false)}
              >
                {options}
                <button
                  className="button"
                  onClick={() => setMobileFilters(false)}
                >
                  Ver {filtered.length} resultados <ArrowRight size={16} />
                </button>
              </Modal>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

export function Safety({ plant }: { plant: MasterPlant }) {
  const documented = plant.risk_status === "documented_risk";
  return (
    <section className={`safety ${documented ? "risk" : ""}`}>
      <ShieldAlert size={23} />
      <div>
        <h2>{documented ? "Precauciones" : "Evidencia insuficiente"}</h2>
        <p>
          {documented
            ? plant.safety ||
              "Esta ficha de demostración incluye riesgos documentados."
            : "La ficha de demostración no aporta evidencia suficiente para establecer su seguridad."}
        </p>
        {documented && !!plant.risk_recipients?.length && (
          <p>
            <strong>Destinatarios:</strong> {plant.risk_recipients.join(", ")}.
          </p>
        )}
      </div>
    </section>
  );
}

export function PlantDetail({
  item,
  garden,
  preview = false,
  sample = false,
}: {
  item: PlantEntry;
  garden: Workspace;
  preview?: boolean;
  sample?: boolean;
}) {
  const [photo, setPhoto] = useState(0);
  const [contact, setContact] = useState(false);
  const { master, local } = item;
  const theme = garden.metadata.theme;
  const images = [
    ...(local.localImageUrl ? [{ url: local.localImageUrl, id: "local" }] : []),
    ...master.images.filter((image) => image.url !== local.localImageUrl),
  ];
  const adapted = isAdapted(local);
  const introduction = resolveField(master, local, "introduction").value;
  const description = resolveField(master, local, "description").value;
  const care = [...new Set([...Object.keys(master.care), "light", "watering"])]
    .map(
      (key) => [key, resolveField(master, local, `care.${key}`).value] as const,
    )
    .filter(([, value]) => value);
  const suggestions = related(garden, item);
  return (
    <div
      className="catalog-surface"
      style={themeStyle(theme)}
      data-chips={theme.chipStyle}
    >
      <div className="wrap detail-wrap">
        {preview && (
          <div className="notice">
            <Eye size={19} /> Vista previa privada{" "}
            <a href={`#${editPath(local.localId)}`}>Volver al editor</a>
          </div>
        )}
        <a href={`#${sample ? samplePath : "/catalogo"}`} className="back-link">
          <ArrowLeft size={16} /> Catálogo <span> / {master.common_name}</span>
        </a>
        <section className="detail-hero">
          <div className="gallery">
            <PlantArt
              url={images[photo]?.url ?? images[0]?.url}
              alt={`Ilustración de ${master.common_name}`}
            />
            {images.length > 1 && (
              <div className="thumbnails">
                {images.map((image, i) => (
                  <button
                    aria-label={`Ver ilustración ${i + 1}`}
                    aria-pressed={i === photo}
                    key={image.id}
                    onClick={() => setPhoto(i)}
                  >
                    <PlantArt url={image.url} />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="eyebrow">
              {master.demo_facets.category_label} · {master.family}
            </p>
            <h1>{local.localTitle ?? master.common_name}</h1>
            {theme.showScientificName && (
              <i className="scientific">{master.scientific_name}</i>
            )}
            <div className="detail-provenance">
              {adapted
                ? `Adaptada por ${garden.metadata.name}`
                : "Ficha de la biblioteca Green Digital"}
            </div>
            {introduction && <p className="detail-intro">{introduction}</p>}
            <button
              className="button catalog-button"
              onClick={() => setContact(true)}
            >
              {local.cta.label || "Consultar esta planta"}{" "}
              <ArrowRight size={17} />
            </button>
            <p className="muted detail-note">
              Ficha e ilustraciones de demostración.
            </p>
          </div>
        </section>
        <div className="detail-bento">
          <section className="content-card">
            <p className="eyebrow">EN SU CONTEXTO</p>
            <h2>Conoce la planta</h2>
            {description && <p>{description}</p>}
            {master.cultivation_context && <p>{master.cultivation_context}</p>}
          </section>
          <Safety plant={master} />
        </div>
        {!!care.length && theme.showCareFacts && (
          <section className="detail-section">
            <p className="eyebrow">GUÍA DE CULTIVO</p>
            <h2>Sus cuidados</h2>
            <div className="facts-grid">
              {care.map(([key, value]) => (
                <article key={key} className="content-card">
                  {key === "light" ? (
                    <Sun />
                  ) : key === "watering" ? (
                    <Droplets />
                  ) : (
                    <Leaf />
                  )}
                  <h3>{careLabels[key] ?? key}</h3>
                  <p>{value}</p>
                </article>
              ))}
            </div>
          </section>
        )}
        {theme.showTraits && master.traits && (
          <section className="detail-section">
            <h2>Características</h2>
            <dl className="trait-list">
              {Object.entries(master.traits).map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
        {theme.showFaqs && !!master.faqs.length && (
          <section className="detail-section">
            <h2>Preguntas frecuentes</h2>
            {[...master.faqs]
              .sort((a, b) => a.position - b.position)
              .map((faq) => (
                <details className="faq" key={faq.id}>
                  <summary>{faq.question}</summary>
                  <p>{faq.answer}</p>
                  {faq.evidence_label && <small>{faq.evidence_label}</small>}
                </details>
              ))}
          </section>
        )}
        {!!suggestions.length && (
          <section className="detail-section">
            <p className="eyebrow">SIGUE EXPLORANDO</p>
            <h2>También te pueden interesar</h2>
            <div className="plant-grid">
              {suggestions.map((plant) => (
                <PlantCard
                  item={plant}
                  theme={theme}
                  sample={sample}
                  key={plant.local.localId}
                />
              ))}
            </div>
          </section>
        )}
        {contact && (
          <Modal
            title={`Consulta sobre ${master.common_name}`}
            close={() => setContact(false)}
          >
            <p>Así se mostraría el contacto de {garden.metadata.name}.</p>
            <address>
              {garden.metadata.address}
              <br />
              {garden.metadata.contactEmail}
              <br />
              {garden.metadata.contactPhone}
            </address>
            <div className="notice">
              Contacto de ejemplo. No se enviará ningún mensaje.
            </div>
            <button className="button" onClick={() => setContact(false)}>
              Volver a la ficha
            </button>
          </Modal>
        )}
      </div>
    </div>
  );
}
