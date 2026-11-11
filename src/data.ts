import type { Garden, MasterPlant, ThemeConfig } from "./contracts.ts";
import {
  MockGreenDigitalAPI,
  importPlants,
  initialState,
  publishFeatured,
} from "./model.ts";
import master from "./master-plants-demo.json";
import changes from "./master-changes-demo.json";
import gardens from "./gardens-demo.json";

export const presets: Record<"natural" | "editorial", ThemeConfig> = {
  natural: {
    ...gardens.gardens[0].theme,
    primary: "#2e3514",
    accent: "#6d7939",
    page: "#ffffff",
    text: "#2e3514",
    font: "Instrument",
    radius: 3,
    shadow: false,
    gridColumnsDesktop: 3,
    showSafetySection: true,
    showTraits: true,
    showFaqs: true,
    chipStyle: "soft",
  },
  editorial: {
    ...gardens.gardens[1].theme,
    font: "Newsreader",
    radius: 6,
    gridColumnsDesktop: 3,
    showSafetySection: true,
    showTraits: true,
    showFaqs: true,
    chipStyle: "outline",
  },
};
export const gardenFixtures: Garden[] = gardens.gardens.map((garden) => ({
  ...garden,
  theme: presets[garden.themePreset === "editorial" ? "editorial" : "natural"],
}));
export const masterFixtures = master.data as MasterPlant[];
export const api = new MockGreenDigitalAPI(masterFixtures, changes);
export const freshState = () =>
  initialState(gardenFixtures, gardens.selected_initial_garden_id);
const sampleState = freshState();
export const sampleGarden = publishFeatured(
  importPlants(
    sampleState.gardens[sampleState.selectedGardenId],
    masterFixtures,
  ).garden,
);
export const demoPlant = masterFixtures[0];
export const asset = (url: string) =>
  url.startsWith("/") ? `${import.meta.env.BASE_URL}${url.slice(1)}` : url;
