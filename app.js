import { 
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
} from "./firebase-config.js";
import { deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";

// Variable globale pour stocker les données de l'utilisateur courant
let currentUserData = null;
let waitingActive = false; // indique si l'utilisateur est dans la waiting list

// ---------------------------
// Menu et navigation
// ---------------------------
const menuToggle = document.getElementById("menu-toggle");
const sidebar = document.getElementById("sidebar");
menuToggle.addEventListener("click", () => {
  sidebar.classList.toggle("active");
});

const sections = document.querySelectorAll(".section");
document.querySelectorAll("#sidebar ul li a").forEach(link => {
  link.addEventListener("click", async (e) => {
    e.preventDefault();
    const currentActiveSection = document.querySelector(".section.active");
    // Si on quitte la section Speed Dating, retirer l'utilisateur de la waiting list
    if (currentActiveSection && currentActiveSection.id === "speed-dating-section" && waitingActive) {
      await removeFromWaitingList();
      waitingActive = false;
    }
    const target = e.target.getAttribute("data-section");
    if(target){
      sections.forEach(sec => sec.classList.remove("active"));
      document.getElementById(target + "-section").classList.add("active");
      sidebar.classList.remove("active");
      // Si l'utilisateur revient sur la section Speed Dating, on l'inscrit
      if(target === "speed-dating" && auth.currentUser) {
        await addToWaitingList();
      }
    }
  });
});

document.getElementById("logout").addEventListener("click", async () => {
  if(waitingActive){
    await removeFromWaitingList();
    waitingActive = false;
  }
  auth.signOut().then(() => {
    window.location.href = "index.html";
  });
});

// ---------------------------
// Gestion automatique de l'inscription/désinscription
// ---------------------------
window.addEventListener("beforeunload", async () => {
  if (auth.currentUser && waitingActive) {
    await removeFromWaitingList();
  }
});

// ---------------------------
// Fonctions de gestion de la waiting list
// ---------------------------
async function addToWaitingList() {
  const user = auth.currentUser;
  if (!user || waitingActive) return; // déjà inscrit ou non connecté
  // S'assurer que currentUserData est chargé
  if (!currentUserData) {
    const userDocRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userDocRef);
    if(userDoc.exists()){
      currentUserData = userDoc.data();
    } else {
      console.error("Données utilisateur introuvables");
      return;
    }
  }
  // Insertion dans la collection "waiting"
  await setDoc(doc(db, "waiting", user.uid), {
    uid: user.uid,
    timestamp: Date.now(),
    preferences: currentUserData.preferences || {},
    age: currentUserData.age,
    sexe: currentUserData.sexe
  }, { merge: true });
  waitingActive = true;
  console.log("Utilisateur inscrit dans la waiting list");
}

async function removeFromWaitingList() {
  const user = auth.currentUser;
  if (user) {
    try {
      await deleteDoc(doc(db, "waiting", user.uid));
      console.log("Utilisateur retiré de la waiting list");
    } catch (error) {
      console.error("Erreur lors de la suppression de la waiting list :", error);
    }
  }
  waitingActive = false;
}

// ---------------------------
// Chargement des infos utilisateur
// ---------------------------
auth.onAuthStateChanged(async (user) => {
  if(user){
    const userDocRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userDocRef);
    if(userDoc.exists()){
      currentUserData = userDoc.data();
      document.getElementById("display-prenom").textContent = `Prénom: ${currentUserData.prenom}`;
      document.getElementById("display-age").textContent = `Âge: ${currentUserData.age}`;
      document.getElementById("display-sexe").textContent = `Sexe: ${currentUserData.sexe}`;
      document.getElementById("display-ville").textContent = `Ville: ${currentUserData.ville}`;
      
      if(currentUserData.preferences){
        document.getElementById("preference-sexe").value = currentUserData.preferences.meetingSex || "";
        document.getElementById("age-min").value = currentUserData.preferences.ageMin || 18;
        document.getElementById("age-max").value = currentUserData.preferences.ageMax || 100;
        document.getElementById("distance").value = currentUserData.preferences.distance || "monpays";
      }
      
      // Si la section Speed Dating est active, inscrire l'utilisateur
      if(document.getElementById("speed-dating-section").classList.contains("active")) {
         await addToWaitingList();
      }
    }
  }
});

// ---------------------------
// Enregistrement des préférences
// ---------------------------
document.getElementById("save-preferences").addEventListener("click", async () => {
  const meetingSex = document.getElementById("preference-sexe").value;
  const ageMin = parseInt(document.getElementById("age-min").value);
  const ageMax = parseInt(document.getElementById("age-max").value);
  const distance = document.getElementById("distance").value;
  if(ageMin < 18 || ageMax > 100 || ageMin >= ageMax){
    showModal("La tranche d'âge doit être comprise entre 18 et 100 ans, et l'âge minimum doit être inférieur à l'âge maximum.", null, null, true);
    return;
  }
  const user = auth.currentUser;
  if(user){
    const userDocRef = doc(db, "users", user.uid);
    await setDoc(userDocRef, {
      preferences: {
        meetingSex,
        ageMin,
        ageMax,
        distance
      }
    }, { merge: true });
    showModal("Préférences sauvegardées !", null, null, true);
    // Si l'utilisateur est déjà en attente, mettre à jour son inscription
    if(waitingActive) {
      await addToWaitingList();
    }
  }
});

// ---------------------------
// Modal custom (pour les pop-ups de l'appli)
// ---------------------------
const modal = document.getElementById("custom-modal");
const modalMessage = document.getElementById("modal-message");
const modalConfirm = document.getElementById("modal-confirm");
const modalCancel = document.getElementById("modal-cancel");

function showModal(message, onConfirm, onCancel, isAlert=false) {
  modalMessage.textContent = message;
  modal.style.display = "flex";
  if(isAlert){
    modalConfirm.style.display = "none";
    modalCancel.textContent = "Ok";
  } else {
    modalConfirm.style.display = "inline-block";
  }
  modalConfirm.onclick = () => {
    modal.style.display = "none";
    if(onConfirm) onConfirm();
  };
  modalCancel.onclick = () => {
    modal.style.display = "none";
    if(onCancel) onCancel();
  };
}

// ---------------------------
// Gestion du Speed Dating
// ---------------------------
const waitingScreen = document.getElementById("waiting-screen");
const chatContainer = document.getElementById("chat-container");
const chatWindow = document.getElementById("chat-window");
const chatInput = document.getElementById("chat-input");
const sendMessageBtn = document.getElementById("send-message");
const prolongerBtn = document.getElementById("prolonger-btn");
const chatTimer = document.getElementById("chat-timer");

let timerInterval;
let timeLeft = 540; // 9 minutes en secondes

let waitingCount = 0;
const waitingCountSpan = document.getElementById("waiting-count");

// Écoute en temps réel de la collection "waiting" pour mettre à jour l'affichage et matcher
onSnapshot(collection(db, "waiting"), (snapshot) => {
  waitingCount = snapshot.size;
  updateWaitingCount();
  console.log("Waiting list mise à jour :", snapshot.docs.map(doc => doc.data()));
  if (waitingCount > 1) {
    attemptMatching(snapshot.docs);
  }
});

function updateWaitingCount(){
  waitingCountSpan.textContent = waitingCount;
}

// Vérifie si deux utilisateurs se correspondent en fonction de leurs préférences
function matchesCriteria(userData, candidateData) {
  if(userData.preferences) {
    const { ageMin, ageMax, meetingSex } = userData.preferences;
    if(candidateData.age < ageMin || candidateData.age > ageMax) return false;
    if(meetingSex && meetingSex !== "les-deux" && candidateData.sexe.toLowerCase() !== meetingSex.toLowerCase()) return false;
  }
  return true;
}

// Tente de matcher l'utilisateur courant avec un autre utilisateur en attente
async function attemptMatching(waitingDocs) {
  const user = auth.currentUser;
  if(!user || !currentUserData) return;
  // Vérifier que l'utilisateur courant est toujours inscrit
  const currentDoc = waitingDocs.find(doc => doc.data().uid === user.uid);
  if(!currentDoc) return;
  // Parcourir les autres utilisateurs en attente
  for (const docSnapshot of waitingDocs) {
    const candidateData = docSnapshot.data();
    if(candidateData.uid !== user.uid) {
      if (matchesCriteria(currentUserData, candidateData) && matchesCriteria(candidateData, currentUserData)) {
        console.log("Match trouvé entre", user.uid, "et", candidateData.uid);
        // Match trouvé : retirer les deux utilisateurs de la waiting list et démarrer le chat
        await deleteDoc(doc(db, "waiting", candidateData.uid));
        await deleteDoc(doc(db, "waiting", user.uid));
        waitingActive = false;
        startChat();
        break;
      }
    }
  }
}

// ---------------------------
// Gestion du chat en Speed Dating
// ---------------------------
function startChat(){
  waitingScreen.style.display = "none";
  chatContainer.style.display = "block";
  timeLeft = 540; // réinitialiser le timer à 9 minutes
  updateChatTimer();
  timerInterval = setInterval(() => {
    timeLeft--;
    updateChatTimer();
    if(timeLeft <= 0){
      clearInterval(timerInterval);
      promptProlongation();
    }
  }, 1000);
}

function updateChatTimer(){
  let minutes = Math.floor(timeLeft / 60).toString().padStart(2, '0');
  let seconds = (timeLeft % 60).toString().padStart(2, '0');
  chatTimer.textContent = `${minutes}:${seconds}`;
}

function promptProlongation(){
  showModal("Voulez-vous prolonger la rencontre ?", () => {
    transferChatToDiscussions();
  }, () => {
    showModal("La rencontre est terminée.", null, null, true);
    chatWindow.innerHTML = "";
    chatContainer.style.display = "none";
  });
}

function transferChatToDiscussions(){
  const discussionsList = document.getElementById("discussions-list");
  const discussionDiv = document.createElement("div");
  discussionDiv.classList.add("discussion");
  discussionDiv.innerHTML = chatWindow.innerHTML;
  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = "Supprimer la discussion";
  deleteBtn.addEventListener("click", () => {
    discussionsList.removeChild(discussionDiv);
  });
  discussionDiv.appendChild(deleteBtn);
  discussionsList.appendChild(discussionDiv);
  chatWindow.innerHTML = "";
  chatContainer.style.display = "none";
}

// --- SUPPRESSION DE LA RÉPONSE AUTOMATIQUE ---
sendMessageBtn.addEventListener("click", () => {
  const message = chatInput.value.trim();
  if(message){
    const msgDiv = document.createElement("div");
    msgDiv.classList.add("chat-message", "self");
    const senderSpan = document.createElement("span");
    senderSpan.classList.add("sender");
    senderSpan.textContent = "Moi";
    const textP = document.createElement("p");
    textP.textContent = message;
    msgDiv.appendChild(senderSpan);
    msgDiv.appendChild(textP);
    chatWindow.appendChild(msgDiv);
    chatInput.value = "";
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }
});

prolongerBtn.addEventListener("click", () => {
  clearInterval(timerInterval);
  promptProlongation();
});
