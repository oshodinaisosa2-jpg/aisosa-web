import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// This publishable key is intended for browser code. Never put a secret key here.
const SUPABASE_URL = "https://qzboyriqqfpgsuewvqmf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_UKY0WOadC6tO-5Edz_zRZg__sfzyJ6v";
const configured = SUPABASE_URL.startsWith("https://") && SUPABASE_PUBLISHABLE_KEY.startsWith("sb_publishable_");
const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY) : null;

// Keep these sample prices aligned with the database function in cryptovault-demo-schema.sql.
const assets = [
  { symbol: "BTC", name: "Bitcoin", icon: "₿", price: 67500, className: "bitcoin" },
  { symbol: "ETH", name: "Ethereum", icon: "Ξ", price: 2400, className: "ethereum" },
  { symbol: "SOL", name: "Solana", icon: "◎", price: 150, className: "solana" }
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
let loadedUserId = null;
let walletState = null;
let actionMode = "buy";
let walletLoadRequest = 0;
let walletRefreshTimer = null;

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

function showDashboard(session, deferWalletLoad = false) {
  if (!session?.user) return showLogin();
  const email = session.user.email || "Account";
  const needsWalletLoad = activeUserId !== session.user.id || loadedUserId !== session.user.id;
  if (activeUserId !== session.user.id) {
    activeUserId = session.user.id;
    walletState = null;
    loadedUserId = null;
  }
  userEmail.textContent = email;
  sidebarEmail.textContent = email;
  authView.hidden = true;
  walletView.hidden = false;
  if (!walletRefreshTimer) {
    walletRefreshTimer = setInterval(() => {
      if (activeUserId && loadedUserId === activeUserId) void refreshWallet(activeUserId);
    }, 20000);
  }
  if (needsWalletLoad) {
    if (deferWalletLoad) setTimeout(() => refreshWallet(session.user.id), 0);
    else void refreshWallet(session.user.id);
  }
}

function showLogin() {
  walletLoadRequest += 1;
  if (walletRefreshTimer) clearInterval(walletRefreshTimer);
  walletRefreshTimer = null;
  activeUserId = null;
  loadedUserId = null;
  walletState = null;
  walletView.hidden = true;
  authView.hidden = false;
  setBusy(false);
}

function formatQuantity(amount, symbol) {
  return `${quantityFormat.format(Number(amount))} ${symbol}`;
}

async function refreshWallet(userId) {
  if (!supabase || !userId || userId !== activeUserId) return;
  const requestNumber = ++walletLoadRequest;
  walletMessage.textContent = "Loading shared demo wallet…";
  walletMessage.classList.remove("error");
  try {
    const { data: wallet, error: walletError } = await supabase.rpc("get_or_create_demo_wallet");
    if (walletError) throw walletError;
    const { data: transactions, error: activityError } = await supabase
      .from("demo_transactions")
      .select("id,reference,user_id,recipient_user_id,action,asset_symbol,quantity,usd_value,sender_email,recipient_email,created_at")
      .or(`user_id.eq.${userId},recipient_user_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(100);
    if (activityError) throw activityError;
    if (requestNumber !== walletLoadRequest || userId !== activeUserId) return;

    walletState = {
      cash: Number(wallet.cash_balance),
      holdings: { BTC: Number(wallet.btc_balance), ETH: Number(wallet.eth_balance), SOL: Number(wallet.sol_balance) },
      transactions: transactions || []
    };
    loadedUserId = userId;
    renderWallet();
    walletMessage.textContent = "Shared demo wallet is up to date. Incoming transfers refresh automatically.";
  } catch (error) {
    if (requestNumber !== walletLoadRequest || userId !== activeUserId) return;
    walletMessage.textContent = `Shared wallet setup needed: ${error.message || "database request failed"}`;
    walletMessage.classList.add("error");
  }
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
    empty.textContent = "No activity yet. Try a simulated buy, sell, or send to create your first shared demo receipt.";
    activityList.append(empty);
    return;
  }

  transactions.forEach((tx) => {
    const asset = assets.find((item) => item.symbol === tx.asset_symbol);
    if (!asset) return;
    const incoming = tx.action === "send" && tx.recipient_user_id === activeUserId && tx.user_id !== activeUserId;
    const displayAction = incoming ? "receive" : tx.action;
    const row = document.createElement("article");
    row.className = "activity-row";
    const icon = document.createElement("span");
    icon.className = `activity-icon ${displayAction}`;
    icon.textContent = displayAction === "buy" ? "＋" : displayAction === "sell" ? "↗" : displayAction === "receive" ? "↓" : "➤";
    const details = document.createElement("div");
    details.className = "activity-description";
    const title = document.createElement("strong");
    const actionText = { buy: "Bought", sell: "Sold", send: "Sent", receive: "Received" }[displayAction];
    title.textContent = `${actionText} ${asset.name}${displayAction === "send" || displayAction === "receive" ? " · Demo transfer" : ""}`;
    const note = document.createElement("span");
    let counterparty = "";
    if (displayAction === "send") counterparty = ` · To ${tx.recipient_email}`;
    if (displayAction === "receive") counterparty = ` · From ${tx.sender_email}`;
    note.textContent = `${dateFormat.format(new Date(tx.created_at))} · ${tx.reference}${counterparty} · Demo only`;
    details.append(title, note);
    const value = document.createElement("strong");
    value.className = "activity-amount";
    const positive = displayAction === "sell" || displayAction === "receive";
    value.textContent = `${positive ? "+" : "−"}${usd.format(Number(tx.usd_value))}`;
    const quantity = document.createElement("small");
    quantity.textContent = formatQuantity(tx.quantity, tx.asset_symbol);
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
    buy: { title: "Buy crypto", description: "Use your demo cash to add a sample asset to this shared portfolio.", label: "Amount in USD", prefix: "$", button: "Confirm demo buy", hint: "The amount will be converted using the fixed sample price." },
    sell: { title: "Sell crypto", description: "Sell part of a sample holding and return demo cash to your wallet.", label: "Amount in USD", prefix: "$", button: "Confirm demo sell", hint: "You can sell up to the current sample value of your holding." },
    send: { title: "Send crypto", description: "Send a demo asset to another registered CryptoVault account by email. No blockchain transfer is made.", label: "Quantity to send", prefix: "", button: "Send demo funds", hint: "The recipient must have created and confirmed a CryptoVault account first." }
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

async function recordTransaction(event) {
  event.preventDefault();
  transactionError.textContent = "";
  const asset = assets.find((item) => item.symbol === transactionAsset.value);
  const amount = Number(transactionAmount.value);
  const recipientEmail = recipientInput.value.trim().toLowerCase();
  if (!asset || !Number.isFinite(amount) || amount <= 0) {
    transactionError.textContent = "Enter an amount greater than zero.";
    return;
  }
  if (actionMode === "send" && !recipientEmail) {
    transactionError.textContent = "Enter the email address used for their CryptoVault account.";
    return;
  }
  if (!supabase || !activeUserId) {
    transactionError.textContent = "Please log in again before making a demo transaction.";
    return;
  }

  confirmTransaction.disabled = true;
  confirmTransaction.textContent = "Saving…";
  try {
    const { data, error } = await supabase.rpc("execute_demo_transaction", {
      p_action: actionMode,
      p_asset_symbol: asset.symbol,
      p_amount: amount,
      p_recipient_email: actionMode === "send" ? recipientEmail : null
    });
    if (error) throw error;
    transactionDialog.close();
    transactionForm.reset();
    await refreshWallet(activeUserId);
    if (data?.reference) walletMessage.textContent = `Shared demo transaction saved · ${data.reference}`;
  } catch (error) {
    transactionError.textContent = error.message || "Could not save the demo transaction.";
  } finally {
    confirmTransaction.disabled = false;
    confirmTransaction.textContent = actionMode === "send" ? "Send demo funds" : actionMode === "sell" ? "Confirm demo sell" : "Confirm demo buy";
  }
}

function csvCell(value) {
  let safeValue = String(value ?? "");
  if (/^[=+@\-]/.test(safeValue)) safeValue = `'${safeValue}`;
  return `"${safeValue.replaceAll('"', '""')}"`;
}

async function downloadActivity() {
  if (!activeUserId) return;
  await refreshWallet(activeUserId);
  if (!walletState) return;
  const rows = [["Demo receipt", "Date", "Action", "Asset", "Quantity", "Sample USD value", "From", "To", "Status"]];
  walletState.transactions.forEach((tx) => {
    const incoming = tx.action === "send" && tx.recipient_user_id === activeUserId && tx.user_id !== activeUserId;
    rows.push([
      tx.reference, tx.created_at, incoming ? "receive" : tx.action, tx.asset_symbol,
      tx.quantity, tx.usd_value, incoming ? tx.sender_email : "", incoming ? "" : (tx.recipient_email || ""),
      "Simulated · not on blockchain"
    ]);
  });
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
document.getElementById("export-activity").addEventListener("click", () => void downloadActivity());
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && activeUserId) void refreshWallet(activeUserId);
});
window.addEventListener("focus", () => {
  if (activeUserId) void refreshWallet(activeUserId);
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy) return;
  if (!supabase) {
    showMessage("Supabase setup is incomplete. Check the project URL and publishable key.", true);
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
    showMessage("Supabase setup is incomplete. Check the project URL and publishable key.", true);
    return;
  }
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    if (session) showDashboard(session, true);
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
