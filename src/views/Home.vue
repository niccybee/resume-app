<template>
  <section class="home-hero">
    <p class="eyebrow">Resume studio</p>
    <h1>One career story.<br />A sharper CV for every role.</h1>
    <p class="lede">Build a reusable library of career evidence, compose focused CVs from exact block versions, and share only the documents you choose to publish.</p>
    <div class="actions">
      <RouterLink role="button" to="/app/cvs">Open workspace</RouterLink>
      <RouterLink class="secondary" role="button" to="/login">Owner sign in</RouterLink>
    </div>
  </section>
  <section class="feature-grid">
    <article><strong>Versioned blocks</strong><p>Keep company achievements and sidebar content reusable without losing earlier wording.</p></article>
    <article><strong>Role-specific CVs</strong><p>Pin exact versions into each draft, reorder them, and preview before anything becomes public.</p></article>
    <article><strong>Unlisted sharing</strong><p>Publish to a deliberate link, choose a theme, print cleanly, and withdraw access at any time.</p></article>
  </section>
</template>

<style scoped>.home-hero { padding: 10vh 0 8vh; max-width: 62rem; } .eyebrow { color: #37624e; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; } h1 { font-size: clamp(3rem, 8vw, 6.8rem); line-height: .88; letter-spacing: -.065em; } .lede { max-width: 46rem; font-size: 1.25rem; line-height: 1.6; } .actions { display: flex; gap: 1rem; flex-wrap: wrap; margin-top: 2rem; } .feature-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; } .feature-grid article { border: 1px solid #dce3df; box-shadow: none; } @media(max-width: 700px){.feature-grid{grid-template-columns:1fr}}</style>
