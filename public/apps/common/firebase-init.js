/**
 * firebase-init.js
 * This is the single source of truth for the Firebase configuration and
 * initialization. It must be loaded on every page before any other
 * script that uses the Firebase SDK.
 */

// IMPORTANT: Paste your complete Firebase Config object here ONE FINAL TIME.
const firebaseConfig = {
    apiKey: "AIzaSyBqhFB8zCneMUrNrbQzR21JFjR77QtMEnM",
    authDomain: "netresponders-apps-50.firebaseapp.com",
    projectId: "netresponders-apps-50",
    storageBucket: "netresponders-apps-50.firebasestorage.app",
    messagingSenderId: "293715447513",
    appId: "1:293715447513:web:9f8b9bf29928b7878a78c8",
    measurementId: "G-BNYN7V62GH"
  };

// Initialize Firebase. The safety check prevents re-initializing.
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
  console.log("Firebase Initialized Successfully.");
}