"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "#lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import type {
  BrandData,
  PlateFormat,
  PlateTemplateId,
  PropertyData,
  PropertyStatus,
} from "./types";

const MAX_IMAGES = 4;
const MAX_FILE_MB = 12;

const FORMATS: Record<PlateFormat, { width: number; height: number; label: string }> = {
  square: { width: 1080, height: 1080, label: "Cuadrado · 1080 × 1080" },
  story: { width: 1080, height: 1920, label: "Historia · 1080 × 1920" },
  landscape: { width: 1200, height: 628, label: "Horizontal · 1200 × 628" },
};

const TEMPLATES: Array<{ id: PlateTemplateId; name: string; detail: string }> = [
  { id: "impact", name: "Impacto fotográfico", detail: "Foto completa, degradado y datos fuertes" },
  { id: "premium", name: "Premium oscuro", detail: "Galería, panel oscuro y precio destacado" },
  { id: "editorial", name: "Editorial geométrica", detail: "Formas diagonales y composición de revista" },
  { id: "technical", name: "Ficha técnica", detail: "Foto protagonista y datos ordenados" },
  { id: "mosaic2", name: "Mosaico doble", detail: "Una foto principal y una secundaria" },
  { id: "mosaic4", name: "Mosaico cuatro", detail: "Galería completa con tarjeta central" },
  { id: "opportunity", name: "Oportunidad", detail: "Negro, amarillo y jerarquía de precio" },
  { id: "residential", name: "Residencial elegante", detail: "Curvas suaves y look inmobiliario premium" },
  { id: "land", name: "Terreno / desarrollo", detail: "Datos técnicos, superficie y ubicación" },
  { id: "minimal", name: "Minimal corporativo", detail: "Limpio, sobrio y adaptable a marca" },
];

const STATUS_OPTIONS: PropertyStatus[] = [
  "",
  "RESERVADO",
  "VENDIDO",
  "ALQUILADO",
  "EN ALQUILER",
  "OPORTUNIDAD",
  "NUEVO PRECIO",
];

const DEFAULT_DATA: PropertyData = {
  operation: "VENTA",
  title: "CASA EN VENTA",
  currency: "USD",
  price: "120.000",
  oldPrice: "135.000",
  location: "Córdoba Capital",
  ambients: "5",
  bedrooms: "3",
  bathrooms: "2",
  garages: "1",
  coveredArea: "160",
  totalArea: "300",
  highlight: "Diseño, ubicación y oportunidad",
  hasPool: false,
  status: "",
  showStatus: false,
  showPrice: true,
  showOldPrice: false,
  showLocation: true,
  showFeatures: true,
  showFooter: true,
  showLogo: true,
  primaryColor: "#d4a64d",
  secondaryColor: "#111827",
};

function formatPrice(currency: string, value: string): string {
  const clean = value.trim();
  return clean ? `${currency.trim() || "USD"} ${clean}` : "Consultar";
}

function normalizeProfessionalName(raw?: string | null): string {
  if (!raw) return "";
  return raw.replace(/cpi\s*\d+/gi, "").replace(/[·|-]+$/g, "").trim();
}

function formatLicense(raw?: string | null): string {
  if (!raw) return "";
  const clean = String(raw).trim();
  return /^cpi\b/i.test(clean) ? clean : `CPI ${clean}`;
}

function safeFileName(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 70) || "placa-inmobiliaria"
  );
}

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("No se pudo leer la imagen"));
    reader.readAsDataURL(file);
  });
}

async function remoteImageToDataUrl(url: string | null): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("data:")) return url;
  try {
    const response = await fetch(url, { cache: "force-cache" });
    if (!response.ok) return null;
    const blob = await response.blob();
    return await fileToDataUrl(new File([blob], "logo", { type: blob.type || "image/png" }));
  } catch {
    return null;
  }
}

export default function PlateEditor({ mode }: { mode: "empresa" | "asesor" }) {
  const { user } = useAuth();
  const { primaryColor: themeColor, logoUrl: themeLogo } = useTheme();

  const htmlCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fabricCanvasRef = useRef<any>(null);
  const fabricModuleRef = useRef<any>(null);
  const buildSequenceRef = useRef(0);

  const [format, setFormat] = useState<PlateFormat>("square");
  const [templateId, setTemplateId] = useState<PlateTemplateId>("impact");
  const [data, setData] = useState<PropertyData>(DEFAULT_DATA);
  const [images, setImages] = useState<string[]>([]);
  const [brand, setBrand] = useState<BrandData>({
    companyName: "VAI Prop",
    professionalName: "Profesional inmobiliario",
    license: "",
    phone: "",
    logoUrl: null,
    primaryColor: themeColor || DEFAULT_DATA.primaryColor,
  });
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const [loadingBrand, setLoadingBrand] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedPhotoSlot, setSelectedPhotoSlot] = useState<number | null>(null);
  const [selectedPhotoZoom, setSelectedPhotoZoom] = useState(1);

  const size = FORMATS[format];
  const previewScale = useMemo(() => {
    const maxWidth = format === "story" ? 430 : 760;
    const maxHeight = 760;
    return Math.min(maxWidth / size.width, maxHeight / size.height, 1);
  }, [format, size.height, size.width]);

  const updateData = <K extends keyof PropertyData>(key: K, value: PropertyData[K]) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    setData((prev) => ({ ...prev, primaryColor: themeColor || prev.primaryColor }));
  }, [themeColor]);

  useEffect(() => {
    let active = true;

    const loadBrand = async () => {
      if (!user?.id) return;
      setLoadingBrand(true);
      try {
        const profile = user as any;
        let company: any = null;

        if (mode === "asesor" && profile.empresa_id) {
          const { data: companyData, error } = await supabase
            .from("empresas")
            .select("id, nombre_comercial, matriculado, cpi, telefono, logo_url, color")
            .eq("id", profile.empresa_id)
            .maybeSingle();
          if (error) throw error;
          company = companyData;
        } else {
          const { data: companyData, error } = await supabase
            .from("empresas")
            .select("id, nombre_comercial, matriculado, cpi, telefono, logo_url, color")
            .or(`user_id.eq.${user.id},id_usuario.eq.${user.id}`)
            .limit(1)
            .maybeSingle();
          if (error) throw error;
          company = companyData;
        }

        if (!active) return;

        const profileName = `${profile?.nombre || ""} ${profile?.apellido || ""}`.trim();
        const professionalName =
          profileName ||
          normalizeProfessionalName(company?.matriculado || profile?.matriculado_nombre || "") ||
          "Profesional inmobiliario";
        const nextColor = company?.color || themeColor || DEFAULT_DATA.primaryColor;
        const nextBrand: BrandData = {
          companyName: company?.nombre_comercial || profile?.inmobiliaria || "VAI Prop",
          professionalName,
          license: formatLicense(company?.cpi || profile?.cpi || ""),
          phone:
            mode === "asesor"
              ? profile?.telefono || company?.telefono || ""
              : company?.telefono || profile?.telefono || "",
          logoUrl: company?.logo_url || themeLogo || null,
          primaryColor: nextColor,
        };

        setBrand(nextBrand);
        setData((prev) => ({ ...prev, primaryColor: nextColor }));
        setLogoDataUrl(await remoteImageToDataUrl(nextBrand.logoUrl));
      } catch (error) {
        console.error("Error cargando identidad del creador de placas:", error);
        setMessage("No se pudo cargar toda la identidad corporativa. El editor puede usarse igualmente.");
      } finally {
        if (active) setLoadingBrand(false);
      }
    };

    void loadBrand();
    return () => {
      active = false;
    };
  }, [mode, themeColor, themeLogo, user]);

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      if (!htmlCanvasRef.current || fabricCanvasRef.current) return;
      const fabric = await import("fabric");
      if (!mounted || !htmlCanvasRef.current) return;

      fabricModuleRef.current = fabric;
      const canvas = new fabric.Canvas(htmlCanvasRef.current, {
        width: size.width,
        height: size.height,
        backgroundColor: "#ffffff",
        preserveObjectStacking: true,
        selection: true,
        stopContextMenu: true,
      });

      canvas.on("selection:created", syncSelectedPhoto);
      canvas.on("selection:updated", syncSelectedPhoto);
      canvas.on("selection:cleared", () => {
        setSelectedPhotoSlot(null);
        setSelectedPhotoZoom(1);
      });
      canvas.on("object:moving", constrainSelectedPhoto);

      fabricCanvasRef.current = canvas;
      setCanvasReady(true);
    };

    const syncSelectedPhoto = (event: any) => {
      const target = event?.selected?.[0] ?? event?.target ?? null;
      if (target?.vaiType === "photo") {
        setSelectedPhotoSlot(Number(target.vaiSlot));
        setSelectedPhotoZoom(Number(target.vaiZoom || 1));
      } else {
        setSelectedPhotoSlot(null);
        setSelectedPhotoZoom(1);
      }
    };

    const constrainSelectedPhoto = (event: any) => {
      const target = event?.target;
      if (!target || target.vaiType !== "photo" || !target.vaiFrame) return;
      const frame = target.vaiFrame;
      const bounds = target.getBoundingRect();
      const minLeft = frame.x + frame.w - bounds.width / 2;
      const maxLeft = frame.x + bounds.width / 2;
      const minTop = frame.y + frame.h - bounds.height / 2;
      const maxTop = frame.y + bounds.height / 2;
      target.set({
        left: Math.min(maxLeft, Math.max(minLeft, target.left)),
        top: Math.min(maxTop, Math.max(minTop, target.top)),
      });
    };

    void initialize();
    return () => {
      mounted = false;
      const canvas = fabricCanvasRef.current;
      if (canvas) {
        canvas.dispose();
        fabricCanvasRef.current = null;
      }
    };
    // La inicialización debe ejecutarse una sola vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buildTemplate = useCallback(async () => {
    const canvas = fabricCanvasRef.current;
    const fabric = fabricModuleRef.current;
    if (!canvas || !fabric) return;

    const sequence = ++buildSequenceRef.current;
    const { Rect, Circle, Polygon, Textbox, FabricImage, Gradient } = fabric;
    const W = size.width;
    const H = size.height;
    const short = Math.min(W, H);
    const unit = W / 1080;
    const portrait = H / W > 1.35;
    const landscape = W / H > 1.35;

    canvas.discardActiveObject();
    canvas.clear();
    canvas.setDimensions({ width: W, height: H });
    canvas.backgroundColor = "#ffffff";

    const add = (object: any) => {
      object.set({ objectCaching: false });
      canvas.add(object);
      return object;
    };

    const rect = (x: number, y: number, w: number, h: number, fill: any, options: any = {}) =>
      add(
        new Rect({
          left: x,
          top: y,
          width: w,
          height: h,
          fill,
          selectable: false,
          evented: false,
          ...options,
        }),
      );

    const circle = (x: number, y: number, radius: number, fill: any, options: any = {}) =>
      add(
        new Circle({
          left: x,
          top: y,
          radius,
          fill,
          selectable: false,
          evented: false,
          ...options,
        }),
      );

    const polygon = (points: Array<{ x: number; y: number }>, fill: any, options: any = {}) =>
      add(
        new Polygon(points, {
          fill,
          selectable: false,
          evented: false,
          ...options,
        }),
      );

    const text = (
      key: string,
      value: string,
      x: number,
      y: number,
      width: number,
      fontSize: number,
      options: any = {},
    ) => {
      const object = new Textbox(value, {
        left: x,
        top: y,
        width,
        fontSize,
        fontFamily: options.fontFamily || "Arial",
        fontWeight: options.fontWeight || "normal",
        fill: options.fill || "#111827",
        lineHeight: options.lineHeight || 1.05,
        textAlign: options.textAlign || "left",
        charSpacing: options.charSpacing || 0,
        splitByGrapheme: false,
        editable: false,
        selectable: false,
        evented: false,
        visible: options.visible !== false,
        ...options,
      });
      object.vaiKey = key;
      return add(object);
    };

    const photo = async (
      slot: number,
      x: number,
      y: number,
      w: number,
      h: number,
      radius = 0,
      borderColor?: string,
      borderWidth = 0,
    ) => {
      rect(x, y, w, h, "#d8dee8", { rx: radius, ry: radius });
      const url = images[slot];
      if (!url) {
        text(`placeholder-${slot}`, `FOTO ${slot + 1}`, x, y + h / 2 - 18 * unit, w, 28 * unit, {
          fill: "#64748b",
          textAlign: "center",
          fontWeight: "bold",
        });
      } else {
        try {
          const image = await FabricImage.fromURL(url);
          if (sequence !== buildSequenceRef.current) return;
          const naturalWidth = Number(image.width || 1);
          const naturalHeight = Number(image.height || 1);
          const baseScale = Math.max(w / naturalWidth, h / naturalHeight);
          image.set({
            left: x + w / 2,
            top: y + h / 2,
            originX: "center",
            originY: "center",
            scaleX: baseScale,
            scaleY: baseScale,
            clipPath: new Rect({
              left: x,
              top: y,
              width: w,
              height: h,
              rx: radius,
              ry: radius,
              absolutePositioned: true,
            }),
            selectable: true,
            evented: true,
            hasControls: false,
            hasBorders: true,
            borderColor: data.primaryColor,
            lockRotation: true,
            perPixelTargetFind: false,
          });
          image.vaiType = "photo";
          image.vaiSlot = slot;
          image.vaiFrame = { x, y, w, h };
          image.vaiBaseScale = baseScale;
          image.vaiZoom = 1;
          add(image);
        } catch (error) {
          console.error("No se pudo cargar una foto en Fabric:", error);
        }
      }
      if (borderWidth > 0) {
        rect(x, y, w, h, "transparent", {
          rx: radius,
          ry: radius,
          stroke: borderColor || "#ffffff",
          strokeWidth: borderWidth,
        });
      }
    };

    const logo = async (x: number, y: number, maxW: number, maxH: number, dark = false) => {
      if (!data.showLogo) return;
      if (!logoDataUrl) {
        text("logo-fallback", brand.companyName, x, y, maxW, 22 * unit, {
          fill: dark ? "#ffffff" : "#111827",
          fontWeight: "bold",
        });
        return;
      }
      try {
        const image = await FabricImage.fromURL(logoDataUrl);
        if (sequence !== buildSequenceRef.current) return;
        const scale = Math.min(maxW / Number(image.width || 1), maxH / Number(image.height || 1));
        image.set({
          left: x,
          top: y,
          originX: "left",
          originY: "top",
          scaleX: scale,
          scaleY: scale,
          selectable: false,
          evented: false,
        });
        image.vaiKey = "logo";
        add(image);
      } catch {
        text("logo-fallback", brand.companyName, x, y, maxW, 22 * unit, {
          fill: dark ? "#ffffff" : "#111827",
          fontWeight: "bold",
        });
      }
    };

    const footerText = [brand.companyName, brand.professionalName, brand.license]
      .filter(Boolean)
      .join(" - ");

    const footer = async (x: number, y: number, w: number, dark = false) => {
      if (!data.showFooter) return;
      rect(x, y, w, 2 * unit, dark ? "rgba(255,255,255,.35)" : "#cbd5e1");
      text("footer", footerText || brand.companyName, x, y + 14 * unit, w - 150 * unit, 18 * unit, {
        fill: dark ? "#ffffff" : "#334155",
        fontWeight: "bold",
      });
      text("phone", brand.phone || "", x, y + 40 * unit, w - 150 * unit, 16 * unit, {
        fill: dark ? "rgba(255,255,255,.78)" : "#64748b",
      });
      await logo(x + w - 128 * unit, y + 12 * unit, 128 * unit, 48 * unit, dark);
    };

    const featureValue = [
      data.ambients ? `${data.ambients} AMB` : "",
      data.bedrooms ? `${data.bedrooms} DORM` : "",
      data.bathrooms ? `${data.bathrooms} BAÑOS` : "",
      data.garages ? `${data.garages} COCH` : "",
      data.coveredArea ? `${data.coveredArea} M² CUB` : "",
      data.totalArea ? `${data.totalArea} M² TOT` : "",
      data.hasPool ? "PISCINA" : "",
    ]
      .filter(Boolean)
      .join("  ·  ");

    const operationPill = (x: number, y: number, w = 180 * unit, darkText = false) => {
      rect(x, y, w, 48 * unit, data.primaryColor, { rx: 24 * unit, ry: 24 * unit });
      text("operation", data.operation, x, y + 12 * unit, w, 20 * unit, {
        fill: darkText ? "#111827" : "#ffffff",
        fontWeight: "bold",
        textAlign: "center",
        charSpacing: 100,
      });
    };

    const priceBlock = (x: number, y: number, w: number, dark = false, accent = false) => {
      const bg = accent ? data.primaryColor : dark ? "rgba(15,23,42,.82)" : "rgba(255,255,255,.94)";
      rect(x, y, w, data.showOldPrice ? 112 * unit : 88 * unit, bg, {
        rx: 20 * unit,
        ry: 20 * unit,
        shadow: new fabric.Shadow({ color: "rgba(0,0,0,.22)", blur: 18 * unit, offsetY: 8 * unit }),
        visible: data.showPrice,
      });
      text("oldPrice", formatPrice(data.currency, data.oldPrice), x + 18 * unit, y + 12 * unit, w - 36 * unit, 20 * unit, {
        fill: accent ? "#111827" : dark ? "#ffffff" : "#64748b",
        fontWeight: "bold",
        linethrough: true,
        visible: data.showPrice && data.showOldPrice,
      });
      text("price", formatPrice(data.currency, data.price), x + 18 * unit, y + (data.showOldPrice ? 44 : 24) * unit, w - 36 * unit, 36 * unit, {
        fill: accent ? "#111827" : dark ? "#ffffff" : "#0f172a",
        fontWeight: "bold",
        visible: data.showPrice,
      });
    };

    const statusStamp = () => {
      if (!data.showStatus || !data.status) return;
      const stampW = Math.min(W * 0.62, 660 * unit);
      const stampH = 120 * unit;
      const stampX = (W - stampW) / 2;
      const stampY = H * 0.45;
      rect(stampX, stampY, stampW, stampH, "rgba(255,255,255,.91)", {
        rx: 18 * unit,
        ry: 18 * unit,
        stroke: data.primaryColor,
        strokeWidth: 8 * unit,
        angle: -8,
      });
      text("status", data.status, stampX, stampY + 32 * unit, stampW, 40 * unit, {
        fill: data.primaryColor,
        fontWeight: "bold",
        textAlign: "center",
        charSpacing: 160,
        angle: -8,
      });
    };

    const featureLine = (x: number, y: number, w: number, dark = false, font = 18 * unit) => {
      text("features", featureValue, x, y, w, font, {
        fill: dark ? "rgba(255,255,255,.9)" : "#475569",
        fontWeight: "bold",
        visible: data.showFeatures,
      });
    };

    const locationLine = (x: number, y: number, w: number, dark = false, font = 22 * unit) => {
      text("location", `⌖ ${data.location}`, x, y, w, font, {
        fill: dark ? "rgba(255,255,255,.9)" : "#475569",
        fontWeight: "bold",
        visible: data.showLocation,
      });
    };

    const titleText = (x: number, y: number, w: number, dark = false, font = 58 * unit) => {
      text("title", data.title, x, y, w, font, {
        fill: dark ? "#ffffff" : "#0f172a",
        fontWeight: "bold",
        lineHeight: 0.95,
      });
    };

    const highlightText = (x: number, y: number, w: number, dark = false, font = 22 * unit) => {
      text("highlight", data.highlight, x, y, w, font, {
        fill: dark ? "rgba(255,255,255,.78)" : "#64748b",
        lineHeight: 1.15,
      });
    };

    if (templateId === "impact") {
      await photo(0, 0, 0, W, H);
      const gradient = new Gradient({
        type: "linear",
        coords: { x1: 0, y1: 0, x2: 0, y2: H },
        colorStops: [
          { offset: 0, color: "rgba(0,0,0,.05)" },
          { offset: 0.46, color: "rgba(0,0,0,.10)" },
          { offset: 1, color: "rgba(0,0,0,.88)" },
        ],
      });
      rect(0, 0, W, H, gradient);
      const contentY = portrait ? H * 0.58 : H * 0.51;
      operationPill(W * 0.055, contentY);
      titleText(W * 0.055, contentY + 70 * unit, W * 0.58, true, portrait ? 68 * unit : 54 * unit);
      locationLine(W * 0.055, contentY + (portrait ? 220 : 180) * unit, W * 0.58, true);
      highlightText(W * 0.055, contentY + (portrait ? 265 : 220) * unit, W * 0.58, true);
      featureLine(W * 0.055, contentY + (portrait ? 320 : 270) * unit, W * 0.67, true);
      priceBlock(W * 0.69, contentY + 60 * unit, W * 0.255, true);
      await footer(W * 0.055, H - 92 * unit, W * 0.89, true);
    }

    if (templateId === "premium") {
      rect(0, 0, W, H, data.secondaryColor);
      const panelW = landscape ? W * 0.37 : W * 0.39;
      const photoW = W - panelW;
      await photo(0, 0, 0, photoW, portrait ? H * 0.71 : H * 0.74);
      const thumbsY = portrait ? H * 0.71 : H * 0.74;
      const thumbsH = H - thumbsY;
      for (let i = 0; i < 3; i += 1) {
        await photo(i + 1, i * (photoW / 3), thumbsY, photoW / 3, thumbsH, 0, "#ffffff", 3 * unit);
      }
      const px = photoW + panelW * 0.11;
      operationPill(px, H * 0.07, panelW * 0.62, true);
      titleText(px, H * 0.16, panelW * 0.78, true, portrait ? 58 * unit : 45 * unit);
      locationLine(px, H * 0.34, panelW * 0.78, true, 20 * unit);
      highlightText(px, H * 0.40, panelW * 0.78, true, 19 * unit);
      featureLine(px, H * 0.50, panelW * 0.78, true, 17 * unit);
      priceBlock(px, H * 0.62, panelW * 0.78, true);
      await footer(px, H - 92 * unit, panelW * 0.78, true);
    }

    if (templateId === "editorial") {
      rect(0, 0, W, H, "#f8fafc");
      await photo(0, W * 0.34, 0, W * 0.66, H);
      polygon(
        [
          { x: 0, y: 0 },
          { x: W * 0.48, y: 0 },
          { x: W * 0.33, y: H },
          { x: 0, y: H },
        ],
        data.secondaryColor,
      );
      polygon(
        [
          { x: 0, y: 0 },
          { x: W * 0.12, y: 0 },
          { x: W * 0.04, y: H },
          { x: 0, y: H },
        ],
        data.primaryColor,
      );
      const x = W * 0.075;
      operationPill(x, H * 0.09, W * 0.20, true);
      titleText(x, H * 0.21, W * 0.31, true, portrait ? 62 * unit : 48 * unit);
      locationLine(x, H * 0.46, W * 0.28, true, 20 * unit);
      highlightText(x, H * 0.53, W * 0.27, true, 19 * unit);
      featureLine(x, H * 0.63, W * 0.27, true, 16 * unit);
      priceBlock(x, H * 0.72, W * 0.28, true);
      await footer(x, H - 92 * unit, W * 0.28, true);
    }

    if (templateId === "technical") {
      rect(0, 0, W, H, "#f3f1ea");
      const margin = W * 0.045;
      operationPill(margin, H * 0.035, W * 0.20);
      titleText(margin, H * 0.095, W * 0.67, false, portrait ? 58 * unit : 46 * unit);
      await logo(W - margin - 150 * unit, H * 0.04, 150 * unit, 58 * unit);
      const photoY = portrait ? H * 0.20 : H * 0.20;
      const photoH = portrait ? H * 0.43 : H * 0.43;
      await photo(0, margin, photoY, W - margin * 2, photoH, 26 * unit);
      const cardY = photoY + photoH + H * 0.025;
      rect(margin, cardY, W - margin * 2, H - cardY - margin, "#ffffff", {
        rx: 26 * unit,
        ry: 26 * unit,
        shadow: new fabric.Shadow({ color: "rgba(15,23,42,.12)", blur: 22 * unit, offsetY: 8 * unit }),
      });
      locationLine(margin * 1.6, cardY + 34 * unit, W * 0.55);
      highlightText(margin * 1.6, cardY + 78 * unit, W * 0.55);
      featureLine(margin * 1.6, cardY + 135 * unit, W * 0.62, false, 18 * unit);
      priceBlock(W * 0.70, cardY + 32 * unit, W * 0.24);
      await footer(margin * 1.6, H - 90 * unit, W - margin * 3.2);
    }

    if (templateId === "mosaic2") {
      rect(0, 0, W, H, "#ffffff");
      const topH = portrait ? H * 0.66 : H * 0.64;
      await photo(0, 0, 0, W * 0.68, topH);
      await photo(1, W * 0.68 + 4 * unit, 0, W * 0.32 - 4 * unit, topH);
      rect(0, topH, W, H - topH, "#ffffff");
      const x = W * 0.055;
      operationPill(x, topH + 32 * unit, W * 0.18);
      titleText(x, topH + 95 * unit, W * 0.52, false, portrait ? 54 * unit : 42 * unit);
      locationLine(x, topH + (portrait ? 220 : 175) * unit, W * 0.52);
      featureLine(x, topH + (portrait ? 270 : 220) * unit, W * 0.58);
      priceBlock(W * 0.70, topH + 54 * unit, W * 0.25);
      await footer(W * 0.70, H - 90 * unit, W * 0.25);
    }

    if (templateId === "mosaic4") {
      rect(0, 0, W, H, data.secondaryColor);
      const gap = 4 * unit;
      await photo(0, 0, 0, W * 0.5 - gap / 2, H * 0.5 - gap / 2);
      await photo(1, W * 0.5 + gap / 2, 0, W * 0.5 - gap / 2, H * 0.5 - gap / 2);
      await photo(2, 0, H * 0.5 + gap / 2, W * 0.5 - gap / 2, H * 0.5 - gap / 2);
      await photo(3, W * 0.5 + gap / 2, H * 0.5 + gap / 2, W * 0.5 - gap / 2, H * 0.5 - gap / 2);
      const cardW = portrait ? W * 0.78 : W * 0.66;
      const cardH = portrait ? H * 0.30 : H * 0.48;
      const cardX = (W - cardW) / 2;
      const cardY = (H - cardH) / 2;
      rect(cardX, cardY, cardW, cardH, "rgba(255,255,255,.94)", {
        rx: 28 * unit,
        ry: 28 * unit,
        shadow: new fabric.Shadow({ color: "rgba(0,0,0,.30)", blur: 28 * unit, offsetY: 10 * unit }),
      });
      operationPill(cardX + 30 * unit, cardY + 28 * unit, cardW * 0.28);
      titleText(cardX + 30 * unit, cardY + 90 * unit, cardW * 0.56, false, portrait ? 48 * unit : 40 * unit);
      locationLine(cardX + 30 * unit, cardY + (portrait ? 205 : 175) * unit, cardW * 0.56, false, 19 * unit);
      featureLine(cardX + 30 * unit, cardY + (portrait ? 250 : 215) * unit, cardW * 0.58, false, 16 * unit);
      priceBlock(cardX + cardW * 0.68, cardY + 58 * unit, cardW * 0.27);
      await footer(cardX + cardW * 0.68, cardY + cardH - 82 * unit, cardW * 0.27);
    }

    if (templateId === "opportunity") {
      rect(0, 0, W, H, "#111214");
      const topH = portrait ? H * 0.60 : H * 0.58;
      await photo(0, 0, 0, W * 0.68, topH);
      for (let i = 0; i < 3; i += 1) {
        await photo(i + 1, W * 0.68 + 4 * unit, i * (topH / 3), W * 0.32 - 4 * unit, topH / 3 - 3 * unit);
      }
      polygon(
        [
          { x: 0, y: topH },
          { x: W * 0.42, y: topH },
          { x: W * 0.33, y: H },
          { x: 0, y: H },
        ],
        "#facc15",
      );
      text("opportunityLabel", data.status || "EN OPORTUNIDAD", W * 0.04, topH + 34 * unit, W * 0.32, 24 * unit, {
        fill: "#111827",
        fontWeight: "bold",
        charSpacing: 100,
      });
      titleText(W * 0.04, topH + 78 * unit, W * 0.30, false, portrait ? 48 * unit : 38 * unit);
      locationLine(W * 0.04, topH + (portrait ? 220 : 165) * unit, W * 0.29, false, 18 * unit);
      const rightX = W * 0.43;
      highlightText(rightX, topH + 40 * unit, W * 0.50, true, 20 * unit);
      featureLine(rightX, topH + 92 * unit, W * 0.50, true, 17 * unit);
      priceBlock(rightX, topH + 145 * unit, W * 0.30, false, true);
      await footer(rightX, H - 90 * unit, W * 0.50, true);
    }

    if (templateId === "residential") {
      rect(0, 0, W, H, "#e7efe1");
      await photo(0, W * 0.30, 0, W * 0.70, H);
      circle(-W * 0.48, -H * 0.08, W * 0.86, "rgba(248,247,241,.95)");
      rect(0, 0, W * 0.46, H, "rgba(248,247,241,.88)");
      const x = W * 0.055;
      operationPill(x, H * 0.09, W * 0.20);
      text("title", data.title, x, H * 0.20, W * 0.36, portrait ? 62 * unit : 48 * unit, {
        fill: "#43503a",
        fontWeight: "bold",
        fontFamily: "Georgia",
        lineHeight: 0.95,
      });
      locationLine(x, H * 0.43, W * 0.34, false, 20 * unit);
      highlightText(x, H * 0.50, W * 0.34, false, 19 * unit);
      featureLine(x, H * 0.60, W * 0.34, false, 16 * unit);
      priceBlock(x, H * 0.69, W * 0.31);
      await footer(x, H - 92 * unit, W * 0.34);
      if (images[1]) {
        await photo(1, W * 0.08, H * 0.72, W * 0.22, H * 0.16, 24 * unit, "#ffffff", 5 * unit);
      }
    }

    if (templateId === "land") {
      rect(0, 0, W, H, "#172d25");
      await photo(0, 0, 0, W, H * 0.64);
      polygon(
        [
          { x: 0, y: H * 0.58 },
          { x: W, y: H * 0.51 },
          { x: W, y: H },
          { x: 0, y: H },
        ],
        "#172d25",
      );
      polygon(
        [
          { x: W * 0.68, y: H * 0.51 },
          { x: W, y: H * 0.48 },
          { x: W, y: H * 0.62 },
        ],
        data.primaryColor,
      );
      const x = W * 0.055;
      operationPill(x, H * 0.61, W * 0.18, true);
      titleText(x, H * 0.69, W * 0.50, true, portrait ? 54 * unit : 43 * unit);
      locationLine(x, H * 0.82, W * 0.50, true, 20 * unit);
      text("landAreas", `${data.totalArea || "—"} M² TOTALES   ·   ${data.coveredArea || "—"} M² CUBIERTOS`, x, H * 0.87, W * 0.58, 20 * unit, {
        fill: data.primaryColor,
        fontWeight: "bold",
        visible: data.showFeatures,
      });
      priceBlock(W * 0.69, H * 0.69, W * 0.25, true);
      await footer(W * 0.69, H - 90 * unit, W * 0.25, true);
    }

    if (templateId === "minimal") {
      rect(0, 0, W, H, "#ffffff");
      const margin = W * 0.055;
      operationPill(margin, H * 0.045, W * 0.18);
      await logo(W - margin - 150 * unit, H * 0.045, 150 * unit, 54 * unit);
      const photoY = H * 0.13;
      const photoH = portrait ? H * 0.58 : H * 0.58;
      await photo(0, margin, photoY, W - margin * 2, photoH, 26 * unit);
      const contentY = photoY + photoH + H * 0.03;
      titleText(margin, contentY, W * 0.56, false, portrait ? 54 * unit : 42 * unit);
      locationLine(margin, contentY + (portrait ? 135 : 105) * unit, W * 0.56, false, 20 * unit);
      featureLine(margin, contentY + (portrait ? 182 : 148) * unit, W * 0.60, false, 17 * unit);
      priceBlock(W * 0.70, contentY + 10 * unit, W * 0.245);
      await footer(margin, H - 90 * unit, W - margin * 2);
    }

    statusStamp();
    canvas.renderAll();
    setSelectedPhotoSlot(null);
    setSelectedPhotoZoom(1);
  }, [brand, data.primaryColor, data.secondaryColor, data.showFooter, data.showLogo, format, images, logoDataUrl, size.height, size.width, templateId]);

  useEffect(() => {
    if (!canvasReady) return;
    void buildTemplate();
  }, [buildTemplate, canvasReady]);

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !canvasReady) return;

    const footerText = [brand.companyName, brand.professionalName, brand.license]
      .filter(Boolean)
      .join(" - ");
    const featureValue = [
      data.ambients ? `${data.ambients} AMB` : "",
      data.bedrooms ? `${data.bedrooms} DORM` : "",
      data.bathrooms ? `${data.bathrooms} BAÑOS` : "",
      data.garages ? `${data.garages} COCH` : "",
      data.coveredArea ? `${data.coveredArea} M² CUB` : "",
      data.totalArea ? `${data.totalArea} M² TOT` : "",
      data.hasPool ? "PISCINA" : "",
    ]
      .filter(Boolean)
      .join("  ·  ");

    canvas.getObjects().forEach((object: any) => {
      switch (object.vaiKey) {
        case "operation":
          object.set({ text: data.operation });
          break;
        case "title":
          object.set({ text: data.title });
          break;
        case "location":
          object.set({ text: `⌖ ${data.location}`, visible: data.showLocation });
          break;
        case "highlight":
          object.set({ text: data.highlight });
          break;
        case "features":
          object.set({ text: featureValue, visible: data.showFeatures });
          break;
        case "landAreas":
          object.set({
            text: `${data.totalArea || "—"} M² TOTALES   ·   ${data.coveredArea || "—"} M² CUBIERTOS`,
            visible: data.showFeatures,
          });
          break;
        case "price":
          object.set({ text: formatPrice(data.currency, data.price), visible: data.showPrice });
          break;
        case "oldPrice":
          object.set({
            text: formatPrice(data.currency, data.oldPrice),
            visible: data.showPrice && data.showOldPrice,
          });
          break;
        case "footer":
          object.set({ text: footerText || brand.companyName, visible: data.showFooter });
          break;
        case "phone":
          object.set({ text: brand.phone || "", visible: data.showFooter });
          break;
        case "logo":
        case "logo-fallback":
          object.set({ visible: data.showLogo });
          break;
        case "status":
          object.set({ text: data.status, visible: data.showStatus && Boolean(data.status) });
          break;
        default:
          break;
      }
      object.setCoords?.();
    });
    canvas.requestRenderAll();
  }, [brand, canvasReady, data]);

  const handleImages = async (files: FileList | null) => {
    if (!files?.length) return;
    const accepted = Array.from(files)
      .filter((file) => file.type.startsWith("image/") && file.size <= MAX_FILE_MB * 1024 * 1024)
      .slice(0, MAX_IMAGES);

    if (!accepted.length) {
      setMessage(`Solo se aceptan imágenes de hasta ${MAX_FILE_MB} MB.`);
      return;
    }

    try {
      setImages(await Promise.all(accepted.map(fileToDataUrl)));
      setMessage(null);
    } catch (error) {
      console.error("Error leyendo imágenes:", error);
      setMessage("No se pudo leer una de las imágenes seleccionadas.");
    }
  };

  const moveImage = (index: number, direction: -1 | 1) => {
    setImages((prev) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  };

  const applySelectedPhotoZoom = (zoom: number) => {
    setSelectedPhotoZoom(zoom);
    const canvas = fabricCanvasRef.current;
    const active = canvas?.getActiveObject?.();
    if (!active || active.vaiType !== "photo") return;
    const base = Number(active.vaiBaseScale || 1);
    active.set({ scaleX: base * zoom, scaleY: base * zoom });
    active.vaiZoom = zoom;
    active.setCoords();
    canvas.requestRenderAll();
  };

  const centerSelectedPhoto = () => {
    const canvas = fabricCanvasRef.current;
    const active = canvas?.getActiveObject?.();
    if (!active || active.vaiType !== "photo" || !active.vaiFrame) return;
    active.set({
      left: active.vaiFrame.x + active.vaiFrame.w / 2,
      top: active.vaiFrame.y + active.vaiFrame.h / 2,
    });
    active.setCoords();
    canvas.requestRenderAll();
  };

  const download = async (kind: "png" | "jpeg") => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    setExporting(true);
    setMessage("Generando placa...");
    try {
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      const dataUrl = canvas.toDataURL({
        format: kind,
        quality: kind === "jpeg" ? 0.94 : 1,
        multiplier: 2,
      });
      const link = document.createElement("a");
      link.download = `${safeFileName(data.title)}-${format}.${kind === "jpeg" ? "jpg" : "png"}`;
      link.href = dataUrl;
      link.click();
      setMessage("Placa descargada correctamente.");
    } catch (error) {
      console.error("Error exportando placa con Fabric:", error);
      setMessage("No se pudo descargar la placa. Probá recargando las imágenes.");
    } finally {
      setExporting(false);
      window.setTimeout(() => setMessage(null), 3500);
    }
  };

  return (
    <div className="space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">VAI Studio · Fabric Edition</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950">Creador de placas inmobiliarias</h1>
        <p className="mt-1 text-sm text-slate-600">
          Editor gráfico con composiciones fijas. Seleccioná una foto en el lienzo para moverla o ajustar su zoom.
        </p>
        {loadingBrand ? <p className="mt-2 text-xs text-slate-500">Cargando identidad corporativa...</p> : null}
      </header>

      <div className="grid items-start gap-5 xl:grid-cols-[400px_minmax(0,1fr)]">
        <aside className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <Section title="Formato y plantilla">
            <Field label="Formato de salida">
              <select className="vai-input" value={format} onChange={(event) => setFormat(event.target.value as PlateFormat)}>
                {Object.entries(FORMATS).map(([key, value]) => (
                  <option key={key} value={key}>{value.label}</option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              {TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => setTemplateId(template.id)}
                  className={`rounded-xl border p-3 text-left transition ${
                    templateId === template.id
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="text-sm font-bold">{template.name}</div>
                  <div className={`mt-1 text-[11px] ${templateId === template.id ? "text-white/70" : "text-slate-500"}`}>
                    {template.detail}
                  </div>
                </button>
              ))}
            </div>
          </Section>

          <Section title="Fotos de la propiedad">
            <input type="file" accept="image/*" multiple onChange={(event) => void handleImages(event.target.files)} className="block w-full text-sm" />
            <p className="text-xs text-slate-500">Hasta 4 imágenes. La primera siempre funciona como foto principal.</p>
            {images.map((url, index) => (
              <div key={`${url.slice(0, 32)}-${index}`} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2">
                <img src={url} alt="" className="h-12 w-12 rounded object-cover" />
                <div className="min-w-0 flex-1 text-xs font-semibold">Foto {index + 1}</div>
                <button type="button" className="vai-mini" onClick={() => moveImage(index, -1)}>↑</button>
                <button type="button" className="vai-mini" onClick={() => moveImage(index, 1)}>↓</button>
                <button type="button" className="vai-mini" onClick={() => removeImage(index)}>×</button>
              </div>
            ))}
            <div className={`rounded-xl border p-3 ${selectedPhotoSlot === null ? "border-slate-200 bg-slate-50" : "border-amber-300 bg-amber-50"}`}>
              <div className="text-xs font-bold text-slate-700">
                {selectedPhotoSlot === null ? "Seleccioná una foto en el lienzo" : `Editando foto ${selectedPhotoSlot + 1}`}
              </div>
              <label className="mt-3 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Zoom ({selectedPhotoZoom.toFixed(2)}x)
                <input
                  type="range"
                  min="1"
                  max="2.2"
                  step="0.05"
                  disabled={selectedPhotoSlot === null}
                  value={selectedPhotoZoom}
                  onChange={(event) => applySelectedPhotoZoom(Number(event.target.value))}
                  className="mt-2 w-full"
                />
              </label>
              <button type="button" disabled={selectedPhotoSlot === null} onClick={centerSelectedPhoto} className="vai-secondary mt-2 w-full">
                Centrar foto seleccionada
              </button>
            </div>
          </Section>

          <Section title="Datos principales">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Operación"><input className="vai-input" value={data.operation} onChange={(event) => updateData("operation", event.target.value)} /></Field>
              <Field label="Ubicación"><input className="vai-input" value={data.location} onChange={(event) => updateData("location", event.target.value)} /></Field>
            </div>
            <Field label="Título principal"><input className="vai-input" value={data.title} onChange={(event) => updateData("title", event.target.value)} maxLength={70} /></Field>
            <div className="grid grid-cols-[90px_1fr] gap-2">
              <Field label="Moneda"><input className="vai-input" value={data.currency} onChange={(event) => updateData("currency", event.target.value)} /></Field>
              <Field label="Precio"><input className="vai-input" value={data.price} onChange={(event) => updateData("price", event.target.value)} /></Field>
            </div>
            <Field label="Precio anterior"><input className="vai-input" value={data.oldPrice} onChange={(event) => updateData("oldPrice", event.target.value)} /></Field>
            <Field label="Texto destacado"><input className="vai-input" value={data.highlight} onChange={(event) => updateData("highlight", event.target.value)} maxLength={90} /></Field>
          </Section>

          <Section title="Características">
            <div className="grid grid-cols-3 gap-2">
              <Field label="Ambientes"><input className="vai-input" value={data.ambients} onChange={(event) => updateData("ambients", event.target.value)} /></Field>
              <Field label="Dormitorios"><input className="vai-input" value={data.bedrooms} onChange={(event) => updateData("bedrooms", event.target.value)} /></Field>
              <Field label="Baños"><input className="vai-input" value={data.bathrooms} onChange={(event) => updateData("bathrooms", event.target.value)} /></Field>
              <Field label="Cocheras"><input className="vai-input" value={data.garages} onChange={(event) => updateData("garages", event.target.value)} /></Field>
              <Field label="m² cubiertos"><input className="vai-input" value={data.coveredArea} onChange={(event) => updateData("coveredArea", event.target.value)} /></Field>
              <Field label="m² totales"><input className="vai-input" value={data.totalArea} onChange={(event) => updateData("totalArea", event.target.value)} /></Field>
            </div>
            <Toggle label="Piscina" value={data.hasPool} onChange={(value) => updateData("hasPool", value)} />
          </Section>

          <Section title="Sello y visibilidad">
            <Field label="Estado / sello">
              <select className="vai-input" value={data.status} onChange={(event) => updateData("status", event.target.value as PropertyStatus)}>
                {STATUS_OPTIONS.map((status) => <option key={status || "none"} value={status}>{status || "Sin sello"}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Toggle label="Mostrar sello" value={data.showStatus} onChange={(value) => updateData("showStatus", value)} />
              <Toggle label="Precio" value={data.showPrice} onChange={(value) => updateData("showPrice", value)} />
              <Toggle label="Precio anterior" value={data.showOldPrice} onChange={(value) => updateData("showOldPrice", value)} />
              <Toggle label="Ubicación" value={data.showLocation} onChange={(value) => updateData("showLocation", value)} />
              <Toggle label="Características" value={data.showFeatures} onChange={(value) => updateData("showFeatures", value)} />
              <Toggle label="Pie profesional" value={data.showFooter} onChange={(value) => updateData("showFooter", value)} />
              <Toggle label="Logo" value={data.showLogo} onChange={(value) => updateData("showLogo", value)} />
            </div>
          </Section>

          <Section title="Colores">
            <div className="grid grid-cols-2 gap-3">
              <ColorInput label="Principal" value={data.primaryColor} onChange={(value) => updateData("primaryColor", value)} />
              <ColorInput label="Secundario" value={data.secondaryColor} onChange={(value) => updateData("secondaryColor", value)} />
            </div>
            <button type="button" className="vai-secondary w-full" onClick={() => updateData("primaryColor", brand.primaryColor)}>
              Restaurar color corporativo
            </button>
          </Section>

          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={exporting || !canvasReady} className="vai-primary" onClick={() => void download("png")}>Descargar PNG</button>
            <button type="button" disabled={exporting || !canvasReady} className="vai-secondary" onClick={() => void download("jpeg")}>Descargar JPG</button>
          </div>

          {message ? <div className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700">{message}</div> : null}
        </aside>

        <main className="xl:sticky xl:top-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-100 p-4 shadow-inner">
            <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
              <span>Vista previa interactiva</span>
              <span>{size.width} × {size.height}px</span>
            </div>
            <div className="overflow-auto">
              <div style={{ width: size.width * previewScale, height: size.height * previewScale }}>
                <div style={{ transform: `scale(${previewScale})`, transformOrigin: "top left", width: size.width, height: size.height }}>
                  <canvas ref={htmlCanvasRef} />
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              La vista previa acompaña el scroll. Las fotos se pueden seleccionar y desplazar dentro de sus marcos.
            </p>
          </div>
        </main>
      </div>

      <style jsx global>{`
        .vai-input { width:100%; border:1px solid #cbd5e1; border-radius:.75rem; padding:.65rem .75rem; font-size:.875rem; background:white; }
        .vai-input:focus { outline:none; border-color:#0f172a; box-shadow:0 0 0 2px rgba(15,23,42,.08); }
        .vai-primary { border-radius:.8rem; background:#0f172a; color:white; padding:.8rem 1rem; font-weight:700; font-size:.875rem; }
        .vai-primary:disabled { opacity:.55; }
        .vai-secondary { border-radius:.8rem; border:1px solid #cbd5e1; background:white; color:#0f172a; padding:.8rem 1rem; font-weight:700; font-size:.875rem; }
        .vai-secondary:disabled { opacity:.5; }
        .vai-mini { height:1.8rem; min-width:1.8rem; border-radius:.45rem; border:1px solid #cbd5e1; background:white; font-weight:700; }
        .canvas-container { box-shadow:0 18px 45px rgba(15,23,42,.18); background:white; }
      `}</style>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 border-b border-slate-100 pb-4 last:border-0">
      <h2 className="text-sm font-bold text-slate-950">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 text-xs text-slate-700">
      <input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="text-xs font-semibold text-slate-600">
      {label}
      <div className="mt-1 flex items-center gap-2">
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-12 rounded border" />
        <input className="vai-input" value={value} onChange={(event) => onChange(event.target.value)} />
      </div>
    </label>
  );
}
