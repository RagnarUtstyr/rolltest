import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDjpo2rp_J91Vn8YjL0iJPTEait_Nu3TYY",
  authDomain: "rolltest-37fe9.firebaseapp.com",
  databaseURL: "https://rolltest-37fe9-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "rolltest-37fe9",
  storageBucket: "rolltest-37fe9.firebasestorage.app",
  messagingSenderId: "854772037721",
  appId: "1:854772037721:web:ef1ea8eab08a2b23bd5948"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({
  prompt: "select_account"
});