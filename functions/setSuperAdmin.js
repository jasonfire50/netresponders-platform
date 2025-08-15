// scripts/setSuperAdmin.js
const admin = require('firebase-admin');
const serviceAccount = require('../scripts/dev-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// --- IMPORTANT: PASTE THE UID OF YOUR DEV TEST USER HERE ---
const uid = '4kIJ6U1Hzjd1ylab71KKf6PLg0n1'; 

async function setSuperAdminClaim() {
  try {
    await admin.auth().setCustomUserClaims(uid, { isSuperAdmin: true });
    console.log(`✅ Success! Custom claim set for user ${uid}.`);
    console.log('NOTE: The user must log out and log back in for the change to take effect.');
  } catch (error) {
    console.error('Error setting custom claim:', error);
    process.exit(1);
  }
}

setSuperAdminClaim();