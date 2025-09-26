// Tipología (orden alfabético)
export enum PropertyType {
  CASA = "Casa",
  DEPARTAMENTO = "Departamento",
  DUPLEX = "Dúplex",
  FONDO_COMERCIO = "Fondo de comercio",
  GALPON = "Galpón",
  LOCAL_COMERCIAL = "Local comercial",
  LOTE = "Lote",
  OFICINA = "Oficina",
  PH = "PH",
}

// Estado de conservación
export enum PropertyCondition {
  ESTRENAR = "A estrenar",
  EXCELENTE = "Excelente",
  MUY_BUENO = "Muy bueno",
  BUENO = "Bueno",
  REGULAR = "Regular",
  MALO = "Malo",
}

// Orientación
export enum Orientation {
  NORTE = "Norte",
  SUR = "Sur",
  ESTE = "Este",
  OESTE = "Oeste",
}

// Calidad de ubicación
export enum LocationQuality {
  EXCELENTE = "Excelente",
  MUY_BUENA = "Muy buena",
  BUENA = "Buena",
  MALA = "Mala",
}

// Tipo de título
export enum TitleType {
  ESCRITURA = "Escritura",
  BOLETO = "Boleto",
  POSESION = "Posesión",
}

// Servicios
export interface Services {
  luz: boolean;
  agua: boolean;
  gas: boolean;
  cloacas: boolean;
  pavimento: boolean;
}

// Propiedad comparable
export interface ComparableProperty {
  builtArea: number;      // m² cubiertos
  price: number;          // precio publicado
  listingUrl: string;     // link de publicación / drive
  description: string;    // descripción libre
  daysPublished: number;  // días publicada
  pricePerM2: number;     // calculado (price / builtArea)
  coefficient: number;    // 0.1 a 1
}

// Formulario principal
export interface ACMFormData {
  date: string;               // ISO auto
  clientName: string;
  advisorName: string;
  phone: string;
  email: string;
  address: string;
  neighborhood: string;
  locality: string;
  propertyType: PropertyType;
  landArea: number;           // m² terreno
  builtArea: number;          // m² cubiertos
  hasPlans: boolean;
  titleType: TitleType;
  age: number;                // antigüedad
  condition: PropertyCondition;
  locationQuality: LocationQuality;
  orientation: Orientation;
  services: Services;         // subsección “Servicios”
  isRented: boolean;
  // Foto principal: URL y base64 (para PDF)
  mainPhotoUrl: string;
  mainPhotoBase64?: string;
  // Comparables
  comparables: ComparableProperty[];
  // Texto libre
  observations: string;
  considerations: string;
  strengths: string;
  weaknesses: string;
}
