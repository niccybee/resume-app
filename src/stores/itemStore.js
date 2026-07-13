import { defineStore } from "pinia";
import { supabase } from "../supabase";

export const useItemsStore = defineStore("items", {
  state: () => {
    return {
      searchInput: "",
      itemsLoading: false,
      itemsError: null,
      addedItems: [],
      // TODO add item types, to be able to add skills etc
      items: [
        {
          id: 1,
          employer: "loading...",
          role: "loading...",
          item: "loading...",
          created: "loading...",
        },
      ],
    };
  },
  getters: {
    headers: (state) => {
      return Object.keys(state.items[0]);
    },
    employers: (state) => {
      let employerList = state.items.map((a) => a.employer);
      return [...new Set(employerList)];
    },
    roles: (state) => {
      let employerList = state.items.map((a) => a.role);
      return [...new Set(employerList)];
    },
    searchItems(state) {
      let filteredItems = state.items;
      return filteredItems.filter(
        (i) =>
          i.item.toLowerCase().includes(state.searchInput) ||
          i.role.toLowerCase().includes(state.searchInput) ||
          i.employer.toLowerCase().includes(state.searchInput)
      );
    },
    itemListLength: (state) => state.items.length,
  },
  actions: {
    async getItems() {
      this.itemsLoading = true;
      this.itemsError = null;
      try {
        const { data, error } = await supabase.from("CV_Items").select();
        if (error) throw error;
        this.items = data;
      } catch (error) {
        this.items = [];
        this.itemsError = error.message || "Unable to load reusable blocks.";
      } finally {
        this.itemsLoading = false;
      }
    },
    addItemToBuilder(i) {
      this.addedItems.push(i);
    },
  },
});
