const form = document.querySelector("#budget-form");
const descriptionInput = document.querySelector("#description");
const amountInput = document.querySelector("#amount");
const typeInput = document.querySelector("#type");
const entryList = document.querySelector("#entry-list");

const incomeTotal = document.querySelector("#income-total");
const expenseTotal = document.querySelector("#expense-total");
const balanceTotal = document.querySelector("#balance-total");

const entries = [];

const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0
});

function updateTotals() {
  const income = entries
    .filter((entry) => entry.type === "income")
    .reduce((total, entry) => total + entry.amount, 0);

  const expenses = entries
    .filter((entry) => entry.type === "expense")
    .reduce((total, entry) => total + entry.amount, 0);

  incomeTotal.textContent = naira.format(income);
  expenseTotal.textContent = naira.format(expenses);
  balanceTotal.textContent = naira.format(income - expenses);
}

function showEntries() {
  entryList.innerHTML = "";

  if (entries.length === 0) {
    entryList.innerHTML =
      '<li class="empty-message">Your income and expenses will appear here.</li>';
    return;
  }

  entries.forEach((entry) => {
    const item = document.createElement("li");
    const label = document.createElement("span");
    const amount = document.createElement("strong");

    label.textContent = `${entry.description} (${entry.type})`;
    amount.textContent = `${entry.type === "income" ? "+" : "−"}${naira.format(entry.amount)}`;
    amount.className =
      entry.type === "income" ? "income-amount" : "expense-amount";

    item.append(label, amount);
    entryList.append(item);
  });
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const description = descriptionInput.value.trim();
  const amount = Number(amountInput.value);
  const type = typeInput.value;

  if (!description || amount <= 0) {
    return;
  }

  entries.push({ description, amount, type });

  form.reset();
  showEntries();
  updateTotals();
});

showEntries();
updateTotals();