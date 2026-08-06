const employeeForm = document.querySelector("#employee-form");

employeeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  window.location.href = "./empleados.html";
});
