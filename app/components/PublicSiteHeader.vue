<template>
  <UHeader id="public-site-header" class="public-header" :toggle="false">
    <template #title>
      <span class="public-brand">
        <span>CV / NB</span>
        <small>Resume Studio</small>
      </span>
    </template>

    <template #right>
      <UButton
        class="nuxt-ui-button"
        to="/login"
        label="Owner sign in"
        color="neutral"
        variant="link"
      />
      <UButton
        class="nuxt-ui-button external-link"
        to="https://nicbenson.com.au"
        target="_blank"
        label="NicBenson.com.au"
        trailing-icon="i-lucide-arrow-up-right"
        color="neutral"
        variant="link"
      />
    </template>
  </UHeader>

  <header id="print-header">
    <h2>Nicholas Benson CV</h2>
  </header>
</template>

<style scoped>
.public-header {
  border-bottom: 2px solid var(--ink);
  background: rgb(243 236 223 / 94%);
  backdrop-filter: blur(8px);
}

.public-brand {
  display: flex;
  align-items: baseline;
  gap: 0.7rem;
  color: var(--ink);
  font-family: var(--font-label);
  font-size: 0.82rem;
  font-weight: 900;
  letter-spacing: 0.12em;
}

.public-brand small {
  color: var(--muted);
  font-size: 0.58rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

@media print {
  #public-site-header {
    display: none;
  }

  #print-header {
    display: block;
  }
}

@media screen {
  #print-header {
    display: none;
  }
}

@media (max-width: 560px) {
  .external-link {
    display: none;
  }

  .public-brand small {
    display: none;
  }
}
</style>
