import { defineStore } from "pinia";
import { supabase } from "../supabase";

export const useItemsStore = defineStore("items", {
  state: () => {
    return {
      searchInput: "",
      itemsLoading: false,
      addedItems: [],
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
  },
  actions: {
    async getItems() {
      const { data, error } = await supabase.from("CV_Items").select();
      if (error) throw error;
      this.items = data;
    },
    addItemToBuilder(i) {
      this.addedItems.push(i);
    },
  },
});
