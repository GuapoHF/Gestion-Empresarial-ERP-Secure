const approvalList = document.querySelector("#approval-list");
const approvalStatus = document.querySelector("#approval-status");

function setApprovalStatus(message, isError = false) {
  if (!approvalStatus) return;
  approvalStatus.textContent = message;
  approvalStatus.classList.toggle("approval-error", isError);
  approvalStatus.hidden = false;
}

function renderEmptyApprovals() {
  approvalList.innerHTML = '<div class="approval-empty">No hay solicitudes pendientes por autorizar.</div>';
}

function createApprovalRow(registration) {
  const row = document.createElement("article");
  row.className = "approval-row";
  row.innerHTML = `
    <div>
      <strong>${registration.firstName} ${registration.lastName}</strong>
      <span>${registration.email}</span>
    </div>
    <span>${registration.username}</span>
    <span class="status pending">Pendiente</span>
    <div class="approval-actions">
      <button type="button" class="approve-button" data-action="approve" data-id="${registration.id}">Aprobar</button>
      <button type="button" class="reject-button" data-action="reject" data-id="${registration.id}">Rechazar</button>
    </div>`;
  return row;
}

async function loadApprovals() {
  if (!approvalList) return;
  const registrations = await window.gestionUserDb.getPendingRegistrations();
  approvalList.innerHTML = "";

  if (!registrations.length) {
    renderEmptyApprovals();
    return;
  }

  registrations.forEach((registration) => approvalList.appendChild(createApprovalRow(registration)));
}

if (approvalList) {
  loadApprovals().catch((error) => setApprovalStatus(error.message, true));

  approvalList.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const currentUser = window.gestionUserDb.getCurrentUser();
    const action = button.dataset.action;
    const id = button.dataset.id;

    try {
      button.disabled = true;
      if (action === "approve") {
        await window.gestionUserDb.approveRegistration(id, currentUser?.username);
        setApprovalStatus("Cuenta aprobada correctamente.");
      } else {
        await window.gestionUserDb.rejectRegistration(id, currentUser?.username);
        setApprovalStatus("Solicitud rechazada correctamente.");
      }
      await loadApprovals();
    } catch (error) {
      button.disabled = false;
      setApprovalStatus(error.message, true);
    }
  });
}
