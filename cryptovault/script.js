import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Supabase provides account sign-in. Wallet actions below are demo-only.
const SUPABASE_URL = "https://qzboyriqqfpgsuewvqmf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_UKY0WOadC6t-0-5Edz_zRZg__sfzyJ6v";
const configured = SUPABASE_URL.startsWith("https://") && SUPABASE_PUBLISHABLE_KEY.length > 0;
const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY) : null;

const assets = [
  { symbol: "BTC", name: "Bitcoin", icon: "₿", price: 67500, className: "bitcoin", initial: 0.12 },
  { symbol: "ETH", name: "Ethereum", icon: "Ξ", price: 2400, className: "ethereum", initial: 1.5 },
  { symbol: "SOL", name: "Solana", icon: "◎", price: 150, className: "solana", initial: 5 }
];
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const quantityFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 });
const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

const authView = document.getElementById("auth-view");
const walletView = document.getElementById("wallet-view");
const authForm = document.getElementById("auth-form");
const authTitle = document.getElementById("auth-title");
const authMessage = document.getElementById("auth-message");
const submitButton = document.getElementById("submit-btn");
const loginTab = document.getElementById("login-tab");
const signupTab = document.getElementById("signup-tab");
const logoutButton = document.getElementById("logout-btn");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const userEmail = document.getElementById("user-email");
const sidebarEmail = document.getElementById("sidebar-email");
const portfolioValue = document.getElementById("portfolio-value");
const cashValue = document.getElementById("cash-value");
const assetCount = document.getElementById("asset-count");
const activityCount = document.getElementById("activity-count");
const assetList = document.getElementById("asset-list");
const activityList = document.getElementById("activity-list");
const transactionDialog = document.getElementById("transaction-dialog");
const transactionForm = document.getElementById("transaction-form");
const dialogTitle = document.getElementById("dialog-title");
const dialogDescription = document.getElementById("dialog-description");
const transactionAsset = document.getElementById("transaction-asset");
const amountLabel = document.getElementById("amount-label");
const amountPrefix = document.getElementById("amount-prefix");
const transactionAmount = document.getElementById("transaction-amount");
const recipientWrap = document.getElementById("recipient-wrap");
const recipientInput = document.getElementById("recipient");
const transactionHint = document.getElementById("transaction-hint");
const transactionError = document.getElementById("transaction-error");
const confirmTransaction = document.getElementById("confirm-transaction");
const walletMessage = document.getElementById("wallet-message");

let mode = "login";
let busy = false;
let activeUserId = null;
let walletState = null;
let actionMode = "buy";

function defaultWallet() {
  return {
    cash: 2500,
    holdings: Object.fromEntries(assets.map((asset) => [asset.symbol, asset.initial])),
    transactions: []
  };
}

function walletStorageKey(userId) {
  return `cryptovault-demo-wallet-v1-${userId}`;
}

function loadWallet(userId) {
  const fallback = defaultWallet();
  try {
    const saved = JSON.parse(localStorage.getItem(walletStorageKey(userId)) || "null");
    if (!saved || typeof saved !== "object") return fallback;
    const holdings = Object.fromEntries(assets.map((asset) => {
      const value = Number(saved.holdings?.[asset.symbol]);
      return [asset.symbol, Number.isFinite(value) && value >= 0 ? value : asset.initial];
    }));
    const transactions = Array.isArray(saved.transactions) ? saved.transactions.filter((tx) =>
      tx && typeof tx.id === "string" && typeof tx.type === "string" &&
      assets.some((asset) => asset.symbol === tx.symbol) &&
      Number.isFinite(Number(tx.quantity)) && Number.isFinite(Number(tx.usdValue))
    ) : [];
    const cash = Number(saved.cash);
    return { cash: Number.isFinite(cash) && cash >= 0 ? cash : fallback.cash, holdings, transactions };
  } catch {
    return fallback;
  }
}

function saveWallet() {
  try {
    localStorage.setItem(walletStorageKey(activeUserId), JSON.stringify(walletState));
    walletMessage.textContent = "Demo activity saved in this browser.";
    walletMessage.classList.remove("error");
    return true;
  } catch {
    walletMessage.textContent = "Could not save this demo activity in the browser.";
    walletMessage.classList.add("error");
    return false;
  }
}

function setMode(nextMode) {
  mode = nextMode;
  const isLogin = mode === "login";
  authTitle.textContent = isLogin ? "Welcome back" : "Create your account";
  submitButton.textContent = isLogin ? "Log in" : "Create account";
  passwordInput.autocomplete = isLogin ? "current-password" : "new-password";
  loginTab.classList.toggle("active", isLogin);
  signupTab.classList.toggle("active", !isLogin);
  loginTab.setAttribute("aria-pressed", String(isLogin));
  signupTab.setAttribute("aria-pressed", String(!isLogin));
  authMessage.textContent = "";
}

function showMessage(message, isError = false) {
  authMessage.textContent = message;
  authMessage.style.color = isError ? "#a34d42" : "#41634d";
}

function setBusy(value) {
  busy = value;
  submitButton.disabled = value;
  submitButton.textContent = value ? "Please wait..." : mode === "login" ? "Log in" : "Create account";
}

function showDashboard(session) {
  if (!session?.user) return showLogin();
  const email = session.user.email || "Account";
  userEmail.textContent = email;
  sidebarEmail.textContent = email;
  if (activeUserId !== session.user.id) {
    activeUserId = session.user.id;
    walletState = loadWallet(activeUserId);
  }
  authView.hidden = true;
  walletView.hidden = false;
  renderWallet();
}

function showLogin() {
  walletView.hidden = true;
  authView.hidden = false;
  setBusy(false);
}

function formatQuantity(amount, symbol) {
  return `${quantityFormat.format(amount)} ${symbol}`;
}

function renderAssets() {
  assetList.replaceChildren();
  assets.forEach((asset) => {
    const quantity = walletState.holdings[asset.symbol] || 0;
    const row = document.createElement("article");
    row.className = "asset-row";
    const name = document.createElement("div");
    name.className = "asset-name";
    const icon = document.createElement("span");
    icon.className = `coin ${asset.className}`;
    icon.textContent = asset.icon;
    const label = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = asset.name;
    const symbol = document.createElement("span");
    symbol.textContent = asset.symbol;
    label.append(title, symbol);
    name.append(icon, label);
    const quantityCell = document.createElement("span");
    quantityCell.className = "quantity";
    quantityCell.textContent = formatQuantity(quantity, asset.symbol);
    const price = document.createElement("span");
    price.className = "asset-price";
    price.textContent = usd.format(asset.price);
    const value = document.createElement("strong");
    value.className = "asset-value";
    value.textContent = usd.format(quantity * asset.price);
    row.append(name, quantityCell, price, value);
    assetList.append(row);
  });
}

function renderActivity() {
  activityList.replaceChildren();
  const transactions = walletState.transactions;
  activityCount.textContent = String(transactions.length);
  if (!transactions.length) {
    const empty = document.createElement("p");
    empty.className = "empty-activity";
    empty.textContent = "No activity yet. Try a simulated buy, sell, or send to create your first demo receipt.";
    activityList.append(empty);
    return;
  }

  [...transactions].reverse().forEach((tx) => {
    const asset = assets.find((item) => item.symbol === tx.symbol);
    const row = document.createElement("article");
    row.className = "activity-row";
    const icon = document.createElement("span");
    icon.className = `activity-icon ${tx.type}`;
    icon.textContent = tx.type === "buy" ? "＋" : tx.type === "sell" ? "↗" : "➤";
    const details = document.createElement("div");
    details.className = "activity-description";
    const title = document.createElement("strong");
    title.textContent = tx.type === "send" ? `Demo send · ${asset.name}` : `${tx.type === "buy" ? "Bought" : "Sold"} ${asset.name}`;
    const note = document.createElement("span");
    const recipientText = tx.type === "send" ? ` · To ${tx.recipient}` : "";
    note.textContent = `${dateFormat.format(new Date(tx.createdAt))} · ${tx.id}${recipientText} · Demo only`;
    details.append(title, note);
    const value = document.createElement("strong");
    value.className = "activity-amount";
    value.textContent = `${tx.type === "sell" ? "+" : "−"}${usd.format(tx.usdValue)}`;
    const quantity = document.createElement("small");
    quantity.textContent = formatQuantity(tx.quantity, tx.symbol);
    value.append(quantity);
    row.append(icon, details, value);
    activityList.append(row);
  });
}

function renderWallet() {
  if (!walletState) return;
  const holdingsValue = assets.reduce((sum, asset) => sum + (walletState.holdings[asset.symbol] || 0) * asset.price, 0);
  portfolioValue.textContent = usd.format(walletState.cash + holdingsValue);
  cashValue.textContent = usd.format(walletState.cash);
  assetCount.textContent = String(assets.filter((asset) => walletState.holdings[asset.symbol] > 0).length);
  renderAssets();
  renderActivity();
}

function populateAssetChoices() {
  transactionAsset.replaceChildren();
  assets.forEach((asset) => {
    const option = document.createElement("option");
    option.value = asset.symbol;
    option.textContent = `${asset.name} (${asset.symbol})`;
    transactionAsset.append(option);
  });
}

function openAction(nextAction) {
  actionMode = nextAction;
  const config = {
    buy: { title: "Buy crypto", description: "Use your demo cash to add a sample asset to this portfolio.", label: "Amount in USD", prefix: "$", button: "Confirm demo buy", hint: "The amount will be converted using the fixed sample price." },
    sell: { title: "Sell crypto", description: "Sell part of a sample holding and return demo cash to your wallet.", label: "Amount in USD", prefix: "$", button: "Confirm demo sell", hint: "You can sell up to the current sample value of your holding." },
    send: { title: "Send crypto", description: "Record a simulated transfer to a demo recipient. No address or blockchain transfer is used.", label: "Quantity to send", prefix: "", button: "Record demo send", hint: "The sample asset balance will decrease; no crypto leaves this demo." }
  }[actionMode];
  dialogTitle.textContent = config.title;
  dialogDescription.textContent = config.description;
  amountLabel.textContent = config.label;
  amountPrefix.textContent = config.prefix;
  confirmTransaction.textContent = config.button;
  transactionHint.textContent = config.hint;
  transactionAmount.value = "";
  transactionError.textContent = "";
  recipientInput.value = "";
  recipientWrap.hidden = actionMode !== "send";
  recipientInput.required = actionMode === "send";
  transactionAmount.step = actionMode === "send" ? "any" : "0.01";
  transactionAmount.min = actionMode === "send" ? "0.00000001" : "0.01";
  transactionAmount.placeholder = actionMode === "send" ? "0.00000000" : "0.00";
  populateAssetChoices();
  transactionDialog.showModal();
}

function createReceiptId() {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 12);
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `CV-DEMO-${stamp}-${suffix}`;
}

function recordTransaction(event) {
  event.preventDefault();
  transactionError.textContent = "";
  const asset = assets.find((item) => item.symbol === transactionAsset.value);
  const inputAmount = Number(transactionAmount.value);
  const recipient = recipientInput.value.trim();
  if (!asset || !Number.isFinite(inputAmount) || inputAmount <= 0) {
    transactionError.textContent = "Enter an amount greater than zero.";
    return;
  }

  let quantity;
  let usdValue;
  if (actionMode === "send") {
    quantity = inputAmount;
    usdValue = quantity * asset.price;
    if (!recipient) {
      transactionError.textContent = "Add a demo recipient label.";
      return;
    }
    if (quantity > walletState.holdings[asset.symbol]) {
      transactionError.textContent = `You only have ${formatQuantity(walletState.holdings[asset.symbol], asset.symbol)} in this demo wallet.`;
      return;
    }
    walletState.holdings[asset.symbol] -= quantity;
  } else {
    usdValue = Math.round(inputAmount * 100) / 100;
    quantity = usdValue / asset.price;
    if (actionMode === "buy") {
      if (usdValue > walletState.cash) {
        transactionError.textContent = `Your demo cash balance is ${usd.format(walletState.cash)}.`;
        return;
      }
      walletState.cash = Math.round((walletState.cash - usdValue) * 100) / 100;
      walletState.holdings[asset.symbol] += quantity;
    } else {
      const holdingValue = walletState.holdings[asset.symbol] * asset.price;
      if (usdValue > holdingValue) {
        transactionError.textContent = `You can sell up to ${usd.format(holdingValue)} at this sample price.`;
        return;
      }
      walletState.holdings[asset.symbol] -= quantity;
      walletState.cash = Math.round((walletState.cash + usdValue) * 100) / 100;
    }
  }

  walletState.holdings[asset.symbol] = Math.max(0, walletState.holdings[asset.symbol]);
  walletState.transactions.push({
    id: createReceiptId(),
    type: actionMode,
    symbol: asset.symbol,
    quantity,
    usdValue,
    recipient: actionMode === "send" ? recipient : "",
    createdAt: new Date().toISOString()
  });
  saveWallet();
  renderWallet();
  transactionDialog.close();
  transactionForm.reset();
}

function csvCell(value) {
  let safeValue = String(value);
  if (/^[=+@\-]/.test(safeValue)) safeValue = `'${safeValue}`;
  return `"${safeValue.replaceAll('"', '""')}"`;
}

function downloadActivity() {
  const rows = [["Demo receipt", "Date", "Action", "Asset", "Quantity", "Sample USD value", "Demo recipient", "Status"]];
  walletState.transactions.forEach((tx) => rows.push([
    tx.id, tx.createdAt, tx.type, tx.symbol, tx.quantity, tx.usdValue, tx.recipient || "", "Simulated · not on blockchain"
  ]));
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "cryptovault-demo-activity.csv";
  link.click();
  URL.revokeObjectURL(url);
}

loginTab.addEventListener("click", () => setMode("login"));
signupTab.addEventListener("click", () => setMode("signup"));
document.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => openAction(button.dataset.action)));
document.getElementById("close-dialog").addEventListener("click", () => transactionDialog.close());
document.getElementById("cancel-transaction").addEventListener("click", () => transactionDialog.close());
transactionDialog.addEventListener("close", () => transactionForm.reset());
transactionForm.addEventListener("submit", recordTransaction);
document.getElementById("export-activity").addEventListener("click", downloadActivity);

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy) return;
  if (!supabase) {
    showMessage("Supabase setup is incomplete. Add your project URL and publishable key.", true);
    return;
  }
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  setBusy(true);
  showMessage("");
  try {
    const result = mode === "signup"
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    if (result.error) throw result.error;
    if (mode === "signup" && !result.data.session) {
      showMessage("Registration received. Check your email to confirm your account, then log in.");
    } else if (result.data.session) {
      showDashboard(result.data.session);
    }
  } catch (error) {
    showMessage(error.message || "Something went wrong. Please try again.", true);
  } finally {
    setBusy(false);
  }
});

logoutButton.addEventListener("click", async () => {
  if (!supabase) return showLogin();
  logoutButton.disabled = true;
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    emailInput.value = "";
    passwordInput.value = "";
    setMode("login");
    showLogin();
  } catch (error) {
    showMessage(error.message || "Unable to log out right now. Please try again.", true);
  } finally {
    logoutButton.disabled = false;
  }
});

async function initialiseAuth() {
  if (!supabase) {
    showLogin();
    setBusy(false);
    showMessage("Supabase setup is incomplete. Add your project URL and publishable key.", true);
    return;
  }
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    if (session) showDashboard(session);
    else showLogin();
  });
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (data.session) showDashboard(data.session);
    else showLogin();
  } catch (error) {
    showLogin();
    showMessage(error.message || "Could not restore your session. Please log in again.", true);
  }
  window.addEventListener("pagehide", () => subscription.unsubscribe(), { once: true });
}

initialiseAuth();
