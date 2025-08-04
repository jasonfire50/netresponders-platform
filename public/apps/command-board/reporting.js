/**
 * Renders the entire Reporting view.
 * @param {HTMLElement} container The container element to render the view into.
 */
function renderReportingView() {
  const container = document.getElementById("reportingView");
  if (!container) return;
  const reportingHTML = `<h2>Incident Reporting</h2><hr><div class="row"><div class="col-md-12"><div class="form-row align-items-end"><div class="form-group col-md-6"><label for="closedIncidentSelect">Select Closed Incident:</label><select id="closedIncidentSelect" class="form-control"></select></div><div class="form-group col-md-3"><button id="generateReportBtn" class="btn btn-info btn-block">Generate Report</button></div><div class="form-group col-md-3"><button id="exportCsvBtn" class="btn btn-outline-secondary btn-block" style="display:none;">Export to CSV</button></div></div><hr><div id="reportIncidentDetailsDisplay" class="mb-3 p-3 border rounded bg-light" style="display:none;"></div><div id="reportOutputArea" class="table-responsive"><p><em>Select an incident to generate a report.</em></p></div></div></div>`;
  container.innerHTML = reportingHTML;
  // ... reporting listeners will be attached here later ...
}

/**
 * Attaches event listeners for the Reporting view.
 */
function attachReportingListeners() {
    console.log("Attaching reporting listeners...");
    // In the future, we will add listeners here, like this:
    // const generateBtn = document.getElementById('generateReportBtn');
    // if (generateBtn) {
    //     generateBtn.addEventListener('click', handleGenerateReport);
    // }
}

async function loadClosedIncidentsForReporting() {
    const select = document.getElementById('closedIncidentSelect');
    if (!select) return;
    select.innerHTML = '<option value="">-- Loading Closed Incidents --</option>';

    try {
        const response = await callApi('getClosedIncidents', { id: appState.launchId });
        if (response.success && response.data) {
            select.innerHTML = '<option value="">-- Select a Closed Incident --</option>';
            response.data.forEach(inc => {
                const endDate = inc.endTime ? new Date(inc.endTime).toLocaleDateString() : 'N/A';
                select.appendChild(new Option(
                    `${inc.incidentNumber} - ${inc.incidentName || 'Unnamed'} (Closed: ${endDate})`,
                    inc.id
                ));
            });
        } else {
            select.innerHTML = '<option value="">-- No Closed Incidents --</option>';
        }
    } catch (error) {
        select.innerHTML = '<option value="">-- Error Loading Incidents --</option>';
        showError(error.message);
    }
}
