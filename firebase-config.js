import { initializeApp } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  getDoc,
  query, 
  where 
} from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.0.0/firebase-storage.js";

// Veillez à bien mettre VOTRE clé d'API ici :
const firebaseConfig = {
  apiKey: "AIzaSyDrA7vok6bdGcs-cUnK_yKG9tdsW4lFQWw", // <--- IMPORTANT : Mettez la vraie clé depuis votre console Firebase
  authDomain: "speeddatingapp-e7691.firebaseapp.com",
  projectId: "speeddatingapp-e7691",
  storageBucket: "speeddatingapp-e7691.appspot.com",
  messagingSenderId: "219890594231",
  appId: "1:219890594231"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { 
  auth, 
  db, 
  storage, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  getDoc,
  query, 
  where, 
  ref, 
  uploadBytes, 
  getDownloadURL 
};
