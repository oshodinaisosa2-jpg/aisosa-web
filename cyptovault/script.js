 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// 1. SUPABASE CONFIGURATION
const SUPABASE_URL = "https://qzboyriqqfpgsuewvqmf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_UKY0WOadC6tO-5Edz_zRZg__sfzyJ6v";

const configured =
  SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("YOUR_SUPABASE_URL") &&
  SUPABASE_PUBLISHABLE_KEY.length > 0 &&
  !SUPABASE_PUBLISHABLE_KEY.includes("YOUR_SUPABASE_PUBLISHABLE_KEY");

const supabase = configured
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;

// 2. PAGE ELEMENTS
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

let mode = "login";
let busy = false;

// 3. LOGIN / REGISTRATION TABS
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

loginTab.addEventListener("click", () => setMode("login"));
signupTab.addEventListener("click", () => setMode("signup"));

// 4. STATUS MESSAGES
function showMessage(message, isError = false) {
  authMessage.textContent = message;
  authMessage.style.color = isError ? "#ff7185" : "#40d9a2";
}

function setBusy(value) {
  busy = value;
  submitButton.disabled = value;
  submitButton.textContent = value
    ? "Please wait..."
    : mode === "login"
      ? "Log in"
      : "Create account";
}

// 5. SHOW THE AUTHENTICATED DASHBOARD
function showDashboard(session) {
  if (!session?.user) {
    showLogin();
    return;
  }

  const email = session.user.email || "Account";

  userEmail.textContent = email;
  sidebarEmail.textContent = email;

  authView.hidden = true;
  walletView.hidden = false;
}

function showLogin() {
  walletView.hidden = true;
  authView.hidden = false;
  setBusy(false);
}

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (busy) return;

  if (!supabase) {
    showMessage(
      "Add your Supabase project URL and publishable key to script.js first.",
      true
    );
    return;
  }

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  setBusy(true);
  showMessage("");

  try {
    let result;

    if (mode === "signup") {
      result = await supabase.auth.signUp({
        email,
        password
      });

      if (result.error) throw result.error;

      if (result.data.session) {
        showDashboard(result.data.session);
      } else {
        showMessage(
          "Registration received. Check your email to confirm your account, then log in."
        );
      }
    } else {
      result = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (result.error) throw result.error;

      showDashboard(result.data.session);
    }
  } catch (error) {
    showMessage(
      error.message || "Something went wrong. Please try again.",
      true
    );
  } finally {
    setBusy(false);
  }
});

// 8. LOG OUT
logoutButton.addEventListener("click", async () => {
  if (!supabase) {
    showLogin();
    return;
  }

  logoutButton.disabled = true;

  try {
    const { error } = await supabase.auth.signOut();

    if (error) throw error;

    emailInput.value = "";
    passwordInput.value = "";
    setMode("login");
    showLogin();
  } catch (error) {
    console.error("Logout failed:", error);
    alert("Unable to log out right now. Please try again.");
  } finally {
    logoutButton.disabled = false;
  }
});

// 9. RESTORE SESSION AND LISTEN FOR AUTH CHANGES
async function initialiseAuth() {
  if (!supabase) {
    showLogin();
    setBusy(false);
    showMessage(
      "Supabase setup is incomplete. Add your project URL and publishable key.",
      true
    );
    return;
  }

  const {
    data: { subscription }
  } = supabase.auth.onAuthStateChange((_event, session) => {
    if (session) {
      showDashboard(session);
    } else {
      showLogin();
    }
  });

  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) throw error;

    if (data.session) {
      showDashboard(data.session);
    } else {
      showLogin();
    }
  } catch (error) {
    console.error("Session restoration failed:", error);
    showLogin();
    showMessage("Could not restore your session. Please log in again.", true);
  }

  // Keep the subscription active while the page is open.
  window.addEventListener("pagehide", () => subscription.unsubscribe(), {
    once: true
  });
}

initialiseAuth();

