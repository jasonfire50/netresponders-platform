/**
 * app.js
 * Version: 1.18.0
 * Changes in this version:
 * - Event listener now correctly handles all Station management buttons.
 */

const APP_VERSION = "1.18.0";

let appState = {
  isAuthenticated: false,
  launchId: null,
  initialData: null,
  departmentsWithAvailableUnits: [],
  openAvailableUnitsPanels: new Set(),
  currentIncident: null,
  currentViewId: 'commandBoardView',
  planLevel: 'Basic',
  unitToMove: null,
  selectedAvailableUnits: new Set(),
  selectedGroupUnits: {},
  unitsToMultiMove: null,
  isMultiMoveActive: false,
  isReorderModeActive: false,
  groupToMove: null,
  isAssignParentModeActive: false,
  groupToAssignParent: null,
  parTimerIntervals: {},
};

/**
 * A helper function to reset all unit selections within groups.
 * This is called after any action that modifies group assignments.
 */
function clearGroupSelectionState() {
  appState.selectedGroupUnits = {};
}

/**
 * Main entry point, triggered by the 'defer' attribute in index.html
 */
document.addEventListener("DOMContentLoaded", initializeApp);

/**
 * Initializes the application: gets data and renders the initial UI.
 * This version now stores the planLevel in the appState.
 */
async function initializeApp() {
  console.log(`NetResponders App Version: ${APP_VERSION} loading...`);
  renderApp();
  const authStatus = document.getElementById("auth-status");

  showLoader();
  try {
    const urlParams = new URLSearchParams(window.location.search);
    appState.launchId = urlParams.get("id");
    if (!appState.launchId) {
      throw new Error("No Launch ID provided. Cannot authenticate.");
    }
    const response = await callApi("getInitialData", {id: appState.launchId});
    if (!response.success) {
      throw new Error(response.message || "Failed to get initial data.");
    }
    appState.isAuthenticated = true;
    appState.initialData = response.data;

    // --- START: STORE THE PLAN LEVEL ---
    appState.planLevel = response.data.planLevel || 'Basic';
    console.log(`User plan level is: ${appState.planLevel}`);
    // --- END: STORE THE PLAN LEVEL ---

    authStatus.textContent = "Authenticated";
    authStatus.className = "text-success font-weight-bold";

    setupGlobalEventListeners();
    showView("commandBoardView");

  } catch (error) {
    console.error("Initialization Error:", error.message);
    if (authStatus) {
        authStatus.textContent = "Initialization Failed";
        authStatus.className = "text-danger font-weight-bold";
    }
    showError(error.message);
  } finally {
    hideLoader();
  }
}

/**
 * Renders the application's static shell, now including the global header
 * with the new manual refresh button.
 */
function renderApp() {
  const appContainer = document.getElementById("app-container");
  if (!appContainer) return;
  appContainer.innerHTML = `
    <div class="d-flex align-items-center mb-2">
      <button id="sidebarToggleBtn" class="btn btn-sm btn-outline-secondary mr-2" title="Toggle Sidebar" style="display: none;">
        ☰ <!-- Hamburger Icon -->
      </button>

      <!-- START: REFRESH BUTTON ADDED -->
      <button id="manualRefreshBtn" class="btn btn-sm btn-outline-secondary mr-2" title="Refresh Timers and Data">
        <i class="fas fa-sync-alt"></i> <!-- Refresh Icon -->
      </button>
      <!-- END: REFRESH BUTTON ADDED -->

      <h3 class="mb-0">Command Board</h3>
      <div id="auth-status" class="ml-auto text-muted font-italic">Initializing...</div>
    </div>
    <ul class="nav nav-tabs mb-3" id="main-nav-tabs">
      <li class="nav-item"><a class="nav-link active" data-view="commandBoardView" href="#">Command Board</a></li>
      <li class="nav-item"><a class="nav-link" data-view="reportingView" href="#">Reporting</a></li>
      <li class="nav-item"><a class="nav-link" data-view="adminView" href="#">Admin</a></li>
    </ul>
    <div id="view-container">
      <div id="commandBoardView" class="view"></div>
      <div id="reportingView" class="view"></div>
      <div id="adminView" class="view"></div>
    </div>`;
}

/**
 * Sets up all persistent, global event listeners for the application.
 * This function acts as the main "switchboard" for user interactions.
 * This final version correctly wires up all actions, including the PAR button.
 */
function setupGlobalEventListeners() {
  // Guard clause to prevent attaching listeners multiple times.
  const appContainer = document.getElementById("app-container");
  if (appContainer && appContainer.dataset.listenersAttached === 'true') return;
  if (appContainer) appContainer.dataset.listenersAttached = 'true';

  // --- Main CLICK event listener for the entire document ---
  document.addEventListener("click", (event) => {
    const target = event.target;
    // Find the closest relevant element the user might have clicked on.
    const button = target.closest("button");
    const navLink = target.closest("#main-nav-tabs .nav-link");
    const sortableHeader = target.closest('.sortable-header');

    // Helper to fix a modal focus bug in Bootstrap.
    const dismissButton = target.closest('[data-dismiss="modal"]');
    if (dismissButton && document.activeElement) {
      document.activeElement.blur();
    }

    if (sortableHeader) {
      handleSortAvailableUnits(sortableHeader);
      return;
    }

    if (button && button.id === 'sidebarToggleBtn') {
        event.preventDefault();
        const commandBoardRow = document.querySelector('#commandBoardView .row.flex-nowrap');
        if (commandBoardRow) {
            commandBoardRow.classList.toggle('sidebar-hidden');
            const isHidden = commandBoardRow.classList.contains('sidebar-hidden');
            button.title = isHidden ? "Show Panel" : "Hide Panel";
        }
        return;
    }

    if (navLink) {
      event.preventDefault();
      showView(navLink.getAttribute("data-view"));
      return;
    }

    // If a button was clicked, determine what action to take.
    if (button) {
      // THE FIX IS HERE: Added '.js-par-btn' to the list of selectors.
      const buttonClassSelector = ".js-edit-dept, .js-delete-dept, .js-edit-type, .js-delete-type, .js-edit-unit, .js-delete-unit, .js-manage-stations, .js-delete-station, .js-edit-cgroup, .js-delete-cgroup, .js-edit-template, .js-delete-template, .js-multi-move, .js-multi-release, .js-multi-split, .js-move-unit, .js-release-unit, .js-set-supervisor, .js-clear-supervisor, .js-benchmark-btn, .js-assign-parent, .js-clear-parent, .js-disband-group, .js-unsplit-unit, .js-split-unit, .js-par-btn";

      if (button.matches(buttonClassSelector)) {
        event.preventDefault();
        const id = button.dataset.id;
        const name = button.dataset.name;

        // This if/else chain calls the appropriate function.
        if (button.matches(".js-edit-dept")) openDepartmentModal(id);
        else if (button.matches(".js-delete-dept")) handleDeleteDepartmentClick(id, name);
        else if (button.matches(".js-edit-type")) openUnitTypeModal(id);
        else if (button.matches(".js-delete-type")) handleDeleteUnitTypeClick(id, name);
        else if (button.matches(".js-edit-unit")) openUnitModal(id);
        else if (button.matches(".js-delete-unit")) handleDeleteUnitClick(id, name);
        else if (button.matches(".js-manage-stations")) openManageStationsModal(button.dataset.deptId, button.dataset.deptName);
        else if (button.matches(".js-delete-station")) handleDeleteStation(button);
        else if (button.matches(".js-edit-cgroup")) openCommonGroupModal(id);
        else if (button.matches(".js-delete-cgroup")) handleDeleteCommonGroupClick(id, name);
        else if (button.matches(".js-edit-template")) openTemplateModal(id);
        else if (button.matches(".js-delete-template")) handleDeleteTemplateClick(id, name);
        else if (button.matches(".js-multi-move")) handleMultiMoveClick(button);
        else if (button.matches(".js-multi-split")) handleMultiSplitClick(button);
        else if (button.matches(".js-multi-release")) handleMultiReleaseClick(button);
        else if (button.matches(".js-move-unit")) handleMoveUnitClick(id, name);
        else if (button.matches(".js-release-unit")) handleReleaseUnitClick(id, name);
        else if (button.matches(".js-set-supervisor")) handleSetSupervisor(button.dataset.groupId, button.dataset.unitId);
        else if (button.matches(".js-clear-supervisor")) handleClearSupervisor(button.dataset.groupId);
        else if (button.matches(".js-benchmark-btn")) handleBenchmarkClick(button.dataset.groupId, button.dataset.benchmarkName, button.dataset.currentStatus);
        else if (button.matches(".js-assign-parent")) handleAssignParentClick(button);
        else if (button.matches(".js-clear-parent")) handleClearParentClick(button);
        else if (button.matches(".js-disband-group")) handleDisbandGroupClick(button);
        else if (button.matches(".js-unsplit-unit")) openUnsplitUnitModal(button);
        else if (button.matches(".js-split-unit")) splitUnit(button);
        // AND THE FIX IS HERE: Added a condition to call the PAR handler.
        else if (button.matches(".js-par-btn")) handleParButtonClick(button);

        return;
      }

      // Handles all buttons that use a specific ID for their action.
      if (button.id) {
        event.preventDefault();
        switch (button.id) {
          case "manualRefreshBtn": handleManualRefresh(); break;
          case "reorderGroupsBtn": toggleReorderMode(); break;
          case "cancelReorderBtn": toggleReorderMode(); break;
          case "confirmUnsplitBtn": handleConfirmUnsplit(); break;
          case "startNewIncidentBtn": handleStartNewIncident(); break;
          case "closeIncidentBtn": handleCloseIncident(); break;
          case "addGroupBtn": handleAddGroup(); break;
          case "applyTemplateBtn": handleApplyTemplate(); break;
          case "addDepartmentBtn": openDepartmentModal(); break;
          case "saveDepartmentBtn": handleSaveDepartment(); break;
          case "addUnitTypeBtn": openUnitTypeModal(); break;
          case "saveUnitTypeBtn": handleSaveUnitType(); break;
          case "addUnitBtn": openUnitModal(); break;
          case "saveUnitBtn": handleSaveUnit(); break;
          case "addCommonGroupBtn": openCommonGroupModal(); break;
          case "saveCommonGroupBtn": handleSaveCommonGroup(); break;
          case "addTemplateBtn": openTemplateModal(); break;
          case "addTemplateGroupBtn": addGroupToTemplateModalList(); break;
          case "saveTemplateBtn": handleSaveTemplate(); break;
          case "saveSettingsBtn": handleSaveSettings(); break;
          case "deleteIncidentBtn": handleDeleteIncidentClick(); break;
          case "addNewStationBtn": handleAddNewStation(); break;
        }
      }
    }
  });

  // --- Main CHANGE event listener for the entire document ---
  document.addEventListener("change", (event) => {
    if (event.target.id === "activeIncidentsSelect") {
      handleActiveIncidentSelect();
    }
    if (event.target.id === "closedIncidentSelect") {
      handleAdminIncidentSelect();
    }
    if (event.target.matches('.available-unit-checkbox')) {
      handleAvailableUnitCheckboxChange(event.target);
    }
  });
}

/**
 * Main view router. Renders the content for the selected view and
 * now also updates the currentViewId in the appState.
 * @param {string} viewId The ID of the view to show.
 */
function showView(viewId) {
  console.log(`Switching to view: ${viewId}`);
  appState.currentViewId = viewId; // Keep track of the active view

  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  document.querySelectorAll("#main-nav-tabs .nav-link").forEach((l) => l.classList.remove("active"));

  const targetView = document.getElementById(viewId);
  const targetLink = document.querySelector(`.nav-link[data-view="${viewId}"]`);
  if (targetView) targetView.classList.add("active");
  if (targetLink) targetLink.classList.add("active");

  const toggleBtn = document.getElementById('sidebarToggleBtn');
  if (toggleBtn) {
    toggleBtn.style.display = (viewId === 'commandBoardView') ? 'inline-block' : 'none';
  }

  const data = appState.initialData;
  if (!data) {
    if (targetView) targetView.innerHTML = `<p class="text-muted">Loading data...</p>`;
    return;
  }

  document.querySelectorAll(".view").forEach((v) => { v.style.display = v.id === viewId ? "block" : "none"; });

  switch (viewId) {
    case "commandBoardView": renderCommandBoardView(targetView, data); break;
    case "reportingView": renderReportingView(targetView, data); break;
    case "adminView": renderAdminView(targetView, data); break;
  }
}

async function callApi(action, params = {}) {
  const API_URL = "https://us-central1-netresponders-apps-50.cloudfunctions.net/api";
  const url = new URL(API_URL);
  url.searchParams.append("action", action);
  for (const key in params) { url.searchParams.append(key, params[key]); }
  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const msg = errorData.message || `Network error: ${response.status}`;
      throw new Error(msg);
    }
    return response.json();
  } catch (error) {
    console.error(`API call error for action "${action}":`, error);
    throw error;
  }
}

function showError(message) {
  const errorDiv = document.getElementById("error-message");
  if (errorDiv) { errorDiv.textContent = message; errorDiv.style.display = "block"; }
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
 * Handles the click of the "Split" button in the multi-action panel.
 * This FINAL version awaits the UI refresh and clears the selection state.
 * @param {HTMLButtonElement} button The button that was clicked.
 */
async function handleMultiSplitClick(button) {
    const groupId = button.dataset.groupId;
    const unitIds = Array.from(appState.selectedGroupUnits[groupId] || []);

    if (unitIds.length === 0) return;
    if (!confirm(`Are you sure you want to split ${unitIds.length} selected unit(s)?`)) {
        return;
    }

    showLoader();
    try {
        await callApi("splitMultipleUnits", {
            id: appState.launchId,
            incidentId: appState.currentIncident.id,
            unitIds: unitIds.join(','),
            groupId,
        });

        // --- THIS IS THE CORRECTED BLOCK ---
        clearGroupSelectionState();
        await loadGroupsForCurrentIncident();
        await loadSplitUnits();

    } catch (error) {
        showError(error.message);
    } finally {
        hideLoader();
    }
}

/**
 * Handles the click of the manual refresh button by re-running the
 * render function for the currently active view.
 */
async function handleManualRefresh() {
    console.log(`Manual refresh triggered for view: ${appState.currentViewId}`);
    if (!appState.currentViewId) return;

    showLoader();
    try {
        // Re-calling showView is the most robust way to refresh, as it
        // contains all the necessary logic to render any view correctly.
        await showView(appState.currentViewId);
    } catch (error) {
        showError("Failed to refresh data.");
        console.error("Refresh Error:", error);
    } finally {
        hideLoader();
    }
}