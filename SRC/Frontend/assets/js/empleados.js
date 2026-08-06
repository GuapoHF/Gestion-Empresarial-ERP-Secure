const employeeSearch = document.querySelector("#employee-search");
const employeeRows = [...document.querySelectorAll(".employee-row:not(.head)")];

employeeSearch.addEventListener("input", () => {
  const term = employeeSearch.value.trim().toLowerCase();
  employeeRows.forEach((row) => {
    row.hidden = !row.textContent.toLowerCase().includes(term);
  });
});
