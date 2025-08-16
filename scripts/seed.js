// scripts/seed.js
const admin = require('firebase-admin');

// Load the service account key
// IMPORTANT: Make sure the path matches the name you gave your uploaded key file
const serviceAccount = require('./dev-service-account.json');

// Initialize the Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Get a reference to the Firestore database
const db = admin.firestore();

async function seedDatabase() {
  console.log('Starting to seed the development database...');

  // --- CUSTOMIZE YOUR SEED DATA HERE ---

  // Example 1: Add some departments
  const departmentsCollection = db.collection('departments');
  console.log('Seeding departments...');
  await departmentsCollection.doc('dept_fire').set({ customerId: 'development', departmentName: 'Dev Department', abbreviation: 'DEV' });

  // Example 2: Add some unit types
  const unitTypesCollection = db.collection('unitTypes');
  console.log('Seeding unit types...');
  await unitTypesCollection.doc('type_engine').set({ name: 'Engine' });
  await unitTypesCollection.doc('type_patrol').set({ name: 'Patrol Car' });
  
  // Example 3: Create a user record for your test user
  // This is essential so your app can find user data after login
  const usersCollection = db.collection('users');
  const testUserEmail = 'appsadmin1@netresponders.com'; 
  const testUserUid = '4kIJ6U1Hzjd1ylab71KKf6PLg0n1'; // <-- IMPORTANT! See below
  
  console.log(`Seeding user record for ${testUserEmail}...`);
  await usersCollection.doc(testUserUid).set({
    email: testUserEmail,
    name: 'Test Admin User',
    planLevel: 'Pro', 
    adminCode: 'DEV911',
    customerId: 'development',
    status: 'Active'
  });

  // Example 4: Create a customer record for your test user
  const customerCollection = db.collection('customers');
  console.log(`Seeding customers...`);
  await customerCollection.doc(testUserUid).set({
    email: testUserEmail,
    name: 'Test Admin User',
    planLevel: 'Pro', 
    adminCode: 'DEV911',
    customerId: 'development',
    status: 'Active'
  });

  // --- END OF CUSTOMIZATION ---

  console.log('✅ Seeding complete!');
}

seedDatabase().catch(error => {
  console.error('Seeding failed:', error);
  process.exit(1);
});