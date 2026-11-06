const form = document.querySelector("#budget-form");
const descriptionInput = document.querySelector("#description");
const amountInput = document.querySelector("#amount");
const typeInput = document.querySelector("#type");
const entryList = document.querySelector("#entry-list");
const incomeTotal = document.querySelector("#income-total");
const expenseTotal = document.querySelector("#expense-total");
const balanceTotal = document.querySelector("#balance-total");
const monthLabel = document.querySelector("#month-label");
const storageNote = document.querySelector(".storage-note");
const storageKey = "aisosa-budget-tracker-v1";
const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0
});
const monthFormatter = new Intl.DateTimeFormat("en-NG", {
  month: "long",
  year: "numeric"
});

function localMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function loadSavedEntries() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || "{}");
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) return {};
    return Object.fromEntries(Object.entries(stored).map(([month, items]) => [
      month,
      Array.isArray(items) ? items.filter((item) =>
        item && typeof item.id === "string" &&
        typeof item.description === "string" &&
        Number.isFinite(Number(item.amount)) && Number(item.amount) > 0 &&
        (item.type === "income" || item.type === "expense")
      ) : []
    ]));
  } catch {
    return {};
  }
}

const savedEntries = loadSavedEntries();
let selectedMonth = localMonthKey();

function entriesForMonth() {
  return savedEntries[selectedMonth] || [];
}

function saveEntries() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(savedEntries));
    storageNote.innerHTML = '<span aria-hidden="true">✓</span> Saved on this device';
    return true;
  } catch {
    storageNote.textContent = "Could not save in this browser. Check your browser storage settings.";
    return false;
  }
}

function updateTotals() {
  const entries = entriesForMonth();
  const income = entries
    .filter((entry) => entry.type === "income")
    .reduce((total, entry) => total + Number(entry.amount), 0);
  const expenses = entries
    .filter((entry) => entry.type === "expense")
    .reduce((total, entry) => total + Number(entry.amount), 0);

  incomeTotal.textContent = naira.format(income);
  expenseTotal.textContent = naira.format(expenses);
  balanceTotal.textContent = naira.format(income - expenses);
}

function showEntries() {
  const entries = entriesForMonth();
  entryList.replaceChildren();

  if (entries.length === 0) {
    const emptyMessage = document.createElement("li");
    emptyMessage.className = "empty-message";
    emptyMessage.textContent = "Your income and expenses will appear here.";
    entryList.append(emptyMessage);
    return;
  }

  [...entries].reverse().forEach((entry) => {
    const item = document.createElement("li");
    const description = document.createElement("span");
    const meta = document.createElement("span");
    const actions = document.createElement("span");
    const amount = document.createElement("strong");
    const deleteButton = document.createElement("button");

    description.className = "entry-description";
    description.textContent = entry.description;
    meta.className = "entry-meta";
    meta.textContent = entry.type;
    description.append(meta);

    actions.className = "entry-actions";
    amount.textContent = `${entry.type === "income" ? "+" : "−"}${naira.format(Number(entry.amount))}`;
    amount.className = entry.type === "income" ? "income-amount" : "expense-amount";
    deleteButton.className = "delete-button";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.setAttribute("aria-label", `Delete ${entry.description}`);
    deleteButton.addEventListener("click", () => {
      savedEntries[selectedMonth] = entriesForMonth().filter((saved) => saved.id !== entry.id);
      saveEntries();
      renderMonth();
    });

    actions.append(amount, deleteButton);
    item.append(description, actions);
    entryList.append(item);
  });
}

function renderMonth() {
  const [year, month] = selectedMonth.split("-").map(Number);
  monthLabel.textContent = monthFormatter.format(new Date(year, month - 1, 1));
  showEntries();
  updateTotals();
}

function moveMonth(offset) {
  const [year, month] = selectedMonth.split("-").map(Number);
  const nextDate = new Date(year, month - 1 + offset, 1);
  selectedMonth = localMonthKey(nextDate);
  renderMonth();
}

document.querySelector("#previous-month").addEventListener("click", () => moveMonth(-1));
document.querySelector("#next-month").addEventListener("click", () => moveMonth(1));

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const description = descriptionInput.value.trim();
  const amount = Number(amountInput.value);
  const type = typeInput.value;

  if (!description || !Number.isFinite(amount) || amount <= 0) return;

  if (!savedEntries[selectedMonth]) savedEntries[selectedMonth] = [];
  savedEntries[selectedMonth].push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    description,
    amount,
    type
  });

  saveEntries();
  form.reset();
  renderMonth();
  descriptionInput.focus();
});

renderMonth();
