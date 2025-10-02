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
 */
export interface ComparableProperty {
  // Identificación y contexto
  address: string;
  neighborhood: string;

  // Métricas y valores
  builtArea: number;
  price: number;
  pricePerM2: number;
  coefficient: number;
  daysPublished: number;

  // Enlaces / referencias
  listingUrl?: string;
  link?: string;

  // Descripción libre
  description: string;

  // Multimedia
  photoUrl?: string;
  photoBase64?: string;
}

/**
 * Datos principales del formulario ACM.
 */
export interface ACMFormData {
  // Fecha del informe
  date: string;

  // Datos del cliente
  clientName: string;
  phone: string;
  email: string;

  // Ubicación de la propiedad principal
  address: string;
  neighborhood: string;
  locality: string;

  // Características principales
  propertyType: PropertyType;
  landArea: number;
  builtArea: number;
  hasPlans: boolean;
  titleType: TitleType;
  age: number;
  condition: PropertyCondition;
  locationQuality: LocationQuality;
  orientation: Orientation;

  // Servicios
  services: Services;

  // Renta
  isRented: boolean;

  // Multimedia principal
  mainPhotoUrl: string;
  mainPhotoBase64?: string;

  // Branding
  logoUrl?: string;
  logoBase64?: string;

  // Comparables
  comparables: ComparableProperty[];

  // Conclusión
  observations: string;
  strengths: string;
  weaknesses: string;
  considerations: string;

  // Extras
  primaryColorHex?: string;
  suggestedPrice?: number;
}
