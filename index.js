import { 
  auth, 
  db,
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  where
} from "./firebase-config.js";

// Bascule entre connexion et inscription
document.getElementById("show-signup").addEventListener("click", () => {
  document.getElementById("login-container").style.display = "none";
  document.getElementById("signup-container").style.display = "block";
});
document.getElementById("show-login").addEventListener("click", () => {
  document.getElementById("signup-container").style.display = "none";
  document.getElementById("login-container").style.display = "block";
});

// Remplissage des dropdowns de date
const jourSelect = document.getElementById("jour");
const moisSelect = document.getElementById("mois");
const anneeSelect = document.getElementById("annee");

for (let i = 1; i <= 31; i++) {
  const option = document.createElement("option");
  option.value = i;
  option.textContent = i;
  jourSelect.appendChild(option);
}
const moisNoms = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
for (let i = 0; i < 12; i++) {
  const option = document.createElement("option");
  option.value = i + 1;
  option.textContent = moisNoms[i];
  moisSelect.appendChild(option);
}
const currentYear = new Date().getFullYear();
for (let i = currentYear - 100; i <= currentYear - 18; i++) {
  const option = document.createElement("option");
  option.value = i;
  option.textContent = i;
  anneeSelect.appendChild(option);
}

// Calcul de l'âge
function calculateAge() {
  const day = parseInt(jourSelect.value);
  const month = parseInt(moisSelect.value) - 1;
  const year = parseInt(anneeSelect.value);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return;
  const birthDate = new Date(year, month, day);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  document.getElementById("age-confirmation").textContent = `Vous avez ${age} ans.`;
}
jourSelect.addEventListener("change", calculateAge);
moisSelect.addEventListener("change", calculateAge);
anneeSelect.addEventListener("change", calculateAge);

// Auto-complétion de la ville via code postal
document.getElementById("code-postal").addEventListener("input", async (e) => {
  const postalCode = e.target.value;
  const villeSelect = document.getElementById("ville");
  if (postalCode.length < 5) {
    villeSelect.innerHTML = "<option value=''>Sélectionnez une ville</option>";
    return;
  }
  try {
    const response = await fetch(`https://geo.api.gouv.fr/communes?codePostal=${postalCode}&fields=nom&format=json`);
    const cities = await response.json();
    villeSelect.innerHTML = "<option value=''>Sélectionnez une ville</option>";
    cities.forEach(city => {
      const option = document.createElement("option");
      option.value = city.nom;
      option.textContent = city.nom;
      villeSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des villes:", error);
  }
});

// Inscription
document.getElementById("signup-btn").addEventListener("click", async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const username = document.getElementById("username").value;
  const prenom = document.getElementById("prenom").value;
  const sexe = document.getElementById("sexe").value;
  const codePostal = document.getElementById("code-postal").value;
  const ville = document.getElementById("ville").value;

  // Calcul de l'âge
  const day = parseInt(jourSelect.value);
  const month = parseInt(moisSelect.value) - 1;
  const year = parseInt(anneeSelect.value);
  const birthDate = new Date(year, month, day);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  if (!email || !password || !username || !prenom || !sexe || isNaN(age) || !codePostal || !ville) {
    alert("Merci de remplir tous les champs !");
    return;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    // Sauvegarde des infos de base dans Firestore ; les préférences seront modifiées dans le profil
    await setDoc(doc(db, "users", user.uid), {
      email,
      username,
      prenom,
      sexe,
      age,
      codePostal,
      ville,
      preferences: {
        meetingSex: "",
        ageMin: 18,
        ageMax: 100,
        distance: "monpays"
      }
    });
    alert("Compte créé avec succès !");
    window.location.href = "app.html";
  } catch (error) {
    console.error("Erreur d'inscription :", error);
    alert("Erreur d'inscription : " + error.message);
  }
});

// Connexion
document.getElementById("login").addEventListener("click", async () => {
  const email = document.getElementById("email-login").value;
  const password = document.getElementById("password-login").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    alert("Connexion réussie !");
    window.location.href = "app.html";
  } catch (error) {
    alert("Erreur de connexion : " + error.message);
  }
});
