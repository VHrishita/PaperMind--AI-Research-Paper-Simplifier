import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyD6v0_m0ATpVd_Inrt36aAEJ0hsBPiJCfA",
  authDomain: "papermind-f9700.firebaseapp.com",
  databaseURL: "https://papermind-f9700-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "papermind-f9700",
  storageBucket: "papermind-f9700.firebasestorage.app",
  messagingSenderId: "800293662098",
  appId: "1:800293662098:web:6f6c8e305d620311c2654b"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);