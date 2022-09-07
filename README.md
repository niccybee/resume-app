# Resume Builder

The beginnings of a resume builder project using Supabase, Vuejs, Pinia, Picocss.

The goal behind this project is to be able to quickly store and retrieve Cv line items, and add them to a [JSONResume Format](https://jsonresume.org) with a unique link to share when needed.

### Tasks:

[ ] Filter items through button inputs

- [ / ] Later: SearchBox refactor - (docs)[https://vuejs.org/guide/components/events.html#usage-with-v-model]
- [ ] Build Resume
  - [ / ] Add items to a json list, upload to supabase
  - [ ] Add details at the top of the resume
  - [ ] Create resume json file and upload to supabase
  - [ ] Show list of CV's - if authenticated
  - [ / ] Print styling for PDF
  - [ ] Show CV per email domain
    - [ / ] Switch between table and list view 
    - [ ] Add local storage for offline use 
    - [ / ] Create items 
    - [ / ] Toggle create item box, add multiple items without refresh

[ ] Add auth to only show create item and builder when logged in
[ ] Unifying CV components into singular sidebar with list/span option

# Initial Template:

## Vue 3 + Vite

This template should help get you started developing with Vue 3 in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

## PicoCSS

This project uses [Pico CSS](https://picocss.com/) for base styling.

### Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar)
