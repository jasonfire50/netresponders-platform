/**
 * auth.js - FINAL DEFINITIVE VERSION
 */

// Define these constants at the top level of the script
const hostname = window.location.hostname;
const isDevelopment = hostname.includes('netresponders-apps-dev--') || 
                      hostname.includes('localhost') || 
                      hostname.includes('127.0.0.1');

const API_URL = isDevelopment 
  ? "https://us-central1-netresponders-apps-dev.cloudfunctions.net/api"  // DEV URL
  : "https://us-central1-netresponders-apps-50.cloudfunctions.net/api"; // PROD URL
  
function initializeLoginForm() {
const auth = firebase.auth();
const loginForm = document.getElementById('login-form');
const loginButton = document.getElementById('login-button');
const loginError = document.getElementById('login-error');
const urlParams = new URLSearchParams(window.location.search);
const redirectUrl = urlParams.get('redirect') || '/command';
const initializationError = urlParams.get('error');

if (initializationError) {
  loginError.textContent = `Login Failed: ${initializationError}`;
  loginError.style.display = 'block';
}

loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  loginButton.disabled = true;
  loginButton.textContent = 'Authenticating...';
  loginError.style.display = 'none';
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  auth.signInWithEmailAndPassword(email, password)
    .then(async (userCredential) => {
      loginButton.textContent = 'Creating Session...';
      try {
        const idToken = await userCredential.user.getIdToken(true);
            
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${idToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'createSession' }),
        });
        const responseData = await response.json();
        if (!response.ok || !responseData.success) {
          throw new Error(responseData.message || "Failed to create a valid session.");
        }
        sessionStorage.setItem('sessionId', responseData.data.sessionId);
        setTimeout(() => {
          window.location.href = redirectUrl;
        }, 50); // A tiny 50ms delay
      } catch (sessionError) {
        console.error("Session creation failed:", sessionError);
        loginError.textContent = `Login Failed: ${sessionError.message}`;
        loginError.style.display = 'block';
        loginButton.disabled = false;
        loginButton.textContent = 'Login';
        await auth.signOut();
      }
    })
    .catch((authError) => {
      console.error("Authentication failed:", authError);
      loginError.textContent = "Error: Invalid email or password.";
      loginError.style.display = 'block';
      loginButton.disabled = false;
      loginButton.textContent = 'Login';
    });
});
}