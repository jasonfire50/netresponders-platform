/**
 * app.js - FINAL DEFINITIVE STABLE VERSION
 */
const APP_VERSION = "5.0.0-stable";
let isInitializing = false;
let activeIncidentsMasterListener = null;

let appState = {
  isAuthenticated: false, currentUser: null, idToken: null, initialData: null,
  departmentsWithAvailableUnits: [], openAvailableUnitsPanels: new Set(),
  currentIncident: null, currentViewId: 'commandBoardView', planLevel: 'Basic',
  unitToMove: null, selectedAvailableUnits: new Set(), selectedGroupUnits: {},
  unitsToMultiMove: null, isMultiMoveActive: false, isReorderModeActive: false,
  groupToMove: null, isAssignParentModeActive: false, groupToAssignParent: null,
  parTimerIntervals: {}, sessionId: null, sessionHeartbeatInterval: null,
  isLockedOut: false, isViewOnly: false, isCommandRequestPending: false,
};

function clearGroupSelectionState() { appState.selectedGroupUnits = {}; }


// ===================================================================
//
//  AUTHENTICATION AND INITIALIZATION
//
// ===================================================================

document.addEventListener("DOMContentLoaded", () => {
  const appContainer = document.getElementById('app-container');
  const loader = document.getElementById('loader');
  if (appContainer) appContainer.style.display = 'none';
  if (loader) loader.style.display = 'block';
  // --- START: NEW ROBUST DYNAMIC CONFIG LOGIC ---

  async function initializeFirebase() {
    // Explicitly define the two possible paths
    const devConfigPath = '/apps/common/firebase-config-dev.js';
    const prodConfigPath = '/apps/common/firebase-config-prod.js';
    
    let configToLoad;
    const hostname = window.location.hostname;

    // The condition to check for any development environment
    const isDevelopment = hostname.includes('netresponders-apps-dev--') || 
                          hostname.includes('localhost') || 
                          hostname.includes('127.0.0.1');

    if (isDevelopment) {
      console.log("Environment: DEVELOPMENT");
      configToLoad = devConfigPath;
    } else {
      console.log("Environment: PRODUCTION");
      configToLoad = prodConfigPath;
    }

    try {
      console.log(`Attempting to load config from: ${configToLoad}`);
      const configModule = await import(configToLoad);
      const firebaseConfig = configModule.firebaseConfig;

      if (!firebaseConfig) {
        throw new Error("firebaseConfig object not found in the loaded module.");
      }

      firebase.initializeApp(firebaseConfig);
      console.log("Firebase has been initialized successfully.");
      
      setupAuthListener(); // Proceed to the next step

    } catch (err) {
      console.error(`CRITICAL: Failed to load Firebase config from ${configToLoad}.`, err);
    }
  }

  function setupAuthListener() {
    firebase.auth().onAuthStateChanged(user => {
      if (user) {
        if (isInitializing) return;
        isInitializing = true;
        if (appContainer) appContainer.style.display = 'block';
        initializeApp(user);
      } else {
        isInitializing = false;
        if (appState.sessionHeartbeatInterval) clearInterval(appState.sessionHeartbeatInterval);
        Object.assign(appState, { sessionId: null, currentUser: null, idToken: null, isLockedOut: false, isViewOnly: false });
        const currentPath = window.location.pathname;
        if (!currentPath.includes('/login.html')) {
          window.location.href = `/login.html?redirect=${currentPath}`;
        }
      }
    });
  }

  // Start the entire process
  initializeFirebase();

  // --- END: NEW ROBUST DYNAMIC CONFIG LOGIC ---
});

/**
 * Main application initializer - FINAL DEFINITIVE VERSION
 * This version corrects the order of operations, ensuring that real-time
 * listeners are ONLY attached AFTER all initial data has been successfully loaded.
 */
async function initializeApp(user) {
  console.log(`App Version: ${APP_VERSION} loading...`);
  const sessionId = sessionStorage.getItem('sessionId');
  if (!sessionId) {
    console.error("CRITICAL: No session ID found. Forcing logout.");
    await firebase.auth().signOut();
    return;
  }
  appState.isAuthenticated = true;
  appState.currentUser = user;
  appState.sessionId = sessionId;
  try {
    appState.idToken = await user.getIdToken(true);
    const statusResponse = await callApi("checkSessionStatus", { sessionId: appState.sessionId }, 'POST');
    if (!statusResponse.success) throw new Error(statusResponse.message);
    if (statusResponse.data.status === 'locked_out') {
      appState.isLockedOut = true;
      document.getElementById('app-container').style.display = 'none';
      const banner = document.getElementById('global-lockout-banner');
      banner.textContent = statusResponse.data.message;
      banner.style.display = 'block';
      hideLoader();
      return;
    }
    const initialDataResponse = await callApi("getInitialData");
    if (!initialDataResponse.success) throw new Error(initialDataResponse.message);
    appState.initialData = initialDataResponse.data;
    appState.planLevel = initialDataResponse.data.planLevel || 'Basic';
    renderApp();
    setupGlobalEventListeners();
    manageHeartbeat();
    attachActiveIncidentsListener();
    const authStatus = document.getElementById("auth-status");
    if (authStatus) authStatus.textContent = `Authenticated: ${user.email}`;
    showView("commandBoardView");
  } catch (error) {
    console.error("CRITICAL INITIALIZATION FAILED:", error);
    await firebase.auth().signOut();
    const errorMessage = encodeURIComponent(error.message);
    window.location.href = `/login.html?error=${errorMessage}`;
  } finally {
    hideLoader();
    isInitializing = false;
  }
}

/**
 * Manages the session heartbeat and authentication token refresh.
 * This function is tied to the browser's visibility state.
 */
async function manageHeartbeat() {
  const user = firebase.auth().currentUser;
  if (!user) return;
  if (document.visibilityState === 'visible' && appState.sessionId) {
    try {
      appState.idToken = await user.getIdToken(true);
    } catch (error) {
      console.error("Failed to refresh auth token, logging out.", error);
      await firebase.auth().signOut();
      return;
    }
    if (!appState.sessionHeartbeatInterval) {
      appState.sessionHeartbeatInterval = setInterval(() => {
        if (appState.sessionId) {
          callApi("sessionHeartbeat", {sessionId: appState.sessionId}, 'POST')
            .catch(err => console.warn("Heartbeat failed:", err.message));
        }
      }, 60000);
    }
  } else {
    if (appState.sessionHeartbeatInterval) {
      clearInterval(appState.sessionHeartbeatInterval);
      appState.sessionHeartbeatInterval = null;
    }
  }
}


/**
 * Renders the application's static shell.
 */
function renderApp() {
  const appContainer = document.getElementById("app-container");
  if (!appContainer) return;
  const SUPER_ADMIN_UID = "WRikDrCVOqTbXHK11mteAD9Fr4t1";
  const isSuperAdmin = appState.currentUser.uid === SUPER_ADMIN_UID;
  const superAdminTabHtml = isSuperAdmin ? `<li class="nav-item"><a class="nav-link" data-view="superAdminView" href="#"><i class="fas fa-user-shield"></i> Super Admin</a></li>` : '';
  appContainer.innerHTML = `
    <div class="d-flex align-items-center mb-2">
      <button id="sidebarToggleBtn" class="btn btn-sm btn-outline-secondary mr-2" title="Toggle Sidebar" style="display: none;">☰</button>
      <button id="manualRefreshBtn" class="btn btn-sm btn-outline-secondary mr-2" title="Refresh Timers and Data"><i class="fas fa-sync-alt"></i></button>
      <h3 class="mb-0">Command Board</h3>
      <div class="ml-auto d-flex align-items-center">
        <div id="auth-status" class="text-muted font-italic mr-3">Initializing...</div>
        <button id="logoutBtn" class="btn btn-sm btn-outline-secondary"><i class="fas fa-sign-out-alt"></i> Logout</button>
      </div>
    </div>
    <ul class="nav nav-tabs mb-3" id="main-nav-tabs">
      <li class="nav-item"><a class="nav-link active" data-view="commandBoardView" href="#">Command Board</a></li>
      <li class="nav-item"><a class="nav-link" data-view="reportingView" href="#">Reporting</a></li>
      <li class="nav-item"><a class="nav-link" data-view="adminView" href="#">Admin</a></li>
      ${superAdminTabHtml}
    </ul>
    <div id="view-container">
      <div id="commandBoardView" class="view"></div>
      <div id="reportingView" class="view"></div>
      <div id="adminView" class="view"></div>
      ${isSuperAdmin ? '<div id="superAdminView" class="view"></div>' : ''}
    </div>
    <footer class="text-muted text-center mt-4 small">
      App Version: ${APP_VERSION}
    </footer>`;
}

/**
 * Handles the click of the "Logout" button.
 * This version now correctly checks if the current user is the actual
 * commander of the selected incident before showing the warning prompt.
 */
async function handleLogout() {
  const isUserCommanding = appState.currentIncident && appState.currentIncident.commanderUid === appState.currentUser.uid;
  if (isUserCommanding) {
    if (!confirm("Warning: You are commanding an active incident. Logging out will NOT close the incident. Are you sure?")) return;
  }
  showLoader();
  try {
    sessionStorage.removeItem('sessionId');
    clearAllIncidentListeners();
    if (activeIncidentsMasterListener) activeIncidentsMasterListener();
    if (appState.sessionHeartbeatInterval) clearInterval(appState.sessionHeartbeatInterval);
    if (appState.sessionId) await callApi("endSession", { sessionId: appState.sessionId }, 'POST');
    await firebase.auth().signOut();
  } catch (error) {
    console.error("Logout failed:", error);
    showError("Failed to logout.");
    await firebase.auth().signOut();
  }
}

/**
 * Sets up all persistent, global event listeners for the application.
 * This definitive version uses a single, delegated listener for all clicks and
 * a single listener for all changes, which is the most robust way to handle
 * dynamically created elements. This is the single source of truth for all
 * user interaction events.
 */
function setupGlobalEventListeners() {
  const appContainer = document.getElementById("app-container");
  if (appContainer && appContainer.dataset.listenersAttached === 'true') return;
  if (appContainer) appContainer.dataset.listenersAttached = 'true';

  document.addEventListener('visibilitychange', manageHeartbeat);

  document.addEventListener("click", (event) => {
    const target = event.target;
    const button = target.closest("button");
    const navLink = target.closest("#main-nav-tabs .nav-link");

    if (navLink) {
      event.preventDefault();
      showView(navLink.getAttribute("data-view"));
      return;
    }
    if (!button) return;

    // Switch for all global and modal buttons
    if (button.id) {
      switch (button.id) {
        // App Shell Buttons
        case "logoutBtn": handleLogout(); break;
        case "manualRefreshBtn": handleManualRefresh(); break;

        // Command Board Modal Buttons
        case "approveCommandRequestBtn": handleApproveCommandRequest(); break;
        case "denyCommandRequestBtn": handleDenyCommandRequest(); break;
        case "confirmUnsplitBtn": handleConfirmUnsplit(); break;

        // Admin Modal "Save" Buttons
        case "saveDepartmentBtn": handleSaveDepartment(); break;
        case "saveUnitBtn": handleSaveUnit(); break;
        case "saveUnitTypeBtn": handleSaveUnitType(); break;
        case "saveCommonGroupBtn": handleSaveCommonGroup(); break;
        case "saveTemplateBtn": handleSaveTemplate(); break;
      }
    }
  });
}


/**
 * Main view router.
 * This definitive version is "dumb" and reliable. It ALWAYS re-renders the
 * view when a tab is clicked, ensuring a clean and correct state.
 */
function showView(viewId) {
  appState.currentViewId = viewId;

  // Hide all view containers.
  document.querySelectorAll(".view").forEach((v) => {
    v.style.display = "none";
  });
  // Update the active state on the navigation tabs.
  document.querySelectorAll("#main-nav-tabs .nav-link").forEach((l) => {
    l.classList.remove("active");
  });

  const targetView = document.getElementById(viewId);
  const targetLink = document.querySelector(`.nav-link[data-view="${viewId}"]`);
  if (targetView) {
    targetView.style.display = "block";
  }
  if (targetLink) {
    targetLink.classList.add("active");
  }

  const data = appState.initialData;
  if (!data) {
    if (targetView) {
      targetView.innerHTML = `<p class="text-muted">Loading data...</p>`;
    }
    return;
  }

  // This switch now runs every time, guaranteeing the correct view is drawn.
  switch (viewId) {
    case "commandBoardView":
      if (appState.currentIncident) {
        reloadCurrentIncidentView();
      } else {
        renderCommandBoardView(targetView, data);
      }
      break;
    case "reportingView":
      renderReportingView(targetView, data);
      break;
    case "adminView":
      renderAdminView(targetView, data);
      break;
    case "superAdminView":
      renderSuperAdminView(targetView);
      break;
  }
}

/**
 * A secure, centralized function for making all API calls.
 */
async function callApi(action, params = {}, method = 'GET') {
  const API_URL = "https://us-central1-netresponders-apps-50.cloudfunctions.net/api";
  const url = new URL(API_URL);

  const headers = {
    'Authorization': `Bearer ${appState.idToken}`,
    'Content-Type': 'application/json'
  };

  let options = {
    method,
    headers,
  };

  if (method.toUpperCase() === 'POST') {
    options.body = JSON.stringify({ action, ...params });
  } else { // GET request
    url.searchParams.append("action", action);
    for (const key in params) {
      url.searchParams.append(key, params[key]);
    }
  }

  try {
    const response = await fetch(url, options);

    if (response.status === 401 || response.status === 403) {
      console.warn("Authentication error detected. Forcing logout.");
      await firebase.auth().signOut();
      throw new Error("Your session has expired. Please log in again.");
    }

    const responseData = await response.json();

    if (!response.ok) {
        const msg = responseData.message || `Network error: ${response.statusText}`;
        throw new Error(msg);
    }

    return responseData;

  } catch (error) {
    console.error(`API call error for action "${action}":`, error);
    showError(error.message);
    throw error;
  }
}

function showError(message) {
  const errorDiv = document.getElementById("error-message");
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.style.display = "block";
  }
}
function showLoader() {
  const loader = document.getElementById("loader");
  if (loader) loader.style.display = "block";
}
function hideLoader() {
  const loader = document.getElementById("loader");
  if (loader) loader.style.display = "none";
}

/**
 * Handles the click of the manual refresh button ("Back to List").
 * This is the definitive "reset" function. It now correctly calls
 * clearIncidentDetails to ensure all listeners are detached.
 */
async function handleManualRefresh() {
  console.log("HANDLE MANUAL REFRESH: Triggered for a full reset.");
  showLoader();
  try {
    clearAllIncidentListeners();
    const response = await callApi("getInitialData");
    if (!response.success) throw new Error(response.message);
    appState.initialData = response.data;
    appState.currentIncident = null;
    appState.isViewOnly = false;
    appState.isCommandRequestPending = false;
    const viewContainer = document.getElementById('commandBoardView');
    renderCommandBoardView(viewContainer, appState.initialData);
  } catch (error) {
    showError("Failed to refresh data.");
  } finally {
    hideLoader();
  }
}

/**
 * Attaches a global, real-time listener to the active incidents list.
 * Its ONLY job is to keep the appState.initialData.activeIncidents array
 * up-to-date. It does not touch the DOM.
 */
function attachActiveIncidentsListener() {
  if (activeIncidentsMasterListener) activeIncidentsMasterListener();
  if (!appState.initialData || !appState.initialData.customerId) return;
  const db = firebase.firestore();
  activeIncidentsMasterListener = db.collection("incidents")
    .where("status", "==", "Active")
    .where("customerId", "==", appState.initialData.customerId)
    .onSnapshot((snapshot) => {
      const updatedIncidents = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id, ...data,
          startTime: data.startTime ? data.startTime.toDate().toISOString() : null,
        };
      });
      appState.initialData.activeIncidents = updatedIncidents;
      updateIncidentDropdownIfVisible();
    });
}