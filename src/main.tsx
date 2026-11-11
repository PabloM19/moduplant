import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  Eye,
  LayoutGrid,
  Leaf,
  LogIn,
  Menu,
  Palette,
  RotateCcw,
  Settings2,
  Sprout,
} from "lucide-react";
import type { CatalogRole } from "./contracts.ts";
import { freshState, sampleGarden } from "./data.ts";
import { entries } from "./model.ts";
import type { State, Workspace } from "./model.ts";
import {
  Brand,
  DemoBadge,
  Empty,
  Modal,
  ActionLink,
  go,
  samplePath,
} from "./ui.tsx";
import { Catalog, PlantDetail, cleanFilters } from "./catalogue.tsx";
import { Dashboard, HowItWorks, Library, Manage } from "./admin.tsx";
import { Design, Editor } from "./editors.tsx";
import "./styles.css";

const storageKey = "green-digital-moduplant-demo-v1";
const currentPath = () =>
  window.location.hash.slice(1).replace(/\?.*$/, "") || "/catalogo";
const links = [
  ["/admin", "Resumen", LayoutGrid],
  ["/admin/plantas", "Plantas", Leaf],
  ["/admin/biblioteca", "Biblioteca y sincronización", BookOpen],
  ["/admin/diseno", "Personalizar diseño", Palette],
] as const;

function readState(): State {
  try {
    const saved = JSON.parse(
      localStorage.getItem(storageKey) ?? "null",
    ) as State | null;
    if (
      saved?.schemaVersion === 1 &&
      saved.gardens?.[saved.selectedGardenId]?.activity &&
      ["visitor", "admin"].includes(saved.role)
    )
      return saved;
  } catch {
    /* A clean state still allows the presentation to open. */
  }
  return freshState();
}

function App() {
  const [state, setState] = useState(readState);
  const current = useRef(state);
  const [path, setPath] = useState(currentPath);
  const [dialog, setDialog] = useState<
    "role" | "garden" | "reset" | "menu" | null
  >(null);
  const [toast, setToast] = useState<{
    message: string;
    error: boolean;
    id: number;
  }>();
  const [filters, setFilters] = useState(cleanFilters);
  const [sampleFilters, setSampleFilters] = useState(cleanFilters);
  const main = useRef<HTMLElement>(null);
  const garden = state.gardens[state.selectedGardenId];
  const viewingSample =
    path === samplePath || path.startsWith(`${samplePath}/plantas/`);
  const admin = state.role === "admin";
  const access = path === "/acceso";
  const privateRoute = path === "/admin" || path.startsWith("/admin/");
  const showAdmin =
    admin && privateRoute && !path.startsWith("/admin/vista-previa/");
  const lastFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const change = () => {
      setPath(currentPath());
      setDialog(null);
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    main.current?.focus({ preventScroll: true });
  }, [path]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(undefined), 4300);
    return () => clearTimeout(timer);
  }, [toast]);

  function notify(message: string, error = false) {
    setToast({ message, error, id: Date.now() });
  }
  function commit(next: State): boolean {
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      notify(
        "No se pudieron guardar los cambios. Revisa el espacio disponible en el navegador.",
        true,
      );
      return false;
    }
    current.current = next;
    setState(next);
    return true;
  }
  function saveGarden(updated: Workspace, message?: string) {
    const snapshot = current.current;
    const saved = commit({
      ...snapshot,
      gardens: { ...snapshot.gardens, [updated.metadata.id]: updated },
    });
    if (saved && message) notify(message);
    return saved;
  }
  function openDialog(value: NonNullable<typeof dialog>) {
    lastFocus.current = document.activeElement as HTMLElement | null;
    setDialog(value);
  }
  function closeDialog() {
    if (access) go("/catalogo");
    setDialog(null);
    lastFocus.current?.focus();
  }
  function chooseRole(role: CatalogRole) {
    if (!commit({ ...current.current, role })) return;
    setDialog(null);
    go(role === "admin" ? "/admin" : "/catalogo");
  }
  function chooseGarden(id: string) {
    if (!commit({ ...current.current, selectedGardenId: id })) return;
    setFilters(cleanFilters());
    setDialog(null);
    go("/admin");
    notify(`Ahora gestionas ${state.gardens[id].metadata.name}`);
  }
  function reset() {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      notify("No se pudo reiniciar el almacenamiento.", true);
      return;
    }
    const empty = freshState();
    current.current = empty;
    setState(empty);
    setFilters(cleanFilters());
    setSampleFilters(cleanFilters());
    setDialog(null);
    go("/catalogo");
    notify(
      "Demostración reiniciada. Los dos catálogos vuelven a estar vacíos.",
    );
  }
  const nav = (
    <>
      {links.map(([url, label, Icon]) => (
        <a
          href={`#${url}`}
          key={url}
          aria-current={
            (url === "/admin" ? path === url : path.startsWith(url))
              ? "page"
              : undefined
          }
          onClick={() => setDialog(null)}
        >
          <Icon size={19} />
          {label}
        </a>
      ))}
      <a href="#/catalogo" onClick={() => setDialog(null)}>
        <Eye size={19} />
        Ver catálogo
        <ArrowUpRight size={15} className="nav-arrow" />
      </a>
    </>
  );
  const roleModal = (dialog === "role" || access) && (
    <Modal title="Elige cómo ver la demo" close={closeDialog}>
      <p>
        Acceso simulado para la presentación. Elige una vista para continuar.
      </p>
      <div className="role-options">
        <button onClick={() => chooseRole("visitor")}>
          <Eye size={23} />
          <span>
            <strong>Entrar como visitante</strong>
            <small>Explora las fichas publicadas del garden.</small>
          </span>
          <ArrowRight size={18} />
        </button>
        <button onClick={() => chooseRole("admin")}>
          <Settings2 size={23} />
          <span>
            <strong>Entrar como administrador (demo)</strong>
            <small>Gestiona fichas, biblioteca y diseño.</small>
          </span>
          <ArrowRight size={18} />
        </button>
      </div>
    </Modal>
  );
  let content;
  if (privateRoute && !admin) {
    content = (
      <div className="wrap">
        <Empty title="Área de administración de la demo">
          <p>
            Elige la vista de administrador para gestionar un catálogo de
            prueba.
          </p>
          <button className="button" onClick={() => openDialog("role")}>
            Elegir vista <ArrowRight size={16} />
          </button>
        </Empty>
      </div>
    );
  } else if (path === "/admin") content = <Dashboard garden={garden} />;
  else if (path === "/admin/biblioteca")
    content = (
      <Library
        garden={garden}
        save={saveGarden}
        failing={state.simulatingApiFailure}
        setFailing={(value) =>
          commit({ ...current.current, simulatingApiFailure: value })
        }
      />
    );
  else if (path === "/admin/plantas")
    content = <Manage garden={garden} save={saveGarden} />;
  else if (path === "/admin/diseno")
    content = <Design garden={garden} save={saveGarden} />;
  else if (path === "/como-funciona") content = <HowItWorks />;
  else if (path === samplePath)
    content = (
      <Catalog
        garden={sampleGarden}
        admin={false}
        filters={sampleFilters}
        setFilters={setSampleFilters}
        sample
      />
    );
  else if (path === "/catalogo" || path === "/" || access)
    content = (
      <Catalog
        garden={garden}
        admin={admin}
        filters={filters}
        setFilters={setFilters}
      />
    );
  else if (
    /^\/(?:plantas|muestra\/plantas|admin\/plantas|admin\/vista-previa)\/[^/]+$/.test(
      path,
    )
  ) {
    const detailGarden = viewingSample ? sampleGarden : garden;
    const item = entries(detailGarden, !privateRoute).find(
      ({ local }) => local.localId === path.split("/").at(-1),
    );
    content = item ? (
      path.startsWith("/admin/plantas/") ? (
        <Editor item={item} garden={garden} save={saveGarden} />
      ) : (
        <PlantDetail
          item={item}
          garden={detailGarden}
          preview={privateRoute}
          sample={viewingSample}
        />
      )
    ) : (
      <div className="wrap">
        <Empty title="Ficha no disponible">
          <p>
            Puede que todavía no esté publicada o que pertenezca a otro garden.
          </p>
          <ActionLink
            to={
              privateRoute
                ? "/admin/plantas"
                : viewingSample
                  ? samplePath
                  : "/catalogo"
            }
            secondary
          >
            Volver al catálogo
          </ActionLink>
        </Empty>
      </div>
    );
  } else
    content = (
      <div className="wrap">
        <Empty title="No encontramos esta página">
          <ActionLink to="/catalogo">Volver al catálogo</ActionLink>
        </Empty>
      </div>
    );

  return (
    <>
      <a
        className="skip"
        href="#contenido"
        onClick={(event) => {
          event.preventDefault();
          main.current?.focus();
        }}
      >
        Saltar al contenido
      </a>
      <header className="top">
        <div className="wrap top-inner">
          <Brand />
          <nav aria-label="Navegación principal" className="top-nav">
            <a
              href={`#${viewingSample ? samplePath : "/catalogo"}`}
              aria-current={
                viewingSample ||
                path === "/catalogo" ||
                path.startsWith("/plantas/")
                  ? "page"
                  : undefined
              }
            >
              {viewingSample ? "Catálogo de muestra" : "Catálogo"}
            </a>
            <a
              href="#/como-funciona"
              aria-current={path === "/como-funciona" ? "page" : undefined}
            >
              Cómo funciona
            </a>
            {admin && (
              <a
                href="#/admin"
                aria-current={privateRoute ? "page" : undefined}
              >
                Panel
              </a>
            )}
          </nav>
          <div className="top-actions">
            <DemoBadge />
            <button
              className="button top-login"
              onClick={() => openDialog("role")}
            >
              {admin ? "Cambiar vista" : "Entrar"}{" "}
              {admin ? <ChevronDown size={15} /> : <LogIn size={16} />}
            </button>
            <button
              className="icon-button mobile-menu"
              aria-label="Abrir menú"
              onClick={() => openDialog("menu")}
            >
              <Menu size={22} />
            </button>
          </div>
        </div>
      </header>
      {showAdmin ? (
        <div className="admin-shell wrap">
          <aside className="sidebar">
            <div className="sidebar-garden">
              <span className="source-icon">
                <Sprout size={20} />
              </span>
              <div>
                <strong>{garden.metadata.name}</strong>
                <small>Administración demo</small>
              </div>
            </div>
            <nav aria-label="Gestión del catálogo">{nav}</nav>
            <div className="sidebar-foot">
              <button onClick={() => openDialog("garden")}>
                <Settings2 size={17} /> Cambiar garden
              </button>
              <button onClick={() => openDialog("reset")}>
                <RotateCcw size={17} /> Reiniciar demostración
              </button>
            </div>
          </aside>
          <main id="contenido" tabIndex={-1} ref={main} className="workspace">
            <div className="workspace-mobile">
              <strong>{garden.metadata.name}</strong>
              <button
                className="button secondary"
                onClick={() => openDialog("garden")}
              >
                Cambiar garden <ChevronDown size={16} />
              </button>
            </div>
            <div key={`${garden.metadata.id}:${path}`}>{content}</div>
          </main>
        </div>
      ) : (
        <main
          id="contenido"
          tabIndex={-1}
          ref={main}
          key={`${garden.metadata.id}:${path}`}
        >
          {content}
        </main>
      )}
      <footer className="footer">
        <div className="wrap footer-inner">
          <Brand />
          <span>Prototipo para Jardinarium · Datos de demostración</span>
          <a href="#/como-funciona">
            Cómo funciona <ArrowUpRight size={14} />
          </a>
        </div>
      </footer>
      {roleModal}
      {dialog === "garden" && admin && (
        <Modal key="garden" title="Cambiar garden" close={closeDialog}>
          <p>
            Cada garden conserva su propio catálogo, diseño y adaptaciones en
            este navegador.
          </p>
          <div className="role-options">
            {Object.values(state.gardens).map((workspace) => (
              <button
                key={workspace.metadata.id}
                onClick={() => chooseGarden(workspace.metadata.id)}
              >
                <Sprout size={22} />
                <span>
                  <strong>{workspace.metadata.name}</strong>
                  <small>
                    {workspace.localPlants.length} fichas locales
                    {workspace.metadata.id === garden.metadata.id
                      ? " · Garden actual"
                      : ""}
                  </small>
                </span>
                <ArrowRight size={18} />
              </button>
            ))}
          </div>
        </Modal>
      )}
      {dialog === "reset" && admin && (
        <Modal
          key="reset"
          title="¿Reiniciar la demostración?"
          close={closeDialog}
        >
          <p>
            Se borrarán las fichas importadas, el diseño y las adaptaciones de
            los dos gardens de esta demo. Volverás al catálogo vacío como
            visitante.
          </p>
          <div className="actions">
            <button className="button secondary" onClick={closeDialog}>
              Cancelar
            </button>
            <button className="button" onClick={reset}>
              Reiniciar ambos gardens
            </button>
          </div>
        </Modal>
      )}
      {dialog === "menu" && (
        <Modal key="menu" title="Navegación" close={closeDialog}>
          <nav className="modal-nav" aria-label="Menú móvil">
            <a
              href={`#${viewingSample ? samplePath : "/catalogo"}`}
              onClick={closeDialog}
            >
              <Leaf size={19} />{" "}
              {viewingSample ? "Catálogo de muestra" : "Catálogo"}
            </a>
            <a href="#/como-funciona" onClick={closeDialog}>
              <BookOpen size={19} /> Cómo funciona
            </a>
            {admin && (
              <>
                {nav}
                <button onClick={() => setDialog("garden")}>
                  <Settings2 size={18} /> Cambiar garden
                </button>
                <button onClick={() => setDialog("reset")}>
                  <RotateCcw size={18} /> Reiniciar demostración
                </button>
              </>
            )}
          </nav>
        </Modal>
      )}
      {toast && (
        <div
          className={`toast ${toast.error ? "error" : ""}`}
          key={toast.id}
          role={toast.error ? "alert" : "status"}
        >
          {toast.message}
        </div>
      )}
    </>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
