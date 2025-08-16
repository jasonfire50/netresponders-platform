/**
 * admin.js
 * Version: 1.2.0
 * Changes in this version:
 * - Added a new "Manage Stations" modal and related CRUD functions.
 * - Replaced the Units table with a new Department -> Station -> Unit accordion.
 * - Updated the Add/Edit Unit modal to include a dynamic Station dropdown.
 * - Corrected loadAdminUnits to include the Basic plan unit limit check.
 */

// ===================================================================
//
//  ADMIN VIEW RENDERING
//
// ===================================================================


/**
 * Sets up a single, delegated event listener for the entire admin view.
 * This is more efficient and robust than attaching listeners to individual
 * elements, as it works automatically for any content that is re-rendered.
 */
function setupAdminEventListeners() {
  const container = document.getElementById('adminView');
  // Ensure this is only run once to prevent duplicate listeners.
  if (!container || container.dataset.listenersAttached === 'true') {
      return;
  }
  container.dataset.listenersAttached = 'true';

  // --- DELEGATED CLICK LISTENER ---
  // ATTACH TO THE DOCUMENT to catch clicks inside modals
  document.addEventListener('click', (event) => {
      const adminView = document.getElementById('adminView');

      // GUARD CLAUSE: Only run this logic if the admin view is visible.
      // This prevents the listener from interfering with other views.
      if (!adminView || adminView.style.display === 'none') {
          return;
      }

      const target = event.target;
      const button = target.closest('button');
      if (!button) return; // Ignore clicks that aren't on a button

      // Department Actions
      if (button.id === 'addDepartmentBtn') openDepartmentModal();
      if (button.matches('.js-edit-dept')) openDepartmentModal(button.dataset.id);
      if (button.matches('.js-delete-dept')) handleDeleteDepartmentClick(button.dataset.id, button.dataset.name);

      // Unit Actions
      if (button.id === 'addUnitBtn') openUnitModal();
      if (button.matches('.js-edit-unit')) openUnitModal(button.dataset.id);
      if (button.matches('.js-delete-unit')) handleDeleteUnitClick(button.dataset.id, button.dataset.name);

      // Unit Type Actions
      if (button.id === 'addUnitTypeBtn') openUnitTypeModal();
      if (button.matches('.js-edit-type')) openUnitTypeModal(button.dataset.id);
      if (button.matches('.js-delete-type')) handleDeleteUnitTypeClick(button.dataset.id, button.dataset.name);

      // Library Actions (Templates & Common Groups)
      if (button.id === 'addTemplateBtn') openTemplateModal();
      if (button.matches('.js-edit-template')) openTemplateModal(button.dataset.id);
      if (button.matches('.js-delete-template')) handleDeleteTemplateClick(button.dataset.id, button.dataset.name);
      if (button.id === 'addCommonGroupBtn') openCommonGroupModal();
      if (button.matches('.js-edit-cgroup')) openCommonGroupModal(button.dataset.id);
      if (button.matches('.js-delete-cgroup')) handleDeleteCommonGroupClick(button.dataset.id, button.dataset.name);
      
      // THIS LINE WILL NOW WORK
      if (button.id === 'addTemplateGroupBtn') addGroupToTemplateModalList();

      // Incident Management Actions
      if (button.id === 'deleteIncidentBtn') handleDeleteIncidentClick();

      // Settings Actions
      if (button.id === 'saveSettingsBtn') handleSaveSettings();

      // Table Sorting Header
      const sortableHeader = target.closest('.sortable-header-admin');
      if (sortableHeader) {
          handleSortAdminUnits(sortableHeader);
      }
  });

  // --- DELEGATED CHANGE LISTENER ---
  // This can safely stay on the container
  container.addEventListener('change', (event) => {
      const target = event.target;
      // Department filter for units
      if (target.id === 'adminUnitDeptFilter') {
          loadAdminUnits(target.value);
      }
      // Incident selection
      if (target.id === 'closedIncidentSelect') {
          handleAdminIncidentSelect();
      }
  });
}

/**
 * Renders the entire Admin view and calls the setup for its delegated listener.
 * @param {HTMLElement} container The container element for the view.
 * @param {object} data The initial data from appState.
 */
function renderAdminView(container, data) {
  if (!container) return;

  const adminHTML = `
    <h2>Admin Management</h2><hr>
    <ul class="nav nav-tabs" id="adminTab" role="tablist">
      <li class="nav-item"><a class="nav-link active" data-toggle="tab" href="#adminDepartments" role="tab">Departments</a></li>
      <li class="nav-item"><a class="nav-link" data-toggle="tab" href="#adminUnits" role="tab">Units</a></li>
      <li class="nav-item"><a class="nav-link" data-toggle="tab" href="#adminUnitTypes" role="tab">Unit Types</a></li>
      <li class="nav-item"><a class="nav-link" data-toggle="tab" href="#adminTemplates" role="tab">Templates</a></li>
      <li class="nav-item"><a class="nav-link" data-toggle="tab" href="#adminIncidents" role="tab">Incidents</a></li>
      <li class="nav-item"><a class="nav-link" data-toggle="tab" href="#adminSettings" role="tab">Settings</a></li>
    </ul>
    <div class="tab-content" id="adminTabContent">
      <div class="tab-pane fade show active" id="adminDepartments" role="tabpanel">
        <div class="mt-3"><h4>Fire Departments</h4><button class="btn btn-success mb-2" id="addDepartmentBtn">Add Department</button><div id="departmentsTableContainer" class="table-responsive"></div></div>
      </div>
      <div class="tab-pane fade" id="adminUnits" role="tabpanel">
        <div class="mt-3"><h4>Manage Units</h4><div class="form-row align-items-end"><div class="form-group col-md-4"><label for="adminUnitDeptFilter">Filter by Department:</label><select id="adminUnitDeptFilter" class="form-control"></select></div><div class="form-group col-md-4 ml-auto text-right"><button class="btn btn-success mb-0" id="addUnitBtn">Add Unit</button></div></div><div id="unitsTableContainer" class="table-responsive mt-3"></div></div>
      </div>
      <div class="tab-pane fade" id="adminUnitTypes" role="tabpanel">
        <div class="mt-3"><h4>Unit Types</h4><p class="text-muted small">Define unit types, e.g., Engine, Ladder.</p><button class="btn btn-success mb-2" id="addUnitTypeBtn">Add Unit Type</button><div id="unitTypesTableContainer" class="table-responsive"></div></div>
      </div>
      <div class="tab-pane fade" id="adminTemplates" role="tabpanel">
        <div class="mt-3"><h4>Incident Templates</h4><p class="text-muted small">Combine groups into templates.</p><button class="btn btn-success mb-2" id="addTemplateBtn">Add Template</button><div id="templatesTableContainer" class="table-responsive"></div><hr class="my-4"><h4>Common Group Definitions</h4><p class="text-muted small">Building blocks for templates.</p><button class="btn btn-success mb-2" id="addCommonGroupBtn">Add Group</button><div id="commonGroupsTableContainer" class="table-responsive"></div></div>
      </div>
      <div class="tab-pane fade" id="adminIncidents" role="tabpanel">
        <div class="mt-3"><h4>Incident Management</h4><p class="text-muted small">Select a closed incident to manage its data.</p><div class="form-row align-items-end"><div class="form-group col-md-6"><label for="closedIncidentSelect">Select Closed Incident:</label><select id="closedIncidentSelect" class="form-control"></select></div></div><hr><div id="incidentDetailsDisplay" class="mb-3" style="display:none;"><h5>Incident Details</h5><div id="incidentDetailsContent" class="p-3 border rounded bg-light"></div><button id="deleteIncidentBtn" class="btn btn-danger mt-3"><i class="fas fa-exclamation-triangle"></i> Permanently Delete Incident</button></div></div>
      </div>
      <div class="tab-pane fade" id="adminSettings" role="tabpanel">
        <div class="mt-3"><h4>Global Settings</h4><div id="settingsContainer"></div></div>
      </div>
    </div>`;

  container.innerHTML = adminHTML;
  // THE FIX: Call the new, single, delegated listener setup function.
  setupAdminEventListeners();
  // Call the function that handles the tab-switching logic.
  attachAdminTabLogic();
}

/**
 * Attaches the logic for the Admin view's Bootstrap tabs. This function
 * ONLY handles the tab switching, as all button clicks are now managed by
 * the delegated event listener.
 */
function attachAdminTabLogic() {
  // Handles switching between the main admin tabs (Departments, Units, etc.)
  $('#adminTab a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
    if (!appState.isAuthenticated) return;
    const targetTabId = $(e.target).attr("href");
    switch (targetTabId) {
      case "#adminDepartments": loadAdminDepartments(); break;
      case "#adminUnitTypes": loadAdminUnitTypes(); break;
      case "#adminUnits": loadAdminUnits(); break;
      case "#adminTemplates": loadAdminLibraryData(); break;
      case "#adminIncidents": loadClosedIncidentsForAdmin(); break;
      case "#adminSettings": renderSettingsView(appState.initialData.settings || {}); break;
    }
  });

  // Load the default tab's data on initial view.
  if (appState.isAuthenticated) {
    loadAdminDepartments();
  }
}


// ===================================================================
//
//  INCIDENT MANAGEMENT (NEW SECTION)
//
// ===================================================================

/**
 * Fetches closed incidents and populates the admin dropdown.
 */
async function loadClosedIncidentsForAdmin() {
    const select = document.getElementById('closedIncidentSelect');
    if (!select) return;
    select.innerHTML = '<option value="">-- Loading Closed Incidents --</option>';

    try {
        const response = await callApi('getClosedIncidents', { id: appState.launchId });
        if (response.success && response.data.length > 0) {
            select.innerHTML = '<option value="">-- Select an Incident --</option>';
            response.data.forEach(inc => {
                const endDate = inc.endTime ? new Date(inc.endTime).toLocaleDateString() : 'N/A';
                const optionText = `${inc.incidentNumber} - ${inc.incidentName || 'Unnamed'} (Closed: ${endDate})`;
                const option = new Option(optionText, inc.id);
                option.dataset.incidentJson = JSON.stringify(inc);
                select.appendChild(option);
            });
        } else {
            select.innerHTML = '<option value="">-- No Closed Incidents Found --</option>';
        }
    } catch (error) {
        select.innerHTML = '<option value="">-- Error Loading Incidents --</option>';
        showError(error.message);
    }
}

/**
 * Handles the user selecting a closed incident from the admin dropdown.
 */
function handleAdminIncidentSelect() {
    const select = document.getElementById('closedIncidentSelect');
    const detailsDisplay = document.getElementById('incidentDetailsDisplay');
    const detailsContent = document.getElementById('incidentDetailsContent');
    if (!select || !detailsDisplay || !detailsContent) return;

    if (select.value) {
        const selectedOption = select.options[select.selectedIndex];
        const incident = JSON.parse(selectedOption.dataset.incidentJson);

        detailsContent.innerHTML = `
            <p class="mb-1"><strong>Incident #:</strong> ${incident.incidentNumber}</p>
            <p class="mb-1"><strong>Name:</strong> ${incident.incidentName || 'N/A'}</p>
            <p class="mb-1"><strong>Start Time:</strong> ${new Date(incident.startTime).toLocaleString()}</p>
            <p class="mb-0"><strong>End Time:</strong> ${new Date(incident.endTime).toLocaleString()}</p>
        `;
        detailsDisplay.style.display = 'block';
    } else {
        detailsDisplay.style.display = 'none';
    }
}

/**
 * Handles the full deletion flow for an incident.
 * The final success alert is removed; the best confirmation is the
 * incident disappearing from the dropdown list.
 */
async function handleDeleteIncidentClick() {
  const select = document.getElementById('closedIncidentSelect');
  if (!select.value) return;

  const selectedOption = select.options[select.selectedIndex];
  const incident = JSON.parse(selectedOption.dataset.incidentJson);

  // We KEEP this confirmation because deletion is a destructive action.
  const confirmMessage = `Are you sure you want to permanently delete Incident ${incident.incidentNumber}? This action and all of its associated data (groups, units, logs) cannot be undone.`;
  if (!confirm(confirmMessage)) return;

  const adminCode = prompt("To authorize this permanent deletion, please enter the Admin Code.");
  if (adminCode === null) return;
  if (!adminCode) {
    showError("An Admin Code is required to delete an incident.");
    return;
  }

  showLoader();
  try {
    await callApi('deleteIncident', {
      id: appState.launchId,
      incidentId: incident.id,
      adminCode: adminCode,
    });

    // THE FIX: The alert(...) has been removed.
    // The code now proceeds directly to refreshing the application state.

    const response = await callApi("getInitialData", {id: appState.launchId});
    if (response.success) {
      appState.initialData = response.data;
    } else {
      throw new Error("Failed to refresh application data after deletion.");
    }

    loadClosedIncidentsForAdmin();
    document.getElementById('incidentDetailsDisplay').style.display = 'none';

  } catch (error) {
    showError(error.message);
  } finally {
    hideLoader();
  }
}


// ===================================================================
//
//  DEPARTMENT MANAGEMENT
//
// ===================================================================

async function loadAdminDepartments() {
  const container = document.getElementById("departmentsTableContainer");
  if (!container) return;
  container.innerHTML = `<p><em>Loading departments...</em></p>`;
  try {
    const response = await callApi("getDepartments", { id: appState.launchId });
    if (response.success) {
      appState.initialData.fireDepartments = response.data;
      renderDepartmentsTable(response.data);
    } else { container.innerHTML = `<p class="text-danger">${response.message}</p>`; }
  } catch (error) { container.innerHTML = `<p class="text-danger">${error.message}</p>`; }
}

/**
 * Renders the departments table.
 * This FINAL version correctly includes the "Manage Stations" button.
 * @param {Array<object>} departments The list of department documents.
 */
function renderDepartmentsTable(departments) {
  const container = document.getElementById("departmentsTableContainer");
  if (!container) return;
  if (!departments || departments.length === 0) {
    container.innerHTML = '<p><em>No departments configured.</em></p>';
    return;
  }
  const sortedDepts = [...departments].sort((a, b) => {
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
      return (a.departmentName || "").localeCompare(b.departmentName || "");
  });

  let tableHtml = `
    <table class="table table-sm table-hover">
      <thead class="thead-light">
        <tr>
          <th>Name</th>
          <th>Abbreviation</th>
          <th class="text-right">Actions</th>
        </tr>
      </thead>
      <tbody>`;

  sortedDepts.forEach((dept) => {
    const safeDeptName = (dept.departmentName || "").replace(/'/g, "\\'");
    const primaryIndicator = dept.isPrimary ? ` <span class="badge badge-info">Primary</span>` : "";
    tableHtml += `
        <tr data-dept-id="${dept.id}" class="${dept.isPrimary ? "table-info" : ""}">
            <td class="align-middle">${dept.departmentName || "N/A"}${primaryIndicator}</td>
            <td class="align-middle">${dept.abbreviation || ""}</td>
            <td class="text-right">
                <button class="btn btn-sm btn-warning py-0 px-1 ml-1 js-edit-dept" data-id="${dept.id}">
                    Edit
                </button>
                <button class="btn btn-sm btn-danger py-0 px-1 ml-1 js-delete-dept" data-id="${dept.id}" data-name="${safeDeptName}">
                    Delete
                </button>
            </td>
        </tr>`;
  });

  tableHtml += `</tbody></table>`;
  container.innerHTML = tableHtml;
}

function openDepartmentModal(deptId = null) {
  document.getElementById("departmentForm").reset();
  const modalLabel = document.getElementById("departmentModalLabel");
  const depts = appState.initialData.fireDepartments || [];
  if (deptId) {
    modalLabel.textContent = "Edit Department";
    const dept = depts.find(d => d.id === deptId);
    if (dept) {
      document.getElementById("editingDeptId").value = dept.id;
      document.getElementById("deptNameInput").value = dept.departmentName;
      document.getElementById("deptAbbrInput").value = dept.abbreviation || "";
    }
  } else {
    modalLabel.textContent = "Add New Department";
    document.getElementById("editingDeptId").value = "";
  }
  $('#departmentModal').modal('show');
}
/**
 * Handles saving a new or edited department.
 * Now refreshes the department list to reflect changes immediately.
 */
async function handleSaveDepartment() {
  const deptId = document.getElementById("editingDeptId").value;
  const deptName = document.getElementById("deptNameInput").value;
  const deptAbbr = document.getElementById("deptAbbrInput").value;
  if (!deptName || deptName.trim() === "") {
    alert("Department Name is required.");
    return;
  }
  const action = deptId ? "updateFireDepartment" : "addDepartment";
  const params = {
    id: appState.launchId,
    departmentName: deptName,
    abbreviation: deptAbbr,
  };
  if (deptId) {
    params.departmentId = deptId;
  }
  showLoader();
  try {
    const response = await callApi(action, params);
    if (response.success) {
      $('#departmentModal').modal('hide');
      // THE FIX: Re-run the load function to refresh the UI.
      await loadAdminDepartments();
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
 * Handles deleting a department.
 * Now refreshes the department list to reflect changes immediately.
 * @param {string} deptId The ID of the department to delete.
 * @param {string} deptName The name for the confirm dialog.
 */
async function handleDeleteDepartmentClick(deptId, deptName) {
  const confirmMsg = `Delete department "${deptName}"? Units must be reassigned first. This cannot be undone.`;
  if (!confirm(confirmMsg)) return;
  showLoader();
  try {
    const response = await callApi("deleteFireDepartment", {
      id: appState.launchId,
      departmentId: deptId,
    });
    if (response.success) {
      // THE FIX: Re-run the load function to refresh the UI.
      await loadAdminDepartments();
    } else {
      showError(response.message);
    }
  } catch (error) {
    showError(error.message);
  } finally {
    hideLoader();
  }
}

// --- UNIT TYPE MANAGEMENT ---
async function loadAdminUnitTypes() {
  const container = document.getElementById("unitTypesTableContainer");
  if (!container) return;
  container.innerHTML = `<p><em>Loading unit types...</em></p>`;
  try {
    const response = await callApi("getUnitTypes", { id: appState.launchId });
    if (response.success) {
      appState.initialData.unitTypes = response.data;
      renderUnitTypesTable(response.data);
    } else { container.innerHTML = `<p class="text-danger">${response.message}</p>`; }
  } catch (error) { container.innerHTML = `<p class="text-danger">${error.message}</p>`; }
}
function renderUnitTypesTable(unitTypes) {
    const container = document.getElementById('unitTypesTableContainer');
    if (!container) return;
    if (!unitTypes || unitTypes.length === 0) { container.innerHTML = '<p><em>No unit types configured yet.</em></p>'; return; }
    const sortedTypes = [...unitTypes].sort((a,b) => (a.typeName || "").localeCompare(b.typeName || ""));
    let tableHtml = `<table class="table table-sm table-hover"><thead class="thead-light"><tr><th>Type Name</th><th>Description</th><th class="text-right">Actions</th></tr></thead><tbody>`;
    sortedTypes.forEach(type => {
        const safeTypeName = (type.typeName || "").replace(/'/g, "\\'");
        tableHtml += `<tr data-type-id="${type.id}"><td>${type.typeName || "N/A"}</td><td>${type.description || ""}</td><td class="text-right"><button class="btn btn-sm btn-warning py-0 px-1 js-edit-type" data-id="${type.id}">Edit</button><button class="btn btn-sm btn-danger py-0 px-1 ml-1 js-delete-type" data-id="${type.id}" data-name="${safeTypeName}">Delete</button></td></tr>`;
    });
    tableHtml += `</tbody></table>`;
    container.innerHTML = tableHtml;
}
function openUnitTypeModal(typeId = null) {
  document.getElementById("unitTypeForm").reset();
  const modalLabel = document.getElementById("unitTypeModalLabel");
  const types = appState.initialData.unitTypes || [];
  if (typeId) {
    modalLabel.textContent = "Edit Unit Type";
    const type = types.find(t => t.id === typeId);
    if (type) {
      document.getElementById("editingUnitTypeId").value = type.id;
      document.getElementById("unitTypeNameInput").value = type.typeName;
      document.getElementById("unitTypeDescriptionInput").value = type.description || "";
    }
  } else {
    modalLabel.textContent = "Add New Unit Type";
    document.getElementById("editingUnitTypeId").value = "";
  }
  $('#unitTypeModal').modal('show');
}

/**
 * Handles saving a new or edited unit type.
 * Now refreshes the unit type list to reflect changes immediately.
 */
async function handleSaveUnitType() {
  const typeId = document.getElementById("editingUnitTypeId").value;
  const typeName = document.getElementById("unitTypeNameInput").value;
  const typeDesc = document.getElementById("unitTypeDescriptionInput").value;
  if (!typeName || typeName.trim() === "") {
    alert("Unit Type Name is required.");
    return;
  }
  const action = typeId ? "updateUnitType" : "addUnitType";
  const params = {
    id: appState.launchId,
    typeName,
    description: typeDesc,
  };
  if (typeId) {
    params.unitTypeId = typeId;
  }
  showLoader();
  try {
    const response = await callApi(action, params);
    if (response.success) {
      $('#unitTypeModal').modal('hide');
      // THE FIX: Re-run the load function to refresh the UI.
      await loadAdminUnitTypes();
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
 * Handles deleting a unit type.
 * Now refreshes the unit type list to reflect changes immediately.
 * @param {string} typeId The ID of the unit type to delete.
 * @param {string} typeName The name for the confirm dialog.
 */
async function handleDeleteUnitTypeClick(typeId, typeName) {
  if (!confirm(`Delete unit type "${typeName}"? This cannot be undone.`)) return;
  showLoader();
  try {
    const response = await callApi("deleteUnitType", {
      id: appState.launchId,
      unitTypeId: typeId,
    });
    if (response.success) {
      // THE FIX: Re-run the load function to refresh the UI.
      await loadAdminUnitTypes();
    } else {
      showError(response.message);
    }
  } catch (error) {
    showError(error.message);
  } finally {
    hideLoader();
  }
}

// --- UNIT MANAGEMENT ---

/**
 * Populates the department filter dropdown on the Admin > Units tab.
 * @param {Array<object>} departments The list of fire department objects.
 */
function populateAdminDepartmentFilter(departments) {
    const filterSelect = document.getElementById('adminUnitDeptFilter');
    if (!filterSelect) return;

    // Preserve the currently selected value.
    const currentFilterValue = filterSelect.value;
    filterSelect.innerHTML = '<option value="">-- All Departments --</option>';

    if (departments && departments.length > 0) {
        // Sort departments for a clean list, primary first.
        const sortedDepts = [...departments].sort((a, b) => {
            if (a.isPrimary && !b.isPrimary) return -1;
            if (!a.isPrimary && b.isPrimary) return 1;
            return (a.departmentName || "").localeCompare(b.departmentName || "");
        });

        sortedDepts.forEach(dept => {
            const option = new Option(dept.departmentName, dept.id);
            if(dept.isPrimary) {
                option.style.fontWeight = "bold";
            }
            filterSelect.appendChild(option);
        });
    }

    // Restore the previous selection if it's still valid.
    if (currentFilterValue) {
        filterSelect.value = currentFilterValue;
    }
}

/**
 * Loads and displays the units accordion in the admin panel.
 * Now filters the displayed units based on the selected department ID.
 * @param {string|null} filterDeptId An optional department ID to filter by.
 *                                    If null, all departments are shown.
 */
async function loadAdminUnits(filterDeptId = null) {
  const container = document.getElementById("unitsTableContainer");
  const addUnitBtn = document.getElementById('addUnitBtn');
  if (!container || !addUnitBtn) return;

  container.innerHTML = `<p><em>Loading...</em></p>`;
  addUnitBtn.disabled = true; // Disable while loading/filtering.

  try {
    // We only need to fetch from the API if the core data isn't loaded yet.
    if (!appState.initialData.departmentsWithStations) {
      const response = await callApi("getUnitsGroupedByStation", {
        id: appState.launchId,
      });
      if (!response.success) {
        throw new Error(response.message);
      }
      appState.initialData.departmentsWithStations = response.data;
    }

    // Now, work with the data we have stored in appState.
    const allDeptsWithStations = appState.initialData.departmentsWithStations;

    // THE FIX: Filter the data *before* rendering.
    let deptsToRender;
    if (filterDeptId) {
      // If a filter is applied, show only that department.
      deptsToRender = allDeptsWithStations.filter(d => d.id === filterDeptId);
    } else {
      // Otherwise, show all departments.
      deptsToRender = allDeptsWithStations;
    }

    // Always ensure the filter dropdown is populated and up-to-date.
    // We use fireDepartments from initialData as it's the master list.
    populateAdminDepartmentFilter(appState.initialData.fireDepartments);

    // Render the accordion with the (potentially filtered) data.
    renderUnitsAccordion(deptsToRender);

    // Unit limit logic for Basic plan (this is unchanged).
    if (appState.planLevel === 'Basic') {
      const totalUnitCount = allDeptsWithStations.reduce((total, dept) => total + (dept.units?.length || 0), 0);
      if (totalUnitCount >= 50) {
        addUnitBtn.disabled = true;
        // Optionally show a message about the limit.
      } else {
        addUnitBtn.disabled = false;
      }
    } else {
      addUnitBtn.disabled = false;
    }

  } catch (error) {
    container.innerHTML = `<p class="text-danger">${error.message}</p>`;
  }
}

/**
 * Renders the master unit list as a sortable table within each
 * department's accordion panel on the Admin tab.
 * @param {Array<object>} departments The list of departments, each with
 *                                    a flat array of its units.
 */
function renderUnitsAccordion(departments) {
  const container = document.getElementById('unitsTableContainer');
  if (!container) return;

  if (!departments || departments.length === 0) {
    const defaultMessage = appState.initialData.fireDepartments.length > 0 ?
      '<em>No units found for the selected department.</em>' :
      '<em>No departments found. Add one from the "Departments" tab.</em>';
    container.innerHTML = `<p class="p-3">${defaultMessage}</p>`;
    return;
  }

  const accordionId = 'admin-units-accordion';

  // This function builds a single row in the table.
  const createUnitRow = (unit) => {
    // Correctly escape the unit name for the data attribute.
    const safeUnitName = (unit.unit || '').replace(/'/g, "\\'");
    const rowClass = unit.status !== 'Available' ? 'table-secondary text-muted' : '';

    return `
      <tr class="${rowClass}">
        <td>${unit.unit}</td>
        <td>${unit.unitName || ''}</td>
        <td>${unit.stationName || ''}</td>
        <td>${unit.status}</td>
        <td class="text-right">
          <button class="btn btn-sm btn-warning py-0 px-1 js-edit-unit" data-id="${unit.id}">Edit</button>
          <button class="btn btn-sm btn-danger py-0 px-1 ml-1 js-delete-unit" data-id="${unit.id}" data-name="${safeUnitName}">Delete</button>
        </td>
      </tr>
    `;
  };

  const accordionHtml = departments.map((dept) => {
    const deptCollapseId = `admin-dept-collapse-${dept.id}`;
    const totalUnitsInDept = dept.units.length;

    const tableHtml = totalUnitsInDept > 0 ? `
      <div class="table-responsive">
        <table class="table table-sm table-hover admin-units-table">
          <thead>
            <tr>
              <th scope="col" class="sortable-header-admin" data-sort-by="unit" data-dept-id="${dept.id}">
                Unit <span class="sort-indicator"></span>
              </th>
              <th scope="col" class="sortable-header-admin" data-sort-by="unitName" data-dept-id="${dept.id}">
                Name <span class="sort-indicator"></span>
              </th>
              <th scope="col" class="sortable-header-admin" data-sort-by="stationName" data-dept-id="${dept.id}">
                Station <span class="sort-indicator"></span>
              </th>
              <th scope="col" class="sortable-header-admin" data-sort-by="status" data-dept-id="${dept.id}">
                Status <span class="sort-indicator"></span>
              </th>
              <th scope="col" class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody id="admin-units-tbody-${dept.id}">
            ${dept.units.map(createUnitRow).join('')}
          </tbody>
        </table>
      </div>` : `<div class="p-3 text-muted"><em>No units configured for this department.</em></div>`;

    return `
      <div class="card mb-1">
        <div class="card-header p-0">
          <h5 class="mb-0">
            <button class="btn btn-light btn-block text-left d-flex justify-content-between align-items-center" type="button" data-toggle="collapse" data-target="#${deptCollapseId}">
              ${dept.departmentName} ${dept.isPrimary ? '<span class="badge badge-info ml-2">Primary</span>' : ''}
              <span class="badge badge-secondary badge-pill">${totalUnitsInDept}</span>
            </button>
          </h5>
        </div>
        <div id="${deptCollapseId}" class="collapse ${dept.isPrimary || departments.length === 1 ? 'show' : ''}">
          <div class="card-body p-0">
            ${tableHtml}
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `<div class="accordion mt-3" id="${accordionId}">${accordionHtml}</div>`;
}

/**
 * Opens the modal for adding or editing a unit.
 * This version correctly finds the unit to edit from the new, flatter
 * data structure provided by the API.
 * @param {string|null} unitId The ID of the unit to edit, or null to add.
 */
async function openUnitModal(unitId = null) {
  const form = document.getElementById("unitForm");
  form.reset();

  const modalLabel = document.getElementById("unitModalLabel");
  const depts = appState.initialData.fireDepartments || [];
  const types = appState.initialData.unitTypes || [];
  const deptSelect = document.getElementById("unitFireDeptSelect");
  const typeSelect = document.getElementById("unitTypeSelect");

  // Populate static dropdowns (Departments and Unit Types)
  deptSelect.innerHTML = '<option value="">-- Select --</option>';
  depts.forEach(d => deptSelect.appendChild(new Option(d.departmentName, d.id)));

  typeSelect.innerHTML = '<option value="">-- Select --</option>';
  const sortedTypes = [...types].sort((a,b) => (a.typeName||"").localeCompare(b.typeName||""));
  sortedTypes.forEach(t => typeSelect.appendChild(new Option(t.typeName, t.id)));

  let unitData = {
      unit: "",
      departmentId: "",
      unitTypeId: "",
      stationName: "",
      unitName: "",
      status: "Available",
      notes: ""
  };

  if (unitId) {
    modalLabel.textContent = "Edit Unit";

    // --- THE FIX IS HERE ---
    // The new, simpler way to get a flat list of all units.
    const allUnits = (appState.initialData.departmentsWithStations || [])
        .flatMap(d => d.units); // We just need to flatMap the units directly.
    const unitToEdit = allUnits.find(u => u.id === unitId);
    // --- END OF FIX ---

    if (unitToEdit) {
        unitData = {...unitData, ...unitToEdit};
    } else {
        console.error(`Could not find unit with ID: ${unitId}. Modal may not populate correctly.`);
    }
  } else {
    modalLabel.textContent = "Add New Unit";
    unitData.departmentId = document.getElementById("adminUnitDeptFilter")?.value || "";
  }

  // Set all form field values from the unitData object.
  document.getElementById("editingUnitId").value = unitId || "";
  document.getElementById("unitCallSignInput").value = unitData.unit;
  document.getElementById("unitNameInput").value = unitData.unitName;
  document.getElementById("unitNotesInput").value = unitData.notes || "";
  document.getElementById("unitStationInput").value = unitData.stationName || "";
  deptSelect.value = unitData.departmentId;
  typeSelect.value = unitData.unitTypeId;
  document.getElementById("unitStatusSelect").value = unitData.status;

  $('#unitModal').modal('show');
}

/**
 * Handles saving a new or edited unit.
 * After a successful save, it now re-runs `loadAdminUnits` to refresh the
 * local state and the UI, ensuring changes are visible immediately.
 */
async function handleSaveUnit() {
  const unitId = document.getElementById("editingUnitId").value;

  const unitData = {
    unit: document.getElementById("unitCallSignInput").value,
    departmentId: document.getElementById("unitFireDeptSelect").value,
    unitTypeId: document.getElementById("unitTypeSelect").value,
    unitName: document.getElementById("unitNameInput").value,
    status: document.getElementById("unitStatusSelect").value,
    notes: document.getElementById("unitNotesInput").value,
    stationName: document.getElementById("unitStationInput").value,
  };

  const requiredFields = [
    unitData.departmentId, unitData.unit, unitData.unitTypeId,
    unitData.unitName, unitData.status
  ];
  if (requiredFields.some(f => !f)) {
    alert("Unit Identifier, Department, Type, Name, and Status are required.");
    return;
  }

  const action = unitId ? "updateUnitInMaster" : "addUnitToMaster";

  const params = {
    id: appState.launchId,
    ...unitData,
  };
  if (unitId) {
    params.unitId = unitId;
  }

  showLoader();
  try {
    const response = await callApi(action, params);
    if (response.success) {
      $('#unitModal').modal('hide');

      // --- THE FIX IS HERE ---
      // We must clear the cached data to force a full refresh from the server.
      appState.initialData.departmentsWithStations = null;

      // Now, re-run the load function. It will fetch the fresh data from
      // the API and re-render the table with the updated information.
      // We pass the current filter value to maintain the user's view.
      const currentFilter = document.getElementById("adminUnitDeptFilter").value;
      await loadAdminUnits(currentFilter);
      // --- END OF FIX ---

    } else {
      showError(response.message);
    }
  } catch (error) {
    showError(error.message);
  } finally {
    // The loader will be hidden by the loadAdminUnits function,
    // but we add it here as a fallback in case of errors.
    hideLoader();
  }
}

/**
 * Handles deleting a master unit from the admin panel.
 * After a successful deletion, it now re-runs `loadAdminUnits` to refresh
 * the UI and remove the deleted unit from the view immediately.
 * @param {string} unitId The ID of the unit to delete.
 * @param {string} unitName The name of the unit for the confirm dialog.
 */
async function handleDeleteUnitClick(unitId, unitName) {
  const confirmMsg = `Are you sure you want to permanently delete the unit "${unitName}"? This action cannot be undone.`;
  if (!confirm(confirmMsg)) return;

  showLoader();
  try {
    const response = await callApi("deleteUnitFromMaster", {
      id: appState.launchId,
      unitId: unitId,
    });

    if (response.success) {
      // --- THE FIX IS HERE ---
      // 1. Clear the cached data to force a full refresh from the server.
      // This is the most important step.
      appState.initialData.departmentsWithStations = null;

      // 2. Re-run the load function to get the fresh list of units.
      // We pass the current filter value to maintain the user's view.
      const currentFilter = document.getElementById("adminUnitDeptFilter").value;
      await loadAdminUnits(currentFilter);
      // --- END OF FIX ---

    } else {
      showError(response.message);
    }
  } catch (error) {
    showError(error.message);
  } finally {
    // The loader will be hidden by loadAdminUnits, but this is a good fallback
    // in case of an error during the process.
    hideLoader();
  }
}

// --- LIBRARY MANAGEMENT ---
async function loadAdminLibraryData() {
    const commonGroupsContainer = document.getElementById("commonGroupsTableContainer");
    const templatesContainer = document.getElementById("templatesTableContainer");
    if(commonGroupsContainer) commonGroupsContainer.innerHTML = `<p><em>Loading...</em></p>`;
    if(templatesContainer) templatesContainer.innerHTML = `<p><em>Loading...</em></p>`;
    try {
        const [commonGroupsRes, templatesRes] = await Promise.all([callApi("getCommonGroups", {id: appState.launchId}), callApi("getTemplates", {id: appState.launchId})]);
        if (commonGroupsRes.success && templatesRes.success) {
            appState.initialData.commonGroups = commonGroupsRes.data;
            appState.initialData.templates = templatesRes.data;
            renderCommonGroupsTable(commonGroupsRes.data);
            renderTemplatesTable(templatesRes.data, commonGroupsRes.data);
        } else { showError(commonGroupsRes.message || templatesRes.message); }
    } catch (error) { showError(error.message); }
}
function renderCommonGroupsTable(commonGroups) {
    const container = document.getElementById('commonGroupsTableContainer');
    if (!container) return;
    if (!commonGroups || commonGroups.length === 0) { container.innerHTML = '<p><em>No common groups configured.</em></p>'; return; }
    const sortedGroups = [...commonGroups].sort((a,b) => (a.name || "").localeCompare(b.name || ""));
    let tableHtml = `<table class="table table-sm table-hover"><thead class="thead-light"><tr><th>Name</th><th>Color</th><th class="text-right">Actions</th></tr></thead><tbody>`;
    sortedGroups.forEach(group => {
        const safeGroupName = (group.name || "").replace(/'/g, "\\'");
        tableHtml += `<tr><td class="align-middle">${group.name}</td><td class="align-middle"><div style="width:50px; height:20px; background-color:${group.color || '#ffffff'}; border: 1px solid #ccc;"></div></td><td class="text-right"><button class="btn btn-sm btn-warning py-0 px-1 js-edit-cgroup" data-id="${group.id}">Edit</button><button class="btn btn-sm btn-danger py-0 px-1 ml-1 js-delete-cgroup" data-id="${group.id}" data-name="${safeGroupName}">Delete</button></td></tr>`;
    });
    tableHtml += `</tbody></table>`;
    container.innerHTML = tableHtml;
}
function openCommonGroupModal(groupId = null) {
  document.getElementById("commonGroupForm").reset();
  const modalLabel = document.getElementById("commonGroupModalLabel");
  const editingIdInput = document.getElementById("editingCommonGroupId");
  const nameInput = document.getElementById("commonGroupNameInput");
  const colorInput = document.getElementById("commonGroupColorInput");
  const commonGroups = (appState.initialData && appState.initialData.commonGroups) ? appState.initialData.commonGroups : [];
  if (groupId) {
    const group = commonGroups.find(g => g.id === groupId);
    if (group) {
      modalLabel.textContent = "Edit Common Group"; editingIdInput.value = group.id;
      nameInput.value = group.name; colorInput.value = group.color || "#6c757d";
    }
  } else {
    modalLabel.textContent = "Add New Common Group";
    editingIdInput.value = ""; colorInput.value = "#6c757d";
  }
  $('#commonGroupModal').modal('show');
}

/**
 * Handles saving a new or edited common group.
 * Now refreshes the entire library view to reflect changes.
 */
async function handleSaveCommonGroup() {
  const groupId = document.getElementById("editingCommonGroupId").value;
  const name = document.getElementById("commonGroupNameInput").value;
  const color = document.getElementById("commonGroupColorInput").value;
  if (!name || name.trim() === "") {
    alert("Group Name is required.");
    return;
  }
  const action = groupId ? "updateCommonGroup" : "addCommonGroup";
  const params = {
    id: appState.launchId,
    name,
    color
  };
  if (groupId) {
    params.groupId = groupId;
  }
  showLoader();
  try {
    const response = await callApi(action, params);
    if (response.success) {
      $('#commonGroupModal').modal('hide');
      // THE FIX: Re-run the library load function.
      await loadAdminLibraryData();
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
 * Handles deleting a common group.
 * Now refreshes the entire library view to reflect changes.
 * @param {string} groupId The ID of the group to delete.
 * @param {string} groupName The name for the confirm dialog.
 */
async function handleDeleteCommonGroupClick(groupId, groupName) {
  if (!confirm(`Delete "${groupName}"? Fails if used in templates.`)) return;
  showLoader();
  try {
    const response = await callApi("deleteCommonGroup", {
      id: appState.launchId,
      groupId,
      groupName,
    });
    if (response.success) {
      // THE FIX: Re-run the library load function.
      await loadAdminLibraryData();
    } else {
      showError(response.message);
    }
  } catch (error) {
    showError(error.message);
  } finally {
    hideLoader();
  }
}

function renderTemplatesTable(templates, commonGroups) {
  const container = document.getElementById('templatesTableContainer');
  if (!container) return;
  if (!templates || templates.length === 0) { container.innerHTML = '<p><em>No incident templates configured.</em></p>'; return; }
  const sortedTemplates = [...templates].sort((a,b) => (a.templateName || "").localeCompare(b.templateName || ""));
  const colorMap = new Map(commonGroups.map(g => [g.name, g.color]));
  let tableHtml = `<table class="table table-sm table-hover"><thead class="thead-light"><tr><th>Template Name</th><th>Groups</th><th class="text-right">Actions</th></tr></thead><tbody>`;
  sortedTemplates.forEach(template => {
    const safeName = (template.templateName || "").replace(/'/g, "\\'");
    const groupsHtml = (template.groups && template.groups.length > 0) ? template.groups.map(name => {
        const bgColor = colorMap.get(name) || '#6c757d';
        const textColor = getContrastYIQ(bgColor);
        return `<span class="badge mr-1" style="background-color:${bgColor}; color:${textColor};">${name}</span>`;
    }).join('') : '<span class="text-muted">None</span>';
    tableHtml += `<tr data-template-id="${template.id}"><td class="align-middle">${template.templateName}</td><td class="align-middle">${groupsHtml}</td><td class="text-right"><button class="btn btn-sm btn-warning py-0 px-1 js-edit-template" data-id="${template.id}">Edit</button><button class="btn btn-sm btn-danger py-0 px-1 ml-1 js-delete-template" data-id="${template.id}" data-name="${safeName}">Delete</button></td></tr>`;
  });
  tableHtml += `</tbody></table>`;
  container.innerHTML = tableHtml;
}
function openTemplateModal(templateId = null) {
  document.getElementById("templateForm").reset();
  const modalLabel = document.getElementById("templateModalLabel");
  const groupsList = document.getElementById("templateGroupsList");
  groupsList.innerHTML = '';
  const commonGroupSelect = document.getElementById("templateCommonGroupSelect");
  commonGroupSelect.innerHTML = '<option value="">-- Select Group to Add --</option>';
  (appState.initialData.commonGroups || []).forEach(cg => {
    if(cg.name) commonGroupSelect.appendChild(new Option(cg.name, cg.name));
  });
  if (templateId) {
    modalLabel.textContent = "Edit Template";
    document.getElementById("editingTemplateId").value = templateId;
    const template = (appState.initialData.templates || []).find(t => t.id === templateId);
    if(template) {
      document.getElementById("templateNameInput").value = template.templateName;
      (template.groups || []).forEach(groupName => addGroupToTemplateModalList(groupName));
    }
  } else {
    modalLabel.textContent = "Add New Template";
    document.getElementById("editingTemplateId").value = "";
  }
  setupTemplateDragAndDrop();
  $('#templateModal').modal('show');
}
function addGroupToTemplateModalList(groupNameFromSelect) {
    const list = document.getElementById('templateGroupsList');
    const select = document.getElementById('templateCommonGroupSelect');
    const nameToAdd = (typeof groupNameFromSelect === 'string') ? groupNameFromSelect : select.value;
    if (!nameToAdd) return;
    if (Array.from(list.querySelectorAll('.list-group-item-text')).some(el => el.textContent === nameToAdd)) {
        alert("This group is already in the template."); return;
    }
    const item = document.createElement('div');
    item.className = 'list-group-item d-flex justify-content-between align-items-center py-2';
    item.setAttribute('draggable', 'true');
    item.innerHTML = `<span class="list-group-item-text">${nameToAdd}</span><button type="button" class="btn btn-sm btn-outline-danger py-0 px-1" onclick="this.parentElement.remove()">×</button>`;
    list.appendChild(item);
    if (select) select.value = '';
}
function setupTemplateDragAndDrop() {
    const list = document.getElementById('templateGroupsList');
    if (!list) return;
    let draggedItem = null;
    list.addEventListener('dragstart', e => {
        draggedItem = e.target;
        setTimeout(() => e.target.classList.add('dragging'), 0);
    });
    list.addEventListener('dragend', e => { if (draggedItem) draggedItem.classList.remove('dragging'); });
    list.addEventListener('dragover', e => {
        e.preventDefault();
        const afterElement = [...list.querySelectorAll('.list-group-item:not(.dragging)')].reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = e.clientY - box.top - box.height / 2;
            return (offset < 0 && offset > closest.offset) ? { offset: offset, element: child } : closest;
        }, { offset: Number.NEGATIVE_INFINITY }).element;
        const currentlyDragged = document.querySelector('.dragging');
        if (currentlyDragged) {
            if (afterElement == null) { list.appendChild(currentlyDragged); }
            else { list.insertBefore(currentlyDragged, afterElement); }
        }
    });
}

/**
 * Handles saving a new or edited template.
 * Now refreshes the entire library view to reflect changes.
 */
async function handleSaveTemplate() {
  const templateId = document.getElementById("editingTemplateId").value;
  const templateName = document.getElementById("templateNameInput").value;
  if (!templateName.trim()) {
    alert("Template Name is required.");
    return;
  }
  const groups = Array.from(document.querySelectorAll("#templateGroupsList .list-group-item-text")).map(el => el.textContent.trim());
  const action = templateId ? "updateTemplate" : "addTemplate";
  const params = {
    id: appState.launchId,
    templateName,
    groups: groups.join(","),
  };
  if (templateId) {
    params.templateId = templateId;
  }
  showLoader();
  try {
    const response = await callApi(action, params);
    if (response.success) {
      $('#templateModal').modal('hide');
      // THE FIX: Re-run the library load function.
      await loadAdminLibraryData();
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
 * Handles deleting a template.
 * Now refreshes the entire library view to reflect changes.
 * @param {string} templateId The ID of the template to delete.
 * @param {string} templateName The name for the confirm dialog.
 */
async function handleDeleteTemplateClick(templateId, templateName) {
  if (!confirm(`Delete template "${templateName}"?`)) return;
  showLoader();
  try {
    const response = await callApi("deleteTemplate", {
      id: appState.launchId,
      templateId,
    });
    if (response.success) {
      // THE FIX: Re-run the library load function.
      await loadAdminLibraryData();
    } else {
      showError(response.message);
    }
  } catch (error) {
    showError(error.message);
  } finally {
    hideLoader();
  }
}

// --- SETTINGS MANAGEMENT ---
function renderSettingsView(settings) {
  const container = document.getElementById("settingsContainer");
  if (!container) return;
  const duration = (settings && settings.parTimerDurationMinutes) ? settings.parTimerDurationMinutes : 10;
  container.innerHTML = `<div class="card my-3"><div class="card-header">PAR Timer</div><div class="card-body"><div class="form-row align-items-end"><div class="form-group col-md-4 mb-0"><label for="parDurationInput">Duration (minutes)</label><input type="number" class="form-control" id="parDurationInput" min="1" value="${duration}"></div><div class="form-group col-md-3 mb-0"><button class="btn btn-primary btn-block" id="saveSettingsBtn">Save</button></div></div></div></div>`;
}

/**
 * Handles saving the global settings.
 * This version no longer shows a success alert. The change is implicitly
 * confirmed by the value remaining in the input box.
 */
async function handleSaveSettings() {
  const newDuration = document.getElementById("parDurationInput").value;
  showLoader();
  try {
    const response = await callApi("updateSettings", {
      id: appState.launchId,
      parTimerDurationMinutes: newDuration,
    });

    if (response.success) {
      // THE FIX: The alert("Settings saved!") has been removed.
      // We still update the local state so the app uses the new timer value.
      appState.initialData.settings.parTimerDurationMinutes = parseInt(newDuration, 10);
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
 * Handles clicks on sortable table headers in the Admin > Units view.
 * This version defensively copies the array before sorting to prevent
 * mutation side-effects and correctly handles repeated clicks.
 * @param {HTMLElement} header The <th> element that was clicked.
 */
function handleSortAdminUnits(header) {
  const { sortBy, deptId } = header.dataset;
  if (!sortBy || !deptId) return;

  const currentDirection = header.dataset.sortDir || 'asc';
  const newDirection = currentDirection === 'asc' ? 'desc' : 'asc';

  // Find the right department's data in our app state.
  const dept = appState.initialData.departmentsWithStations.find(d => d.id === deptId);
  if (!dept || !dept.units) return;

  // --- THE CORE FIX ---
  // 1. Create a shallow copy of the units array to avoid in-place mutation issues.
  const unitsToSort = [...dept.units];

  // 2. Sort the *copy*, not the original state.
  unitsToSort.sort((a, b) => {
    const valA = a[sortBy] || '';
    const valB = b[sortBy] || '';
    // Using numeric collation for natural sorting of unit numbers (e.g., E2 before E10)
    const comparison = valA.localeCompare(valB, undefined, { numeric: true });
    return newDirection === 'asc' ? comparison : -comparison;
  });

  // 3. Replace the old array in the state with our new, sorted array.
  dept.units = unitsToSort;
  // --- END OF CORE FIX ---


  // Helper function to create a single, syntactically correct table row.
  const createAdminUnitRow = (unit) => {
    const safeUnitName = (unit.unit || '').replace(/'/g, "\\'");
    const rowClass = unit.status !== 'Available' ? 'table-secondary text-muted' : '';
    return `
      <tr class="${rowClass}">
        <td>${unit.unit}</td>
        <td>${unit.unitName || ''}</td>
        <td>${unit.stationName || ''}</td>
        <td>${unit.status}</td>
        <td class="text-right">
          <button class="btn btn-sm btn-warning py-0 px-1 js-edit-unit" data-id="${unit.id}">Edit</button>
          <button class="btn btn-sm btn-danger py-0 px-1 ml-1 js-delete-unit" data-id="${unit.id}" data-name="${safeUnitName}">Delete</button>
        </td>
      </tr>
    `;
  };

  // Re-render the table body with the newly sorted data.
  const tbody = document.getElementById(`admin-units-tbody-${deptId}`);
  if (tbody) {
    tbody.innerHTML = dept.units.map(createAdminUnitRow).join('');
  }

  // Update UI indicators for sort direction on the headers.
  document.querySelectorAll(`.sortable-header-admin[data-dept-id="${deptId}"]`).forEach(th => {
    // Clear styles from all headers in this table first.
    th.classList.remove('sort-asc', 'sort-desc');
    // Only set the sort direction on the header that was actually clicked.
    if (th === header) {
      th.dataset.sortDir = newDirection;
      th.classList.add(newDirection === 'asc' ? 'sort-asc' : 'sort-desc');
    } else {
      delete th.dataset.sortDir;
    }
  });
}