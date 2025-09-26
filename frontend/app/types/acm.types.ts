export interface ComparableProperty {
  address: string;
  photoUrl?: string;
  listingUrl?: string;
  builtArea: number;
  price: number;
  description?: string;
  pricePerM2?: number;
}

export interface ACMFormData {
  clientName: string;
  advisorName: string;
  phone: string;
  email: string;
  address: string;
  neighborhood: string;
  propertyType: PropertyType;
  age: number;
  landArea: number;
  builtArea: number;
  hasPlans: boolean;
  orientation: Orientation;
  locationQuality: LocationQuality;
  condition: PropertyCondition;
  hasGas: boolean;
  hasElectricity: boolean;
  hasSewer: boolean;
  hasWater: boolean;
  titleType: TitleType;
  isRented: boolean;
  mainPhotoUrl?: string;
  comparables: ComparableProperty[];
}

export enum PropertyType {
  CASA = 'CASA',
  DEPARTAMENTO = 'DEPARTAMENTO',
  PH = 'PH',
  LOCAL = 'LOCAL',
  OFICINA = 'OFICINA',
  TERRENO = 'TERRENO',
  GALPON = 'GALPON',
  COCHERA = 'COCHERA'
}

export enum Orientation {
  NORTE = 'NORTE',
  SUR = 'SUR',
  ESTE = 'ESTE',
  OESTE = 'OESTE',
  NORESTE = 'NORESTE',
  NOROESTE = 'NOROESTE',
  SURESTE = 'SURESTE',
  SUROESTE = 'SUROESTE'
}

export enum LocationQuality {
  EXCELENTE = 'EXCELENTE',
  MUY_BUENA = 'MUY_BUENA',
  BUENA = 'BUENA',
  REGULAR = 'REGULAR',
  MALA = 'MALA'
}

export enum PropertyCondition {
  A_ESTRENAR = 'A_ESTRENAR',
  EXCELENTE = 'EXCELENTE',
  MUY_BUENO = 'MUY_BUENO',
  BUENO = 'BUENO',
  REGULAR = 'REGULAR',
  A_REFACCIONAR = 'A_REFACCIONAR'
}

export enum TitleType {
  ESCRITURA = 'ESCRITURA',
  POSESION = 'POSESION',
  BOLETO_COMPRAVENTA = 'BOLETO_COMPRAVENTA'
}