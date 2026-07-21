export type PlateFormat = "square" | "story" | "landscape";
export type PlateTemplateId = "circles-controlled";

export type PropertyStatus =
  | ""
  | "RESERVADO"
  | "VENDIDO"
  | "ALQUILADO"
  | "EN ALQUILER"
  | "OPORTUNIDAD"
  | "NUEVO PRECIO";

export type BrandData = {
  companyName: string;
  professionalName: string;
  license: string;
  phone: string;
  logoUrl: string | null;
  primaryColor: string;
};

export type PropertyData = {
  operation: string;
  title: string;
  currency: string;
  price: string;
  oldPrice: string;
  location: string;
  ambients: string;
  bedrooms: string;
  bathrooms: string;
  garages: string;
  coveredArea: string;
  totalArea: string;
  highlight: string;
  hasPool: boolean;
  status: PropertyStatus;
  showStatus: boolean;
  showPrice: boolean;
  showOldPrice: boolean;
  showLocation: boolean;
  showFeatures: boolean;
  showFooter: boolean;
  showLogo: boolean;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
};
