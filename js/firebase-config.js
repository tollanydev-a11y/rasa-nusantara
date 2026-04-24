/* ===================================================
   FIREBASE CONFIGURATION
   Rasa Nusantara - Restaurante Indonesio
   ===================================================
   INSTRUCCIONES PARA ACTIVAR FIREBASE:
   1. Ve a https://console.firebase.google.com/
   2. Crea un nuevo proyecto (ej. "rasa-nusantara")
   3. En "Configuración del proyecto" > "Tus apps" > Agrega
      una Web App y copia el objeto firebaseConfig.
   4. Pégalo abajo, reemplazando los valores "TU_*".
   5. Habilita los siguientes servicios en la consola:
      - Authentication  →  Sign-in method: Email/Password
      - Firestore Database  →  modo "test" para desarrollo,
        luego añade reglas de seguridad.
   6. Cambia USE_DEMO_MODE a false.
   7. (Opcional) Si publicas en un dominio propio, añádelo en
      Authentication > Settings > Authorized domains.

   COLECCIONES DE FIRESTORE QUE USA LA APP:
   - users               → perfil + rol (user | admin)
        { email, displayName, phone, role, createdAt }
   - reservaciones       → reservas de clientes
        { userId, userName, userEmail, telefono, fecha, hora,
          personas, personasNombres[], area, mesa, menu,
          estado, comentarios, total, createdAt,
          menuSelectionEnabled, menuSelectionsByClient }
   - platillos           → catálogo editable del menú
        { nombre, categoria, origen, descripcion, precio,
          emoji, icono, imagen, tags[], picante, disponible }
   - mesas_estado        → estado físico libre/ocupada
        documento 'state' con { [mesaId]: 'available'|'occupied' }

   Cada módulo de la app verifica USE_DEMO_MODE y alterna
   entre localStorage (demo) y Firestore (producción) de
   forma transparente.
   =================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ============================================================
// ⚠️ REEMPLAZA ESTAS CREDENCIALES CON LAS DE TU PROYECTO FIREBASE
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyB2Dk2xPerYrgA5jKV_FRs61o5GS_nB1ww",
  authDomain: "app-restaurante-d2861.firebaseapp.com",
  projectId: "app-restaurante-d2861",
  storageBucket: "app-restaurante-d2861.firebasestorage.app",
  messagingSenderId: "687582472906",
  appId: "1:687582472906:web:6153126bd878e65756e233",
  measurementId: "G-0WHK9NCZG0",
};

// ============================================================
// INICIALIZACIÓN DE FIREBASE (segura incluso en modo demo —
// si las credenciales están vacías no se realizan peticiones
// reales porque USE_DEMO_MODE intercepta los flujos).
// ============================================================
let app, auth, db;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (err) {
  console.warn(
    "⚠️ Firebase no inicializado (revisa credenciales). Operando en modo demo:",
    err?.message || err,
  );
  app = null;
  auth = null;
  db = null;
}

// ============================================================
// BANDERA DE MODO DEMO
// -------------------------------------------------------------
// true  → La app usa localStorage / sessionStorage (sin red).
// false → La app usa Firebase Auth + Firestore.
// ============================================================
const USE_DEMO_MODE = false;

// ============================================================
// NOMBRES DE LAS COLECCIONES DE FIRESTORE (una sola fuente de
// verdad para todos los módulos).
// ============================================================
const COLLECTIONS = {
  USERS: "users",
  RESERVATIONS: "reservaciones",
  DISHES: "platillos",
  TABLES_STATE: "mesas_estado",
};

// ============================================================
// USUARIOS DE EJEMPLO (modo demo)
// En producción estos estarán en Firebase Authentication + Firestore
// ============================================================
const DEMO_USERS = [
  {
    uid: "admin001",
    email: "admin@rasanusantara.com",
    password: "admin123",
    displayName: "Rany Kiyai",
    role: "admin",
    phone: "+52 555-123-4567",
    createdAt: "2024-01-15",
  },
  {
    uid: "user001",
    email: "usuario@rasanusantara.com",
    password: "user123",
    displayName: "Diego Paz",
    role: "user",
    phone: "+52 555-987-6543",
    createdAt: "2024-03-20",
  },
  {
    uid: "user002",
    email: "maria@rasanusantara.com",
    password: "maria123",
    displayName: "María Yáñez",
    role: "user",
    phone: "+52 555-234-5678",
    createdAt: "2024-05-10",
  },
];

// ============================================================
// EXPORTS
// ============================================================
export {
  app,
  auth,
  db,
  // Auth functions
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  // Firestore functions
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  // Config
  USE_DEMO_MODE,
  COLLECTIONS,
  DEMO_USERS,
};
