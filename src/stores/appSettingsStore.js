import { defineStore } from "pinia";

export const useSettingStore = defineStore("settings", {
  state: () => ({
    showCreateItemModal: false,
    showListNotTable: true,
    showFilter: false,
  }),
  actions: {
    toggleView: (state) => {
      this.showListNotTable = !this.showListNotTable;
    },
  },
});
