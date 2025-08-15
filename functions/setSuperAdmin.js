/**
 * setSuperAdmin.js
 *
 * A command-line utility script to grant Super Admin privileges to a user
 * by setting a custom claim on their Firebase Authentication record.
 * This script is intended for administrative use in a secure environment.
 */

// We are using `const` and `require` which are standard in Node.js scripts.
const admin = require("firebase-admin");

// The service account key provides the necessary credentials.
// The path is relative to the script's location inside the `functions` dir.
const serviceAccount = require("../scripts/dev-service-account.json");

// --- CONFIGURATION ---
// IMPORTANT: Paste the UID of the user you want to make a Super Admin.
const TARGET_USER_UID = "PASTE_THE_UID_OF_YOUR_DEV_TEST_USER_HERE";

/**
 * Initializes the Firebase Admin SDK.
 */
function initializeFirebaseAdmin() {
  console.log("Initializing Firebase Admin SDK...");
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log("SDK Initialized successfully.");
}

/**
 * Sets the isSuperAdmin custom claim for the specified user.
 * @return {Promise<void>} A promise that resolves when the claim is set.
 */
async function setSuperAdminClaim() {
  if (!TARGET_USER_UID || TARGET_USER_UID.startsWith("PASTE_THE_UID")) {
    const errorMsg = "ERROR: You must specify a valid TARGET_USER_UID " +
      "in the script before running.";
    console.error(errorMsg);
    // Use process.exit(1) to indicate a failure.
    process.exit(1);
  }

  try {
    console.log(`Attempting to set custom claim for UID: ${TARGET_USER_UID}`);
    // The custom claims object. We are setting isSuperAdmin to true.
    await admin.auth().setCustomUserClaims(TARGET_USER_UID, {
      isSuperAdmin: true,
    });

    const successMsg = "✅ Success! Custom claim { isSuperAdmin: true } " +
      `has been set for user ${TARGET_USER_UID}.`;
    console.log(successMsg);

    const reminderMsg = "NOTE: The user must log out and log back in " +
      "for the new claim to be included in their ID token.";
    console.log(reminderMsg);
  } catch (error) {
    console.error("❌ Error setting custom claim:", error.message);
    process.exit(1);
  }
}

/**
 * Main function to run the script.
 */
function main() {
  initializeFirebaseAdmin();
  // We use .then() to ensure the program exits gracefully after the async
  // operation is complete.
  setSuperAdminClaim().then(() => {
    process.exit(0);
  });
}

// Execute the main function.
main();