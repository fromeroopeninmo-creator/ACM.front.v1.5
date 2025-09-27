// app/types/acm.types.ts

/**
 * Tipologías de propiedades disponibles en el ACM.
 * Se muestran en orden alfabético en el formulario.
 */
export const propertyTypes: string[] = [
  "Casa",
  "Departamento",
  "Dúplex",
  "Fondo de comercio",
  "Galpón",
  "Local comercial",
  "Oficina",
  "PH",
  "Terreno"
].sort();

/**
 * Servicios básicos que puede tener la propiedad.
 */
export interface Services {
  agua: boolean;
  luz: boolean;
  gas: boolean;
  cloacas: boolean;
  pavimento: boolean;
  internet: boolean;
}

/**
 * Propiedad comparable que se usa en el análisis.
 */
export interface ComparableProperty {
  // Identificación
  address: string;        // Dirección
  neighborhood: string;   // Barrio

  // Dimensiones y valores
  builtArea: number;      // m² cubiertos
  price: number;          // Precio total
  pricePerM2: number;     // Precio por m² (calculado)
  coefficient: number;    // Coeficiente de ajuste (0.1 a 1)

  // Info adicional
  description: string;    // Breve descripción
  link: string;           // Link a publicación (ej. portal inmobiliario)

  // Multimedia
  photo?: string;         // Foto de la propiedad (base64 o URL)
}

/**
 * Datos principales de la propiedad bajo análisis.
 */
export interface MainProperty {
  propertyType: string;   // Tipo de propiedad
  address: string;        // Dirección
  neighborhood: string;   // Barrio
  landArea: number;       // m² de terreno
  builtArea: number;      // m² cubiertos
  age: number;            // Antigüedad en años
  state: string;          // Estado de conservación
  orientation: string;    // Orientación (ej. Norte, Sur, etc.)
  location: string;       // Ubicación interna (ej. Frente, Contrafrente)
  price?: number;         // Precio estimado opcional

  // Multimedia
  photo?: string;         // Foto de la propiedad principal
  logo?: string;          // Logo de la empresa/inmobiliaria

  // Servicios
  services: Services;
}

/**
 * Conclusiones del análisis comparativo.
 */
export interface Conclusions {
  observations: string;   // Observaciones generales
  strengths: string;      // Fortalezas
  weaknesses: string;     // Debilidades
  considerations: string; // A considerar
}

/**
 * Datos completos del formulario ACM.
 * Incluye la propiedad principal, comparables y conclusiones.
 */
export interface ACMFormData {
  mainProperty: MainProperty;          // Propiedad principal
  comparables: ComparableProperty[];   // Lista de comparables
  conclusions: Conclusions;            // Observaciones y análisis
  date: string;                        // Fecha del informe (automática)
}
