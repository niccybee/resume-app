<template>
  <header id="public-site-header" class="public-header">
    <nav aria-label="Public site navigation">
      <ul class="brand-list">
        <li><NuxtLink class="brand" to="/">CV / NB</NuxtLink></li>
      </ul>
      <ul class="public-links">
        <li><NuxtLink to="/login">Owner sign in</NuxtLink></li>
        <li><a href="https://nicbenson.com.au">NicBenson.com.au ↗</a></li>
      </ul>
    </nav>
  </header>
  <header id="print-header">
    <h2>Nicholas Benson CV</h2>
  </header>
</template>

<style>
.public-header { border-bottom: 2px solid var(--ink); padding: .85rem 0 .75rem; }
.public-header nav, .public-header ul { margin: 0; }
.public-header .brand { color: var(--ink); font-family: var(--font-label); font-size: .82rem; font-weight: 800; letter-spacing: .12em; text-decoration: none; }
.public-links a { color: var(--ink); font-family: var(--font-label); font-size: .72rem; letter-spacing: .04em; text-decoration: none; text-transform: uppercase; }
.public-links a:hover { color: var(--marker-dark); }
@media print { #public-site-header { display: none; } #print-header { display: block; } }
@media screen { #print-header { display: none; } }
@media (max-width: 560px) { .public-header nav { align-items: flex-start; } .public-links { align-items: flex-end; flex-direction: column; gap: .2rem; } }
</style>
