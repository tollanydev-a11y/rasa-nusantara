/* ===================================================
   DATOS DE LA GASTRONOMÍA INDONESIA
   Menús, platillos, áreas y mesas del restaurante

   Cada platillo incluye:
   - categoria: "entrada" | "principal" | "postre" | "bebida"
   - tags: ["Picante", "Vegano", ...]
   - picante: 0-4 (0 = no picante, 4 = muy picante)
   - disponible: true/false (para admin)
   - emoji:  emoji (fallback visual)
   - icono:  clase de FontAwesome (fallback si no hay emoji)
   - imagen: URL o data-URI (opcional; si existe se muestra en
             vez del emoji en home y carta)
   =================================================== */

import {
  db,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  USE_DEMO_MODE,
  COLLECTIONS,
} from "./firebase-config.js";

// ==========================================================
// PLATILLOS TÍPICOS DE INDONESIA (lista plana extendida)
// ==========================================================

export const DEFAULT_PLATILLOS = [
  // ======== ENTRADAS (10) ========
  {
    id: "e1",
    nombre: "Sate Ayam",
    categoria: "entrada",
    origen: "Java",
    descripcion:
      "Brochetas de pollo marinadas con salsa de cacahuate picante, servidas con arroz prensado",
    precio: 120,
    emoji: "🍢",
    icono: "fa-drumstick-bite",
    imagen: "",
    tags: ["Popular", "Sin gluten"],
    picante: 2,
    disponible: true,
  },
  {
    id: "e2",
    nombre: "Lumpia Semarang",
    categoria: "entrada",
    origen: "Java Central",
    descripcion:
      "Rollitos crujientes rellenos de brotes de bambú, pollo y camarón",
    precio: 95,
    emoji: "🥟",
    icono: "fa-utensils",
    imagen: "",
    tags: ["Crujiente", "Compartir"],
    picante: 0,
    disponible: true,
  },
  {
    id: "e3",
    nombre: "Gado-Gado",
    categoria: "entrada",
    origen: "Jakarta",
    descripcion:
      "Ensalada tradicional con verduras al vapor, tofu, huevo y salsa de cacahuate",
    precio: 110,
    emoji: "🥗",
    icono: "fa-leaf",
    imagen: "",
    tags: ["Vegetariano", "Sin gluten"],
    picante: 1,
    disponible: true,
  },
  {
    id: "e4",
    nombre: "Tempe Mendoan",
    categoria: "entrada",
    origen: "Java Central",
    descripcion:
      "Tempeh rebozado en masa de cúrcuma y cilantro, frito al momento",
    precio: 85,
    emoji: "🍤",
    icono: "fa-seedling",
    imagen: "",
    tags: ["Vegano", "Tradicional"],
    picante: 0,
    disponible: true,
  },
  {
    id: "e5",
    nombre: "Kerupuk Udang",
    categoria: "entrada",
    origen: "Indonesia",
    descripcion: "Crujiente pan de camarón servido con salsa sambal",
    precio: 70,
    emoji: "🍘",
    icono: "fa-circle",
    imagen: "",
    tags: ["Ligero", "Compartir"],
    picante: 2,
    disponible: true,
  },
  {
    id: "e6",
    nombre: "Perkedel Kentang",
    categoria: "entrada",
    origen: "Sumatra",
    descripcion:
      "Croquetas de papa con carne especiada y hierbas aromáticas, fritas hasta dorar",
    precio: 90,
    emoji: "🥔",
    icono: "fa-cookie-bite",
    imagen: "",
    tags: ["Popular", "Tradicional"],
    picante: 1,
    disponible: true,
  },
  {
    id: "e7",
    nombre: "Siomay Bandung",
    categoria: "entrada",
    origen: "Bandung",
    descripcion:
      "Dumplings al vapor de pescado y camarón con salsa de maní al estilo Sundanés",
    precio: 115,
    emoji: "🥟",
    icono: "fa-utensils",
    imagen: "",
    tags: ["Ligero", "Al vapor"],
    picante: 1,
    disponible: true,
  },
  {
    id: "e8",
    nombre: "Bakwan Jagung",
    categoria: "entrada",
    origen: "Java",
    descripcion:
      "Buñuelos crujientes de maíz dulce con hierbas frescas, perfectos para compartir",
    precio: 80,
    emoji: "🌽",
    icono: "fa-seedling",
    imagen: "",
    tags: ["Vegetariano", "Crujiente"],
    picante: 0,
    disponible: true,
  },
  {
    id: "e9",
    nombre: "Martabak Telur",
    categoria: "entrada",
    origen: "Yakarta",
    descripcion:
      "Panqueque relleno de huevo, carne molida y cebollín, servido con encurtidos",
    precio: 125,
    emoji: "🥘",
    icono: "fa-utensils",
    imagen: "",
    tags: ["Popular", "Contundente"],
    picante: 2,
    disponible: true,
  },
  {
    id: "e10",
    nombre: "Otak-Otak",
    categoria: "entrada",
    origen: "Palembang",
    descripcion:
      "Pasta de pescado envuelta en hoja de plátano y asada al carbón con sambal",
    precio: 135,
    emoji: "🐟",
    icono: "fa-fire",
    imagen: "",
    tags: ["Sin gluten", "A la parrilla"],
    picante: 3,
    disponible: true,
  },

  // ======== PRINCIPALES (14) ========
  {
    id: "p1",
    nombre: "Nasi Goreng Spesial",
    categoria: "principal",
    origen: "Indonesia",
    descripcion:
      "Arroz frito tradicional con pollo, camarones, huevo, verduras y sambal",
    precio: 195,
    emoji: "🍚",
    icono: "fa-bowl-rice",
    imagen: "",
    tags: ["Clásico", "Chef's pick"],
    picante: 2,
    disponible: true,
  },
  {
    id: "p2",
    nombre: "Rendang Padang",
    categoria: "principal",
    origen: "Sumatra Occidental",
    descripcion:
      "Guiso lento de ternera en leche de coco con especias secretas minang. Plato icónico de Indonesia",
    precio: 245,
    emoji: "🍛",
    icono: "fa-fire",
    imagen: "",
    tags: ["Especial", "Sin gluten"],
    picante: 4,
    disponible: true,
  },
  {
    id: "p3",
    nombre: "Mie Goreng Jawa",
    categoria: "principal",
    origen: "Java",
    descripcion:
      "Tallarines salteados al wok con pollo, vegetales y salsa kecap manis",
    precio: 175,
    emoji: "🍜",
    icono: "fa-bowl-food",
    imagen: "",
    tags: ["Clásico", "Popular"],
    picante: 1,
    disponible: true,
  },
  {
    id: "p4",
    nombre: "Ayam Betutu",
    categoria: "principal",
    origen: "Bali",
    descripcion:
      "Pollo balinés cocido en hojas de plátano con base genep (mezcla de 15 especias)",
    precio: 220,
    emoji: "🍗",
    icono: "fa-drumstick-bite",
    imagen: "",
    tags: ["Especial"],
    picante: 3,
    disponible: true,
  },
  {
    id: "p5",
    nombre: "Ikan Bakar",
    categoria: "principal",
    origen: "Sulawesi",
    descripcion:
      "Pescado fresco asado a la parrilla con glaseado de kecap y sambal matah",
    precio: 235,
    emoji: "🐟",
    icono: "fa-fish",
    imagen: "",
    tags: ["Sin gluten", "Parrilla"],
    picante: 2,
    disponible: true,
  },
  {
    id: "p6",
    nombre: "Soto Ayam",
    categoria: "principal",
    origen: "Indonesia",
    descripcion:
      "Sopa aromática de pollo con cúrcuma, fideos de huevo, huevo duro y lima kaffir",
    precio: 155,
    emoji: "🍲",
    icono: "fa-bowl-food",
    imagen: "",
    tags: ["Reconfortante", "Tradicional"],
    picante: 1,
    disponible: true,
  },
  {
    id: "p7",
    nombre: "Gulai Kambing",
    categoria: "principal",
    origen: "Sumatra",
    descripcion:
      "Curry de cordero con leche de coco, cardamomo, canela y chiles rojos",
    precio: 255,
    emoji: "🥘",
    icono: "fa-fire-burner",
    imagen: "",
    tags: ["Especial"],
    picante: 3,
    disponible: true,
  },
  {
    id: "p8",
    nombre: "Nasi Campur Bali",
    categoria: "principal",
    origen: "Bali",
    descripcion:
      "Plato mixto balinés: arroz con satay lilit, lawar, pollo betutu y sambal",
    precio: 215,
    emoji: "🍱",
    icono: "fa-utensils",
    imagen: "",
    tags: ["Chef's pick", "Variado"],
    picante: 2,
    disponible: true,
  },
  {
    id: "p9",
    nombre: "Rawon",
    categoria: "principal",
    origen: "Java Oriental",
    descripcion:
      "Sopa negra de res con keluak, hierba ancestral que le da su color y sabor únicos",
    precio: 190,
    emoji: "🫕",
    icono: "fa-bowl-food",
    imagen: "",
    tags: ["Sin gluten", "Único"],
    picante: 2,
    disponible: true,
  },
  {
    id: "p10",
    nombre: "Bebek Goreng",
    categoria: "principal",
    origen: "Madura",
    descripcion:
      "Pato marinado en especias y frito hasta quedar crujiente, con sambal mattah",
    precio: 265,
    emoji: "🦆",
    icono: "fa-drumstick-bite",
    imagen: "",
    tags: ["Chef's pick", "Crujiente"],
    picante: 3,
    disponible: true,
  },
  {
    id: "p11",
    nombre: "Gado-Gado Surabaya",
    categoria: "principal",
    origen: "Java Oriental",
    descripcion:
      "Versión contundente con patata, judías verdes, tofu, tempeh y salsa de maní",
    precio: 165,
    emoji: "🥗",
    icono: "fa-leaf",
    imagen: "",
    tags: ["Vegano", "Sin gluten"],
    picante: 1,
    disponible: true,
  },
  {
    id: "p12",
    nombre: "Udang Saus Padang",
    categoria: "principal",
    origen: "Sumatra",
    descripcion:
      "Camarones jumbo salteados en salsa padang agridulce con tomate y chile",
    precio: 245,
    emoji: "🦐",
    icono: "fa-fish",
    imagen: "",
    tags: ["Picante", "Mariscos"],
    picante: 4,
    disponible: true,
  },
  {
    id: "p13",
    nombre: "Ayam Penyet",
    categoria: "principal",
    origen: "Java Oriental",
    descripcion:
      "Pollo frito machacado con sambal terasi, tempeh y verduras al vapor",
    precio: 180,
    emoji: "🍗",
    icono: "fa-drumstick-bite",
    imagen: "",
    tags: ["Popular", "Picante"],
    picante: 3,
    disponible: true,
  },
  {
    id: "p14",
    nombre: "Tahu Telur",
    categoria: "principal",
    origen: "Java Oriental",
    descripcion:
      "Tortilla de huevo con tofu, brotes de soja y salsa dulce de maní",
    precio: 145,
    emoji: "🍳",
    icono: "fa-egg",
    imagen: "",
    tags: ["Vegetariano", "Popular"],
    picante: 1,
    disponible: true,
  },

  // ======== POSTRES (8) ========
  {
    id: "d1",
    nombre: "Pisang Goreng",
    categoria: "postre",
    origen: "Indonesia",
    descripcion:
      "Plátano frito con masa crujiente, miel de palma y helado de vainilla",
    precio: 95,
    emoji: "🍌",
    icono: "fa-ice-cream",
    imagen: "",
    tags: ["Dulce", "Clásico"],
    picante: 0,
    disponible: true,
  },
  {
    id: "d2",
    nombre: "Klepon",
    categoria: "postre",
    origen: "Java",
    descripcion:
      "Bolitas de arroz glutinoso verde con palma de azúcar líquida y coco rallado",
    precio: 85,
    emoji: "🟢",
    icono: "fa-cookie",
    imagen: "",
    tags: ["Vegano", "Tradicional"],
    picante: 0,
    disponible: true,
  },
  {
    id: "d3",
    nombre: "Es Cendol",
    categoria: "postre",
    origen: "Indonesia",
    descripcion:
      "Postre helado con fideos de pandan, leche de coco y azúcar de palma",
    precio: 90,
    emoji: "🍧",
    icono: "fa-ice-cream",
    imagen: "",
    tags: ["Frío", "Refrescante"],
    picante: 0,
    disponible: true,
  },
  {
    id: "d4",
    nombre: "Dadar Gulung",
    categoria: "postre",
    origen: "Java",
    descripcion:
      "Crepas verdes de pandan rellenas de coco caramelizado con azúcar de palma",
    precio: 80,
    emoji: "🫓",
    icono: "fa-birthday-cake",
    imagen: "",
    tags: ["Vegano", "Tradicional"],
    picante: 0,
    disponible: true,
  },
  {
    id: "d5",
    nombre: "Kue Lapis",
    categoria: "postre",
    origen: "Indonesia",
    descripcion:
      "Pastel tradicional de mil capas con mantequilla y especias cálidas",
    precio: 105,
    emoji: "🍰",
    icono: "fa-birthday-cake",
    imagen: "",
    tags: ["Colorido", "Especial"],
    picante: 0,
    disponible: true,
  },
  {
    id: "d6",
    nombre: "Martabak Manis",
    categoria: "postre",
    origen: "Indonesia",
    descripcion:
      "Panqueque grueso relleno de chocolate, cacahuate y leche condensada",
    precio: 120,
    emoji: "🥞",
    icono: "fa-birthday-cake",
    imagen: "",
    tags: ["Dulce", "Popular"],
    picante: 0,
    disponible: true,
  },
  {
    id: "d7",
    nombre: "Bubur Sumsum",
    categoria: "postre",
    origen: "Java",
    descripcion:
      "Pudín tibio de harina de arroz con jarabe de palma y hojas de pandan",
    precio: 75,
    emoji: "🍮",
    icono: "fa-bowl-food",
    imagen: "",
    tags: ["Vegano", "Caliente"],
    picante: 0,
    disponible: true,
  },
  {
    id: "d8",
    nombre: "Es Teler",
    categoria: "postre",
    origen: "Yakarta",
    descripcion:
      "Copa de hielo con aguacate, jackfruit, coco joven y leche condensada",
    precio: 95,
    emoji: "🥭",
    icono: "fa-ice-cream",
    imagen: "",
    tags: ["Frío", "Tropical"],
    picante: 0,
    disponible: true,
  },

  // ======== BEBIDAS (9) ========
  {
    id: "b1",
    nombre: "Teh Tarik",
    categoria: "bebida",
    origen: "Sumatra",
    descripcion:
      "Té negro batido con leche condensada, servido con espuma aireada",
    precio: 55,
    emoji: "🍵",
    icono: "fa-mug-hot",
    imagen: "",
    tags: ["Con cafeína", "Tradicional"],
    picante: 0,
    disponible: true,
  },
  {
    id: "b2",
    nombre: "Kopi Tubruk",
    categoria: "bebida",
    origen: "Java",
    descripcion:
      "Café tradicional javanés preparado al estilo turco con azúcar de palma",
    precio: 60,
    emoji: "☕",
    icono: "fa-mug-hot",
    imagen: "",
    tags: ["Con cafeína", "Fuerte"],
    picante: 0,
    disponible: true,
  },
  {
    id: "b3",
    nombre: "Es Jeruk",
    categoria: "bebida",
    origen: "Indonesia",
    descripcion:
      "Refrescante limonada indonesia con lima kaffir y azúcar de palma",
    precio: 50,
    emoji: "🍋",
    icono: "fa-glass-water",
    imagen: "",
    tags: ["Sin alcohol", "Frío"],
    picante: 0,
    disponible: true,
  },
  {
    id: "b4",
    nombre: "Bajigur",
    categoria: "bebida",
    origen: "Java Occidental",
    descripcion:
      "Bebida caliente tradicional de coco, jengibre y azúcar de palma",
    precio: 65,
    emoji: "🥥",
    icono: "fa-mug-hot",
    imagen: "",
    tags: ["Sin alcohol", "Caliente"],
    picante: 0,
    disponible: true,
  },
  {
    id: "b5",
    nombre: "Jamu Kunyit Asam",
    categoria: "bebida",
    origen: "Java",
    descripcion: "Bebida herbal tradicional de cúrcuma, tamarindo y miel",
    precio: 70,
    emoji: "🌿",
    icono: "fa-leaf",
    imagen: "",
    tags: ["Saludable", "Ancestral"],
    picante: 0,
    disponible: true,
  },
  {
    id: "b6",
    nombre: "Wedang Jahe",
    categoria: "bebida",
    origen: "Indonesia",
    descripcion: "Infusión caliente de jengibre con miel, lemongrass y pandan",
    precio: 60,
    emoji: "🫖",
    icono: "fa-mug-hot",
    imagen: "",
    tags: ["Caliente", "Reconfortante"],
    picante: 1,
    disponible: true,
  },
  {
    id: "b7",
    nombre: "Es Kelapa Muda",
    categoria: "bebida",
    origen: "Indonesia",
    descripcion: "Agua de coco natural con pulpa tierna y sirope de pandan",
    precio: 70,
    emoji: "🥥",
    icono: "fa-glass-water",
    imagen: "",
    tags: ["Natural", "Frío"],
    picante: 0,
    disponible: true,
  },
  {
    id: "b8",
    nombre: "Dawet Ayu",
    categoria: "bebida",
    origen: "Banyumas",
    descripcion:
      "Cendol, leche de coco y azúcar de palma. Refrescante y tradicional",
    precio: 75,
    emoji: "🧃",
    icono: "fa-glass-water",
    imagen: "",
    tags: ["Sin alcohol", "Tradicional"],
    picante: 0,
    disponible: true,
  },
  {
    id: "b9",
    nombre: "Bandrek",
    categoria: "bebida",
    origen: "Java Occidental",
    descripcion:
      "Bebida caliente especiada con jengibre, canela, anís y clavo de olor",
    precio: 65,
    emoji: "🍵",
    icono: "fa-mug-hot",
    imagen: "",
    tags: ["Caliente", "Especiada"],
    picante: 2,
    disponible: true,
  },
];

// ==========================================================
// PERSISTENCIA DE PLATILLOS (demo → localStorage, prod → Firestore)
// ==========================================================
const STORAGE_KEY_PLATILLOS = "rasa_platillos";

// Caché en memoria para producción (evita re-consultas Firestore
// en cada getPlatillos síncrono usado por el render)
let _platillosCache = null;

/**
 * Obtiene los platillos. En demo es síncrono desde localStorage.
 * En producción usa la caché (que se pobla con refreshPlatillos()).
 */
export function getPlatillos() {
  if (USE_DEMO_MODE) {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_PLATILLOS);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      /* fallback */
    }
    return [...DEFAULT_PLATILLOS];
  }
  // Producción: usar caché (si no está poblada, semilla default)
  return _platillosCache ? [..._platillosCache] : [...DEFAULT_PLATILLOS];
}

/**
 * Guarda el listado completo de platillos.
 *   - Demo:     localStorage
 *   - Producción: colección `platillos` (1 doc por id)
 */
export async function setPlatillos(lista) {
  if (USE_DEMO_MODE) {
    localStorage.setItem(STORAGE_KEY_PLATILLOS, JSON.stringify(lista));
    return true;
  }
  try {
    _platillosCache = [...lista];
    // Escribir cada platillo como doc independiente
    await Promise.all(
      lista.map((p) =>
        setDoc(doc(db, COLLECTIONS.DISHES, p.id), p, { merge: true }),
      ),
    );
    return true;
  } catch (err) {
    console.error("Error guardando platillos en Firestore:", err);
    return false;
  }
}

/**
 * Refresca la caché de platillos desde Firestore (producción).
 * En demo no hace nada (ya es síncrono). Se debe llamar al inicio
 * de cualquier página que use getPlatillos() antes del primer render.
 */
export async function refreshPlatillos() {
  if (USE_DEMO_MODE) return getPlatillos();
  try {
    const snap = await getDocs(collection(db, COLLECTIONS.DISHES));
    if (snap.empty) {
      // Si la colección está vacía, sembrar con los defaults
      _platillosCache = [...DEFAULT_PLATILLOS];
      await setPlatillos(DEFAULT_PLATILLOS);
    } else {
      _platillosCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }
    return [..._platillosCache];
  } catch (err) {
    console.error("Error cargando platillos desde Firestore:", err);
    _platillosCache = [...DEFAULT_PLATILLOS];
    return [...DEFAULT_PLATILLOS];
  }
}

/**
 * Elimina un platillo (por id).
 */
export async function deletePlatillo(id) {
  if (USE_DEMO_MODE) {
    const lista = getPlatillos().filter((p) => p.id !== id);
    localStorage.setItem(STORAGE_KEY_PLATILLOS, JSON.stringify(lista));
    return true;
  }
  try {
    await deleteDoc(doc(db, COLLECTIONS.DISHES, id));
    if (_platillosCache) {
      _platillosCache = _platillosCache.filter((p) => p.id !== id);
    }
    return true;
  } catch (err) {
    console.error("Error eliminando platillo:", err);
    return false;
  }
}

export function resetPlatillos() {
  if (USE_DEMO_MODE) localStorage.removeItem(STORAGE_KEY_PLATILLOS);
  _platillosCache = null;
}

// ==========================================================
// Compatibilidad: PLATILLOS agrupados por categoría
// ==========================================================
export const PLATILLOS = {
  get entradas() {
    return getPlatillos().filter(
      (p) => p.categoria === "entrada" && p.disponible,
    );
  },
  get principales() {
    return getPlatillos().filter(
      (p) => p.categoria === "principal" && p.disponible,
    );
  },
  get postres() {
    return getPlatillos().filter(
      (p) => p.categoria === "postre" && p.disponible,
    );
  },
  get bebidas() {
    return getPlatillos().filter(
      (p) => p.categoria === "bebida" && p.disponible,
    );
  },
};

// ==========================================================
// MENÚS POR TIEMPOS
// ==========================================================
export const MENUS = {
  clasico: {
    id: "clasico",
    nombre: "Menú Clásico",
    subtitle: "Menú de 3 Tiempos",
    tiempos: 3,
    precio: 380,
    descripcion: "Una introducción perfecta a los sabores de Indonesia",
    estructura: ["entradas", "principales", "postres"],
    maxSelecciones: { entradas: 1, principales: 1, postres: 1, bebidas: 0 },
    caracteristicas: [
      "1 entrada",
      "1 plato principal",
      "1 postre",
      "Té indonesio incluido",
    ],
  },
  formal: {
    id: "formal",
    nombre: "Menú Formal",
    subtitle: "Menú de 4 Tiempos",
    tiempos: 4,
    precio: 520,
    descripcion: "La experiencia culinaria balanceada de Nusantara",
    estructura: ["entradas", "principales", "postres", "bebidas"],
    maxSelecciones: { entradas: 1, principales: 1, postres: 1, bebidas: 1 },
    caracteristicas: [
      "1 entrada gourmet",
      "1 plato principal",
      "1 postre tradicional",
      "1 bebida artesanal",
    ],
  },
  gala: {
    id: "gala",
    nombre: "Menú de Gala",
    subtitle: "Menú de 5 Tiempos",
    tiempos: 5,
    precio: 780,
    descripcion: "La experiencia completa del archipiélago indonesio",
    estructura: ["entradas", "entradas", "principales", "postres", "bebidas"],
    maxSelecciones: { entradas: 2, principales: 1, postres: 1, bebidas: 1 },
    caracteristicas: [
      "2 entradas variadas",
      "1 plato principal premium",
      "1 postre tradicional",
      "1 bebida artesanal",
      "Degustación de sambal",
    ],
  },
};

// ==========================================================
// ÁREAS
// ==========================================================
export const AREAS = [
  {
    id: "terraza",
    nombre: "Terraza Tropical",
    descripcion:
      "Al aire libre con vista al jardín, decorada con plantas tropicales",
    icono: "fa-umbrella-beach",
    capacidad: "2-6 personas",
    mesas: 8,
  },
  {
    id: "salon",
    nombre: "Salón Principal",
    descripcion: "Ambiente elegante con decoración tradicional indonesia",
    icono: "fa-utensils",
    capacidad: "2-8 personas",
    mesas: 12,
  },
  {
    id: "privado",
    nombre: "Salón Privado",
    descripcion: "Área reservada para eventos especiales y grupos",
    icono: "fa-star",
    capacidad: "6-12 personas",
    mesas: 4,
  },
  {
    id: "barra",
    nombre: "Barra Nusantara",
    descripcion: "Experiencia frente a la cocina con chef dedicado",
    icono: "fa-martini-glass",
    capacidad: "1-4 personas",
    mesas: 6,
  },
];

// ==========================================================
// MESAS
// ==========================================================
export function generarMesas() {
  const mesas = [];
  AREAS.forEach((area) => {
    for (let i = 1; i <= area.mesas; i++) {
      mesas.push({
        id: `${area.id}-m${i}`,
        numero: i,
        area: area.id,
        areaNombre: area.nombre,
        capacidad:
          area.id === "privado"
            ? 10
            : area.id === "barra"
              ? 2
              : area.id === "terraza"
                ? i % 2 === 0
                  ? 6
                  : 4
                : 4,
        ocupada: false,
      });
    }
  });
  return mesas;
}

// ==========================================================
// ESTADO MANUAL DE MESAS (admin)
//   Demo: localStorage
//   Prod: doc `mesas_estado/state` con { [mesaId]: 'available'|'occupied' }
// ==========================================================
const STORAGE_KEY_MESAS = "rasa_mesas_estado";

// Caché en memoria (prod)
let _mesasEstadoCache = null;

export function getEstadoMesas() {
  if (USE_DEMO_MODE) {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_MESAS);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      /* fallback */
    }
    return _estadoDefault();
  }
  return _mesasEstadoCache ? { ..._mesasEstadoCache } : _estadoDefault();
}

function _estadoDefault() {
  const estado = {};
  generarMesas().forEach((m) => {
    estado[m.id] = "available";
  });
  return estado;
}

export async function setEstadoMesas(estado) {
  if (USE_DEMO_MODE) {
    localStorage.setItem(STORAGE_KEY_MESAS, JSON.stringify(estado));
    return true;
  }
  try {
    _mesasEstadoCache = { ...estado };
    await setDoc(doc(db, COLLECTIONS.TABLES_STATE, "state"), estado, {
      merge: false,
    });
    return true;
  } catch (err) {
    console.error("Error guardando estado de mesas en Firestore:", err);
    return false;
  }
}

/**
 * Refresca la caché de estado de mesas desde Firestore.
 * En demo no hace nada.
 */
export async function refreshEstadoMesas() {
  if (USE_DEMO_MODE) return getEstadoMesas();
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.TABLES_STATE, "state"));
    if (snap.exists()) {
      _mesasEstadoCache = snap.data();
    } else {
      _mesasEstadoCache = _estadoDefault();
      await setEstadoMesas(_mesasEstadoCache);
    }
    return { ..._mesasEstadoCache };
  } catch (err) {
    console.error("Error cargando estado de mesas desde Firestore:", err);
    _mesasEstadoCache = _estadoDefault();
    return _estadoDefault();
  }
}

/**
 * Alterna el estado de una mesa entre 'available' y 'occupied'.
 * Devuelve el nuevo estado.
 */
export async function toggleEstadoMesa(mesaId) {
  const estado = getEstadoMesas();
  estado[mesaId] = estado[mesaId] === "occupied" ? "available" : "occupied";
  await setEstadoMesas(estado);
  return estado[mesaId];
}

// ==========================================================
// HORARIOS
// Dos turnos: Comida (12:00-16:00) y Cena (18:00-22:00)
// ==========================================================
export const HORARIOS = {
  0: {
    dia: "Domingo",
    abierto: true,
    comida: { inicio: "12:00", fin: "15:30" },
    cena: { inicio: "18:00", fin: "21:30" },
  },
  1: { dia: "Lunes", abierto: false, comida: null, cena: null },
  2: {
    dia: "Martes",
    abierto: true,
    comida: { inicio: "12:00", fin: "15:30" },
    cena: { inicio: "18:00", fin: "21:30" },
  },
  3: {
    dia: "Miércoles",
    abierto: true,
    comida: { inicio: "12:00", fin: "15:30" },
    cena: { inicio: "18:00", fin: "21:30" },
  },
  4: {
    dia: "Jueves",
    abierto: true,
    comida: { inicio: "12:00", fin: "15:30" },
    cena: { inicio: "18:00", fin: "21:30" },
  },
  5: {
    dia: "Viernes",
    abierto: true,
    comida: { inicio: "12:00", fin: "15:30" },
    cena: { inicio: "18:00", fin: "21:30" },
  },
  6: {
    dia: "Sábado",
    abierto: true,
    comida: { inicio: "12:00", fin: "15:30" },
    cena: { inicio: "18:00", fin: "21:30" },
  },
};

export const HORAS_COMIDA = [
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
];
export const HORAS_CENA = [
  "18:00",
  "18:30",
  "19:00",
  "19:30",
  "20:00",
  "20:30",
  "21:00",
  "21:30",
];
export const HORAS_RESERVA = [...HORAS_COMIDA, ...HORAS_CENA];

export const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

// ==========================================================
// RESERVACIONES DE EJEMPLO
//  - Ahora incluyen: menuSelectionEnabled, menuSelectionsByClient
// ==========================================================
export const DEMO_RESERVACIONES = [
  {
    id: "r001",
    userId: "user001",
    userName: "Diego Paz",
    userEmail: "usuario@rasanusantara.com",
    fecha: "2026-04-22",
    hora: "20:00",
    personas: 4,
    area: "salon",
    mesa: "salon-m3",
    menu: "formal",
    estado: "confirmed",
    telefono: "+52 555-987-6543",
    comentarios: "Aniversario, mesa romántica si es posible",
    total: 520 * 4,
    createdAt: "2026-04-15T14:30:00",
    menuSelectionEnabled: true,
    menuSelectionsByClient: null,
  },
  {
    id: "r002",
    userId: "user002",
    userName: "María Yáñez",
    userEmail: "maria@rasanusantara.com",
    fecha: "2026-04-25",
    hora: "14:30",
    personas: 2,
    area: "terraza",
    mesa: "terraza-m2",
    menu: "clasico",
    estado: "pending",
    telefono: "+52 555-234-5678",
    comentarios: "Preferencia vegetariana",
    total: 380 * 2,
    createdAt: "2026-04-16T11:15:00",
    menuSelectionEnabled: false,
    menuSelectionsByClient: null,
  },
  {
    id: "r003",
    userId: "user001",
    userName: "Diego Paz",
    userEmail: "usuario@rasanusantara.com",
    fecha: "2026-05-02",
    hora: "21:00",
    personas: 6,
    area: "privado",
    mesa: "privado-m1",
    menu: "gala",
    estado: "confirmed",
    telefono: "+52 555-987-6543",
    comentarios: "Cumpleaños sorpresa, solicitar pastel",
    total: 780 * 6,
    createdAt: "2026-04-14T09:00:00",
    menuSelectionEnabled: false,
    menuSelectionsByClient: null,
  },
];
