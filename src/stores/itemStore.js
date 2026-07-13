import { defineStore } from "pinia";
import { blockLibrary } from "../services/blockLibrary";

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function toLegacyItem(block) {
  const context = block.contexts.find(
    (candidate) => candidate.type === "employment",
  );

  return {
    id: block.id,
    employer: context?.metadata?.company || "Unassigned company",
    role: context?.metadata?.role || "Unassigned role",
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
    headers: () => ["employer", "role", "item", "created"],
    employers: (state) => [
      ...new Set(state.items.map((item) => item.employer)),
    ],
    roles: (state) => [...new Set(state.items.map((item) => item.role))],
    searchItems(state) {
      const search = state.searchInput.trim().toLowerCase();
      if (!search) return state.items;
      return state.items.filter((item) =>
        [item.item, item.role, item.employer].some((value) =>
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

    async createExperienceBlock({ employer, role, text }) {
      if (!employer?.trim() || !role?.trim() || !text?.trim()) {
        throw new Error("Employer, role, and block text are required.");
      }
      const companyId = slugify(employer);
      const roleId = slugify(role);
      await blockLibrary.saveVersion({
        kind: "experience",
        title: `${role} at ${employer}`,
        content: { text },
        context: {
          type: "employment",
          key: `${companyId}-${roleId}`,
          label: `${employer} · ${role}`,
          metadata: {
            companyId,
            company: employer.trim(),
            roleId,
            role: role.trim(),
          },
        },
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
