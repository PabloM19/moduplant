/**
 * Contratos sugeridos para la DEMO frontend de ModuPlant.
 * No son un SDK oficial de Green Digital ni un modelo WordPress.
 * Los paths `images[].url` son rutas SVG locales solo en nuestros fixtures;
 * la API real entrega URLs absolutas.
 */

export type CatalogRole = "visitor" | "admin";
export type PostStatus = "draft" | "publish" | "private";
export type SyncStatus = "current" | "needs-review" | "source-withdrawn";
export type RiskStatus = "unknown" | "documented_risk";
export type Exposure = "sol" | "semisombra" | "sombra" | "luz-filtrada";
export type WateringLevel = "bajo" | "moderado" | "frecuente";
export type DifficultyLevel = "facil" | "medio" | "avanzado";

export interface MasterImage {
  id: string;
  position: number;
  url: string; // Relative demo path, e.g. /demo-images/monstera-deliciosa.svg
  metadata?: { alt_original?: string; [key: string]: unknown };
  variant?: string;
}

export interface MasterFaq {
  id: string;
  position: number;
  topic?: string;
  question: string;
  answer: string;
  evidence_status?: string;
  evidence_label?: string;
}

export interface MasterPlant {
  id: string; // Stable taxon UUID; in production this is API data.id
  record_id: string; // NOT the identity key for ModuPlant
  slug: string;
  version: number;
  language: "es";
  common_name: string;
  scientific_name: string;
  full_name?: string;
  family?: string;
  category: string;
  exposure: Exposure[];
  introduction?: string;
  description?: string;
  care: Record<string, string>;
  traits?: Record<string, string>;
  risk_status: RiskStatus;
  risk_recipients: string[] | null;
  safety?: string;
  cultivation_context?: string;
  synonyms?: string[];
  identity?: Record<string, unknown>;
  images: MasterImage[];
  faqs: MasterFaq[];
  sources?: unknown[];
  evidence?: unknown[];
  demo_facets: {
    watering_level: WateringLevel;
    difficulty: DifficultyLevel;
    category_label: string;
    environment: "interior" | "exterior";
    has_flowers: boolean;
  }; // LOCAL DEMO enrichment; NOT in the Green Digital API schema.
  demo_only: true;
}

export interface FieldOverride {
  kind: "value" | "empty";
  value: string | number | boolean | null;
  changedAt: string;
}

export interface LocalPlant {
  localId: string;
  gardenId: string;
  masterTaxonId: string; // UUID: MasterPlant.id, never localId or record_id
  postStatus: PostStatus;
  active: boolean;
  overrides: Record<string, FieldOverride>; // paths: introduction, description, care.watering
  localTitle?: string;
  localImageUrl?: string | null;
  cta: { label: string; target: string };
  localCategories?: string[];
  syncStatus: SyncStatus;
  createdAt: string;
  editedAt?: string;
}

export interface ThemeConfig {
  primary: string;
  accent: string;
  page: string;
  card: string;
  text: string;
  radius: number;
  shadow: boolean;
  font: "Instrument" | "system" | "Newsreader";
  gridColumnsDesktop: 2 | 3 | 4;
  cardRatio: string;
  showScientificName: boolean;
  showCareFacts: boolean;
  showSafetySection: true;
  showTraits: boolean;
  showFaqs: boolean;
  chipStyle: "soft" | "outline"; // safety is mandatory whenever there is a risk warning
}

export interface Garden {
  id: string;
  name: string;
  city: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  themePreset: string;
  theme: ThemeConfig;
}

export interface GardenState {
  metadata: Garden;
  connected: boolean;
  localPlants: LocalPlant[];
  masterSnapshots: Record<string, MasterPlant>;
  syncAppliedScenarios: string[];
  lastSyncedAt?: string;
}

export interface DemoState {
  schemaVersion: number;
  selectedGardenId: string;
  role: CatalogRole;
  gardens: Record<string, GardenState>;
  simulatingApiFailure: boolean;
  demoGuideStep: number;
}

export interface SyncEvent {
  id: string;
  sequence: string; // Decimal STRING per API
  type: "plant.published" | "plant.withdrawn";
  taxon_id: string;
  version: number;
  occurred_at: string;
  invalidated_image_ids: string[];
}

export type ResolvedSource = "master" | "local" | "local-empty" | "missing";
export interface ResolvedField<T = unknown> {
  value: T | undefined;
  source: ResolvedSource;
}

export interface MockListResponse {
  data: MasterPlant[];
  meta: { contract_version: "1"; per_page: number };
  links: { next: string | null; previous: string | null };
}

export const DEFAULT_FEATURED_SLUGS: string[] = [
  "monstera-deliciosa",
  "sansevieria-trifasciata",
  "lavandula-angustifolia",
  "nerium-oleander",
  "pelargonium-zonale",
  "aloe-vera",
  "olea-europaea",
  "trachelospermum-jasminoides",
];
