<template>
  <header id="public-site-header">
    <nav>
      <ul>
        <li>
          <a href="https://nicbenson.com.au">⬅ Back to NicBenson.com.au</a>
        </li>
      </ul>
    </nav>
    <hr />
  </header>
  <header id="print-header">
    <h2>Nicholas Benson CV</h2>
  </header>
</template>

<style>
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
</style>
