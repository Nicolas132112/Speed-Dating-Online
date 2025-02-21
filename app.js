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
  serverTimestamp,
  ref, 
  uploadBytes, 
  getDownloadURL 
} from "./firebase-config.js";
import { deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";

// Variables globales
let currentUserData = null;
let waitingActive = false; // indique si l'utilisateur est dans la waiting list
let currentConversationId = null;
let messagesListenerUnsubscribe = null;

// Fonction pour générer un identifiant de conversation unique (tri lexicographique)
function getConversationId(u1, u2) {
  return [u1, u2].sort().join("_");
}

// ---------------------------
// Gestion du dark mode
// ---------------------------
const darkModeToggle = document.getElementById("dark-mode-toggle");
window.addEventListener("load", () => {
  const savedDark = localStorage.getItem("darkMode") === "true";
  darkModeToggle.checked = savedDark;
  if (savedDark) {
    document.body.classList.add("dark-mode");
  }
});
darkModeToggle.addEventListener("change", (e) => {
  if(e.target.checked){
    document.body.classList.add("dark-mode");
    localStorage.setItem("darkMode", "true");
  } else {
    document.body.classList.remove("dark-mode");
    localStorage.setItem("darkMode", "false");
  }
});

// ---------------------------
// Menu et navigation
// ---------------------------
const menuToggleEl = document.getElementById("menu-toggle");
const sidebarEl = document.getElementById("sidebar");
menuToggleEl.addEventListener("click", () => {
  sidebarEl.classList.toggle("active");
});

const sections = document.querySelectorAll(".section");
document.querySelectorAll("#sidebar ul li a").forEach(link => {
  link.addEventListener("click", async (e) => {
    e.preventDefault();
    const target = e.target.getAttribute("data-section");
    if (target !== "speed-dating" && waitingActive) {
      await removeFromWaitingList();
      waitingActive = false;
    }
    sections.forEach(sec => sec.classList.remove("active"));
    document.getElementById(target + "-section").classList.add("active");
    sidebarEl.classList.remove("active");
    if (target === "speed-dating" && auth.currentUser) {
      await addToWaitingList();
    }
  });
});

document.getElementById("logout").addEventListener("click", async () => {
  if (waitingActive) {
    await removeFromWaitingList();
    waitingActive = false;
  }
  auth.signOut().then(() => {
    window.location.href = "index.html";
  });
});

window.addEventListener("beforeunload", async () => {
  if (auth.currentUser && waitingActive) {
    await removeFromWaitingList();
  }
});

// ---------------------------
// Waiting list
// ---------------------------
async function addToWaitingList() {
  const user = auth.currentUser;
  if (!user || waitingActive) return;
  if (!currentUserData) {
    const userDocRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()){
      currentUserData = userDoc.data();
    } else {
      console.error("Données utilisateur introuvables");
      return;
    }
  }
  await setDoc(doc(db, "waiting", user.uid), {
    uid: user.uid,
    timestamp: Date.now(),
    preferences: currentUserData.preferences || {},
    age: currentUserData.age,
    sexe: currentUserData.sexe.toLowerCase()
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
  if (user) {
    const userDocRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()){
      currentUserData = userDoc.data();
      document.getElementById("display-prenom").textContent = `Prénom: ${currentUserData.prenom}`;
      document.getElementById("display-age").textContent = `Âge: ${currentUserData.age}`;
      document.getElementById("display-sexe").textContent = `Sexe: ${currentUserData.sexe}`;
      document.getElementById("display-ville").textContent = `Ville: ${currentUserData.ville}`;
      
      if (currentUserData.preferences) {
        document.getElementById("preference-sexe").value = currentUserData.preferences.meetingSex || "";
        document.getElementById("age-min").value = currentUserData.preferences.ageMin || 18;
        document.getElementById("age-max").value = currentUserData.preferences.ageMax || 100;
        document.getElementById("distance").value = currentUserData.preferences.distance || "monpays";
      }
      
      if (document.getElementById("speed-dating-section").classList.contains("active")) {
         await addToWaitingList();
      }
    }
  }
});

// ---------------------------
// Enregistrement des préférences
// ---------------------------
document.getElementById("save-preferences").addEventListener("click", async () => {
  const meetingSex = document.getElementById("preference-sexe").value.toLowerCase();
  const ageMin = parseInt(document.getElementById("age-min").value);
  const ageMax = parseInt(document.getElementById("age-max").value);
  const distance = document.getElementById("distance").value;
  if (ageMin < 18 || ageMax > 100 || ageMin >= ageMax) {
    showModal("La tranche d'âge doit être comprise entre 18 et 100 ans, et l'âge minimum doit être inférieur à l'âge maximum.", null, null, true);
    return;
  }
  const user = auth.currentUser;
  if (user) {
    const userDocRef = doc(db, "users", user.uid);
    await setDoc(userDocRef, {
      preferences: {
        meetingSex,
        ageMin,
        ageMax,
        distance
      }
    }, { merge: true });
    currentUserData.preferences = { meetingSex, ageMin, ageMax, distance };
    showModal("Préférences sauvegardées !", null, null, true);
    if (waitingActive) {
      await removeFromWaitingList();
      await addToWaitingList();
    }
  }
});

// ---------------------------
// Suppression de compte
// ---------------------------
document.getElementById("delete-account-btn").addEventListener("click", async () => {
  const confirmation = document.getElementById("delete-confirm").value.trim().toLowerCase();
  if(confirmation !== "supprimer" && confirmation !== "delete" && confirmation !== "eliminar"){
    alert("Veuillez taper la confirmation exacte pour supprimer votre compte.");
    return;
  }
  try {
    await auth.currentUser.delete();
    alert("Votre compte a été supprimé.");
    window.location.href = "index.html";
  } catch (error) {
    console.error("Erreur lors de la suppression du compte :", error);
    alert("Erreur lors de la suppression de votre compte. Veuillez réessayer.");
  }
});

// ---------------------------
// Gestion des conversations pour Speed Dating
// ---------------------------
const waitingScreen = document.getElementById("waiting-screen");
const chatContainer = document.getElementById("chat-container");
const chatWindow = document.getElementById("chat-window");
const chatInput = document.getElementById("chat-input");
const sendMessageBtn = document.getElementById("send-message");
const prolongerBtn = document.getElementById("prolonger-btn");
const chatTimer = document.getElementById("chat-timer");

let timerInterval;
let timeLeft = 540;

let waitingCount = 0;
const waitingCountSpan = document.getElementById("waiting-count");

// Démarrer le chat pour la conversation donnée
function startChat(conversationId) {
  currentConversationId = conversationId;
  waitingScreen.style.display = "none";
  chatContainer.style.display = "block";
  chatWindow.innerHTML = "";
  timeLeft = 540;
  updateChatTimer();

  // Si on écoutait déjà une autre conversation, on arrête
  if (messagesListenerUnsubscribe) {
    messagesListenerUnsubscribe();
  }
  // Écoute en temps réel des messages de la conversation
  messagesListenerUnsubscribe = onSnapshot(
    collection(db, "conversations", currentConversationId, "messages"),
    (snapshot) => {
      chatWindow.innerHTML = "";
      snapshot.forEach(doc => {
        const data = doc.data();
        const msgDiv = document.createElement("div");
        msgDiv.classList.add("chat-message", data.sender === auth.currentUser.uid ? "self" : "other");
        const senderSpan = document.createElement("span");
        senderSpan.classList.add("sender");
        senderSpan.textContent = data.sender === auth.currentUser.uid ? "Moi" : "L'autre";
        const textP = document.createElement("p");
        textP.textContent = data.text;
        msgDiv.appendChild(senderSpan);
        msgDiv.appendChild(textP);
        chatWindow.appendChild(msgDiv);
      });
      chatWindow.scrollTop = chatWindow.scrollHeight;
    }
  );

  timerInterval = setInterval(() => {
    timeLeft--;
    updateChatTimer();
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      promptProlongation();
    }
  }, 1000);
}

function updateChatTimer() {
  let minutes = Math.floor(timeLeft / 60).toString().padStart(2, '0');
  let seconds = (timeLeft % 60).toString().padStart(2, '0');
  chatTimer.textContent = `${minutes}:${seconds}`;
}

// Proposer de prolonger la rencontre
function promptProlongation() {
  showModal("Voulez-vous prolonger la rencontre ?", () => {
    transferChatToDiscussions();
  }, () => {
    showModal("La rencontre est terminée.", null, null, true);
    chatContainer.style.display = "none";
  });
}

// Ajouter un lien vers la conversation dans "Discussions"
function transferChatToDiscussions() {
  const discussionsList = document.getElementById("discussions-list");
  const convLink = document.createElement("a");
  convLink.href = "#";
  convLink.textContent = "Reprendre la conversation " + currentConversationId;
  convLink.style.display = "block";
  convLink.style.margin = "10px 0";
  convLink.addEventListener("click", () => {
    loadConversation(currentConversationId);
  });
  discussionsList.appendChild(convLink);
  chatContainer.style.display = "none";
}

// Charger une conversation existante
function loadConversation(convId) {
  startChat(convId);
}

// Surveille la waiting list en temps réel
onSnapshot(collection(db, "waiting"), (snapshot) => {
  waitingCount = snapshot.size;
  updateWaitingCount();
  console.log("Waiting list mise à jour :", snapshot.docs.map(doc => doc.data()));
  if (waitingCount > 1) {
    attemptMatching(snapshot.docs);
  }
});

function updateWaitingCount() {
  waitingCountSpan.textContent = waitingCount;
}

// Vérifie si deux utilisateurs correspondent et lance le chat
async function attemptMatching(waitingDocs) {
  const user = auth.currentUser;
  if (!user || !currentUserData) return;
  const currentDoc = waitingDocs.find(doc => doc.data().uid === user.uid);
  if (!currentDoc) return;
  
  const { ageMin: userMin = 18, ageMax: userMax = 100, meetingSex: userMeetingSex = "les-deux" } = currentUserData.preferences || {};
  const userAge = currentUserData.age;
  const userSex = (currentUserData.sexe || "").toLowerCase();
  
  for (const docSnapshot of waitingDocs) {
    const candidateData = docSnapshot.data();
    if (candidateData.uid === user.uid) continue;
    
    const { ageMin: candMin = 18, ageMax: candMax = 100, meetingSex: candMeetingSex = "les-deux" } = candidateData.preferences || {};
    const candidateAge = candidateData.age;
    const candidateSex = (candidateData.sexe || "").toLowerCase();
    
    const candidateMatchesUser = (candidateAge >= userMin && candidateAge <= userMax) &&
      (userMeetingSex === "les-deux" || candidateSex === userMeetingSex);
    const userMatchesCandidate = (userAge >= candMin && userAge <= candMax) &&
      (candMeetingSex === "les-deux" || userSex === candMeetingSex);
    
    console.log(`Comparaison entre ${user.uid} et ${candidateData.uid}:`);
    console.log("User recherche :", { userMin, userMax, userMeetingSex }, "→ Candidat:", candidateData);
    console.log("candidateMatchesUser:", candidateMatchesUser, "userMatchesCandidate:", userMatchesCandidate);
    
    if (candidateMatchesUser && userMatchesCandidate) {
      // Générer un identifiant de conversation unique
      const conversationId = getConversationId(user.uid, candidateData.uid);
      console.log("Match trouvé entre", user.uid, "et", candidateData.uid, "-> Conversation:", conversationId);

      await deleteDoc(doc(db, "waiting", candidateData.uid));
      await deleteDoc(doc(db, "waiting", user.uid));
      waitingActive = false;
      startChat(conversationId);
      break;
    }
  }
}

// Envoi de message
sendMessageBtn.addEventListener("click", async () => {
  const message = chatInput.value.trim();
  if (message && currentConversationId) {
    await setDoc(
      doc(collection(db, "conversations", currentConversationId, "messages")),
      {
         sender: auth.currentUser.uid,
         text: message,
         timestamp: serverTimestamp()
      }
    );
    chatInput.value = "";
  }
});

prolongerBtn.addEventListener("click", () => {
  clearInterval(timerInterval);
  promptProlongation();
});

// ---------------------------
// Fonction d'affichage de modal
function showModal(message, onConfirm, onCancel, isAlert = false) {
  const modal = document.getElementById("custom-modal");
  const modalMessage = document.getElementById("modal-message");
  const modalConfirm = document.getElementById("modal-confirm");
  const modalCancel = document.getElementById("modal-cancel");
  
  modalMessage.textContent = message;
  modal.style.display = "flex";
  if (isAlert) {
    modalConfirm.style.display = "none";
    modalCancel.textContent = "Ok";
  } else {
    modalConfirm.style.display = "inline-block";
  }
  modalConfirm.onclick = () => {
    modal.style.display = "none";
    if (onConfirm) onConfirm();
  };
  modalCancel.onclick = () => {
    modal.style.display = "none";
    if (onCancel) onCancel();
  };
}
