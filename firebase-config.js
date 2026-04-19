import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC1VdAKmOg27Bo-evlzff4UjvJadD1g7KQ",
  authDomain: "rpgtracker-7387b.firebaseapp.com",
  databaseURL: "https://rpgtracker-7387b-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "rpgtracker-7387b",
  storageBucket: "rpgtracker-7387b.firebasestorage.app",
  messagingSenderId: "3530907990",
  appId: "1:3530907990:web:3f15bbd25e785d806bb6f7"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export const firestore = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({
  prompt: "select_account"
});