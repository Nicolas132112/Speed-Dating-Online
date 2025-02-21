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
let waitingActive = false;
let currentConversationId = null;
let messagesListenerUnsubscribe = null;
let requestsProlongUnsubscribe = null;

// Fonction pour générer un identifiant de conversation unique
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
  if (e.target.checked) {
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
    if (userDoc.exists()) {
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
    if (userDoc.exists()) {
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
  if (confirmation !== "supprimer" && confirmation !== "delete" && confirmation !== "eliminar") {
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
// Gestion du Speed Dating et du chat
// ---------------------------
const waitingScreen = document.getElementById("waiting-screen");
const chatContainer = document.getElementById("chat-container");
const chatWindow = document.getElementById("chat-window");
const chatInput = document.getElementById("chat-input");
const sendMessageBtn = document.getElementById("send-message");
const prolongerCheckbox = document.getElementById("prolonger-checkbox");
const prolongerLabel = document.getElementById("prolonger-label");
const chatTimer = document.getElementById("chat-timer");
const prolongerBtn = document.getElementById("prolonger-btn"); // s'il est présent dans HTML, même caché

let timerInterval;
let timeLeft = 540;

let waitingCount = 0;
const waitingCountSpan = document.getElementById("waiting-count");

// Démarrer la conversation
function startChat(conversationId) {
  currentConversationId = conversationId;
  waitingScreen.style.display = "none";
  chatContainer.style.display = "block";
  chatWindow.innerHTML = "";
  timeLeft = 540;
  updateChatTimer();

  // Réinitialiser la checkbox prolonger
  prolongerCheckbox.checked = false;
  prolongerCheckbox.disabled = false;
  prolongerLabel.textContent = "Prolonger";

  // Écoute messages
  if (messagesListenerUnsubscribe) {
    messagesListenerUnsubscribe();
  }
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
        senderSpan.textContent = (data.sender === auth.currentUser.uid) ? "Moi" : (data.senderPrenom || "L'autre");
        const textP = document.createElement("p");
        textP.textContent = data.text;
        msgDiv.appendChild(senderSpan);
        msgDiv.appendChild(textP);
        chatWindow.appendChild(msgDiv);
      });
      chatWindow.scrollTop = chatWindow.scrollHeight;
    }
  );

  // Écoute requestsProlong
  if (requestsProlongUnsubscribe) {
    requestsProlongUnsubscribe();
  }
  const convRef = doc(db, "conversations", currentConversationId);
  requestsProlongUnsubscribe = onSnapshot(convRef, (docSnap) => {
    if (!docSnap.exists()) return;
    const data = docSnap.data();
    if (!data.requestsProlong) return;
    const requests = data.requestsProlong;
    let countTrue = 0;
    for (let uid in requests) {
      if (requests[uid]) countTrue++;
    }
    if (countTrue >= 2) {
      // Les deux ont coché => on transfère
      transferChatToDiscussions();
    }
  });

  // Timer
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

// Quand on coche prolonger
prolongerCheckbox.addEventListener("change", async (e) => {
  if (e.target.checked) {
    prolongerCheckbox.disabled = true;
    prolongerLabel.textContent = "Prolongation demandée";
    const myPrenom = currentUserData.prenom || "Quelqu'un";
    // Envoyer un message "X veut prolonger"
    await setDoc(
      doc(collection(db, "conversations", currentConversationId, "messages")),
      {
        sender: auth.currentUser.uid,
        senderPrenom: myPrenom,
        text: `${myPrenom} veut prolonger la discussion`,
        timestamp: serverTimestamp()
      }
    );
    // Mettre requestsProlong[uid] = true
    const convRef = doc(db, "conversations", currentConversationId);
    await setDoc(convRef, {
      requestsProlong: {
        [auth.currentUser.uid]: true
      }
    }, { merge: true });
  }
});

// Fin du temps
function promptProlongation() {
  showModal("Voulez-vous prolonger la rencontre ?", async () => {
    // L'utilisateur dit OUI => on coche la checkbox si pas déjà
    if (!prolongerCheckbox.checked) {
      prolongerCheckbox.checked = true;
      prolongerCheckbox.disabled = true;
      prolongerLabel.textContent = "Prolongation demandée";
      const myPrenom = currentUserData.prenom || "Quelqu'un";
      // Envoyer message
      await setDoc(
        doc(collection(db, "conversations", currentConversationId, "messages")),
        {
          sender: auth.currentUser.uid,
          senderPrenom: myPrenom,
          text: `${myPrenom} veut prolonger la discussion`,
          timestamp: serverTimestamp()
        }
      );
      // Maj Firestore
      const convRef = doc(db, "conversations", currentConversationId);
      await setDoc(convRef, {
        requestsProlong: {
          [auth.currentUser.uid]: true
        }
      }, { merge: true });
    }
  }, () => {
    showModal("La rencontre est terminée.", null, null, true);
    chatContainer.style.display = "none";
  });
}

// Transfert conversation => Discussions
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

// Surveille la waiting list
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

// Matching
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
    
    if (candidateMatchesUser && userMatchesCandidate) {
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
        senderPrenom: currentUserData.prenom || "Moi",
        text: message,
        timestamp: serverTimestamp()
      }
    );
    chatInput.value = "";
  }
});

// (Bouton prolonger masqué, si besoin)
prolongerBtn.addEventListener("click", () => {
  clearInterval(timerInterval);
  promptProlongation();
});

// Modal
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
    modalCancel.textContent = "Non";
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
