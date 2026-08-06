export type PlateFormat = "portrait" | "square" | "story";
export type PlateTemplateId =
  | "template-1"
  | "template-2"
  | "template-3"
  | "template-4"
  | "template-5"
  | "template-6"
  | "template-7"
  | "template-8"
  | "template-9"
  | "template-10";

export type ElementKind = "text" | "rect" | "circle" | "line" | "image";

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
  status: PropertyStatus;
  showStatus: boolean;
  showPrice: boolean;
  showLocation: boolean;
  showFeatures: boolean;
  showFooter: boolean;
  showLogo: boolean;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
};

export type CanvasElement = {
  id: string;
  kind: ElementKind;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontStyle?: "normal" | "bold";
  align?: "left" | "center" | "right";
  colorRole?: "primary" | "secondary" | "accent" | "background";
  textRole?: keyof PropertyData | "brand" | "contact" | "features" | "price";
  imageSlot?: number;
  imageUrl?: string | null;
  cropX?: number;
  cropY?: number;
  locked?: boolean;
  visible?: boolean;
  draggable?: boolean;
  zIndex: number;
};

export type PlateTemplate = {
  id: PlateTemplateId;
  name: string;
  description: string;
  imageCount: number;
  previewGradient: string;
  elements: CanvasElement[];
};
