/* ===================================================
   MÓDULO: AUTENTICACIÓN
   Login, Registro, Logout y control de roles
   =================================================== */

import {
  auth,
  db,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
  doc,
  setDoc,
  getDoc,
  USE_DEMO_MODE,
  DEMO_USERS,
} from "./firebase-config.js";

// ==========================================================
// ESTADO DEL USUARIO ACTUAL
// ==========================================================
const SESSION_KEY = "rasa_nusantara_session";

/**
 * Obtiene el usuario actualmente logueado (desde sessionStorage en modo demo)
 */
export function getCurrentUser() {
  const session = sessionStorage.getItem(SESSION_KEY);
  return session ? JSON.parse(session) : null;
}

/**
 * Guarda el usuario en sesión (modo demo)
 */
function setCurrentUser(user) {
  const userData = {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    phone: user.phone || "",
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(userData));
  return userData;
}

/**
 * Cerrar sesión
 */
export async function logoutUser() {
  try {
    if (!USE_DEMO_MODE) {
      await signOut(auth);
    }
    sessionStorage.removeItem(SESSION_KEY);
    return { success: true };
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
    return { success: false, error: error.message };
  }
}

// ==========================================================
// LOGIN
// ==========================================================
export async function loginUser(email, password) {
  try {
    if (USE_DEMO_MODE) {
      // Modo demo: buscar en usuarios de ejemplo
      const user = DEMO_USERS.find(
        (u) =>
          u.email.toLowerCase() === email.toLowerCase() &&
          u.password === password,
      );

      if (!user) {
        throw new Error("Correo o contraseña incorrectos");
      }

      // Simular delay asíncrono
      await new Promise((resolve) => setTimeout(resolve, 500));

      const userData = setCurrentUser(user);
      return { success: true, user: userData };
    }

    // Modo Firebase real
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password,
    );
    const firebaseUser = userCredential.user;

    // Obtener datos adicionales (rol) desde Firestore
    const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));

    if (!userDoc.exists()) {
      throw new Error("Usuario no encontrado en la base de datos");
    }

    const userData = {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: userDoc.data().displayName || firebaseUser.displayName,
      role: userDoc.data().role || "user",
      phone: userDoc.data().phone || "",
    };

    setCurrentUser(userData);
    return { success: true, user: userData };
  } catch (error) {
    console.error("Error en login:", error);
    let mensaje = "Error al iniciar sesión";

    if (
      error.code === "auth/user-not-found" ||
      error.code === "auth/wrong-password" ||
      error.code === "auth/invalid-credential"
    ) {
      mensaje = "Correo o contraseña incorrectos";
    } else if (error.code === "auth/invalid-email") {
      mensaje = "Correo electrónico no válido";
    } else if (error.code === "auth/too-many-requests") {
      mensaje = "Demasiados intentos, intenta más tarde";
    } else if (error.message) {
      mensaje = error.message;
    }

    return { success: false, error: mensaje };
  }
}

// ==========================================================
// REGISTRO
// ==========================================================
export async function registerUser(userData) {
  const { email, password, displayName, phone } = userData;

  try {
    if (USE_DEMO_MODE) {
      // Validación básica
      if (
        DEMO_USERS.some((u) => u.email.toLowerCase() === email.toLowerCase())
      ) {
        throw new Error("Este correo ya está registrado");
      }

      // Simular delay asíncrono
      await new Promise((resolve) => setTimeout(resolve, 800));

      const newUser = {
        uid: `user${Date.now()}`,
        email: email,
        password: password,
        displayName: displayName,
        role: "user", // Por defecto los nuevos son usuarios estándar
        phone: phone || "",
        createdAt: new Date().toISOString().split("T")[0],
      };

      // Agregar al arreglo en memoria (no persiste en demo)
      DEMO_USERS.push(newUser);

      const sessionData = setCurrentUser(newUser);
      return { success: true, user: sessionData };
    }

    // Modo Firebase real
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password,
    );
    const firebaseUser = userCredential.user;

    // Guardar datos extra en Firestore
    await setDoc(doc(db, "users", firebaseUser.uid), {
      email: email,
      displayName: displayName,
      phone: phone || "",
      role: "user",
      createdAt: new Date().toISOString(),
    });

    const sessionData = {
      uid: firebaseUser.uid,
      email: email,
      displayName: displayName,
      role: "user",
      phone: phone || "",
    };

    setCurrentUser(sessionData);
    return { success: true, user: sessionData };
  } catch (error) {
    console.error("Error en registro:", error);
    let mensaje = "Error al registrar usuario";

    if (error.code === "auth/email-already-in-use") {
      mensaje = "Este correo ya está registrado";
    } else if (error.code === "auth/invalid-email") {
      mensaje = "Correo electrónico no válido";
    } else if (error.code === "auth/weak-password") {
      mensaje = "La contraseña debe tener al menos 6 caracteres";
    } else if (error.message) {
      mensaje = error.message;
    }

    return { success: false, error: mensaje };
  }
}

// ==========================================================
// CONTROL DE ACCESO POR ROLES
// ==========================================================

/**
 * Verifica si el usuario actual es administrador
 */
export function isAdmin() {
  const user = getCurrentUser();
  return user && user.role === "admin";
}

/**
 * Verifica si hay un usuario logueado
 */
export function isAuthenticated() {
  return getCurrentUser() !== null;
}

/**
 * Protege páginas: redirige al login si no hay sesión
 * @param {boolean} adminOnly - Si es true, requiere rol admin
 */
export function protectPage(adminOnly = false) {
  const user = getCurrentUser();

  if (!user) {
    window.location.href = "login.html";
    return false;
  }

  if (adminOnly && user.role !== "admin") {
    alert("No tienes permisos para acceder a esta sección");
    window.location.href = "index.html";
    return false;
  }

  return true;
}

// ==========================================================
// ACTUALIZACIÓN DE UI SEGÚN SESIÓN
// ==========================================================

/**
 * Actualiza elementos del header según el estado de autenticación
 */
export function updateNavUI() {
  const user = getCurrentUser();
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const userInfo = document.getElementById("user-info");
  const adminLink = document.getElementById("admin-link");
  const misReservasLink = document.getElementById("mis-reservas-link");

  if (user) {
    if (loginBtn) loginBtn.classList.add("hidden");
    if (logoutBtn) logoutBtn.classList.remove("hidden");
    if (userInfo) {
      userInfo.classList.remove("hidden");
      const nameEl = userInfo.querySelector(".user-name");
      if (nameEl) {
        nameEl.textContent = user.displayName;
      }
    }
    // Mostrar "Mis Reservas" a cualquier usuario autenticado
    if (misReservasLink) misReservasLink.classList.remove("hidden");
    // Mostrar enlace de admin solo si es admin
    if (adminLink) {
      if (user.role === "admin") {
        adminLink.classList.remove("hidden");
      } else {
        adminLink.classList.add("hidden");
      }
    }
  } else {
    if (loginBtn) loginBtn.classList.remove("hidden");
    if (logoutBtn) logoutBtn.classList.add("hidden");
    if (userInfo) userInfo.classList.add("hidden");
    if (adminLink) adminLink.classList.add("hidden");
    if (misReservasLink) misReservasLink.classList.add("hidden");
  }
}

// ==========================================================
// AUTENTICACIÓN SOCIAL (Google / Facebook)
// ==========================================================

/**
 * Lógica compartida para cualquier proveedor OAuth (popup)
 * @param {GoogleAuthProvider|FacebookAuthProvider} provider
 */
async function loginWithSocialProvider(provider) {
  try {
    if (USE_DEMO_MODE) {
      throw new Error(
        "El inicio de sesión con redes sociales no está disponible en modo demo",
      );
    }

    const result = await signInWithPopup(auth, provider);
    const firebaseUser = result.user;

    const userDocRef = doc(db, "users", firebaseUser.uid);
    const userDoc = await getDoc(userDocRef);

    let role = "user";
    let phone = "";

    if (!userDoc.exists()) {
      // Primera vez: crear documento en Firestore
      await setDoc(userDocRef, {
        email: firebaseUser.email,
        displayName: firebaseUser.displayName || firebaseUser.email,
        phone: "",
        role: "user",
        createdAt: new Date().toISOString(),
      });
    } else {
      role = userDoc.data().role || "user";
      phone = userDoc.data().phone || "";
    }

    const userData = {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName || firebaseUser.email,
      role,
      phone,
    };

    setCurrentUser(userData);
    return { success: true, user: userData };
  } catch (error) {
    console.error("Error en autenticación social:", error);

    let mensaje = "Error al iniciar sesión con red social";
    if (error.code === "auth/popup-closed-by-user") {
      mensaje = "Inicio de sesión cancelado";
    } else if (error.code === "auth/popup-blocked") {
      mensaje =
        "El navegador bloqueó la ventana emergente. Permite los popups para este sitio.";
    } else if (error.code === "auth/account-exists-with-different-credential") {
      mensaje =
        "Ya existe una cuenta con este correo registrada con otro método";
    } else if (error.message) {
      mensaje = error.message;
    }

    return { success: false, error: mensaje };
  }
}

/**
 * Inicio de sesión / registro con Google
 */
export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return loginWithSocialProvider(provider);
}

/**
 * Inicio de sesión / registro con Facebook
 */
export async function loginWithFacebook() {
  const provider = new FacebookAuthProvider();
  return loginWithSocialProvider(provider);
}
