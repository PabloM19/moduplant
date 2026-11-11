import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import { ArrowUpRight, Sprout, X } from "lucide-react";
import greenDigitalLogo from "./assets/green-digital.png";
import type { ThemeConfig } from "./contracts.ts";
import { heroTheme } from "./model.ts";

export const go = (path: string) => {
  window.location.hash = path;
};
export const samplePath = "/muestra";
export const publicPath = (localId: string, sample = false) =>
  `${sample ? samplePath : ""}/plantas/${localId}`;
export const editPath = (localId: string) => `/admin/plantas/${localId}`;
export const dateLabel = (date?: string) =>
  date
    ? new Intl.DateTimeFormat("es-ES", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(date))
    : "Todavía no";

export function ActionLink({
  to,
  children,
  secondary = false,
}: {
  to: string;
  children: ReactNode;
  secondary?: boolean;
}) {
  return (
    <a className={`button ${secondary ? "secondary" : ""}`} href={`#${to}`}>
      {children}
      <ArrowUpRight size={16} />
    </a>
  );
}
export function Brand() {
  return (
    <a href="#/catalogo" className="brand" aria-label="ModuPlant, catálogo">
      <img
        className="brand-logo"
        src={greenDigitalLogo}
        alt="Green Digital"
        width={500}
        height={250}
      />
      <span className="brand-product">
        ModuPlant<small>CATÁLOGO BOTÁNICO</small>
      </span>
    </a>
  );
}
export function DemoBadge() {
  return (
    <span className="demo-badge">
      <i /> Modo demo <span>· Datos simulados</span>
    </span>
  );
}
export function Empty({
  title,
  children,
  icon = <Sprout size={26} />,
}: {
  title: string;
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon}</span>
      <h2>{title}</h2>
      {children}
    </div>
  );
}
export function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby="modal-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="modal-content">
        <button
          className="icon-button modal-close"
          aria-label="Cerrar"
          onClick={close}
        >
          <X size={21} />
        </button>
        <h2 id="modal-title">{title}</h2>
        {children}
      </div>
    </dialog>
  );
}
export function themeStyle(theme: ThemeConfig): CSSProperties {
  return {
    "--primary": theme.primary,
    "--on-primary": heroTheme(theme),
    "--accent": theme.accent,
    "--page": theme.page,
    "--card": theme.card,
    "--text": theme.text,
    "--radius": `${theme.radius}px`,
    "--shadow": theme.shadow ? "0 12px 26px #2e351410" : "none",
    "--columns": theme.gridColumnsDesktop,
    "--ratio": theme.cardRatio.replace(":", " / "),
    "--catalog-font":
      theme.font === "Newsreader"
        ? "Newsreader, Georgia, serif"
        : theme.font === "system"
          ? "system-ui, sans-serif"
          : "Instrument, sans-serif",
  } as CSSProperties;
}
