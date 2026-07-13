<template>
  <RouterView />
</template>

<style>
:root { --primary: #37624e; --primary-hover: #294c3b; --primary-focus: rgba(55, 98, 78, .2); --background-color: #f6f8f6; }
body { background: #f6f8f6; }
.cv-sidebar-content {
  font-size: 0.8rem !important;
}
.cv-sidebar-article {
  margin: 0.8rem 0 !important;
  padding-top: 0.8rem !important;
  padding-bottom: 0.2rem !important;
}
.cv-sidebar-header {
  margin-bottom: 1rem !important;
}
@page { size: A4; margin: 0; }
@media print {
  body, [data-layout] { background: white; }
  [data-layout] > .container:first-child, [data-workspace-navigation] { display: none !important; }
  [data-layout] > main.container { max-width: none; width: 100%; margin: 0; padding: 0; }
}
</style>
