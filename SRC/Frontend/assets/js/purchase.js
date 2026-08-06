const form = document.querySelector("#purchase-form");
const productIdInput = document.querySelector("#productId");
const descriptionInput = document.querySelector("#description");
const exchangeRateInput = document.querySelector("#exchangeRate");
const totalCostInput = document.querySelector("#totalCost");
const totalPriceInput = document.querySelector("#totalPrice");
const profitResult = document.querySelector("#profitResult");
const profitPercentResult = document.querySelector("#profitPercentResult");
const marginResult = document.querySelector("#marginResult");

const inventoryItems = {
  "TELA-00142": {
    description: "Manta cruda 1.50 m",
    cost: 12750,
    price: 18500,
  },
  "TELA-00098": {
    description: "Lino premium azul marino",
    cost: 9360,
    price: 13200,
  },
  "TELA-00215": {
    description: "Popelina estampada floral",
    cost: 4140,
    price: 5580,
  },
};

function currency(value) {
  return `L ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function updateResults() {
  const cost = Number(totalCostInput.value || 0);
  const price = Number(totalPriceInput.value || 0);
  const profit = price - cost;
  const profitPercent = cost > 0 ? (profit / cost) * 100 : 0;
  const margin = price > 0 ? (profit / price) * 100 : 0;

  if (!cost && !price) {
    profitResult.textContent = "-";
    profitPercentResult.textContent = "-";
    marginResult.textContent = "-";
    return;
  }

  profitResult.textContent = currency(profit);
  profitPercentResult.textContent = `${profitPercent.toFixed(2)}%`;
  marginResult.textContent = `${margin.toFixed(2)}%`;
}

const params = new URLSearchParams(window.location.search);
const selectedId = params.get("id");
if (selectedId && inventoryItems[selectedId]) {
  const item = inventoryItems[selectedId];
  productIdInput.value = selectedId;
  descriptionInput.value = item.description;
  totalCostInput.value = item.cost.toFixed(2);
  totalPriceInput.value = item.price.toFixed(2);
}

[exchangeRateInput, totalCostInput, totalPriceInput].forEach((input) => {
  input.addEventListener("input", updateResults);
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  window.location.href = "./inventario.html";
});

updateResults();
