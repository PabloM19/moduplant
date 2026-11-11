import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  MockGreenDigitalAPI,
  applyChanges,
  entries,
  initialState,
  importPlants,
  isPublic,
  matchesQuery,
  publishFeatured,
  related,
  resolveField,
} from "../src/model.ts";
import type { Scenario } from "../src/model.ts";
import type { Garden, MasterPlant } from "../src/contracts.ts";

const read = (file: string) =>
  JSON.parse(
    readFileSync(new URL(`../src/${file}.json`, import.meta.url), "utf8"),
  );
const plants: MasterPlant[] = read("master-plants-demo").data;
const gardens: Garden[] = read("gardens-demo").gardens;
const changes: Scenario = read("master-changes-demo");
const fresh = () => initialState(gardens, "garden-turia");
const populated = () =>
  importPlants(fresh().gardens["garden-turia"], plants).garden;
const monstera = (garden = populated()) =>
  entries(garden).find((item) => item.master.slug === "monstera-deliciosa")!;

test("both catalogues start empty and the visitor is selected", () => {
  const state = fresh();
  assert.equal(state.role, "visitor");
  assert.equal(state.selectedGardenId, "garden-turia");
  assert.ok(
    Object.values(state.gardens).every(
      (garden) => !garden.connected && !garden.localPlants.length,
    ),
  );
});

test("imports 24 drafts and reimport preserves local identity, publication and photos", () => {
  const garden = populated();
  assert.equal(garden.localPlants.length, 24);
  assert.equal(entries(garden, true).length, 0);
  assert.ok(
    garden.localPlants.every(
      (plant) =>
        plant.postStatus === "draft" && plant.localId !== plant.masterTaxonId,
    ),
  );
  const featured = publishFeatured(garden);
  const { local } = monstera(featured);
  local.localImageUrl = "/demo-images/monstera-deliciosa-detail.svg";
  const repeated = importPlants(featured, plants);
  assert.equal(repeated.created, 0);
  assert.equal(repeated.existing, 24);
  assert.deepEqual(repeated.garden.localPlants, featured.localPlants);
});

test("only eight featured plants are published across six categories", () => {
  const featured = publishFeatured(populated());
  assert.equal(entries(featured, true).length, 8);
  assert.equal(
    new Set(entries(featured, true).map((item) => item.master.category)).size,
    6,
  );
  assert.equal(
    featured.localPlants.filter((plant) => plant.postStatus === "draft").length,
    16,
  );
});

test("draft, private and inactive entries never appear in public selectors or related plants", () => {
  const garden = publishFeatured(populated());
  const { local } = monstera(garden);
  local.active = false;
  assert.equal(isPublic(local), false);
  assert.ok(!entries(garden, true).some((item) => item.local === local));
  assert.ok(
    related(garden, entries(garden, true)[0]).every((item) =>
      isPublic(item.local),
    ),
  );
  assert.equal(
    isPublic({ ...local, active: true, postStatus: "private" }),
    false,
  );
});

test("a deliberate empty and a missing field resolve differently", () => {
  const { master, local } = monstera();
  assert.deepEqual(resolveField(master, local, "care.nonexistent"), {
    value: undefined,
    source: "missing",
  });
  local.overrides["care.watering"] = {
    kind: "empty",
    value: "",
    changedAt: "",
  };
  assert.deepEqual(resolveField(master, local, "care.watering"), {
    value: "",
    source: "local-empty",
  });
});

test("new master care updates inherited fields and preserves local text, image and state", () => {
  const garden = publishFeatured(populated());
  const { master, local } = monstera(garden);
  local.overrides["care.watering"] = {
    kind: "value",
    value: "Riego del Turia",
    changedAt: "",
  };
  local.localImageUrl = "/demo-images/monstera-deliciosa-detail.svg";
  const result = applyChanges(garden, changes);
  const updated = monstera(result.garden);
  assert.equal(updated.master.version, 2);
  assert.notEqual(updated.master.care.light, master.care.light);
  assert.equal(
    resolveField(updated.master, updated.local, "care.watering").value,
    "Riego del Turia",
  );
  assert.deepEqual(updated.local, local);
  assert.equal(
    result.rows.find(
      (row) => row.taxon === master.id && row.field === "care.watering",
    )?.local,
    "Riego del Turia",
  );
  assert.equal(applyChanges(result.garden, changes).garden, result.garden);
});

test("a deliberate empty survives sync and restoring it inherits the newest value", () => {
  const garden = populated();
  const { local } = monstera(garden);
  local.overrides["care.watering"] = {
    kind: "empty",
    value: "",
    changedAt: "",
  };
  const updated = monstera(applyChanges(garden, changes).garden);
  assert.equal(
    resolveField(updated.master, updated.local, "care.watering").value,
    "",
  );
  const restored = { ...updated.local, overrides: {} };
  assert.equal(
    resolveField(updated.master, restored, "care.watering").value,
    updated.master.care.watering,
  );
});

test("garden catalogues and designs are isolated and reset recovers the initial values", () => {
  const state = fresh();
  state.gardens["garden-turia"] = publishFeatured(
    importPlants(state.gardens["garden-turia"], plants).garden,
  );
  state.gardens["garden-turia"].metadata.theme.primary = "#000000";
  assert.equal(state.gardens["garden-norte"].localPlants.length, 0);
  assert.notEqual(
    state.gardens["garden-norte"].metadata.theme.primary,
    "#000000",
  );
  const reset = fresh();
  assert.equal(reset.gardens["garden-turia"].localPlants.length, 0);
  assert.notEqual(
    reset.gardens["garden-turia"].metadata.theme.primary,
    "#000000",
  );
});

test("the simulated API has three pages and exposes all 24 unique entries", async () => {
  const api = new MockGreenDigitalAPI(plants, changes);
  const signal = new AbortController().signal;
  const first = await api.list(null, signal, false);
  const second = await api.list(first.links.next, signal, false);
  const third = await api.list(second.links.next, signal, false);
  assert.deepEqual(
    [first.data.length, second.data.length, third.data.length],
    [8, 8, 8],
  );
  assert.equal(
    new Set(
      [...first.data, ...second.data, ...third.data].map((plant) => plant.id),
    ).size,
    24,
  );
  assert.equal(third.links.next, null);
});

test("a simulated outage rejects without changing the local workspace and an abort cancels", async () => {
  const api = new MockGreenDigitalAPI(plants, changes);
  const garden = publishFeatured(populated());
  const snapshot = structuredClone(garden);
  await assert.rejects(
    api.changes(new AbortController().signal, true),
    /no está disponible/,
  );
  assert.deepEqual(garden, snapshot);
  const controller = new AbortController();
  const pending = api.list(null, controller.signal, false);
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
});

test("search matches common and scientific names with or without accents", () => {
  const { master } = monstera();
  assert.ok(matchesQuery(master, "MÓNSTERA DELICIOSA"));
  assert.ok(!matchesQuery(master, "Lavanda"));
});
