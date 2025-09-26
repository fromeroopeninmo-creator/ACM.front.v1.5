// app/types/acm.types.ts

export enum PropertyType {
  CASA = 'Casa',
  DEPARTAMENTO = 'Departamento',
  PH = 'PH',
  TERRENO = 'Terreno',
  LOCAL = 'Local',
  OFICINA = 'Oficina',
}

export enum TitleType {
  ESCRITURA = 'Escritura',
  BOLETO = 'Boleto',
  POSESION = 'Posesión',
}

export enum PropertyCondition {
  A_ESTRENAR = 'A Estrenar',
  EXCELENTE = 'Excelente',
  MUY_BUENO = 'Muy Bueno',
  BUENO = 'Bueno',
  REGULAR = 'Regular',
  MALO = 'Malo',
}

export enum LocationQuality {
  EXCELENTE = 'Excelente',
  MUY_BUENA = 'Muy Buena',
  BUENA = 'Buena',
  MALA = 'Mala',
}

export enum Orientation {
  NORTE = 'Norte',
  SUR = 'Sur',
  ESTE = 'Este',
  OESTE = 'Oeste',
}

export interface Services {
  luz: boolean;
  agua: boolean;
  gas: boolean;
  cloacas: boolean;
  pavimento: boolean;
}

export interface ComparableProperty {
  id: string;
  squareMeters: number;
  price: number;
  link: string;
  description: string;
  daysPublished: number;
  pricePerSquareMeter: number;
  coefficient: number;
}

export interface ACMFormData {
  // Información básica
  date: string;
  client: string;
  agent: string;
  phone: string;
  email: string;
  
  // Ubicación
  address: string;
  neighborhood: string;
  locality: string;
  
  // Características de la propiedad
  propertyType: PropertyType;
  landSquareMeters: number;
  coveredSquareMeters: number;
  hasPlans: boolean;
  titleType: TitleType;
  age: number;
  condition: PropertyCondition;
  locationQuality: LocationQuality;
  orientation: Orientation;
  services: Services;
  hasRent: boolean;
  mainPhoto: string | null;
  
  // Propiedades comparables
  comparables: ComparableProperty[];
  
  // Secciones de texto libre
  observations: string;
  toConsider: string;
  strengths: string;
  weaknesses: string;
}

export interface AppConfig {
  primaryColor: string;
  secondaryColor: string;
}
