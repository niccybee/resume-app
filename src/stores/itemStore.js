import { defineStore } from "pinia";
import { blockLibrary } from "../services/blockLibrary";
import { createEmploymentContext, formatEmploymentPeriod, normalizeEmploymentGroup } from "../domain/employment/occasion";

function toLegacyItem(block) {
  const context = block.contexts.find(
    (candidate) => candidate.type === "employment",
  );

  const employment = normalizeEmploymentGroup(context?.metadata);
  return {
    id: block.id,
    employer: employment.employer,
    role: employment.role,
    occasionId: employment.occasionId,
    startDate: employment.startDate,
    endDate: employment.endDate,
    period: formatEmploymentPeriod(employment.startDate, employment.endDate),
    item: block.currentVersion?.content?.text || "",
    created: block.currentVersion?.createdAt || block.createdAt,
    block,
  };
}

export const useItemsStore = defineStore("items", {
  state: () => ({
    searchInput: "",
    itemsLoading: false,
    itemsError: null,
    addedItems: [],
    items: [],
  }),

  getters: {
    headers: () => ["employer", "role", "period", "item", "created"],
    employers: (state) => [
      ...new Set(state.items.map((item) => item.employer)),
    ],
    roles: (state) => [...new Set(state.items.map((item) => item.role))],
    searchItems(state) {
      const search = state.searchInput.trim().toLowerCase();
      if (!search) return state.items;
      return state.items.filter((item) =>
        [item.item, item.role, item.employer, item.period].some((value) =>
          value.toLowerCase().includes(search),
        ),
      );
    },
    itemListLength: (state) => state.items.length,
  },

  actions: {
    async getItems() {
      this.itemsLoading = true;
      this.itemsError = null;
      try {
        const catalog = await blockLibrary.browse({ kind: "experience" });
        this.items = catalog.blocks.map(toLegacyItem);
      } catch (error) {
        this.itemsError = error.message;
        this.items = [];
      } finally {
        this.itemsLoading = false;
      }
    },

    async createExperienceBlock({ employer, role, startDate, endDate, text }) {
      if (!employer?.trim() || !role?.trim() || !startDate?.trim() || !text?.trim()) {
        throw new Error("Employer, role, start period, and block text are required.");
      }
      const context = createEmploymentContext({ employer, role, startDate, endDate: endDate || "present" });
      await blockLibrary.saveVersion({
        kind: "experience",
        title: `${role} at ${employer}`,
        content: { text },
        context,
      });
      await this.getItems();
    },

    addItemToBuilder(item) {
      if (!this.addedItems.some((candidate) => candidate.id === item.id)) {
        this.addedItems.push(item);
      }
    },
  },
});
