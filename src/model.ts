import { DEFAULT_FEATURED_SLUGS } from "./contracts.ts";
import type {
  DemoState,
  Garden,
  GardenState,
  LocalPlant,
  MasterPlant,
  MockListResponse,
  ResolvedField,
  ThemeConfig,
} from "./contracts.ts";

export interface ChangeRow {
  taxon: string;
  plant: string;
  field: string;
  before?: string;
  after: string;
  local?: string;
}
export interface Activity {
  date: string;
  title: string;
  detail: string;
  kind: "success" | "error" | "info";
}
export interface Workspace extends GardenState {
  activity: Activity[];
  comparison: ChangeRow[];
}
export interface State extends Omit<DemoState, "gardens" | "demoGuideStep"> {
  gardens: Record<string, Workspace>;
}
export interface Scenario {
  scenario_id: string;
  updated_master_plants: {
    taxon_id: string;
    version: number;
    patch: Partial<Record<string, string>>;
  }[];
}

export function initialState(
  gardens: Garden[],
  selectedGardenId: string,
): State {
  return {
    schemaVersion: 1,
    role: "visitor",
    selectedGardenId,
    simulatingApiFailure: false,
    gardens: Object.fromEntries(
      gardens.map((metadata) => [
        metadata.id,
        {
          metadata: structuredClone(metadata),
          connected: false,
          localPlants: [],
          masterSnapshots: {},
          syncAppliedScenarios: [],
          activity: [],
          comparison: [],
        },
      ]),
    ),
  };
}

export class MockGreenDigitalAPI {
  private readonly pageSize = 8;

  private readonly plants: MasterPlant[];
  private readonly scenario: Scenario;

  constructor(plants: MasterPlant[], scenario: Scenario) {
    this.plants = plants;
    this.scenario = scenario;
  }

  async list(
    cursor: string | null,
    signal: AbortSignal,
    failing: boolean,
  ): Promise<MockListResponse> {
    await this.delay(680, signal);
    if (failing) throw new Error("La biblioteca simulada no está disponible.");
    const offset = Number(cursor ?? 0);
    const next = offset + this.pageSize;
    return {
      data: this.plants.slice(offset, next),
      meta: { contract_version: "1", per_page: this.pageSize },
      links: {
        next: next < this.plants.length ? String(next) : null,
        previous: offset ? String(offset - this.pageSize) : null,
      },
    };
  }

  async changes(signal: AbortSignal, failing: boolean): Promise<Scenario> {
    await this.delay(580, signal);
    if (failing)
      throw new Error(
        "La biblioteca simulada no está disponible. Tu catálogo sigue operativo.",
      );
    return this.scenario;
  }

  private delay(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(signal.reason);
        return;
      }
      const cancel = () => {
        clearTimeout(timer);
        reject(signal.reason);
      };
      const timer = setTimeout(() => {
        signal.removeEventListener("abort", cancel);
        resolve();
      }, ms);
      signal.addEventListener("abort", cancel, { once: true });
    });
  }
}

export function logActivity(
  garden: Workspace,
  title: string,
  detail: string,
  kind: Activity["kind"],
): Workspace {
  return {
    ...garden,
    activity: [
      { date: new Date().toISOString(), title, detail, kind },
      ...garden.activity,
    ].slice(0, 20),
  };
}

export function importPlants(
  garden: Workspace,
  plants: MasterPlant[],
): { garden: Workspace; created: number; existing: number } {
  const localPlants = [...garden.localPlants];
  const snapshots = { ...garden.masterSnapshots };
  let created = 0;
  let existing = 0;
  const now = new Date().toISOString();
  for (const plant of plants) {
    if (snapshots[plant.id]) {
      existing++;
      if (plant.version > snapshots[plant.id].version)
        snapshots[plant.id] = plant;
      continue;
    }
    snapshots[plant.id] = plant;
    localPlants.push({
      localId: `${garden.metadata.id}-${plant.id}`,
      gardenId: garden.metadata.id,
      masterTaxonId: plant.id,
      postStatus: "draft",
      active: true,
      overrides: {},
      cta: { label: "Consultar esta planta", target: "contact" },
      syncStatus: "current",
      createdAt: now,
    });
    created++;
  }
  const imported = {
    ...garden,
    localPlants,
    masterSnapshots: snapshots,
    connected: true,
    lastSyncedAt: now,
  };
  return {
    garden: logActivity(
      imported,
      "Importación completada",
      `${created} nuevas · ${existing} ya existentes`,
      "success",
    ),
    created,
    existing,
  };
}

export function isAdapted(plant: LocalPlant) {
  return Boolean(
    plant.localImageUrl ||
      Object.keys(plant.overrides).length ||
      plant.cta.label !== "Consultar esta planta",
  );
}

export function isPublic(plant: LocalPlant) {
  return plant.postStatus === "publish" && plant.active;
}

export function publishFeatured(garden: Workspace): Workspace {
  const localPlants = garden.localPlants.map((plant) =>
    DEFAULT_FEATURED_SLUGS.includes(
      garden.masterSnapshots[plant.masterTaxonId].slug,
    )
      ? { ...plant, postStatus: "publish" as const, active: true }
      : plant,
  );
  return logActivity(
    { ...garden, localPlants },
    "Colección de demostración publicada",
    "8 fichas de muestra activas",
    "success",
  );
}

export const fields = {
  introduction: "Introducción",
  description: "Descripción",
  "care.light": "Luz",
  "care.watering": "Riego",
} as const;
export type EditableField = keyof typeof fields;

export function masterField(
  master: MasterPlant,
  field: string,
): string | undefined {
  if (field.startsWith("care.")) return master.care[field.slice(5)];
  if (field === "introduction" || field === "description") return master[field];
  return undefined;
}

export function resolveField(
  master: MasterPlant,
  plant: LocalPlant,
  field: string,
): ResolvedField<string> {
  if (Object.hasOwn(plant.overrides, field)) {
    const override = plant.overrides[field];
    return override.kind === "empty"
      ? { value: "", source: "local-empty" }
      : { value: String(override.value ?? ""), source: "local" };
  }
  const value = masterField(master, field);
  return { value, source: value == null ? "missing" : "master" };
}

export function applyChanges(
  garden: Workspace,
  scenario: Scenario,
): { garden: Workspace; rows: ChangeRow[] } {
  if (garden.syncAppliedScenarios.includes(scenario.scenario_id))
    return { garden, rows: [] };
  const snapshots = { ...garden.masterSnapshots };
  const rows: ChangeRow[] = [];
  for (const change of scenario.updated_master_plants) {
    const previous = snapshots[change.taxon_id];
    const local = garden.localPlants.find(
      (plant) => plant.masterTaxonId === change.taxon_id,
    );
    if (!previous || !local || previous.version >= change.version) continue;
    const next = {
      ...previous,
      care: { ...previous.care },
      version: change.version,
    };
    for (const [field, after] of Object.entries(change.patch)) {
      if (after === undefined) continue;
      const value = resolveField(previous, local, field);
      const before = masterField(previous, field);
      if (before === after) continue;
      rows.push({
        taxon: change.taxon_id,
        plant: previous.common_name,
        field,
        before,
        after,
        ...(value.source === "local" || value.source === "local-empty"
          ? { local: value.value }
          : {}),
      });
      if (field.startsWith("care.")) next.care[field.slice(5)] = after;
      else if (field === "introduction" || field === "description")
        next[field] = after;
    }
    snapshots[change.taxon_id] = next;
  }
  const updated = {
    ...garden,
    masterSnapshots: snapshots,
    comparison: rows,
    syncAppliedScenarios: [
      ...garden.syncAppliedScenarios,
      scenario.scenario_id,
    ],
    lastSyncedAt: new Date().toISOString(),
  };
  return {
    garden: logActivity(
      updated,
      "Novedades procesadas",
      `${rows.length} campos comparados · ${rows.filter((row) => Object.hasOwn(row, "local")).length} adaptaciones conservadas`,
      "success",
    ),
    rows,
  };
}

export type PlantEntry = { local: LocalPlant; master: MasterPlant };
export function entries(garden: Workspace, publicOnly = false): PlantEntry[] {
  return garden.localPlants
    .filter((plant) => !publicOnly || isPublic(plant))
    .map((local) => ({
      local,
      master: garden.masterSnapshots[local.masterTaxonId],
    }))
    .filter((entry) => entry.master)
    .sort((a, b) =>
      a.master.common_name.localeCompare(b.master.common_name, "es"),
    );
}

export function related(garden: Workspace, current: PlantEntry): PlantEntry[] {
  const others = entries(garden, true).filter(
    (entry) => entry.local.localId !== current.local.localId,
  );
  return others
    .sort(
      (a, b) =>
        Number(b.master.category === current.master.category) -
        Number(a.master.category === current.master.category),
    )
    .slice(0, 3);
}

export function normalize(value: string) {
  return value
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

export function matchesQuery(master: MasterPlant, query: string) {
  return normalize(
    [
      master.common_name,
      master.scientific_name,
      ...(master.synonyms ?? []),
    ].join(" "),
  ).includes(normalize(query));
}

export function heroTheme(theme: ThemeConfig) {
  const channels = (
    theme.primary.match(/[0-9a-f]{2}/gi) ?? ["2e", "35", "14"]
  ).map((n) => parseInt(n, 16) / 255);
  const luminance = channels.reduce(
    (sum, value, i) =>
      sum +
      [0.2126, 0.7152, 0.0722][i] *
        (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4),
    0,
  );
  return luminance > 0.179 ? "#111" : "#fff";
}
