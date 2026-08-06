import type { CanvasElement, PlateTemplate, PlateTemplateId } from "./types";

const W = 1080;
const H = 1350;
const text = (id: string, name: string, x: number, y: number, width: number, height: number, role: CanvasElement["textRole"], fontSize: number, fill = "#ffffff", zIndex = 20, align: CanvasElement["align"] = "left"): CanvasElement => ({ id, kind: "text", name, x, y, width, height, textRole: role, fontSize, fontFamily: "Arial", fontStyle: "bold", fill, align, zIndex, visible: true, draggable: true });
const rect = (id: string, name: string, x: number, y: number, width: number, height: number, fill: string, zIndex: number, cornerRadius = 0, role?: CanvasElement["colorRole"]): CanvasElement => ({ id, kind: "rect", name, x, y, width, height, fill, colorRole: role, cornerRadius, zIndex, visible: true, draggable: true });
const circle = (id: string, name: string, x: number, y: number, radius: number, fill: string, zIndex: number, role?: CanvasElement["colorRole"]): CanvasElement => ({ id, kind: "circle", name, x, y, width: radius * 2, height: radius * 2, fill, colorRole: role, zIndex, visible: true, draggable: true });
const image = (id: string, slot: number, x: number, y: number, width: number, height: number, zIndex: number, radius = 0): CanvasElement => ({ id, kind: "image", name: `Foto ${slot + 1}`, imageSlot: slot, x, y, width, height, zIndex, cornerRadius: radius, visible: true, draggable: true });

const footer = (dark = true): CanvasElement[] => [
  rect("footer-bg", "Fondo pie", 0, 1210, W, 140, dark ? "#111827" : "#ffffff", 40, 0, dark ? "primary" : "accent"),
  text("brand", "Marca", 70, 1240, 540, 54, "brand", 30, dark ? "#ffffff" : "#111827", 42),
  text("contact", "Contacto", 630, 1247, 380, 44, "contact", 22, dark ? "#e5c16a" : "#6b7280", 42, "right"),
];

const features = (y: number, dark = true): CanvasElement[] => [
  rect("features-bg", "Panel características", 55, y, 970, 112, dark ? "#111827" : "#ffffff", 32, 34, dark ? "primary" : "accent"),
  text("features", "Características", 90, y + 30, 900, 50, "features", 25, dark ? "#ffffff" : "#111827", 34, "center"),
];

const commonDark = (imageEls: CanvasElement[], titleY: number, priceY: number, featuresY: number): CanvasElement[] => [
  rect("bg", "Fondo", 0, 0, W, H, "#f7f4ee", 0, 0, "background"),
  ...imageEls,
  rect("info", "Panel principal", 0, titleY - 55, W, H - titleY + 55, "#111827", 15, 0, "primary"),
  rect("operation-bg", "Etiqueta operación", 55, titleY - 110, 220, 62, "#d5ad55", 24, 18, "secondary"),
  text("operation", "Operación", 72, titleY - 95, 185, 42, "operation", 28, "#111827", 26, "center"),
  text("title", "Título", 58, titleY, 620, 155, "title", 68, "#ffffff", 26),
  text("location", "Ubicación", 62, titleY + 155, 520, 52, "location", 29, "#e5c16a", 26),
  rect("price-bg", "Fondo precio", 650, priceY, 380, 88, "#d5ad55", 27, 28, "secondary"),
  text("price", "Precio", 675, priceY + 18, 330, 58, "price", 38, "#111827", 29, "center"),
  ...features(featuresY, true),
  ...footer(true),
];

const templates: PlateTemplate[] = [
  {
    id: "template-1", name: "Plantilla 1", description: "Tres imágenes · premium oscura", imageCount: 3, previewGradient: "linear-gradient(135deg,#111827,#d5ad55)",
    elements: commonDark([
      image("img-1",0,35,35,690,650,8,42), image("img-2",1,750,35,295,305,9,36), image("img-3",2,750,365,295,320,9,36),
      rect("photo-frame","Marco",25,25,1030,670,"transparent",10,50),
    ], 760, 870, 1055),
  },
  {
    id: "template-2", name: "Plantilla 2", description: "Una imagen · editorial clara", imageCount: 1, previewGradient: "linear-gradient(135deg,#f8f5ef,#0f2438)",
    elements: [
      rect("bg","Fondo",0,0,W,H,"#f7f4ee",0,0,"background"), image("img-1",0,0,0,W,790,5,0),
      rect("arc","Curva",-120,640,1320,520,"#f7f4ee",12,220,"background"),
      rect("operation-bg","Etiqueta operación",55,60,235,70,"#d5ad55",20,26,"secondary"), text("operation","Operación",70,78,205,44,"operation",30,"#111827",22,"center"),
      text("title","Título",60,735,660,150,"title",72,"#111827",24), text("location","Ubicación",62,895,560,50,"location",30,"#b1842e",24),
      text("highlight","Descripción",62,960,580,72,"highlight",24,"#374151",24), rect("price-bg","Fondo precio",650,900,370,92,"#111827",26,46,"primary"), text("price","Precio",670,921,330,54,"price",38,"#ffffff",28,"center"),
      ...features(1060,false), ...footer(true),
    ],
  },
  {
    id: "template-3", name: "Plantilla 3", description: "Galería · principal + cuatro miniaturas", imageCount: 5, previewGradient: "linear-gradient(135deg,#ffffff,#d5ad55)",
    elements: [
      rect("bg","Fondo",0,0,W,H,"#f8f7f3",0,0,"background"), image("img-1",0,0,0,W,610,5,0),
      image("img-2",1,45,555,230,220,10,28), image("img-3",2,300,555,230,220,10,28), image("img-4",3,555,555,230,220,10,28), image("img-5",4,810,555,225,220,10,28),
      rect("operation-bg","Etiqueta operación",0,0,330,105,"#111827",18,0,"primary"), text("operation","Operación",60,28,230,50,"operation",34,"#e5c16a",20,"center"),
      text("title","Título",58,810,620,130,"title",64,"#111827",24), text("location","Ubicación",62,945,530,48,"location",30,"#b1842e",24), text("highlight","Descripción",62,1000,570,62,"highlight",22,"#374151",24),
      rect("price-bg","Fondo precio",670,850,350,90,"#111827",25,44,"primary"), text("price","Precio",690,870,310,52,"price",38,"#e5c16a",27,"center"), ...features(1075,false), ...footer(true),
    ],
  },
  {
    id: "template-4", name: "Plantilla 4", description: "Mosaico geométrico · cuatro imágenes", imageCount: 4, previewGradient: "linear-gradient(135deg,#14213d,#fca311)",
    elements: [rect("bg","Fondo",0,0,W,H,"#14213d",0,0,"primary"), image("img-1",0,0,0,650,700,5,0), image("img-2",1,670,0,410,335,6,0), image("img-3",2,670,355,410,345,6,0), image("img-4",3,0,720,360,320,6,0),
      rect("info","Panel",380,720,700,490,"#ffffff",15,70,"accent"), text("operation","Operación",430,760,220,45,"operation",28,"#fca311",20), text("title","Título",430,820,570,130,"title",62,"#14213d",20), text("location","Ubicación",430,955,500,45,"location",27,"#4b5563",20), rect("price-bg","Precio",425,1020,390,78,"#fca311",21,24,"secondary"), text("price","Precio",445,1037,350,48,"price",34,"#14213d",22,"center"), ...footer(true)],
  },
  {
    id: "template-5", name: "Plantilla 5", description: "Minimalista · una imagen vertical", imageCount: 1, previewGradient: "linear-gradient(135deg,#ebe5d8,#263238)",
    elements: [rect("bg","Fondo",0,0,W,H,"#ebe5d8",0,0,"background"), rect("left","Bloque lateral",0,0,390,H,"#263238",4,0,"primary"), image("img-1",0,350,70,680,910,6,40), text("operation","Operación",55,95,250,50,"operation",30,"#d7b46a",15), text("title","Título",55,190,280,260,"title",62,"#ffffff",15), text("location","Ubicación",55,485,260,75,"location",28,"#d7b46a",15), text("highlight","Descripción",55,590,260,120,"highlight",22,"#d1d5db",15), rect("price-bg","Precio",500,1020,500,90,"#263238",18,22,"primary"), text("price","Precio",525,1040,450,52,"price",38,"#ffffff",20,"center"), ...features(1125,false), ...footer(true)],
  },
  {
    id: "template-6", name: "Plantilla 6", description: "Círculos · tres imágenes", imageCount: 3, previewGradient: "linear-gradient(135deg,#eff6ff,#1d4ed8)",
    elements: [rect("bg","Fondo",0,0,W,H,"#eff6ff",0,0,"background"), image("img-1",0,0,0,760,820,5,0), circle("circle-bg-1","Círculo",760,110,155,"#ffffff",8,"accent"), image("img-2",1,780,130,270,270,10,135), circle("circle-bg-2","Círculo",760,430,155,"#ffffff",8,"accent"), image("img-3",2,780,450,270,270,10,135), rect("info","Panel",0,800,W,410,"#1d4ed8",15,0,"primary"), text("operation","Operación",58,835,260,45,"operation",30,"#93c5fd",20), text("title","Título",58,895,650,130,"title",66,"#ffffff",20), text("location","Ubicación",60,1030,520,46,"location",28,"#dbeafe",20), rect("price-bg","Precio",675,950,350,85,"#ffffff",21,42,"accent"), text("price","Precio",695,970,310,50,"price",36,"#1d4ed8",22,"center"), ...footer(true)],
  },
  {
    id: "template-7", name: "Plantilla 7", description: "Diagonal moderna · dos imágenes", imageCount: 2, previewGradient: "linear-gradient(135deg,#0f172a,#ef4444)",
    elements: [rect("bg","Fondo",0,0,W,H,"#0f172a",0,0,"primary"), image("img-1",0,310,0,770,820,5,0), image("img-2",1,650,690,390,300,8,34), rect("diag","Diagonal",-190,560,900,430,"#ef4444",10,0,"secondary"), text("operation","Operación",55,80,250,50,"operation",30,"#fca5a5",20), text("title","Título",55,160,480,180,"title",66,"#ffffff",20), text("location","Ubicación",55,365,450,50,"location",28,"#fecaca",20), rect("price-bg","Precio",55,455,410,88,"#ffffff",21,24,"accent"), text("price","Precio",75,476,370,50,"price",36,"#0f172a",22,"center"), ...features(1035,true), ...footer(true)],
  },
  {
    id: "template-8", name: "Plantilla 8", description: "Editorial beige · dos imágenes", imageCount: 2, previewGradient: "linear-gradient(135deg,#fbf7f0,#7c5e45)",
    elements: [rect("bg","Fondo",0,0,W,H,"#fbf7f0",0,0,"background"), image("img-1",0,410,0,670,900,5,0), image("img-2",1,70,760,430,320,8,32), rect("line","Bloque",0,0,430,750,"#7c5e45",10,0,"primary"), text("operation","Operación",60,90,260,50,"operation",29,"#ead8bd",20), text("title","Título",60,190,320,220,"title",62,"#ffffff",20), text("location","Ubicación",60,445,310,60,"location",28,"#ead8bd",20), text("highlight","Descripción",60,535,300,110,"highlight",22,"#f5ede3",20), rect("price-bg","Precio",570,965,440,90,"#7c5e45",22,45,"primary"), text("price","Precio",595,985,390,52,"price",37,"#ffffff",24,"center"), ...features(1090,false), ...footer(true)],
  },
  {
    id: "template-9", name: "Plantilla 9", description: "Impacto · foto completa", imageCount: 1, previewGradient: "linear-gradient(135deg,#000000,#f59e0b)",
    elements: [image("img-1",0,0,0,W,H,0,0), rect("overlay","Degradado",0,0,W,H,"rgba(0,0,0,0.48)",5,0), rect("operation-bg","Etiqueta",55,65,240,68,"#f59e0b",10,20,"secondary"), text("operation","Operación",73,83,205,40,"operation",29,"#111827",12,"center"), text("title","Título",55,760,850,180,"title",78,"#ffffff",15), text("location","Ubicación",60,945,580,52,"location",32,"#fde68a",15), text("highlight","Descripción",60,1010,650,70,"highlight",24,"#ffffff",15), rect("price-bg","Precio",650,965,370,88,"#f59e0b",16,42,"secondary"), text("price","Precio",675,985,320,50,"price",36,"#111827",18,"center"), ...features(1090,true), ...footer(true)],
  },
  {
    id: "template-10", name: "Plantilla 10", description: "Desarrollo · cinco imágenes", imageCount: 5, previewGradient: "linear-gradient(135deg,#052e2b,#34d399)",
    elements: [rect("bg","Fondo",0,0,W,H,"#ecfdf5",0,0,"background"), image("img-1",0,0,0,W,620,5,0), image("img-2",1,50,555,220,210,8,26), image("img-3",2,300,555,220,210,8,26), image("img-4",3,550,555,220,210,8,26), image("img-5",4,800,555,230,210,8,26), rect("info","Panel",0,735,W,475,"#052e2b",12,0,"primary"), text("operation","Operación",60,790,260,44,"operation",28,"#6ee7b7",20), text("title","Título",60,850,650,135,"title",66,"#ffffff",20), text("location","Ubicación",62,995,520,46,"location",29,"#a7f3d0",20), rect("price-bg","Precio",660,875,360,88,"#34d399",21,22,"secondary"), text("price","Precio",680,895,320,50,"price",36,"#052e2b",22,"center"), ...features(1065,true), ...footer(true)],
  },
];

export const PLATE_TEMPLATES = templates;
export const getTemplate = (id: PlateTemplateId): PlateTemplate => templates.find((item) => item.id === id) || templates[0];
export const DESIGN_WIDTH = W;
export const DESIGN_HEIGHT = H;
