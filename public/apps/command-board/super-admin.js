/**
 * super-admin.js
 * Contains all logic for the Super Admin view for user management.
 * This version uses the standard `callApi` function for consistency and
 * to resolve CORS issues.
 */

function renderSuperAdminView(container) {
  const viewHtml = `
    <h2><i class="fas fa-user-shield"></i> User Management</h2>
    <p class="text-muted">Use this panel to manage all users across all customers.</p>
    <div id="user-list-container">
      <p><em>Loading user list...</em></p>
    </div>
  `;
  container.innerHTML = viewHtml;
  loadAllUsers();
}

async function loadAllUsers() {
  const container = document.getElementById('user-list-container');
  try {
    // --- THE FIX: Use the standard callApi function ---
    const response = await callApi("adminGetAllUsers");
    if (!response.success) {
      throw new Error(response.message);
    }
    const users = response.data.sort((a,b) => (a.email || "").localeCompare(b.email || ""));
    // --- END OF FIX ---

    const tableHtml = `
      <table class="table table-sm table-hover">
        <thead class="thead-light">
          <tr>
            <th>Email</th>
            <th>Name / Customer ID</th>
            <th>Plan</th>
            <th>Status</th>
            <th class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(user => `
            <tr>
              <td class="align-middle">${user.email}</td>
              <td class="align-middle">
                ${user.name || '<em>No Name</em>'}<br>
                <small class="text-muted">${user.customerId || '<em>No Customer ID</em>'}</small>
              </td>
              <td class="align-middle">${user.planLevel || 'N/A'}</td>
              <td class="align-middle">
                ${user.disabled ? '<span class="badge badge-danger">Disabled</span>' : '<span class="badge badge-success">Active</span>'}
              </td>
              <td class="text-right">
                <button class="btn btn-sm btn-warning py-0 px-1 js-reset-password" data-uid="${user.uid}" data-email="${user.email}">
                  Set Password
                </button>
                <button class="btn btn-sm btn-danger py-0 px-1 ml-1 js-force-logout" data-uid="${user.uid}" data-email="${user.email}">
                  Force Logout
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
    container.innerHTML = tableHtml;
  } catch (error) {
    console.error("Error loading users:", error);
    container.innerHTML = `<p class="text-danger">Error loading users: ${error.message}</p>`;
  }
}

async function handleSetPasswordClick(button) {
  const { uid, email } = button.dataset;
  const newPassword = prompt(`Enter a new temporary password for ${email}:`);

  if (!newPassword || newPassword.length < 6) {
    alert("Invalid input. Password must be at least 6 characters long.");
    return;
  }

  showLoader();
  try {
    // --- THE FIX: Use the standard callApi function ---
    const response = await callApi("adminSetNewPassword", {
      targetUid: uid,
      newPassword: newPassword,
    });
    if (response.success) {
      alert(response.data.message);
    } else {
      throw new Error(response.message);
    }
    // --- END OF FIX ---
  } catch (error) {
    console.error("Failed to set password:", error);
    showError(error.message);
  } finally {
    hideLoader();
  }
}

async function handleForceLogoutClick(button) {
    const { uid, email } = button.dataset;
    const confirmMsg = `Are you sure you want to force a logout for ${email}? This will sign them out of all devices immediately.`;
    if (!confirm(confirmMsg)) {
        return;
    }

    showLoader();
    try {
        // --- THE FIX: Use the standard callApi function ---
        const response = await callApi("adminRevokeUserSessions", { targetUid: uid });
        if (response.success) {
            alert(response.data.message);
        } else {
            throw new Error(response.message);
        }
        // --- END OF FIX ---
    } catch (error) {
        console.error("Failed to force logout:", error);
        showError(error.message);
    } finally {
        hideLoader();
    }
}