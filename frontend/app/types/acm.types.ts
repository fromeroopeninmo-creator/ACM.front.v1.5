// app/types/acm.types.ts

/**
 * Tipología de propiedad (mantener estos valores tal cual, se ordenan en UI).
 */
export enum PropertyType {
  CASA = "Casa",
  DEPARTAMENTO = "Departamento",
  DUPLEX = "Dúplex",
  FONDO_DE_COMERCIO = "Fondo de comercio",
  GALPON = "Galpón",
  LOCAL_COMERCIAL = "Local comercial",
  OFICINA = "Oficina",
  PH = "PH",
  LOTE = "Terreno",
}

/**
 * Estado de conservación de la propiedad.
 */
export enum PropertyCondition {
  ESTRENAR = "A estrenar",
  EXCELENTE = "Excelente",
  MUY_BUENO = "Muy bueno",
  BUENO = "Bueno",
  REGULAR = "Regular",
  MALO = "Malo",
}

/**
 * Orientación cardinal.
 */
export enum Orientation {
  NORTE = "Norte",
  SUR = "Sur",
  ESTE = "Este",
  OESTE = "Oeste",
}

/**
 * Calidad de ubicación (interna/entorno).
 */
export enum LocationQuality {
  EXCELENTE = "Excelente",
  MUY_BUENA = "Muy buena",
  BUENA = "Buena",
  MALA = "Mala",
}

/**
 * Tipo de título/tenencia.
 */
export enum TitleType {
  ESCRITURA = "Escritura",
  BOLETO = "Boleto",
  POSESION = "Posesión",
}

/**
 * Servicios disponibles (coinciden con los 5 checkboxes del formulario).
 */
export interface Services {
  luz: boolean;
  agua: boolean;
  gas: boolean;
  cloacas: boolean;
  pavimento: boolean;
}

/**
 * Estructura de cada propiedad comparable.
 * NOTA: incluimos address/barrio/foto y ambos campos de link (listingUrl y link)
 * para ser compatibles con distintas versiones del formulario/PDF.
 */
export interface ComparableProperty {
  // Identificación y contexto
  address: string;            // Dirección de la comparable
  neighborhood: string;       // Barrio de la comparable

  // Métricas y valores
  builtArea: number;          // m² cubiertos
  price: number;              // Precio publicado (total)
  pricePerM2: number;         // Calculado: price / builtArea
  coefficient: number;        // Multiplicador 0.1 a 1 (ajuste por diferencias)
  daysPublished: number;      // Días publicada

  // Enlaces / referencias
  listingUrl?: string;        // Link a publicación (nombre usado en versiones previas)
  link?: string;              // Alias alternativo (por compatibilidad)

  // Descripción libre
  description: string;

  // Multimedia (para preview y para PDF)
  photoUrl?: string;          // URL de imagen si se carga por link
  photoBase64?: string;       // Imagen en base64 si se sube archivo
}

/**
 * Datos principales del formulario ACM.
 * Mantiene la estructura usada por el ACMForm grande: campos “planos/renta” como boolean,
 * orientación, calidad de ubicación, condición, etc. Además, soporta logo e imagen principal.
 */
export interface ACMFormData {
  // Fecha del informe (ISO string)
  date: string;

  // Datos del cliente / asesor
  clientName: string;
  advisorName: string;
  phone: string;
  email: string;

  // Ubicación de la propiedad principal
  address: string;
  neighborhood: string;
  locality: string;

  // Características principales
  propertyType: PropertyType;
  landArea: number;              // m² terreno
  builtArea: number;             // m² cubiertos
  hasPlans: boolean;             // Planos (sí/no)
  titleType: TitleType;          // Título (escritura/boleto/posesión)
  age: number;                   // Antigüedad (años)
  condition: PropertyCondition;  // Estado de conservación
  locationQuality: LocationQuality; // Calidad de ubicación
  orientation: Orientation;      // Orientación

  // Servicios (subsección “Servicios”)
  services: Services;

  // Renta actual (sí/no)
  isRented: boolean;

  // Multimedia principal
  mainPhotoUrl: string;          // URL opcional (si pegás un link)
  mainPhotoBase64?: string;      // Imagen cargada (para preview/PDF)

  // Branding opcional
  logoUrl?: string;              // URL de logo
  logoBase64?: string;           // Logo en base64 (para PDF)

  // Comparables
  comparables: ComparableProperty[];

  // Texto libre (Conclusión)
  observations: string;          // Observaciones
  strengths: string;             // Fortalezas
  weaknesses: string;            // Debilidades
  considerations: string;        // A considerar

  // Extras opcionales que puede usar el UI/PDF
  primaryColorHex?: string;      // Color primario configurable (UI/PDF)
  suggestedPrice?: number;       // Precio sugerido calculado (resultado final)
}
