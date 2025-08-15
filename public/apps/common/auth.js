/**
 * auth.js - Self-contained login script
 */
document.addEventListener("DOMContentLoaded", () => {
  // --- START: Initialization Logic (Only for login page) ---
  
  // We must define these constants again here because app.js is not present
  const hostname = window.location.hostname;
  const isDevelopment = hostname.includes('netresponders-apps-dev--') || 
                        hostname.includes('localhost') || 
                        hostname.includes('127.0.0.1');

  // The dynamic Firebase config logic
  const configPath = isDevelopment 
    ? '/firebase-config-dev.js' 
    : '/firebase-config-prod.js';
  
  import(configPath)
    .then(module => {
      if (!firebase.apps.length) {
        firebase.initializeApp(module.firebaseConfig);
      }
      // Now that Firebase is initialized, set up the login form
      initializeLoginForm();
    })
    .catch(err => {
      console.error("Critical error initializing Firebase on login page:", err);
      const loginError = document.getElementById('login-error');
      loginError.textContent = "A critical error occurred. Could not initialize authentication service.";
      loginError.style.display = 'block';
    });
  
  // --- END: Initialization Logic ---
});

function initializeLoginForm() {
  const auth = firebase.auth();
  const loginForm = document.getElementById('login-form');
  const loginButton = document.getElementById('login-button');
  const loginError = document.getElementById('login-error');
  const urlParams = new URLSearchParams(window.location.search);
  const redirectUrl = urlParams.get('redirect') || '/'; // Redirect to the main index page

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    loginButton.disabled = true;
    loginButton.textContent = 'Authenticating...';

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    auth.signInWithEmailAndPassword(email, password)
      .then(async (userCredential) => {
        loginButton.textContent = 'Creating Session...';
        try {
          const idToken = await userCredential.user.getIdToken(true);

          const hostname = window.location.hostname;
          const isDevelopment = hostname.includes('netresponders-apps-dev--') || 
                                hostname.includes('localhost') || 
                                hostname.includes('127.0.0.1');

          const API_URL = isDevelopment 
            ? "https://us-central1-netresponders-apps-dev.cloudfunctions.net/api"
            : "https://us-central1-netresponders-apps-50.cloudfunctions.net/api";

          const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${idToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'createSession' }),
          });

          const responseData = await response.json();
          if (!response.ok || !responseData.success) {
            throw new Error(responseData.message || "Failed to create a valid session.");
          }

          const sessionId = responseData.data.sessionId;
          // Pass the session ID in the URL to the main app
          window.location.href = `${redirectUrl}?sessionId=${sessionId}`;

        } catch (sessionError) {
          loginError.textContent = `Login Failed: ${sessionError.message}`;
          loginError.style.display = 'block';
          loginButton.disabled = false;
          loginButton.textContent = 'Login';
          await auth.signOut();
        }
      })
      .catch((authError) => {
        loginError.textContent = "Error: Invalid email or password.";
        loginError.style.display = 'block';
        loginButton.disabled = false;
        loginButton.textContent = 'Login';
      });
  });
}