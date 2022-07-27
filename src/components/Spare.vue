<script>
// const activeEmployerFilter = ref("");

// function filtered() {
//   if (activeEmployerFilter.value.length > 0) {
//     let employerFilter = props.listItems.filter((i) => {
//       // log the matches
//       console.log(
//         "match: ",
//         i.employer.toLowerCase() == activeEmployerFilter.value.toLowerCase()
//       );
//       //   filter the results
//       i.employer.toLowerCase() == activeEmployerFilter.value.toLowerCase();
//     });
//     // log the result of the filter
//     console.log(employerFilter);
//     filteredItems = employerFilter;
//     // filter the items with the search input
//     return filteredItems.filter(
//       (i) =>
//         i.item.toLowerCase().includes(searchInput.value) ||
//         i.role.toLowerCase().includes(searchInput.value) ||
//         i.employer.toLowerCase().includes(searchInput.value)
//     );
//   } else {
//     // filter the items with the search input
//     return filteredItems.filter(
//       (i) =>
//         i.item.toLowerCase().includes(searchInput.value) ||
//         i.role.toLowerCase().includes(searchInput.value) ||
//         i.employer.toLowerCase().includes(searchInput.value)
//     );
//   }
// }
// function employerSelected(employer) {
//   console.log("employer selected: ", employer);
// }
// function employers() {
//   let employerList = props.listItems.map((a) => a.employer);
//   return [...new Set(employerList)];
// }
</script>
<template>
  <div>
    <!-- CV
         <div v-for="(section, i) in cv">
    <h3>{{ i }}</h3>

    <ul v-if="i === 'work'" v-for="(item, index) in section[0]">
      <li>{{ index }}</li>
    </ul>
    <sub>{{ section }}</sub>
    <hr />
  </div> -->
  </div>
</template>
