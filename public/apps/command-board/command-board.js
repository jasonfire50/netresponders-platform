/**
 * command-board.js - DEFINITIVE STABLE VERSION
 * This file contains all logic for the main Command Board view. It implements
 * the complete, stable architecture for session management, tiered licensing,
 * real-time updates, and robust event handling via a Delegated Listener Model.
 */

// ===================================================================
//
//  GLOBAL LISTENERS & STATE
//
// ===================================================================

let mainIncidentListener = null;
let commandRequestListener = null;
let myRequestStatusListener = null;
let groupsListener = null;
let assignmentsListener = null;

// ===================================================================
//
//  HELPER FUNCTIONS
//
// ===================================================================

/**
 * Formats a duration in total minutes into a readable "Xd Yh Zm" format.
 */
function formatDuration(totalMinutes) {
  if (totalMinutes < 1) return '0m';
  const MINUTES_IN_A_DAY = 1440;
  const MINUTES_IN_AN_HOUR = 60;

  if (totalMinutes >= MINUTES_IN_A_DAY) {
    const days = Math.floor(totalMinutes / MINUTES_IN_A_DAY);
    const remainingMinutes = totalMinutes % MINUTES_IN_A_DAY;
    const hours = Math.floor(remainingMinutes / MINUTES_IN_AN_HOUR);
    const minutes = remainingMinutes % MINUTES_IN_AN_HOUR;
    return `${days}d ${hours}h ${minutes}m`;
  } else if (totalMinutes >= MINUTES_IN_AN_HOUR) {
    const hours = Math.floor(totalMinutes / MINUTES_IN_AN_HOUR);
    const minutes = totalMinutes % MINUTES_IN_AN_HOUR;
    return `${hours}h ${minutes}m`;
  } else {
    return `${totalMinutes}m`;
  }
}


// ===================================================================
//
//  CORE RENDERING AND DATA LOADING
//
// ===================================================================

/**
 * A safe UI update function. It checks if the command board is visible and
 * not in an active incident. If so, it re-renders the incident control
 * panel with the latest data from the appState.
 */
function updateIncidentDropdownIfVisible() {
  if (appState.currentViewId !== 'commandBoardView' || appState.currentIncident) return;
  const sidebar = document.getElementById('commandSidebar');
  if (sidebar) {
    const incidentControl = sidebar.querySelector('.card');
    if (incidentControl) {
      incidentControl.outerHTML = renderIncidentControl(appState.initialData.activeIncidents);
    }
  }
}

/**
 * Renders the static shell for the Command Board view and attaches its single delegated listener.
 */
function renderCommandBoardView(container, data) {
  if (!container) return;
  container.innerHTML = `
    <div id="view-only-banner" class="alert alert-info text-center" style="display:none; font-weight: bold;">You are in View-Only Mode</div>
    <div class="row flex-nowrap">
      <div class="col-md-3" id="commandSidebar">
        <div class="sidebar">
          ${renderIncidentControl(data.activeIncidents || [])}
          <div id="available-units-section"></div>
          <div id="split-units-section"></div>
        </div>
      </div>
      <div class="col-md-9" id="commandMainContent"></div>
    </div>
  `;

  setupCommandBoardEventListeners();

  const incidentSelect = document.getElementById("activeIncidentsSelect");
  const storageKey = `fcb_lastActiveIncidentId_${appState.currentUser.uid}`;
  const lastActiveId = sessionStorage.getItem(storageKey);

  if (lastActiveId && incidentSelect.querySelector(`option[value="${lastActiveId}"]`)) {
    incidentSelect.value = lastActiveId;
    handleActiveIncidentSelect();
  } else {
    clearIncidentDetails();
    loadAvailableUnits();
  }
}

/**
 * Renders the main content area for an active incident.
 */
function renderIncidentContent() {
  const incident = appState.currentIncident;
  const container = document.getElementById("commandMainContent");
  if (!container || !incident) {
    clearIncidentDetails();
    return;
  }
  const isDisabled = appState.isViewOnly ? 'disabled' : '';
  container.innerHTML = `
    <div class="main-content">
      <div id="current-incident-summary" class="d-flex flex-wrap align-items-center mb-2 p-2 border rounded bg-light">
        <span class="text-primary font-weight-bold mr-3">${incident.incidentNumber}</span>
        <span class="text-muted mr-3">${incident.incidentName || ""}</span>
        <span class="mr-3">Started: ${new Date(incident.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        <span class="font-weight-bold mr-3">${incident.status}</span>
        <div class="btn-group ml-auto">
          <button id="incidentViewRefreshBtn" class="btn btn-secondary btn-sm" title="Back to Incident List">
            <i class="fas fa-list-ul"></i> Back to List
          </button>
          <button id="closeIncidentBtn" class="btn btn-danger btn-sm" ${isDisabled}>
            Close Incident
          </button>
        </div>
      </div>
      <div id="incident-content-area">
        <div class="card shadow-sm mb-3">
          <div class="card-header"><h5>Add Groups to Incident</h5></div>
          <div class="card-body">
            <div class="row">
              <div class="col-md-4 form-group">
                <label><small><strong>1. Apply Template</strong></small></label>
                <div class="input-group">
                  <select id="templateSelect" class="form-control form-control-sm" ${isDisabled}></select>
                  <div class="input-group-append">
                    <button class="btn btn-info btn-sm" id="applyTemplateBtn" ${isDisabled}>Apply</button>
                  </div>
                </div>
              </div>
              <div class="col-md-4 form-group">
                <label><small><strong>2. Add Common Group</strong></small></label>
                <select id="commonGroupSelect" class="form-control form-control-sm" ${isDisabled}></select>
              </div>
              <div class="col-md-4 form-group">
                <label><small><strong>3. Add Custom Group</strong></small></label>
                <div class="input-group">
                  <input type="text" id="newGroupName" class="form-control form-control-sm" placeholder="Type Custom Name" ${isDisabled}>
                  <div class="input-group-append">
                    <button class="btn btn-success btn-sm" id="addGroupBtn" ${isDisabled}>Add</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h4>Command Groups</h4>
          <div id="reorder-buttons-container">
            <button id="reorderGroupsBtn" class="btn btn-outline-secondary btn-sm" ${isDisabled}>
                <i class="fas fa-sort"></i> Reorder Groups
            </button>
            <button id="cancelReorderBtn" class="btn btn-danger btn-sm" style="display: none;">
                Cancel Reorder
            </button>
          </div>
        </div>
        <div id="groupsContainer" class="row"></div>
      </div>
    </div>`;

  populateTemplateDropdown(appState.initialData.templates || []);
  populateCommonGroupsDropdown(appState.initialData.commonGroups || []);
  renderGroupCards(appState.currentIncident.groups || []);
  setIncidentActiveUI(true);
}

/**
 * Renders all group cards and initializes their client-side PAR timers.
 */
function renderGroupCards(allGroups) {
  const container = document.getElementById("groupsContainer");
  if (!container) return;
  if (!allGroups || allGroups.length === 0) {
    container.innerHTML = '<p class="text-muted col-12">No groups created yet.</p>';
    return;
  }
  container.innerHTML = buildGroupHierarchy(allGroups).map(node => renderGroupNode(node, new Map(allGroups.map(g => [g.id, g.groupName])))).join('');
  initializeParTimers(allGroups);
}

/**
 * Transforms a flat array of groups into a hierarchical tree structure.
 */
function buildGroupHierarchy(allGroups) {
  const groupMap = new Map();
  const tree = [];

  allGroups.forEach(group => {
    group.children = [];
    groupMap.set(group.id, group);
  });

  allGroups.forEach(group => {
    if (group.parentGroupId) {
      const parent = groupMap.get(group.parentGroupId);
      if (parent) {
        parent.children.push(group);
      }
    } else {
      tree.push(group);
    }
  });

  return tree;
}

/**
 * A recursive function that renders a single group and all of its descendants.
 */
function renderGroupNode(groupNode, groupNameMap) {
  const hasChildren = groupNode.children && groupNode.children.length > 0;
  const childrenHtml = hasChildren
    ? `<div class="child-groups-container">${groupNode.children.map(child => renderGroupNode(child, groupNameMap)).join('')}</div>`
    : '';

  let wrapperStyle = '';
  if (hasChildren) {
    const borderColor = groupNode.headerColor || '#dee2e6';
    wrapperStyle = `style="border-color: ${borderColor};"`;
  }

  if (!groupNode.parentGroupId) {
    return `
      <div class="col-md-3 mb-3 parent-group-wrapper ${hasChildren ? 'has-children' : ''}" ${wrapperStyle}>
        ${renderSingleGroupCard(groupNode, groupNameMap)}
        ${childrenHtml}
      </div>
    `;
  } else {
    return `
      <div class="mb-3 parent-group-wrapper ${hasChildren ? 'has-children' : ''}" ${wrapperStyle}>
        ${renderSingleGroupCard(groupNode, groupNameMap)}
        ${childrenHtml}
      </div>
    `;
  }
}

/**
 * Renders the HTML for a single group card, disabling controls if in view-only mode.
 */
function renderSingleGroupCard(group, groupMap) {
  if (group.units && group.units.length > 0) {
    group.units.sort((a, b) => {
      const isASupervisor = a.unitId === group.groupSupervisorUnitId;
      const isBSupervisor = b.unitId === group.groupSupervisorUnitId;
      if (isASupervisor && !isBSupervisor) return -1;
      if (!isASupervisor && isBSupervisor) return 1;
      const timeA = new Date(a.assignmentTime);
      const timeB = new Date(b.assignmentTime);
      if (timeA - timeB !== 0) return timeA - timeB;
      return (a.unit || "").localeCompare(b.unit || "");
    });
  }

  const isDisabled = appState.isViewOnly ? 'disabled' : '';
  const parStatus = group.parStatus || "Idle";
  let parButtonClass = "par-btn-idle";
  if (parStatus === "Active") parButtonClass = "par-btn-active";
  if (parStatus === "Expired") parButtonClass = "par-btn-expired";
  const parBtnData = `data-group-id="${group.id}" data-par-status="${parStatus}"`;
  const parButtonHtml = `<button class="btn par-btn ${parButtonClass} js-par-btn" ${parBtnData} ${isDisabled}>PAR</button>`;
  const multiUnitActionsHtml = appState.isViewOnly ? '' : `
    <div class="multi-unit-actions mt-2" style="display: none;">
      <div class="d-flex justify-content-between align-items-center bg-light p-1 rounded">
        <span class="multi-unit-selection-count small font-weight-bold pl-2"></span>
        <div>
          <button class="btn btn-sm btn-info py-0 px-1 js-multi-split" data-group-id="${group.id}">Split</button>
          <button class="btn btn-sm btn-warning py-0 px-1 ml-1 js-multi-move" data-group-id="${group.id}">Move</button>
          <button class="btn btn-sm btn-success py-0 px-1 ml-1 js-multi-release" data-group-id="${group.id}">Release</button>
        </div>
      </div>
    </div>`;

  let supervisorHtml = '';
  if (group.groupSupervisorName) {
    let elapsedTimeHtml = "";
    if (group.supervisorAssignmentTime) {
      const durationMs = new Date().getTime() - new Date(group.supervisorAssignmentTime).getTime();
      const totalMinutes = Math.floor(durationMs / 60000);
      elapsedTimeHtml = ` <small>(${formatDuration(totalMinutes)})</small>`;
    }
    const supText = `Supervisor: <strong>${group.groupSupervisorName}</strong>`;
    supervisorHtml = `<div style="font-size: 0.8em;">${supText}${elapsedTimeHtml}</div>`;
  }

  const benchmarks = [
    { name: "Fire", status: group.fireBenchmark || "Pending" },
    { name: "Search", status: group.searchBenchmark || "Pending" },
    { name: "Extension", status: group.extensionBenchmark || "Pending" },
  ];
  const benchmarkButtonsHtml = benchmarks.map(bm => {
    const btnClass = bm.status === 'Completed' ? 'btn-success' : bm.status === 'Started' ? 'btn-warning' : 'btn-light';
    const benchmarkName = `${bm.name.toLowerCase()}Benchmark`;
    const btnData = `data-group-id="${group.id}" data-benchmark-name="${benchmarkName}" data-current-status="${bm.status}"`;
    return `<button class="btn btn-sm ${btnClass} py-0 px-2 js-benchmark-btn" ${btnData} ${isDisabled}>${bm.name}</button>`;
  }).join('');

  const unitsHtml = (group.units && group.units.length > 0) ? group.units.map(unit => {
    const totalMinutes = Math.floor((new Date().getTime() - new Date(unit.assignmentTime).getTime()) / 60000);
    const elapsedTimeDisplay = formatDuration(totalMinutes);
    const safeUnitName = (unit.unit || "").replace(/'/g, "\\'");
    const isSupervisor = unit.unitId === group.groupSupervisorUnitId;
    const isSubunit = unit.parentUnitId != null;
    const checkboxId = `chk-group-unit-${unit.unitId}`;
    const isChecked = appState.selectedGroupUnits[group.id]?.has(unit.unitId) ? 'checked' : '';
    const supervisorBtnData = `data-group-id="${group.id}" data-unit-id="${unit.unitId}"`;
    const supervisorButton = isSupervisor ?
      `<button class="btn btn-sm btn-warning py-0 px-1 js-clear-supervisor" data-group-id="${group.id}" title="Clear Supervisor" ${isDisabled}>Clear Sup.</button>` :
      `<button class="btn btn-sm btn-outline-warning py-0 px-1 js-set-supervisor" ${supervisorBtnData} title="Set as Supervisor" ${isDisabled}>Set Sup.</button>`;
    const splitButtonHtml = !isSubunit ?
      `<button class="btn btn-sm btn-outline-info py-0 px-1 js-split-unit" ${supervisorBtnData} title="Split Unit" ${isDisabled}><i class="fas fa-code-branch"></i></button>` :
      '';
    const releaseButtonHtml = !isSubunit ?
      `<button class="btn btn-sm btn-outline-success py-0 px-1 js-release-unit" data-id="${unit.unitId}" data-name="${safeUnitName}" title="Release Unit" ${isDisabled}><i class="fas fa-check-circle"></i></button>` :
      '';
    const supervisorBadgeHtml = isSupervisor ?
      `<span class="badge badge-warning badge-pill ml-2" title="Group Supervisor">Sup</span>` :
      '';
    const checkboxData = `data-unit-id="${unit.unitId}" data-group-id="${group.id}" ${isChecked}`;
    const checkboxHtml = appState.isViewOnly ? '' : `<input type="checkbox" class="mr-2 group-unit-checkbox" id="${checkboxId}" ${checkboxData}>`;
    const labelHtml = `<label for="${checkboxId}" class="mb-0"><strong class="mr-2">${unit.unit}</strong>${supervisorBadgeHtml}<small class="text-muted ml-2">(${elapsedTimeDisplay})</small></label>`;
    const singleUnitActions = appState.isViewOnly ? '' : `
      <div class="single-unit-actions">
        <div class="btn-group">
          ${supervisorButton}
          ${splitButtonHtml}
          <button class="btn btn-sm btn-outline-secondary py-0 px-1 js-move-unit" data-id="${unit.unitId}" data-name="${safeUnitName}" title="Move Unit"><i class="fas fa-arrows-alt"></i></button>
          ${releaseButtonHtml}
        </div>
      </div>`;
    return `
      <div class="unit-in-group list-group-item d-flex justify-content-between align-items-center py-1 px-2">
        <div class="d-flex align-items-center">${checkboxHtml}${labelHtml}</div>
        ${singleUnitActions}
      </div>`;
  }).join('') : '<p class="text-muted p-2 no-units-assigned"><em>No units assigned.</em></p>';

  let reportsToHtml = '';
  if (group.parentGroupId) {
    const parentName = groupMap.get(group.parentGroupId) || 'Unknown';
    const clearParentBtn = appState.isViewOnly ? '' : `<button class="btn-clear-parent js-clear-parent" title="Remove from Group" data-child-group-id="${group.id}">×</button>`;
    reportsToHtml = `<div class="reports-to-bar d-flex justify-content-between align-items-center"><span>Reports to: <strong>${parentName}</strong></span>${clearParentBtn}</div>`;
  }
  const assignParentButton = appState.isViewOnly || group.parentGroupId ? '' : `<button class="btn btn-sm btn-outline-info py-0 px-1 js-assign-parent" data-group-id="${group.id}" title="Assign to Group"><i class="fas fa-sitemap"></i></button>`;
  const safeGroupName = group.groupName.replace(/'/g, "\\'");
  const disbandBtnData = `data-group-id="${group.id}" data-group-name="${safeGroupName}"`;
  const disbandButton = appState.isViewOnly ? '' : `<button class="btn btn-sm btn-outline-secondary py-0 px-1 js-disband-group" ${disbandBtnData} title="Disband Group"><i class="fas fa-trash"></i></button>`;

  const headerContent = `<div class="d-flex justify-content-between align-items-start"><div><h5 class="card-title mb-0">${group.groupName}</h5>${supervisorHtml}</div>${parButtonHtml}</div>${reportsToHtml}${multiUnitActionsHtml}`;
  const footerContent = `<div class="d-flex justify-content-between align-items-center w-100"><div style="flex-basis: 60px;" class="d-flex">${assignParentButton}</div><div class="btn-group btn-group-sm mx-auto">${benchmarkButtonsHtml}</div><div style="flex-basis: 60px;" class="d-flex justify-content-end">${disbandButton}</div></div>`;
  const headerStyle = `style="background-color: ${group.headerColor || '#6c757d'}; color: ${getContrastYIQ(group.headerColor)};"`;
  const cardData = `id="group-card-${group.id}" data-group-id="${group.id}" data-is-child="${!!group.parentGroupId}"`;

  return `<div class="card shadow-sm group-card" ${cardData} onclick="handleGroupCardClick('${group.id}')"><div class="card-header" ${headerStyle}>${headerContent}</div><div class="card-body p-0"><div class="list-group list-group-flush">${unitsHtml}</div></div><div class="card-footer text-center p-1">${footerContent}</div></div>`;
}

// ===================================================================
//
//  EVENT BINDING (DEFINITIVE ARCHITECTURE)
//
// ===================================================================

/**
 * FINAL ARCHITECTURE: Sets up a single, delegated event listener for the
 * entire command board view. This is more efficient and robust than attaching
 * listeners to individual elements, as it works automatically for any
 * content that is re-rendered.
 */
function setupCommandBoardEventListeners() {
    const container = document.getElementById('commandBoardView');
    if (!container || container.dataset.listenersAttached === 'true') {
        return; // Ensure this is only run once.
    }
    container.dataset.listenersAttached = 'true';

    // --- CLICK LISTENER ---
    container.addEventListener('click', (event) => {
        const target = event.target;
        const button = target.closest('button');
        if (!button) return; // Ignore clicks that aren't on a button

        // Sidebar Actions
        if (button.id === 'startNewIncidentBtn') handleStartNewIncident();
        if (button.id === 'takeCommandBtn') handleTakeCommandClick();
        if (button.id === 'viewOnlyBtn') handleViewOnlyClick();

        // Main Incident Content Actions
        if (button.id === 'incidentViewRefreshBtn') handleManualRefresh();
        if (button.id === 'closeIncidentBtn') handleCloseIncident();
        if (button.id === 'applyTemplateBtn') handleApplyTemplate();
        if (button.id === 'addGroupBtn') handleAddGroup();
        if (button.id === 'reorderGroupsBtn') toggleReorderMode();
        if (button.id === 'cancelReorderBtn') toggleReorderMode();

        // Group Card and Unit Actions (using class selectors)
        if (button.matches('.js-set-supervisor')) handleSetSupervisor(button.dataset.groupId, button.dataset.unitId);
        if (button.matches('.js-clear-supervisor')) handleClearSupervisor(button.dataset.groupId);
        if (button.matches('.js-split-unit')) splitUnit(button);
        if (button.matches('.js-release-unit')) handleReleaseUnitClick(button.dataset.id, button.dataset.name);
        if (button.matches('.js-move-unit')) handleMoveUnitClick(button.dataset.id, button.dataset.name);
        if (button.matches('.js-benchmark-btn')) handleBenchmarkClick(button.dataset.groupId, button.dataset.benchmarkName, button.dataset.currentStatus);
        if (button.matches('.js-par-btn')) handleParButtonClick(button);
        if (button.matches('.js-disband-group')) handleDisbandGroupClick(button);
        if (button.matches('.js-assign-parent')) handleAssignParentClick(button);
        if (button.matches('.js-clear-parent')) handleClearParentClick(button);
        if (button.matches('.js-unsplit-unit')) openUnsplitUnitModal(button);

        // Multi-Unit Actions
        if (button.matches('.js-multi-split')) handleMultiSplitClick(button);
        if (button.matches('.js-multi-move')) handleMultiMoveClick(button);
        if (button.matches('.js-multi-release')) handleMultiReleaseClick(button);
    });

    // --- CHANGE LISTENER ---
    container.addEventListener('change', (event) => {
        const target = event.target;

        if (target.id === 'activeIncidentsSelect') handleActiveIncidentSelect();
        if (target.id === 'commonGroupSelect') handleAddGroup(); // For selecting a common group
        if (target.matches('.available-unit-checkbox')) handleAvailableUnitCheckboxChange(target);
        if (target.matches('.group-unit-checkbox')) handleGroupUnitCheckboxChange(target);
    });
}


// ===================================================================
//
//  COMMAND AND INCIDENT LIFECYCLE HANDLERS
//
// ===================================================================

async function handleTakeCommandClick() {
  if (!appState.currentIncident || !appState.sessionId) return;

  const actionButton = document.getElementById("takeCommandBtn");
  const buttonText = actionButton.textContent.trim();
  const incidentId = appState.currentIncident.id;

  // --- THIS IS THE CRITICAL FIX ---
  // We now differentiate between re-establishing and taking command.
  if (buttonText === "Re-establish Command") {
    showLoader();
    try {
      // Call the new, dedicated API action for this specific case.
      await callApi("reestablishCommand", { incidentId, sessionId: appState.sessionId }, 'POST');
      // On success, use the safe reloader.
      await reloadCurrentIncidentView();
    } catch (error) {
      showError(`Could not re-establish command: ${error.message}`);
      hideLoader();
    }
    return;
  }
  // --- END OF CRITICAL FIX ---

  const primaryActionTexts = ["Take Command", "Take Over Command"];
  if (primaryActionTexts.includes(buttonText)) {
    if (appState.currentIncident.commanderUid && appState.currentIncident.commanderUid !== appState.currentUser.uid) {
      if (!confirm("Are you sure you want to take command from another user?")) return;
    }
    showLoader();
    try {
      // The generic "take command" action is still used for other cases.
      await callApi("takeIncidentCommand", { incidentId, sessionId: appState.sessionId }, 'POST');
      await reloadCurrentIncidentView();
    } catch (error) {
      showError(`Could not take command: ${error.message}`);
      hideLoader();
    }
    return;
  }

  if (buttonText === "Request Command") {
    actionButton.disabled = true;
    actionButton.textContent = "Sending Request...";
    try {
      appState.isCommandRequestPending = true;
      const response = await callApi("requestIncidentCommand", { incidentId, sessionId: appState.sessionId }, 'POST');
      if (!response.success) throw new Error(response.message);
      actionButton.textContent = "Request Sent...";
      listenForMyRequestStatus(response.data.id);
    } catch (error) {
      showError(`Could not request command: ${error.message}`);
      actionButton.disabled = false;
      actionButton.textContent = "Request Command";
      appState.isCommandRequestPending = false;
    }
  }
}

/**
 * Handles the click of the "View Only" button.
 * This function now correctly calls the "dumb renderer" (loadAndDisplayIncident)
 * directly, immediately and safely putting the user into View Only mode
 * without any risk of a race condition or state re-evaluation.
 */
async function handleViewOnlyClick() {
  if (!appState.currentIncident) return;

  // THE CRITICAL FIX:
  // We call the renderer directly, passing it the data we already have
  // and explicitly telling it to render in "View Only" mode. This is the
  // user's explicit choice and we must obey it directly.
  await loadAndDisplayIncident(appState.currentIncident, true);
}

/**
 * The master function to fully load all data for an incident and render it.
 * This is the "Dumb Renderer". It should only be called by a function that
 * has already fetched fresh data.
 */
async function loadAndDisplayIncident(incidentData, isViewOnly = false) {
  clearAllIncidentListeners();
  appState.currentIncident = incidentData;
  appState.isViewOnly = isViewOnly;
  sessionStorage.setItem(`fcb_lastActiveIncidentId_${appState.currentUser.uid}`, incidentData.id);

  showLoader();
  try {
    await Promise.all([
      loadGroupsForCurrentIncident(),
      loadSplitUnits(),
      loadAvailableUnits()
    ]);

    renderIncidentContent();
    listenForIncidentChanges();

    if (!appState.isViewOnly) {
      listenForCommandRequests();
    }
  } catch (error) {
    showError(error.message);
    clearIncidentDetails();
  } finally {
    hideLoader();
  }
}

/**
 * The "Smart Reloader". Its job is to fetch the latest truth from the
 * server and then delegate the work of drawing the screen to the "Dumb Renderer".
 */
async function reloadCurrentIncidentView() {
  if (!appState.currentIncident) {
    await handleManualRefresh();
    return;
  }
  const incidentId = appState.currentIncident.id;
  try {
    const response = await callApi("getIncidentDetails", { incidentId });
    if (!response.success) throw new Error(response.message);
    const latestIncidentData = response.data;
    const amINowTheCommander = latestIncidentData.commanderUid === appState.currentUser.uid;
    await loadAndDisplayIncident(latestIncidentData, !amINowTheCommander);
  } catch (error) {
    showError("Failed to reload the incident view. You may need to return to the list and re-select the incident.");
  }
}

async function loadGroupsForCurrentIncident() {
    if (!appState.currentIncident) return;
    try {
        const response = await callApi("getGroupsForIncident", {
            incidentId: appState.currentIncident.id,
        });
        if (response.success) {
            if (appState.currentIncident) {
                appState.currentIncident.groups = response.data;
            }
        } else {
            showError(response.message);
            if (appState.currentIncident) appState.currentIncident.groups = [];
        }
    } catch (error) {
        showError(error.message);
        if (appState.currentIncident) appState.currentIncident.groups = [];
    }
}

function clearIncidentDetails() {
  clearAllIncidentListeners();
  appState.currentIncident = null;
  appState.isViewOnly = false;
  appState.isCommandRequestPending = false;
  const mainContent = document.getElementById("commandMainContent");
  if (mainContent) mainContent.innerHTML = "";
  setIncidentActiveUI(false);
}

function clearAllIncidentListeners() {
    if (mainIncidentListener) mainIncidentListener();
    if (commandRequestListener) commandRequestListener();
    if (myRequestStatusListener) myRequestStatusListener();
    if (groupsListener) groupsListener();
    if (assignmentsListener) assignmentsListener();
    mainIncidentListener = null;
    commandRequestListener = null;
    myRequestStatusListener = null;
    groupsListener = null;
    assignmentsListener = null;
}

/**
 * Handles selecting an incident from the dropdown. This definitive version
 * correctly distinguishes between an incident commanded by another user vs.
 * one commanded by the current user on a different device, preventing a user
 * from requesting command from themselves.
 */
async function handleActiveIncidentSelect() {
  clearAllIncidentListeners();
  const select = document.getElementById("activeIncidentsSelect");
  const actionButtons = document.getElementById("incident-action-buttons");
  const takeCommandBtn = document.getElementById("takeCommandBtn");
  const viewOnlyBtn = document.getElementById("viewOnlyBtn");

  // Reset the UI to a clean state
  if (!select || !select.value) {
    if (actionButtons) actionButtons.style.display = "none";
    appState.currentIncident = null;
    return;
  }
  const incidentId = select.value;
  actionButtons.style.display = "block";
  takeCommandBtn.style.display = "block";
  takeCommandBtn.disabled = true;
  takeCommandBtn.textContent = "Verifying Status...";
  viewOnlyBtn.style.display = "none";

  try {
    const response = await callApi("getIncidentDetails", { incidentId });
    if (!response.success) throw new Error(response.message);
    appState.currentIncident = response.data;
    const incident = appState.currentIncident;

    // --- THIS IS THE FINAL, CORRECTED LOGIC HIERARCHY ---
    const isCommanded = !!incident.commanderUid;
    const isCommandedByMyUser = isCommanded && incident.commanderUid === appState.currentUser.uid;
    const isCommandedByThisSession = isCommandedByMyUser && incident.commanderSessionId === appState.sessionId;

    const canRequestOrView = appState.planLevel !== 'Basic';
    takeCommandBtn.style.display = 'block';
    viewOnlyBtn.style.display = 'none';

    if (!isCommanded) {
      // SCENARIO 1: Incident is available.
      takeCommandBtn.textContent = "Take Command";
      takeCommandBtn.disabled = false;
    } else {
      // Incident is commanded by someone.
      if (isCommandedByThisSession) {
        // SCENARIO 2: Commanded by a dead session on this device.
        takeCommandBtn.textContent = "Re-establish Command";
        takeCommandBtn.disabled = false;
      } else if (isCommandedByMyUser) {
        // SCENARIO 3: Commanded by ME, but on a DIFFERENT device (iPad-1).
        // A user cannot request command from themselves.
        takeCommandBtn.textContent = "Commanded on another device";
        takeCommandBtn.disabled = true;
        if (canRequestOrView) {
          viewOnlyBtn.style.display = 'block';
        }
      } else {
        // SCENARIO 4: Commanded by a DIFFERENT user.
        if (canRequestOrView) {
          takeCommandBtn.textContent = "Request Command";
          takeCommandBtn.disabled = false;
          viewOnlyBtn.style.display = 'block';
        } else {
          // Basic plan user looking at another user's incident.
          takeCommandBtn.textContent = "Commanded by another user";
          takeCommandBtn.disabled = true;
        }
      }
    }
    // --- END OF FINAL LOGIC ---

  } catch (error) {
    showError(`Failed to get incident details: ${error.message}`);
  }
}

async function handleCloseIncident() {
  if (appState.isViewOnly || !appState.currentIncident) return;
  if (!confirm(`Are you sure you want to CLOSE incident ${appState.currentIncident.incidentNumber}?`)) return;
  clearAllIncidentListeners();
  showLoader();
  try {
    await callApi("closeIncident", { incidentId: appState.currentIncident.id }, 'POST');
    await handleManualRefresh();
  } catch (error) {
    showError(error.message);
    hideLoader();
  }
}

/**
 * Attaches all necessary real-time listeners for an active incident.
 * This definitive version is session-aware, preventing race conditions when a
 * user is active on multiple devices. It only triggers a full UI reload when
 * the command status of THIS SPECIFIC SESSION changes.
 */
function listenForIncidentChanges() {
  if (mainIncidentListener) mainIncidentListener();
  if (!appState.currentIncident) return;

  const db = firebase.firestore();
  const incidentId = appState.currentIncident.id;
  const customerId = appState.initialData.customerId;

  mainIncidentListener = db.collection("incidents").doc(incidentId)
    .onSnapshot(async (doc) => {
      // --- THIS IS THE NEW, ROBUST LOGIC ---
      // Determine the command status of THIS BROWSER before the update.
      const amICurrentlyTheCommander =
        !appState.isViewOnly &&
        appState.currentIncident.commanderSessionId === appState.sessionId;

      if (!doc.exists || doc.data().status !== 'Active') {
        alert("This incident is no longer active. Returning to the main list.");
        await handleManualRefresh();
        return;
      }

      const freshData = doc.data();
      // Determine what the command status of THIS BROWSER *should be* now.
      const shouldINowBeTheCommander =
        freshData.commanderUid === appState.currentUser.uid &&
        freshData.commanderSessionId === appState.sessionId;

      // The critical comparison: Only trigger a reload if the command status
      // for this specific session has changed.
      if (shouldINowBeTheCommander !== amICurrentlyTheCommander) {
        const logMsg = "Command status change for this session detected. " +
          "Triggering a full, safe reload of the incident view.";
        console.log(logMsg);
        await reloadCurrentIncidentView();
      } else {
        // If our command status hasn't changed, update the incident data
        // in the background without a full redraw.
        appState.currentIncident = { id: doc.id, ...freshData };
      }
      // --- END OF NEW LOGIC ---
    });

  const refreshTacticalView = async () => {
    if (!appState.currentIncident) return;
    await loadGroupsForCurrentIncident();
    renderGroupCards(appState.currentIncident.groups || []);
  };

  groupsListener = db.collection("groups")
    .where("incidentId", "==", incidentId)
    .where("customerId", "==", customerId)
    .onSnapshot(refreshTacticalView);

  assignmentsListener = db.collection("assignments")
    .where("incidentId", "==", incidentId)
    .where("customerId", "==", customerId)
    .onSnapshot(refreshTacticalView);
}

// ===================================================================
//
//  COMMAND REQUEST WORKFLOW
//
// ===================================================================

/**
 * Listens for incoming command requests for the active commander.
 */
function listenForCommandRequests() {
  if (commandRequestListener) commandRequestListener();
  if (!appState.currentIncident || appState.isViewOnly) return;

  const db = firebase.firestore();
  commandRequestListener = db.collection("commandRequests")
    .where("incidentId", "==", appState.currentIncident.id)
    .where("currentCommanderUid", "==", appState.currentUser.uid)
    .where("status", "==", "pending")
    .onSnapshot((snapshot) => {
      if (!snapshot.empty) {
        const request = snapshot.docs[0].data();
        const requestId = snapshot.docs[0].id;
        const requesterName = document.getElementById("requesterNameDisplay");
        if (requesterName) requesterName.textContent = request.requesterName || "An unknown user";
        const approveBtn = document.getElementById("approveCommandRequestBtn");
        const denyBtn = document.getElementById("denyCommandRequestBtn");
        if (approveBtn) approveBtn.dataset.requestId = requestId;
        if (denyBtn) denyBtn.dataset.requestId = requestId;
        $('#commandRequestModal').modal('show');
      } else {
        $('#commandRequestModal').modal('hide');
      }
    }, (error) => {
      console.error("Listener for incoming command requests failed:", error);
    });
}

/**
 * Listens for the status of a command request that THIS user sent.
 */
function listenForMyRequestStatus(requestId) {
  if (myRequestStatusListener) myRequestStatusListener();

  const db = firebase.firestore();
  myRequestStatusListener = db.collection("commandRequests").doc(requestId)
    .onSnapshot(async (doc) => {
      if (!doc.exists) {
        if (myRequestStatusListener) myRequestStatusListener();
        appState.isCommandRequestPending = false;
        return;
      }
      const requestData = doc.data();
      if (requestData.status === 'approved') {
        if (myRequestStatusListener) myRequestStatusListener();
        appState.isCommandRequestPending = false;
        console.log("My command request was approved. Triggering smart reload into command mode.");
        await reloadCurrentIncidentView();
      }
      else if (requestData.status === 'denied') {
        if (myRequestStatusListener) myRequestStatusListener();
        appState.isCommandRequestPending = false;
        alert("Your request to take command was denied.");
        const takeCommandBtn = document.getElementById("takeCommandBtn");
        if (takeCommandBtn) {
            takeCommandBtn.textContent = "Request Command";
            takeCommandBtn.disabled = false;
        }
      }
    }, (error) => {
      if (myRequestStatusListener) myRequestStatusListener();
      appState.isCommandRequestPending = false;
      console.error("Listener for my request status failed:", error);
    });
}

/**
 * Handles the click of the "Approve" button in the command request modal.
 */
async function handleApproveCommandRequest() {
    const approveBtn = document.getElementById("approveCommandRequestBtn");
    const requestId = approveBtn.dataset.requestId;
    if (!requestId) return;
    $('#commandRequestModal').modal('hide');
    showLoader();
    try {
        await callApi("approveCommandRequest", { requestId: requestId }, 'POST');
    } catch (error) {
        showError(error.message);
        hideLoader();
    }
}

/**
 * Handles the click of the "Deny" button in the command request modal.
 */
async function handleDenyCommandRequest() {
  const denyBtn = document.getElementById("denyCommandRequestBtn");
  const requestId = denyBtn.dataset.requestId;
  if (!requestId) return;
  $('#commandRequestModal').modal('hide');
  showLoader();
  try {
    await callApi("denyCommandRequest", { requestId: requestId }, 'POST');
  } catch (error) {
    showError(error.message);
  } finally {
    hideLoader();
  }
}

// ===================================================================
//
//  TACTICAL GROUP AND UNIT HANDLERS
//
// ===================================================================

/**
 * The main "traffic cop" click handler for a group card.
 */
async function handleGroupCardClick(clickedGroupId) {
    if (appState.isReorderModeActive) {
        handleReorderClick(clickedGroupId);
        return;
    }
    if (appState.isAssignParentModeActive) {
        const { childGroupId } = appState.groupToAssignParent;
        const parentGroupId = clickedGroupId;
        if (childGroupId === parentGroupId) {
            appState.isAssignParentModeActive = false;
            appState.groupToAssignParent = null;
            updateAssignParentModeUI();
            return;
        }
        showLoader();
        try {
            await callApi('setGroupParent', {
                incidentId: appState.currentIncident.id,
                childGroupId,
                parentGroupId,
            });
            appState.isAssignParentModeActive = false;
            appState.groupToAssignParent = null;
            updateAssignParentModeUI();
            await reloadCurrentIncidentView();
        } catch (error) {
            showError(error.message);
            hideLoader();
        }
        return;
    }
    if (appState.isMultiMoveActive) {
        const { fromGroupId, unitIds } = appState.unitsToMultiMove;
        if (clickedGroupId === fromGroupId) {
            appState.isMultiMoveActive = false;
            appState.unitsToMultiMove = null;
            updateMultiMoveModeUI(false);
            return;
        }
        showLoader();
        try {
            await callApi("moveMultipleUnits", {
                incidentId: appState.currentIncident.id,
                newGroupId: clickedGroupId,
                unitIds: unitIds.join(','),
            });
            clearGroupSelectionState();
            appState.isMultiMoveActive = false;
            appState.unitsToMultiMove = null;
            updateMultiMoveModeUI(false);
            await reloadCurrentIncidentView();
        } catch (error) {
            showError(error.message);
            hideLoader();
        }
        return;
    }
    if (appState.unitToMove) {
        handleGroupCardMoveClick(clickedGroupId);
        return;
    }
    if (appState.selectedAvailableUnits.size > 0) {
        handleGroupCardAssignment(clickedGroupId);
        return;
    }
}

async function handleGroupCardAssignment(groupId) {
  if (appState.isViewOnly) return;
  const selectedIds = Array.from(appState.selectedAvailableUnits);
  if (selectedIds.length === 0) return;
  showLoader();
  try {
    await callApi("assignUnitsToGroup", {
      incidentId: appState.currentIncident.id,
      groupId,
      unitIds: selectedIds.join(",")
    });
    appState.selectedAvailableUnits.clear();
    updateAssignmentModeUI();
    await reloadCurrentIncidentView();
  } catch (error) {
    showError(error.message);
    hideLoader();
  }
}

async function handleGroupCardMoveClick(newGroupId) {
  if (appState.isViewOnly) return;
  const unitToMove = appState.unitToMove;
  if (!unitToMove) return;
  showLoader();
  try {
    await callApi("moveUnitToNewGroup", {
      incidentId: appState.currentIncident.id,
      unitId: unitToMove.unitId,
      newGroupId,
    });
    appState.unitToMove = null;
    updateMoveModeUI();
    clearGroupSelectionState();
    await reloadCurrentIncidentView();
  } catch (error) {
    showError(error.message);
    hideLoader();
  }
}

async function handleReorderClick(clickedGroupId) {
    if (!appState.groupToMove) {
        appState.groupToMove = clickedGroupId;
        updateReorderModeUI();
    } else {
        if (appState.groupToMove === clickedGroupId) {
            appState.groupToMove = null;
            updateReorderModeUI();
            return;
        }
        const movingId = appState.groupToMove;
        const destinationId = clickedGroupId;
        const originalOrderIds = appState.currentIncident.groups
            .filter(g => !g.parentGroupId)
            .map(g => g.id);
        const sourceIndex = originalOrderIds.indexOf(movingId);
        const destinationIndex = originalOrderIds.indexOf(destinationId);
        if (sourceIndex === -1 || destinationIndex === -1) {
            console.error("Reorder failed: a selected group was not a top-level group.");
            toggleReorderMode();
            return;
        }
        const newOrder = [...originalOrderIds];
        const [itemToMove] = newOrder.splice(sourceIndex, 1);
        newOrder.splice(destinationIndex, 0, itemToMove);
        toggleReorderMode();
        showLoader();
        try {
            await callApi('updateGroupOrder', {
                incidentId: appState.currentIncident.id,
                groupIds: newOrder.join(','),
            });
            await reloadCurrentIncidentView();
        } catch (error) {
            showError(error.message);
            hideLoader();
        }
    }
}

async function handleSetSupervisor(groupId, unitId) {
  if (appState.isViewOnly) return;
  showLoader();
  try {
    await callApi("setGroupSupervisor", {
      groupId: groupId,
      unitId: unitId,
      incidentId: appState.currentIncident.id,
    });
    clearGroupSelectionState();
    await reloadCurrentIncidentView();
  } catch (error) {
    showError(error.message);
    hideLoader();
  }
}

async function handleClearSupervisor(groupId) {
  if (appState.isViewOnly) return;
  showLoader();
  try {
    await callApi("clearGroupSupervisor", {
      groupId: groupId,
      incidentId: appState.currentIncident.id,
    });
    clearGroupSelectionState();
    await reloadCurrentIncidentView();
  } catch (error) {
    showError(error.message);
    hideLoader();
  }
}

async function handleMultiReleaseClick(button) {
  const groupId = button.dataset.groupId;
  const unitIds = Array.from(appState.selectedGroupUnits[groupId] || []);
  if (unitIds.length === 0 || appState.isViewOnly) return;
  showLoader();
  try {
    await callApi("releaseMultipleUnits", {
      incidentId: appState.currentIncident.id,
      unitIds: unitIds.join(','),
    });
    clearGroupSelectionState();
    await reloadCurrentIncidentView();
  } catch (error) {
    showError(error.message);
    hideLoader();
  }
}

async function handleReleaseUnitClick(unitId, unitName) {
  if (appState.isViewOnly) return;
  showLoader();
  try {
    await callApi("releaseUnitToAvailable", {
      incidentId: appState.currentIncident.id,
      unitId: unitId,
    });
    clearGroupSelectionState();
    await reloadCurrentIncidentView();
  } catch (error) {
    showError(error.message);
    hideLoader();
  }
}

async function handleMultiSplitClick(button) {
  if (appState.isViewOnly) return;
  const groupId = button.dataset.groupId;
  const unitIds = Array.from(appState.selectedGroupUnits[groupId] || []);
  if (unitIds.length === 0) return;
  if (!confirm(`Are you sure you want to split ${unitIds.length} selected unit(s)?`)) {
      return;
  }
  showLoader();
  try {
      await callApi("splitMultipleUnits", {
          incidentId: appState.currentIncident.id,
          unitIds: unitIds.join(','),
          groupId,
      });
      clearGroupSelectionState();
      await reloadCurrentIncidentView();
  } catch (error) {
      showError(error.message);
      hideLoader();
  }
}

async function splitUnit(button) {
  const { unitId, groupId } = button.dataset;
  if (!unitId || !groupId || appState.isViewOnly) return;
  showLoader();
  try {
    await callApi("splitUnit", {
      incidentId: appState.currentIncident.id,
      unitId,
      groupId,
    });
    clearGroupSelectionState();
    await reloadCurrentIncidentView();
  } catch (error) {
    showError(error.message);
    hideLoader();
  }
}

async function handleDisbandGroupClick(button) {
    if (appState.isViewOnly) return;
    const { groupId, groupName } = button.dataset;
    const confirmationMessage = `Are you sure you want to permanently disband the "${groupName}" group? This action cannot be undone.`;
    if (!confirm(confirmationMessage)) return;
    showLoader();
    try {
        await callApi('disbandGroup', {
            incidentId: appState.currentIncident.id,
            groupId: groupId,
        });
        await reloadCurrentIncidentView();
    } catch (error) {
        showError(error.message);
        hideLoader();
    }
}

function handleAssignParentClick(button) {
    if (appState.isViewOnly) return;
    const childGroupId = button.dataset.groupId;
    appState.isAssignParentModeActive = true;
    appState.groupToAssignParent = { childGroupId };
    updateAssignParentModeUI();
}

async function handleClearParentClick(button) {
    if (appState.isViewOnly) return;
    const childGroupId = button.dataset.childGroupId;
    showLoader();
    try {
        await callApi('clearGroupParent', {
            incidentId: appState.currentIncident.id,
            childGroupId,
        });
        await reloadCurrentIncidentView();
    } catch (error) {
        showError(error.message);
        hideLoader();
    }
}

async function handleAddGroup() {
  if (appState.isViewOnly || !appState.currentIncident) return;
  const groupNameInput = document.getElementById("newGroupName");
  const commonGroupSelect = document.getElementById("commonGroupSelect");
  let groupNameToCreate = groupNameInput.value.trim();

  if (commonGroupSelect && commonGroupSelect.value) {
      groupNameToCreate = commonGroupSelect.value;
  }

  if (!groupNameToCreate) {
    showError("Please enter a custom group name or select a common group.");
    return;
  }

  showLoader();
  try {
    await callApi("createGroupForIncident", {
      incidentId: appState.currentIncident.id,
      groupName: groupNameToCreate,
    });
    if (groupNameInput) groupNameInput.value = "";
    if (commonGroupSelect) commonGroupSelect.value = "";
    await reloadCurrentIncidentView();
  } catch (error) {
    showError(error.message);
    hideLoader();
  }
}

async function handleApplyTemplate() {
  const select = document.getElementById("templateSelect");
  if (!select || !select.value || appState.isViewOnly || !appState.currentIncident) return;
  showLoader();
  try {
    await callApi("applyTemplateToIncident", {
      incidentId: appState.currentIncident.id,
      templateId: select.value,
    });
    await reloadCurrentIncidentView();
  } catch (error) {
    showError(error.message);
    hideLoader();
  }
}

async function handleBenchmarkClick(groupId, benchmarkName, currentStatus) {
  if (appState.isViewOnly) return;
  const statusCycle = { "Pending": "Started", "Started": "Completed", "Completed": "Pending" };
  const newStatus = statusCycle[currentStatus];
  showLoader();
  try {
    await callApi("updateGroupBenchmark", {
      groupId, benchmarkName, newStatus,
    });
    await reloadCurrentIncidentView();
  } catch (error) {
    showError(error.message);
    hideLoader();
  }
}

function renderIncidentControl(activeIncidents) {
  const options = (activeIncidents || []).map(inc => {
    let statusText = "Available";
    if (inc.commanderUid) {
        statusText = (inc.commanderUid === appState.currentUser.uid) ? "Command Reserved for You" : "Commanded by another user";
    }
    return `<option value="${inc.id}">${inc.incidentNumber} - ${inc.incidentName || "Unnamed"} [${statusText}]</option>`;
  }).join("");

  return `
    <div class="card mb-2 shadow-sm">
      <div class="card-header p-0"><h5 class="mb-0"><button class="btn btn-light btn-block text-left d-flex justify-content-between align-items-center py-2 px-3" type="button" data-toggle="collapse" data-target="#collapseIncidentControl" aria-expanded="true"><span>Incident Setup & Selection</span></button></h5></div>
      <div id="collapseIncidentControl" class="collapse show"><div class="card-body p-3">
        <div class="form-group"><label><b>Select Active Incident:</b></label><select id="activeIncidentsSelect" class="form-control"><option value="">-- Select or Create --</option>${options}</select></div>

        <div id="incident-action-buttons" class="mt-2" style="display:none;">
            <button id="takeCommandBtn" class="btn btn-success btn-block">Take Command</button>
            <button id="viewOnlyBtn" class="btn btn-info btn-block">View in Read-Only Mode</button>
        </div>

        <p class="text-center my-2">OR</p>
        <h5 class="mb-2">Create New Incident:</h5>
        <div class="form-group"><label for="incidentNumber">Incident Number (CAD):</label><input type="text" id="incidentNumber" class="form-control form-control-sm" placeholder="Leave blank to auto-generate"></div>
        <div class="form-group"><label for="incidentName">Incident Name (Optional):</label><input type="text" id="incidentName" class="form-control form-control-sm"></div>
        <button id="startNewIncidentBtn" class="btn btn-primary btn-block btn-sm">Start New Incident</button>
      </div></div>
    </div>`;
}

function setIncidentActiveUI(isActive) {
  const collapseTarget = document.getElementById("collapseIncidentControl");
  if (window.$ && collapseTarget) {
      isActive ? $(collapseTarget).collapse("hide") : $(collapseTarget).collapse("show");
  }
}

async function loadAvailableUnits() {
  const container = document.getElementById("available-units-section");
  if (!container) return;
  container.innerHTML = `<p class="text-muted p-2"><em>Loading...</em></p>`;
  try {
    const response = await callApi("getAllAvailableUnitsGroupedByDept", {});
    if (response.success) {
      appState.departmentsWithAvailableUnits = response.data.departmentsWithUnits;
      container.innerHTML = renderAvailableUnitsAccordion(
        appState.departmentsWithAvailableUnits,
      );
      const accordion = $('#available-units-accordion');
      if (accordion.length > 0) {
        accordion.on('show.bs.collapse', function (e) {
          const card = e.target.closest('.card');
          if (card && card.dataset.deptId) appState.openAvailableUnitsPanels.add(card.dataset.deptId);
        });
        accordion.on('hide.bs.collapse', function (e) {
          const card = e.target.closest('.card');
          if (card && card.dataset.deptId) appState.openAvailableUnitsPanels.delete(card.dataset.deptId);
        });
      }
    } else {
      container.innerHTML = `<div class="p-2 text-danger"><em>${response.message}</em></div>`;
    }
  } catch (error) {
     container.innerHTML = `<div class="p-2 text-danger"><em>${error.message}</em></div>`;
  }
}

function renderAvailableUnitsAccordion(departmentsWithUnits) {
  if (!departmentsWithUnits || departmentsWithUnits.length === 0) {
    return `<div class="mt-2"><h4>Available Units</h4><div class="p-2 text-muted"><em>No units are available.</em></div></div>`;
  }
  const isDisabled = appState.isViewOnly ? 'disabled' : '';
  const accordionId = 'available-units-accordion';
  const accordionHtml = departmentsWithUnits.map((dept) => {
    const deptCollapseId = `avail-dept-collapse-${dept.id}`;
    const totalUnitsInDept = dept.units.length;
    const isFirstRender = appState.openAvailableUnitsPanels.size === 0;
    const isShown = (isFirstRender && dept.isPrimary) || appState.openAvailableUnitsPanels.has(dept.id);
    const showClass = isShown ? 'show' : '';
    const tableHtml = `
      <div class="table-responsive">
        <table class="table table-sm table-hover available-units-table">
          <thead>
            <tr>
              <th scope="col" style="width: 5%;"></th>
              <th scope="col">Unit</th>
              <th scope="col">Name</th>
              <th scope="col">Station</th>
            </tr>
          </thead>
          <tbody>
            ${dept.units.map(unit => `
              <tr>
                <td>
                  <input type="checkbox" class="available-unit-checkbox" id="chk-avail-${unit.id}" data-unit-id="${unit.id}" ${isDisabled}>
                </td>
                <td>${unit.unit}</td>
                <td>${unit.unitName || ''}</td>
                <td>${unit.stationName || ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;
    return `
      <div class="card mb-1" data-dept-id="${dept.id}">
        <div class="card-header p-0">
          <h5 class="mb-0">
            <button class="btn btn-light btn-block text-left d-flex justify-content-between align-items-center" type="button" data-toggle="collapse" data-target="#${deptCollapseId}">
              ${dept.departmentName}
              <span class="badge badge-primary badge-pill">${totalUnitsInDept}</span>
            </button>
          </h5>
        </div>
        <div id="${deptCollapseId}" class="collapse ${showClass}">
          <div class="card-body p-0">${tableHtml}</div>
        </div>
      </div>
    `;
  }).join('');
  return `<div class="mt-2"><h4>Available Units</h4><div class="accordion" id="${accordionId}">${accordionHtml}</div></div>`;
}

async function handleStartNewIncident() {
  const incidentNumberInput = document.getElementById("incidentNumber");
  const incidentNameInput = document.getElementById("incidentName");
  if (!appState.sessionId) {
      showError("Session not initialized. Cannot start incident.");
      return;
  }
  showLoader();
  try {
    const response = await callApi("startNewIncident", {
      incidentNumber: incidentNumberInput.value,
      incidentName: incidentNameInput.value,
      sessionId: appState.sessionId,
    }, 'POST');
    if (response.success && response.data) {
      const initialDataResponse = await callApi("getInitialData");
      if (initialDataResponse.success) appState.initialData = initialDataResponse.data;
      const sidebar = document.getElementById('commandSidebar');
      if (sidebar) {
        const incidentControl = sidebar.querySelector('.card');
        if (incidentControl) incidentControl.outerHTML = renderIncidentControl(appState.initialData.activeIncidents || []);
      }
      const select = document.getElementById("activeIncidentsSelect");
      if(select) select.value = response.data.id;
      await loadAndDisplayIncident(response.data, false);
      if (incidentNumberInput) incidentNumberInput.value = "";
      if (incidentNameInput) incidentNameInput.value = "";
    } else {
      showError(response.message || "Failed to start new incident.");
      hideLoader();
    }
  } catch (error) {
    showError(error.message);
    hideLoader();
  }
}

function populateTemplateDropdown(templates) {
  const select = document.getElementById("templateSelect");
  if (!select) return;
  select.innerHTML = '<option value="">-- Select a Template --</option>';
  if (templates && templates.length > 0) {
    templates.forEach((template) => {
      select.appendChild(new Option(template.templateName, template.id));
    });
  }
}

function populateCommonGroupsDropdown(commonGroups) {
  const select = document.getElementById("commonGroupSelect");
  if (!select) return;
  select.innerHTML = '<option value="">-- Select Common Group --</option>';
  if (commonGroups && commonGroups.length > 0) {
    commonGroups.forEach((cg) => {
      if (cg && cg.name) select.appendChild(new Option(cg.name, cg.name));
    });
  }
}

function handleAvailableUnitCheckboxChange(checkbox) {
  if (appState.isViewOnly) {
    checkbox.checked = !checkbox.checked;
    return;
  }
  const unitId = checkbox.dataset.unitId;
  if (!unitId) return;
  if (checkbox.checked) {
    appState.selectedAvailableUnits.add(unitId);
  } else {
    appState.selectedAvailableUnits.delete(unitId);
  }
  updateAssignmentModeUI();
}

function updateAssignmentModeUI() {
  document.body.classList.toggle("assignment-mode-active", appState.selectedAvailableUnits.size > 0);
}

function updateMoveModeUI() {
  document.body.classList.toggle("move-mode-active", !!appState.unitToMove);
}

function handleMoveUnitClick(unitId, unitName) {
  if (appState.isViewOnly) return;
  if (appState.unitToMove && appState.unitToMove.unitId === unitId) {
    appState.unitToMove = null;
  } else {
    appState.unitToMove = { unitId: unitId, unitName: unitName };
  }
  updateMoveModeUI();
}

function handleGroupUnitCheckboxChange(checkbox) {
  if (appState.isViewOnly) {
    checkbox.checked = !checkbox.checked;
    return;
  }
  const { unitId, groupId } = checkbox.dataset;
  if (!unitId || !groupId) return;
  if (!appState.selectedGroupUnits[groupId]) {
    appState.selectedGroupUnits[groupId] = new Set();
  }
  if (checkbox.checked) {
    appState.selectedGroupUnits[groupId].add(unitId);
  } else {
    appState.selectedGroupUnits[groupId].delete(unitId);
    if (appState.selectedGroupUnits[groupId].size === 0) {
      delete appState.selectedGroupUnits[groupId];
    }
  }
  updateGroupCardActions(groupId);
}

function updateGroupCardActions(groupId) {
  const card = document.getElementById(`group-card-${groupId}`);
  if (!card) return;
  const multiActionsPanel = card.querySelector('.multi-unit-actions');
  const countSpan = card.querySelector('.multi-unit-selection-count');
  const unitRows = card.querySelectorAll('.unit-in-group');
  const selectedUnitIds = appState.selectedGroupUnits[groupId];
  const selectedCount = selectedUnitIds?.size || 0;

  if (multiActionsPanel) multiActionsPanel.style.display = 'none';
  card.classList.remove('multi-select-active');
  unitRows.forEach(row => row.classList.remove('unit-selected'));

  if (selectedCount === 1) {
    const selectedUnitId = selectedUnitIds.values().next().value;
    const selectedRow = card.querySelector(`input[data-unit-id="${selectedUnitId}"]`)?.closest('.unit-in-group');
    if (selectedRow) selectedRow.classList.add('unit-selected');
  } else if (selectedCount > 1) {
    if(countSpan) countSpan.textContent = `${selectedCount} Unit(s) Selected`;
    if(multiActionsPanel) multiActionsPanel.style.display = 'block';
    card.classList.add('multi-select-active');

    const group = appState.currentIncident.groups.find(g => g.id === groupId);
    let isAnySubunitSelected = false;
    if (group && group.units) {
      isAnySubunitSelected = [...selectedUnitIds].some(selectedId => {
        const unit = group.units.find(u => u.unitId === selectedId);
        return unit && unit.parentUnitId;
      });
    }

    const multiSplitButton = card.querySelector('.js-multi-split');
    const multiReleaseButton = card.querySelector('.js-multi-release');
    if (multiSplitButton) {
      multiSplitButton.disabled = isAnySubunitSelected;
      multiSplitButton.title = isAnySubunitSelected ? "Cannot split subunits" : "Split selected units";
    }
    if (multiReleaseButton) {
      multiReleaseButton.disabled = isAnySubunitSelected;
      multiReleaseButton.title = isAnySubunitSelected ? "Cannot release subunits; re-form first" : "Release selected units";
    }
  }
}

function handleMultiMoveClick(button) {
    if (appState.isViewOnly) return;
    const fromGroupId = button.dataset.groupId;
    const unitIds = Array.from(appState.selectedGroupUnits[fromGroupId] || []);
    if (unitIds.length === 0) return;
    appState.isMultiMoveActive = true;
    appState.unitsToMultiMove = { fromGroupId, unitIds };
    delete appState.selectedGroupUnits[fromGroupId];
    updateGroupCardActions(fromGroupId);
    updateMultiMoveModeUI(true);
}

function updateMultiMoveModeUI(isActive) {
  document.body.classList.toggle('move-mode-active', isActive);
}

async function loadSplitUnits() {
    const container = document.getElementById("split-units-section");
    if (!container || !appState.currentIncident) {
        if (container) container.innerHTML = "";
        return;
    }
    container.innerHTML = `<p class="text-muted p-2"><em>Loading...</em></p>`;
    try {
        const response = await callApi("getSplitUnitsForIncident", {
            incidentId: appState.currentIncident.id,
        });
        if (response.success) {
            container.innerHTML = renderSplitUnitsPanel(response.data);
        } else {
            container.innerHTML = `<div class="p-2 text-danger"><em>${response.message}</em></div>`;
        }
    } catch (error) {
        container.innerHTML = `<div class="p-2 text-danger"><em>${error.message}</em></div>`;
    }
}

function renderSplitUnitsPanel(subunits) {
    if (!subunits || subunits.length === 0) return "";
    const sortedSubunits = [...subunits].sort((a, b) => (a.unit || "").localeCompare(b.unit || ""));
    const unitsHtml = sortedSubunits.map(unit => `
        <li class="list-group-item py-1 px-2 d-flex justify-content-between align-items-center">
            <span>${unit.unit}</span>
            <button class="btn btn-sm btn-info py-0 px-1 js-unsplit-unit"
                    data-parent-unit-id="${unit.parentUnitId}"
                    title="Re-form original unit">
                Re-form
            </button>
        </li>
    `).join('');
    return `
        <div class="mt-3">
            <h4>Split Units</h4>
            <ul class="list-group">${unitsHtml}</ul>
        </div>`;
}

function openUnsplitUnitModal(button) {
    if (appState.isViewOnly) return;
    const parentUnitId = button.dataset.parentUnitId;
    document.getElementById("unsplitParentUnitId").value = parentUnitId;
    const groupSelect = document.getElementById("unsplitGroupSelect");
    groupSelect.innerHTML = '<option value="">-- Select Group --</option>';
    (appState.currentIncident?.groups || []).forEach(group => {
        groupSelect.appendChild(new Option(group.groupName, group.id));
    });
    $('#unsplitUnitModal').modal('show');
}

async function handleConfirmUnsplit() {
  const parentUnitId = document.getElementById("unsplitParentUnitId").value;
  const newGroupId = document.getElementById("unsplitGroupSelect").value;
  if (!parentUnitId || !newGroupId) {
    alert("You must select a destination group.");
    return;
  }
  showLoader();
  $('#unsplitUnitModal').modal('hide');
  try {
    await callApi("unsplitUnit", {
      incidentId: appState.currentIncident.id,
      parentUnitId,
      newGroupId,
    });
    clearGroupSelectionState();
    await reloadCurrentIncidentView();
  } catch (error) {
    showError(error.message);
    hideLoader();
  }
}

function handleParButtonClick(button) {
    if (appState.isViewOnly) return;
    const { groupId, parStatus } = button.dataset;
    if (!groupId) return;
    if (parStatus === 'Idle') {
        startParTimer(groupId);
    } else {
        stopParTimer(groupId);
    }
}

async function startParTimer(groupId) {
    if (appState.isViewOnly) return;
    showLoader();
    try {
        await callApi('startParTimer', { groupId });
        await reloadCurrentIncidentView();
    } catch (error) {
        showError(error.message);
        hideLoader();
    }
}

async function stopParTimer(groupId) {
    if (appState.isViewOnly) return;
    showLoader();
    try {
        await callApi('stopParTimer', { groupId });
        if (appState.parTimerIntervals[groupId]) {
            clearInterval(appState.parTimerIntervals[groupId]);
            delete appState.parTimerIntervals[groupId];
        }
        await reloadCurrentIncidentView();
    } catch (error) {
        showError(error.message);
        hideLoader();
    }
}

function initializeParTimers(groups) {
    const parDurationMinutes = appState.initialData.settings?.parTimerDurationMinutes || 10;
    const parDurationMs = parDurationMinutes * 60 * 1000;
    groups.forEach(group => {
        if (group.parStatus === 'Active' && group.parStartTime) {
            const startTime = new Date(group.parStartTime);
            const expirationTime = new Date(startTime.getTime() + parDurationMs);
            if (new Date() >= expirationTime) {
                const button = document.querySelector(`.js-par-btn[data-group-id="${group.id}"]`);
                if (button) {
                    button.classList.remove('par-btn-active');
                    button.classList.add('par-btn-expired');
                    button.dataset.parStatus = 'Expired';
                }
                return;
            }
            if (appState.parTimerIntervals[group.id]) {
                clearInterval(appState.parTimerIntervals[group.id]);
            }
            appState.parTimerIntervals[group.id] = setInterval(() => {
                if (new Date() >= expirationTime) {
                    const button = document.querySelector(`.js-par-btn[data-group-id="${group.id}"]`);
                    if (button) {
                        button.classList.remove('par-btn-active');
                        button.classList.add('par-btn-expired');
                        button.dataset.parStatus = 'Expired';
                    }
                    clearInterval(appState.parTimerIntervals[group.id]);
                    delete appState.parTimerIntervals[group.id];
                }
            }, 1000);
        }
    });
}

function toggleReorderMode() {
    if (appState.isViewOnly) return;
    appState.isReorderModeActive = !appState.isReorderModeActive;
    appState.groupToMove = null;
    updateReorderModeUI();
}

function updateReorderModeUI() {
    const container = document.getElementById('groupsContainer');
    const reorderBtn = document.getElementById('reorderGroupsBtn');
    const cancelBtn = document.getElementById('cancelReorderBtn');
    if (!container || !reorderBtn || !cancelBtn) return;
    container.classList.toggle('reorder-mode-active', appState.isReorderModeActive);
    reorderBtn.style.display = appState.isReorderModeActive ? 'none' : 'inline-block';
    cancelBtn.style.display = appState.isReorderModeActive ? 'inline-block' : 'none';
    document.querySelectorAll('.group-selected-for-move').forEach(el => {
        el.classList.remove('group-selected-for-move');
    });
    if (appState.groupToMove) {
        const cardToHighlight = document.querySelector(`.group-card[data-group-id="${appState.groupToMove}"]`);
        if (cardToHighlight) {
            cardToHighlight.classList.add('group-selected-for-move');
        }
    }
}

function updateAssignParentModeUI() {
    document.body.classList.toggle('assign-parent-active', appState.isAssignParentModeActive);
}

// A helper function to get a readable contrasting color (black or white) for a given hex color.
function getContrastYIQ(hexcolor){
    hexcolor = hexcolor.replace("#", "");
    var r = parseInt(hexcolor.substr(0,2),16);
    var g = parseInt(hexcolor.substr(2,2),16);
    var b = parseInt(hexcolor.substr(4,2),16);
    var yiq = ((r*299)+(g*587)+(b*114))/1000;
    return (yiq >= 128) ? 'black' : 'white';
}