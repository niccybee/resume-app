<template>
  <div data-layout="public-site">
    <PublicSiteHeader />
    <UMain>
      <UContainer class="public-container">
        <slot />
      </UContainer>
    </UMain>
  </div>
</template>

<style scoped>
.public-container {
  min-height: calc(100vh - var(--ui-header-height));
}

@media print {
  .public-container {
    width: 100%;
    max-width: none;
    padding: 0;
  }
}
</style>
