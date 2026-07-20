export type PlateFormat = "square" | "story" | "landscape";
export type PlateTemplateId =
  | "hero"
  | "bottom"
  | "side"
  | "mosaic2"
  | "mosaic3"
  | "minimal"
  | "circle"
  | "opportunity"
  | "premiumdark"
  | "technical"
  | "elegant"
  | "stacked";
export type PropertyStatus = "" | "RESERVADO" | "VENDIDO" | "ALQUILADO" | "EN ALQUILER" | "OPORTUNIDAD" | "NUEVO PRECIO";
export type ImagePosition = "center" | "top" | "bottom" | "left" | "right";
export type ImageFit = "cover" | "contain";

export type LocalImage = {
  id: string;
  name: string;
  url: string;
};

export type BrandData = {
  companyName: string;
  professionalName: string;
  license: string;
  phone: string;
  logoUrl: string | null;
  primaryColor: string;
};

export type PlateState = {
  format: PlateFormat;
  templateId: PlateTemplateId;
  images: LocalImage[];
  importedPlate: LocalImage | null;
  useImportedPlateMode: boolean;
  imagePosition: ImagePosition;
  imageFit: ImageFit;
  imageZoom: number;
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
  hasPool: boolean;
  highlight: string;
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
};
