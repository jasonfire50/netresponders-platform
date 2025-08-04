/**
 * command-board.js
 * This file contains all logic for the main Command Board view.
 *
 * This version includes the "smart memory" feature for the Available Units
 * accordion, preventing it from collapsing after user actions.
 */

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
 * Renders the static shell for the Command Board view and initiates loading.
 */
function renderCommandBoardView(container, data) {
  if (!container) return;

  container.innerHTML = `
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

  const lastActiveId = sessionStorage.getItem("fcb_lastActiveIncidentId");
  const select = document.getElementById("activeIncidentsSelect");

  if (lastActiveId && select && select.querySelector(`option[value="${lastActiveId}"]`)) {
    select.value = lastActiveId;
    const selectedOption = select.options[select.selectedIndex];
    const incidentData = JSON.parse(selectedOption.dataset.incidentJson);
    loadAndDisplayIncident(incidentData);
  } else {
    clearIncidentDetails();
    loadAvailableUnits();
  }
}

/**
 * The master function to fully load all data for an incident and render it.
 */
async function loadAndDisplayIncident(incidentData) {
    appState.currentIncident = incidentData;
    sessionStorage.setItem("fcb_lastActiveIncidentId", incidentData.id);

    showLoader();
    try {
        await Promise.all([
            loadGroupsForCurrentIncident(),
            loadSplitUnits(),
            loadAvailableUnits(),
        ]);
        renderIncidentContent();
    } catch (error) {
        showError(error.message);
        clearIncidentDetails();
    } finally {
        hideLoader();
    }
}

/**
 * Fetches groups for the current incident and saves them to the appState.
 */
async function loadGroupsForCurrentIncident() {
    if (!appState.currentIncident) return;
    try {
        const response = await callApi("getGroupsForIncident", {
            id: appState.launchId,
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

/**
 * Renders the main content area after all data has been loaded into appState.
 */
function renderIncidentContent() {
  const incident = appState.currentIncident;
  const container = document.getElementById("commandMainContent");
  if (!container || !incident) {
    clearIncidentDetails();
    return;
  }

  container.innerHTML = `
    <div class="main-content">
      <div id="current-incident-summary" class="d-flex flex-wrap align-items-center mb-2 p-2 border rounded bg-light">
        <span class="text-primary font-weight-bold mr-3">${incident.incidentNumber}</span>
        <span class="text-muted mr-3">${incident.incidentName || ""}</span>
        <span class="mr-3">Started: ${new Date(incident.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        <span class="font-weight-bold mr-3">${incident.status}</span>
      </div>
      <div id="incident-content-area">
        <hr class="mt-0 mb-2">
        <div class="card shadow-sm mb-3">
          <div class="card-header"><h5>Add Groups to Incident</h5></div>
          <div class="card-body">
            <div class="row">
              <div class="col-md-4 form-group">
                <label><small><strong>1. Apply Template</strong></small></label>
                <div class="input-group">
                  <select id="templateSelect" class="form-control form-control-sm"></select>
                  <div class="input-group-append">
                    <button class="btn btn-info btn-sm" id="applyTemplateBtn">Apply</button>
                  </div>
                </div>
              </div>
              <div class="col-md-4 form-group">
                <label><small><strong>2. Add Common Group</strong></small></label>
                <select id="commonGroupSelect" class="form-control form-control-sm"></select>
              </div>
              <div class="col-md-4 form-group">
                <label><small><strong>3. Add Custom Group</strong></small></label>
                <div class="input-group">
                  <input type="text" id="newGroupName" class="form-control form-control-sm" placeholder="Type Custom Name">
                  <div class="input-group-append">
                    <button class="btn btn-success btn-sm" id="addGroupBtn">Add</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h4>Command Groups</h4>
          <div>
            <button id="reorderGroupsBtn" class="btn btn-outline-secondary btn-sm">
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
 * Renders all group cards by first building a hierarchy.
 */
function renderGroupCards(allGroups) {
  const container = document.getElementById("groupsContainer");
  if (!container) return;

  if (!allGroups || allGroups.length === 0) {
    container.innerHTML = '<p class="text-muted col-12">No groups have been created for this incident yet.</p>';
    return;
  }

  const groupNameMap = new Map(allGroups.map(g => [g.id, g.groupName]));
  const groupTree = buildGroupHierarchy(allGroups);
  container.innerHTML = groupTree.map(groupNode => renderGroupNode(groupNode, groupNameMap)).join('');

  allGroups.forEach(group => {
    if (appState.selectedGroupUnits[group.id]?.size > 0) {
      updateGroupCardActions(group.id, allGroups);
    }
  });

  initializeParTimers(allGroups);
}

/**
 * Renders the HTML for a single group card.
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

  const parStatus = group.parStatus || "Idle";
  let parButtonClass = "par-btn-idle";
  if (parStatus === "Active") parButtonClass = "par-btn-active";
  if (parStatus === "Expired") parButtonClass = "par-btn-expired";
  const parBtnData = `data-group-id="${group.id}" data-par-status="${parStatus}"`;
  const parButtonHtml = `<button class="btn par-btn ${parButtonClass} js-par-btn" ${parBtnData}>PAR</button>`;
  const multiUnitActionsHtml = `
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
    return `<button class="btn btn-sm ${btnClass} py-0 px-2 js-benchmark-btn" ${btnData}>${bm.name}</button>`;
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
    const supervisorButton = isSupervisor
      ? `<button class="btn btn-sm btn-warning py-0 px-1 js-clear-supervisor" data-group-id="${group.id}" title="Clear Supervisor">Clear Sup.</button>`
      : `<button class="btn btn-sm btn-outline-warning py-0 px-1 js-set-supervisor" ${supervisorBtnData} title="Set as Supervisor">Set Sup.</button>`;
    const splitButtonHtml = !isSubunit
      ? `<button class="btn btn-sm btn-outline-info py-0 px-1 js-split-unit" ${supervisorBtnData} title="Split Unit"><i class="fas fa-code-branch"></i></button>`
      : '';
    const releaseButtonHtml = !isSubunit
      ? `<button class="btn btn-sm btn-outline-success py-0 px-1 js-release-unit" data-id="${unit.id}" data-name="${safeUnitName}" title="Release Unit"><i class="fas fa-check-circle"></i></button>`
      : '';
    const supervisorBadgeHtml = isSupervisor
      ? `<span class="badge badge-warning badge-pill ml-2" title="Group Supervisor">Sup</span>`
      : '';
    const checkboxData = `onchange="handleGroupUnitCheckboxChange(this)" data-unit-id="${unit.unitId}" data-group-id="${group.id}" ${isChecked}`;
    const labelHtml = `<label for="${checkboxId}" class="mb-0"><strong class="mr-2">${unit.unit}</strong>${supervisorBadgeHtml}<small class="text-muted ml-2">(${elapsedTimeDisplay})</small></label>`;
    const checkboxHtml = `<input type="checkbox" class="mr-2 group-unit-checkbox" id="${checkboxId}" ${checkboxData}>`;
    return `
      <div class="unit-in-group list-group-item d-flex justify-content-between align-items-center py-1 px-2">
        <div class="d-flex align-items-center">${checkboxHtml}${labelHtml}</div>
        <div class="single-unit-actions">
          <div class="btn-group">
            ${supervisorButton}${splitButtonHtml}
            <button class="btn btn-sm btn-outline-secondary py-0 px-1 js-move-unit" data-id="${unit.id}" data-name="${safeUnitName}" title="Move Unit"><i class="fas fa-arrows-alt"></i></button>
            ${releaseButtonHtml}
          </div>
        </div>
      </div>`;
  }).join('') : '<p class="text-muted p-2 no-units-assigned"><em>No units assigned.</em></p>';

  let reportsToHtml = '';
  if (group.parentGroupId) {
    const parentName = groupMap.get(group.parentGroupId) || 'Unknown';
    const clearParentBtn = `<button class="btn-clear-parent js-clear-parent" title="Remove from Group" data-child-group-id="${group.id}">×</button>`;
    reportsToHtml = `<div class="reports-to-bar d-flex justify-content-between align-items-center"><span>Reports to: <strong>${parentName}</strong></span>${clearParentBtn}</div>`;
  }
  const assignParentButton = !group.parentGroupId ? `<button class="btn btn-sm btn-outline-info py-0 px-1 js-assign-parent" data-group-id="${group.id}" title="Assign to Group"><i class="fas fa-sitemap"></i></button>` : '';
  const safeGroupName = group.groupName.replace(/'/g, "\\'");
  const disbandBtnData = `data-group-id="${group.id}" data-group-name="${safeGroupName}"`;
  const disbandButton = `<button class="btn btn-sm btn-outline-secondary py-0 px-1 js-disband-group" ${disbandBtnData} title="Disband Group"><i class="fas fa-trash"></i></button>`;
  const headerContent = `<div class="d-flex justify-content-between align-items-start"><div><h5 class="card-title mb-0">${group.groupName}</h5>${supervisorHtml}</div>${parButtonHtml}</div>${reportsToHtml}${multiUnitActionsHtml}`;
  const footerContent = `<div class="d-flex justify-content-between align-items-center w-100"><div style="flex-basis: 60px;" class="d-flex">${assignParentButton}</div><div class="btn-group btn-group-sm mx-auto">${benchmarkButtonsHtml}</div><div style="flex-basis: 60px;" class="d-flex justify-content-end">${disbandButton}</div></div>`;
  const headerStyle = `style="background-color: ${group.headerColor || '#6c757d'}; color: ${getContrastYIQ(group.headerColor)};"`;
  const cardData = `id="group-card-${group.id}" data-group-id="${group.id}" data-is-child="${!!group.parentGroupId}" onclick="handleGroupCardClick('${group.id}')"`;
  return `<div class="card shadow-sm group-card" ${cardData}><div class="card-header" ${headerStyle}>${headerContent}</div><div class="card-body p-0"><div class="list-group list-group-flush">${unitsHtml}</div></div><div class="card-footer text-center p-1">${footerContent}</div></div>`;
}

// ===================================================================
//
//  EVENT HANDLERS AND UI LOGIC
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
                id: appState.launchId,
                incidentId: appState.currentIncident.id,
                childGroupId,
                parentGroupId,
            });
            appState.isAssignParentModeActive = false;
            appState.groupToAssignParent = null;
            updateAssignParentModeUI();
            await loadAndDisplayIncident(appState.currentIncident);
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
                id: appState.launchId,
                incidentId: appState.currentIncident.id,
                newGroupId: clickedGroupId,
                unitIds: unitIds.join(','),
            });
            clearGroupSelectionState();
            appState.isMultiMoveActive = false;
            appState.unitsToMultiMove = null;
            updateMultiMoveModeUI(false);
            await loadAndDisplayIncident(appState.currentIncident);
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

    console.log(`Group card ${clickedGroupId} clicked, but no action pending.`);
}

/**
 * Handles clicks on group cards when in reorder mode.
 */
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
                id: appState.launchId,
                incidentId: appState.currentIncident.id,
                groupIds: newOrder.join(','),
            });
            await loadAndDisplayIncident(appState.currentIncident);
        } catch (error) {
            showError(error.message);
            hideLoader();
        }
    }
}

/**
 * Handles setting a unit as the group supervisor.
 */
async function handleSetSupervisor(groupId, unitId) {
  showLoader();
  try {
    await callApi("setGroupSupervisor", {
      id: appState.launchId,
      groupId: groupId,
      unitId: unitId,
      incidentId: appState.currentIncident.id,
    });
    clearGroupSelectionState();
    await loadAndDisplayIncident(appState.currentIncident);
  } catch (error) {
    showError(error.message);
    hideLoader();
  }
}

/**
 * Handles clearing the supervisor from a group.
 */
async function handleClearSupervisor(groupId) {
  showLoader();
  try {
    await callApi("clearGroupSupervisor", {
      id: appState.launchId,
      groupId: groupId,
      incidentId: appState.currentIncident.id,
    });
    clearGroupSelectionState();
    await loadAndDisplayIncident(appState.currentIncident);
  } catch (error) {
    showError(error.message);
    hideLoader();
  }
}

/**
 * Handles clicks on the 'Release Selected' button.
 */
async function handleMultiReleaseClick(button) {
  const groupId = button.dataset.groupId;
  const unitIds = Array.from(appState.selectedGroupUnits[groupId] || []);
  if (unitIds.length === 0) return;

  showLoader();
  try {
    await callApi("releaseMultipleUnits", {
      id: appState.launchId,
      incidentId: appState.currentIncident.id,
      unitIds: unitIds.join(','),
    });
    clearGroupSelectionState();
    await loadAndDisplayIncident(appState.currentIncident);
  } catch (error) {
    showError(error.message);
    hideLoader();
  }
}

/**
 * Handles the click on a unit's "Release" button.
 */
async function handleReleaseUnitClick(unitId, unitName) {
  showLoader();
  try {
    await callApi("releaseUnitToAvailable", {
      id: appState.launchId,
      incidentId: appState.currentIncident.id,
      unitId: unitId,
    });
    clearGroupSelectionState();
    await loadAndDisplayIncident(appState.currentIncident);
  } catch (error) {
    showError(error.message);
    hideLoader();
  }
}

/**
 * Handles the click of the "Disband Group" icon.
 */
async function handleDisbandGroupClick(button) {
    const { groupId, groupName } = button.dataset;
    const confirmationMessage = `Are you sure you want to permanently disband the "${groupName}" group? This action cannot be undone.`;
    if (!confirm(confirmationMessage)) return;

    showLoader();
    try {
        await callApi('disbandGroup', {
            id: appState.launchId,
            incidentId: appState.currentIncident.id,
            groupId: groupId,
        });
        await loadAndDisplayIncident(appState.currentIncident);
    } catch (error) {
        showError(error.message);
        hideLoader();
    }
}

/**
 * Toggles the "Assign Parent" mode.
 */
function handleAssignParentClick(button) {
    const childGroupId = button.dataset.groupId;
    appState.isAssignParentModeActive = true;
    appState.groupToAssignParent = { childGroupId };
    updateAssignParentModeUI();
}

/**
 * Handles the click of the "X" button to clear a group's parent.
 */
async function handleClearParentClick(button) {
    const childGroupId = button.dataset.childGroupId;
    showLoader();
    try {
        await callApi('clearGroupParent', {
            id: appState.launchId,
            incidentId: appState.currentIncident.id,
            childGroupId,
        });
        await loadAndDisplayIncident(appState.currentIncident);
    } catch (error) {
        showError(error.message);
        hideLoader();
    }
}

/**
 * Handles adding a new group to the current incident.
 */
async function handleAddGroup() {
  if (!appState.currentIncident) {
    showError("Please select an active incident first.");
    return;
  }
  const groupNameInput = document.getElementById("newGroupName");
  const commonGroupSelect = document.getElementById("commonGroupSelect");
  const groupNameToCreate = (commonGroupSelect.value || groupNameInput.value).trim();
  if (!groupNameToCreate) {
    showError("Please enter a custom group name or select a common group.");
    return;
  }
  showLoader();
  try {
    await callApi("createGroupForIncident", {
      id: appState.launchId,
      incidentId: appState.currentIncident.id,
      groupName: groupNameToCreate,
    });
    groupNameInput.value = "";
    commonGroupSelect.value = "";
    await loadAndDisplayIncident(appState.currentIncident);
  } catch (error) {
    showError(error.message);
    hideLoader();
  }
}

/**
 * Handles the click on the "Apply Template" button.
 */
async function handleApplyTemplate() {
  const select = document.getElementById("templateSelect");
  if (!select || !select.value) {
    return;
  }
  if (!appState.currentIncident) {
    showError("Please select an active incident first.");
    return;
  }

  showLoader();
  try {
    const response = await callApi("applyTemplateToIncident", {
      id: appState.launchId,
      incidentId: appState.currentIncident.id,
      templateId: select.value,
    });

    if (response.success) {
      await loadAndDisplayIncident(appState.currentIncident);
    } else {
      showError(response.message);
    }

  } catch (error) {
    showError(error.message);
  } finally {
    hideLoader();
  }
}

/**
 * Handles a click on a benchmark button, cycling its status.
 */
async function handleBenchmarkClick(groupId, benchmarkName, currentStatus) {
  const statusCycle = { "Pending": "Started", "Started": "Completed", "Completed": "Pending" };
  const newStatus = statusCycle[currentStatus];
  showLoader();
  try {
    await callApi("updateGroupBenchmark", {
      id: appState.launchId, groupId, benchmarkName, newStatus,
    });
    await loadAndDisplayIncident(appState.currentIncident);
  } catch (error) {
    showError(error.message);
    hideLoader();
  }
}

/**
 * Renders the HTML for the Incident Setup & Selection panel.
 */
function renderIncidentControl(activeIncidents) {
  const options = (activeIncidents || []).map(inc => {
    const json = JSON.stringify(inc).replace(/'/g, "'");
    return `<option value="${inc.id}" data-incident-json='${json}'>${inc.incidentNumber} - ${inc.incidentName || "Unnamed"}</option>`;
  }).join("");
  return `
    <div class="card mb-2 shadow-sm">
      <div class="card-header p-0"><h5 class="mb-0"><button class="btn btn-light btn-block text-left d-flex justify-content-between align-items-center py-2 px-3" type="button" data-toggle="collapse" data-target="#collapseIncidentControl" aria-expanded="true"><span>Incident Setup & Selection</span></button></h5></div>
      <div id="collapseIncidentControl" class="collapse show"><div class="card-body p-3">
        <div class="form-group"><label><b>Select Active Incident:</b></label><select id="activeIncidentsSelect" class="form-control"><option value="">-- Select or Create --</option>${options}</select></div>
        <p class="text-center my-2">OR</p>
        <h5 class="mb-2">Create New Incident:</h5>
        <div class="form-group"><label for="incidentNumber">Incident Number (CAD):</label><input type="text" id="incidentNumber" class="form-control form-control-sm" placeholder="Leave blank to auto-generate"></div>
        <div class="form-group"><label for="incidentName">Incident Name (Optional):</label><input type="text" id="incidentName" class="form-control form-control-sm"></div>
        <button id="startNewIncidentBtn" class="btn btn-primary btn-block btn-sm">Start New Incident</button>
        <button id="closeIncidentBtn" class="btn btn-danger btn-block mt-3 btn-sm" style="display:none;">Close Current Incident</button>
      </div></div>
    </div>`;
}

/**
 * Clears the incident-specific UI and resets the creation form.
 */
function clearIncidentDetails() {
  const mainContent = document.getElementById("commandMainContent");
  if (mainContent) mainContent.innerHTML = "";
  setIncidentActiveUI(false);
}

/**
 * A single function to control the UI state based on incident status.
 */
function setIncidentActiveUI(isActive) {
  const startBtn = document.getElementById("startNewIncidentBtn");
  const closeBtn = document.getElementById("closeIncidentBtn");
  const collapseTarget = document.getElementById("collapseIncidentControl");
  if (startBtn) startBtn.disabled = isActive;
  if (closeBtn) closeBtn.style.display = isActive ? "block" : "none";
  if (window.$ && collapseTarget) {
      isActive ? $(collapseTarget).collapse("hide") : $(collapseTarget).collapse("show");
  }
}

// ===================================================================
//
//  ### THIS IS THE SECTION THAT NEEDS TO BE REPLACED ###
//
// ===================================================================

/**
 * Fetches and renders units for the available units panel.
 * It now attaches event listeners to the accordion after rendering,
 * allowing it to track which panels the user opens/closes and save
 * that state for subsequent re-renders.
 */
async function loadAvailableUnits() {
  const container = document.getElementById("available-units-section");
  if (!container) return;
  container.innerHTML = `<p class="text-muted p-2"><em>Loading...</em></p>`;

  try {
    const response = await callApi("getAllAvailableUnitsGroupedByDept", {
      id: appState.launchId,
    });

    if (response.success) {
      appState.departmentsWithAvailableUnits = response.data.departmentsWithUnits;
      container.innerHTML = renderAvailableUnitsAccordion(
        appState.departmentsWithAvailableUnits,
      );

      // --- THE FIX IS HERE ---
      // After the HTML is on the page, we attach listeners to it.
      // This uses jQuery, which is already part of the project for Bootstrap.
      const accordion = $('#available-units-accordion');

      // When a panel is shown (opened), add its department ID to our memory set.
      accordion.on('show.bs.collapse', function (e) {
        const deptId = $(e.target).closest('.card').data('dept-id');
        if (deptId) {
          appState.openAvailableUnitsPanels.add(deptId);
        }
      });

      // When a panel is hidden (closed), remove its ID from our memory set.
      accordion.on('hide.bs.collapse', function (e) {
        const deptId = $(e.target).closest('.card').data('dept-id');
        if (deptId) {
          appState.openAvailableUnitsPanels.delete(deptId);
        }
      });
      // --- END OF FIX ---

    } else {
      appState.departmentsWithAvailableUnits = [];
      showError(response.message);
    }
  } catch (error) {
    appState.departmentsWithAvailableUnits = [];
    showError(error.message);
  }
}

/**
 * Builds the HTML for the available units section. This version now reads from
 * `appState.openAvailableUnitsPanels` to remember and restore which accordion
 * panels the user had open, preventing them from collapsing after an action.
 * @param {Array<object>} departmentsWithUnits Data from the API.
 * @return {string} The complete HTML string for the section.
 */
function renderAvailableUnitsAccordion(departmentsWithUnits) {
  if (!departmentsWithUnits || departmentsWithUnits.length === 0) {
    const panel = `<div class="p-2 text-muted"><em>No units are available.</em></div>`;
    return `<div class="mt-2"><h4>Available Units</h4>${panel}</div>`;
  }

  const accordionId = 'available-units-accordion';
  const accordionHtml = departmentsWithUnits.map((dept) => {
    const deptCollapseId = `avail-dept-collapse-${dept.id}`;
    const totalUnitsInDept = dept.units.length;

    // --- THE FIX IS HERE ---
    // Determine if this panel should be shown.
    // Logic: Show if (it's the first render AND it's the primary dept)
    // OR if (its ID is in our 'open panels' memory set).
    const isFirstRender = appState.openAvailableUnitsPanels.size === 0;
    const isShown = (isFirstRender && dept.isPrimary) || appState.openAvailableUnitsPanels.has(dept.id);
    const showClass = isShown ? 'show' : '';
    // --- END OF FIX ---

    const tableHtml = `
      <div class="table-responsive">
        <table class="table table-sm table-hover available-units-table">
          <thead>
            <tr>
              <th scope="col" style="width: 5%;"></th>
              <th scope="col" class="sortable-header" data-sort-by="unit" data-dept-id="${dept.id}">
                Unit <span class="sort-indicator"></span>
              </th>
              <th scope="col" class="sortable-header" data-sort-by="unitName" data-dept-id="${dept.id}">
                Name <span class="sort-indicator"></span>
              </th>
              <th scope="col" class="sortable-header" data-sort-by="stationName" data-dept-id="${dept.id}">
                Station <span class="sort-indicator"></span>
              </th>
            </tr>
          </thead>
          <tbody id="available-units-tbody-${dept.id}">
            ${dept.units.map(unit => `
              <tr>
                <td>
                  <input type="checkbox" class="available-unit-checkbox" id="chk-avail-${unit.id}" data-unit-id="${unit.id}">
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
          <div class="card-body p-0">
            ${tableHtml}
          </div>
        </div>
      </div>
    `;
  }).join('');

  return `<div class="mt-2"><h4>Available Units</h4><div class="accordion" id="${accordionId}">${accordionHtml}</div></div>`;
}

/**
 * Handles the user selecting an incident from the dropdown.
 */
function handleActiveIncidentSelect() {
  const select = document.getElementById("activeIncidentsSelect");
  if (!select) return;

  appState.selectedAvailableUnits.clear();
  clearGroupSelectionState();
  updateAssignmentModeUI();

  const selectedValue = select.value;

  if (!selectedValue) {
    appState.currentIncident = null;
    sessionStorage.removeItem("fcb_lastActiveIncidentId");
    clearIncidentDetails();
    loadAvailableUnits();
    return;
  }

  const selectedOption = select.options[select.selectedIndex];
  if (selectedOption && selectedOption.dataset.incidentJson) {
    try {
      const incidentData = JSON.parse(selectedOption.dataset.incidentJson);
      loadAndDisplayIncident(incidentData);
    } catch (error) {
      console.error("Failed to parse incident data from dropdown:", error);
      showError("Could not load the selected incident.");
    }
  }
}

/**
 * Handles the "Start New Incident" button click.
 */
async function handleStartNewIncident() {
  const incidentNumberInput = document.getElementById("incidentNumber");
  const incidentNameInput = document.getElementById("incidentName");
  const startBtn = document.getElementById("startNewIncidentBtn");
  if (startBtn.disabled) return;
  startBtn.disabled = true;

  showLoader();
  try {
    const response = await callApi("startNewIncident", {
      id: appState.launchId,
      incidentNumber: incidentNumberInput.value,
      incidentName: incidentNameInput.value,
    });
    if (response.success && response.data) {
      const newIncident = response.data;
      appState.initialData.activeIncidents.unshift(newIncident);
      const select = document.getElementById("activeIncidentsSelect");
      if (select) {
        const json = JSON.stringify(newIncident).replace(/'/g, "'");
        const newOption = new Option(
          `${newIncident.incidentNumber} - ${newIncident.incidentName || "Unnamed"}`,
          newIncident.id
        );
        newOption.dataset.incidentJson = json;
        select.insertBefore(newOption, select.options[1]);
        select.value = newIncident.id;
      }
      handleActiveIncidentSelect();
      if (incidentNumberInput) incidentNumberInput.value = "";
      if (incidentNameInput) incidentNameInput.value = "";
    } else {
      showError(response.message || "Failed to start new incident.");
      if (startBtn) startBtn.disabled = false;
    }
  } catch (error) {
    showError(error.message);
    if (startBtn) startBtn.disabled = false;
  } finally {
    hideLoader();
  }
}

/**
 * Handles closing the current incident.
 */
async function handleCloseIncident() {
  if (!appState.currentIncident) {
    showError("No active incident to close.");
    return;
  }
  const incidentNumber = appState.currentIncident.incidentNumber;
  if (!confirm(`Are you sure you want to CLOSE incident ${incidentNumber}?`)) {
    return;
  }
  showLoader();
  try {
    const response = await callApi("closeIncident", {
      id: appState.launchId,
      incidentId: appState.currentIncident.id,
    });
    if (response.success) {
      initializeApp();
    } else { showError(response.message); }
  } catch (error) { showError(error.message); }
  finally { hideLoader(); }
}

/**
 * Populates the "Apply a Template" dropdown.
 */
function populateTemplateDropdown(templates) {
  const select = document.getElementById("templateSelect");
  if (!select) return;
  select.innerHTML = '<option value="">-- Select a Template --</option>';
  if (templates && templates.length > 0) {
    templates.forEach((template) => {
      const opt = new Option(template.templateName, template.id);
      opt.dataset.templateJson = JSON.stringify(template);
      select.appendChild(opt);
    });
  }
}

/**
 * Populates the "Add Single Common Group" dropdown.
 */
function populateCommonGroupsDropdown(commonGroups) {
  const select = document.getElementById("commonGroupSelect");
  if (!select) return;
  select.innerHTML = '<option value="">-- Select Common Group --</option>';
  if (commonGroups && commonGroups.length > 0) {
    commonGroups.forEach((cg) => {
      if (cg && cg.name) {
        select.appendChild(new Option(cg.name, cg.name));
      }
    });
  }
}

/**
 * Handles the click event for an available unit's checkbox.
 */
function handleAvailableUnitCheckboxChange(checkbox) {
  const unitId = checkbox.dataset.unitId;
  if (!unitId) return;
  if (checkbox.checked) {
    appState.selectedAvailableUnits.add(unitId);
  } else {
    appState.selectedAvailableUnits.delete(unitId);
  }
  updateAssignmentModeUI();
}

/**
 * Toggles a CSS class on the body to change the UI when units are selected.
 */
function updateAssignmentModeUI() {
  const body = document.body;
  if (appState.selectedAvailableUnits.size > 0) {
    body.classList.add("assignment-mode-active");
  } else {
    body.classList.remove("assignment-mode-active");
  }
}

/**
 * Executes the API call to assign selected available units to a group.
 */
async function handleGroupCardAssignment(groupId) {
  const selectedIds = Array.from(appState.selectedAvailableUnits);
  if (selectedIds.length === 0) return;
  showLoader();
  try {
    const response = await callApi("assignUnitsToGroup", {
      id: appState.launchId,
      incidentId: appState.currentIncident.id,
      groupId: groupId,
      unitIds: selectedIds.join(","),
    });
    if (response.success) {
      appState.selectedAvailableUnits.clear();
      updateAssignmentModeUI();
      await loadAndDisplayIncident(appState.currentIncident);
    } else {
      showError(response.message);
      hideLoader();
    }
  } catch (error) {
    showError(error.message);
    hideLoader();
  }
}

/**
 * Toggles a CSS class on the body to change the UI when a unit is moved.
 */
function updateMoveModeUI() {
  const body = document.body;
  const banner = document.getElementById("unit-action-banner");
  body.classList.remove("assignment-mode-active");
  if (appState.unitToMove) {
    body.classList.add("move-mode-active");
    if (banner) {
      banner.innerHTML = `<div class="moving-unit-banner">...</div>`;
    }
  } else {
    body.classList.remove("move-mode-active");
    if (banner) {
      banner.innerHTML = `<h4>Available Units</h4>`;
    }
  }
}

/**
 * Handles the click on a unit's "Move" button.
 */
function handleMoveUnitClick(unitId, unitName) {
  if (appState.unitToMove && appState.unitToMove.unitId === unitId) {
    appState.unitToMove = null;
  } else {
    appState.unitToMove = { unitId: unitId, unitName: unitName };
  }
  updateMoveModeUI();
}

/**
 * Handles the click on a group card when in single-unit move mode.
 */
async function handleGroupCardMoveClick(newGroupId) {
  const unitToMove = appState.unitToMove;
  if (!unitToMove) return;
  showLoader();
  try {
    const response = await callApi("moveUnitToNewGroup", {
      id: appState.launchId,
      incidentId: appState.currentIncident.id,
      unitId: unitToMove.unitId,
      newGroupId: newGroupId,
    });
    if (response.success) {
      appState.unitToMove = null;
      updateMoveModeUI();
      clearGroupSelectionState();
      await loadAndDisplayIncident(appState.currentIncident);
    } else {
      showError(response.message);
      hideLoader();
    }
  } catch (error) {
    showError(error.message);
    hideLoader();
  }
}


/**
 * Handles the change event for a unit's checkbox within a group.
 */
function handleGroupUnitCheckboxChange(checkbox) {
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
  updateGroupCardActions(groupId, appState.currentIncident.groups);
}

/**
 * The single source of truth for updating a group card's UI.
 */
function updateGroupCardActions(groupId, allGroups) {
  const card = document.getElementById(`group-card-${groupId}`);
  if (!card) return;

  const multiActionsPanel = card.querySelector('.multi-unit-actions');
  const countSpan = card.querySelector('.multi-unit-selection-count');
  const unitRows = card.querySelectorAll('.unit-in-group');

  const selectedUnitIds = appState.selectedGroupUnits[groupId];
  const selectedCount = selectedUnitIds?.size || 0;

  multiActionsPanel.style.display = 'none';
  card.classList.remove('multi-select-active');
  unitRows.forEach(row => row.classList.remove('unit-selected'));

  if (selectedCount === 1) {
    const selectedUnitId = selectedUnitIds.values().next().value;
    const selectedRow = card.querySelector(`input[data-unit-id="${selectedUnitId}"]`)?.closest('.unit-in-group');
    if (selectedRow) {
        selectedRow.classList.add('unit-selected');
    }
  } else if (selectedCount > 1) {
    countSpan.textContent = `${selectedCount} Unit(s) Selected`;
    multiActionsPanel.style.display = 'block';
    card.classList.add('multi-select-active');

    const group = allGroups.find(g => g.id === groupId);
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

/**
 * Handles the click of a single unit's "Split" icon.
 */
async function splitUnit(button) {
  const { unitId, groupId } = button.dataset;
  if (!unitId || !groupId) return;

  showLoader();
  try {
    await callApi("splitUnit", {
      id: appState.launchId,
      incidentId: appState.currentIncident.id,
      unitId,
      groupId,
    });

    clearGroupSelectionState();
    await loadAndDisplayIncident(appState.currentIncident);

  } catch (error) {
    showError(error.message);
  } finally {
    hideLoader();
  }
}

/**
 * Handles clicks on the 'Move Selected' button.
 */
function handleMultiMoveClick(button) {
    const fromGroupId = button.dataset.groupId;
    const unitIds = Array.from(appState.selectedGroupUnits[fromGroupId] || []);
    if (unitIds.length === 0) return;
    appState.isMultiMoveActive = true;
    appState.unitsToMultiMove = { fromGroupId, unitIds };
    delete appState.selectedGroupUnits[fromGroupId];
    updateGroupCardActions(fromGroupId, appState.currentIncident.groups);
    updateMultiMoveModeUI(true);
}

/**
 * Toggles the UI state for multi-unit move mode.
 */
function updateMultiMoveModeUI(isActive) {
  document.body.classList.toggle('move-mode-active', isActive);
}

/**
 * Fetches and renders the "Split Units" management panel.
 */
async function loadSplitUnits() {
    const container = document.getElementById("split-units-section");
    if (!container || !appState.currentIncident) {
        if (container) container.innerHTML = "";
        return;
    }
    container.innerHTML = `<p class="text-muted p-2"><em>Loading split units...</em></p>`;
    try {
        const response = await callApi("getSplitUnitsForIncident", {
            id: appState.launchId,
            incidentId: appState.currentIncident.id,
        });
        if (response.success) {
            container.innerHTML = renderSplitUnitsPanel(response.data);
        } else {
            showError(response.message);
        }
    } catch (error) {
        showError(error.message);
    }
}

/**
 * Builds the HTML for the "Split Units" panel.
 */
function renderSplitUnitsPanel(subunits) {
    if (!subunits || subunits.length === 0) {
        return "";
    }
    const sortedSubunits = [...subunits].sort((a, b) =>
        (a.unit || "").localeCompare(b.unit || "")
    );
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

/**
 * Opens the modal to confirm unsplitting a unit.
 */
function openUnsplitUnitModal(button) {
    const parentUnitId = button.dataset.parentUnitId;
    document.getElementById("unsplitParentUnitId").value = parentUnitId;
    const groupSelect = document.getElementById("unsplitGroupSelect");
    groupSelect.innerHTML = '<option value="">-- Select Group --</option>';
    (appState.currentIncident?.groups || []).forEach(group => {
        groupSelect.appendChild(new Option(group.groupName, group.id));
    });
    $('#unsplitUnitModal').modal('show');
}

/**
 * Handles the final confirmation of the unsplit action.
 */
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
      id: appState.launchId,
      incidentId: appState.currentIncident.id,
      parentUnitId,
      newGroupId,
    });
    clearGroupSelectionState();
    await loadAndDisplayIncident(appState.currentIncident);
  } catch (error) {
    showError(error.message);
    hideLoader();
  }
}

/**
 * Handles clicks on a PAR button.
 */
function handleParButtonClick(button) {
    const { groupId, parStatus } = button.dataset;
    if (!groupId) return;
    if (parStatus === 'Idle') {
        startParTimer(groupId);
    } else {
        stopParTimer(groupId);
    }
}

/**
 * Calls the API to start the PAR timer.
 */
async function startParTimer(groupId) {
    showLoader();
    try {
        await callApi('startParTimer', { id: appState.launchId, groupId });
        await loadAndDisplayIncident(appState.currentIncident);
    } catch (error) {
        showError(error.message);
        hideLoader();
    }
}

/**
 * Calls the API to stop the PAR timer.
 */
async function stopParTimer(groupId) {
    showLoader();
    try {
        await callApi('stopParTimer', { id: appState.launchId, groupId });
        if (appState.parTimerIntervals[groupId]) {
            clearInterval(appState.parTimerIntervals[groupId]);
            delete appState.parTimerIntervals[groupId];
        }
        await loadAndDisplayIncident(appState.currentIncident);
    } catch (error) {
        showError(error.message);
        hideLoader();
    }
}

/**
 * Scans all rendered groups and starts client-side checks for any active timers.
 */
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

/**
 * Toggles the group reordering mode on or off.
 */
function toggleReorderMode() {
    appState.isReorderModeActive = !appState.isReorderModeActive;
    appState.groupToMove = null;
    updateReorderModeUI();
}

/**
 * Updates the UI to reflect the current reorder mode state.
 */
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
        const cardToHighlight = document.querySelector(`.js-draggable-group[data-group-id="${appState.groupToMove}"] .group-card`);
        if (cardToHighlight) {
            cardToHighlight.classList.add('group-selected-for-move');
        }
    }
}

/**
 * Updates the UI to reflect if "Assign Parent" mode is active.
 */
function updateAssignParentModeUI() {
    document.body.classList.toggle('assign-parent-active', appState.isAssignParentModeActive);
}

/**
 * Handles a click on a sortable table header for available units.
 */
function handleSortAvailableUnits(header) {
  const { sortBy, deptId } = header.dataset;
  if (!sortBy || !deptId) return;

  const currentDirection = header.dataset.sortDir || 'asc';
  const newDirection = currentDirection === 'asc' ? 'desc' : 'asc';

  const dept = appState.departmentsWithAvailableUnits.find(d => d.id === deptId);
  if (!dept || !dept.units) return;

  dept.units.sort((a, b) => {
    const valA = a[sortBy] || '';
    const valB = b[sortBy] || '';
    const comparison = valA.localeCompare(valB, undefined, { numeric: true });
    return newDirection === 'asc' ? comparison : -comparison;
  });

  const tbody = document.getElementById(`available-units-tbody-${deptId}`);
  if (tbody) {
    tbody.innerHTML = dept.units.map(unit => `
      <tr>
        <td>
          <input type="checkbox" class="available-unit-checkbox" id="chk-avail-${unit.id}" data-unit-id="${unit.id}">
        </td>
        <td>${unit.unit}</td>
        <td>${unit.unitName || ''}</td>
        <td>${unit.stationName || ''}</td>
      </tr>
    `).join('');
  }

  document.querySelectorAll(`.sortable-header[data-dept-id="${deptId}"]`).forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    delete th.dataset.sortDir;
  });
  header.dataset.sortDir = newDirection;
  header.classList.add(newDirection === 'asc' ? 'sort-asc' : 'sort-desc');
}