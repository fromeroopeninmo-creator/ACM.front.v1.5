"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toJpeg, toPng } from "html-to-image";
import { supabase } from "#lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import type {
  BrandData,
  ImagePosition,
  LocalImage,
  PlateFormat,
  PlateState,
  PlateTemplateId,
  PropertyStatus,
} from "./types";

const MAX_IMAGES = 4;
const MAX_FILE_MB = 12;

const FORMAT_SIZE: Record<PlateFormat, { width: number; height: number; label: string }> = {
  square: { width: 1080, height: 1080, label: "Cuadrado 1080 × 1080" },
  story: { width: 1080, height: 1920, label: "Historia 1080 × 1920" },
  landscape: { width: 1200, height: 628, label: "Horizontal 1200 × 628" },
};

const TEMPLATE_OPTIONS: Array<{ id: PlateTemplateId; name: string; detail: string }> = [
  { id: "hero", name: "Foto protagonista", detail: "Imagen completa con datos en overlay" },
  { id: "bottom", name: "Ficha inferior", detail: "Foto amplia con bloque informativo al pie" },
  { id: "side", name: "Lateral corporativa", detail: "Panel lateral con look más editorial" },
  { id: "mosaic2", name: "Mosaico 2 fotos", detail: "Principal + secundaria" },
  { id: "mosaic3", name: "Mosaico 3 fotos", detail: "Principal + 2 detalles" },
  { id: "minimal", name: "Minimal", detail: "Estilo limpio, elegante y aireado" },
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

const DEFAULT_STATE: PlateState = {
  format: "square",
  templateId: "hero",
  images: [],
  importedPlate: null,
  useImportedPlateMode: false,
  imagePosition: "center",
  imageZoom: 1,
  operation: "VENTA",
  title: "CASA EN VENTA",
  currency: "USD",
  price: "120.000",
  oldPrice: "135.000",
  location: "Córdoba Capital",
  bedrooms: "3",
  bathrooms: "2",
  garages: "1",
  coveredArea: "160",
  totalArea: "300",
  highlight: "Diseño, ubicación y oportunidad",
  status: "",
  showStatus: false,
  showPrice: true,
  showOldPrice: false,
  showLocation: true,
  showFeatures: true,
  showFooter: true,
  showLogo: true,
  primaryColor: "#2563eb",
  secondaryColor: "#111827",
};

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}

function formatPrice(currency: string, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "Consultar";
  return `${currency.trim() || "USD"} ${trimmed}`;
}

function objectPosition(position: ImagePosition): string {
  switch (position) {
    case "top":
      return "center top";
    case "bottom":
      return "center bottom";
    case "left":
      return "left center";
    case "right":
      return "right center";
    default:
      return "center center";
  }
}

function assetUrl(url?: string | null): string | null {
  if (!url) return null;
  return url;
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

export default function PlateEditor({ mode }: { mode: "empresa" | "asesor" }) {
  const { user } = useAuth();
  const { primaryColor: themeColor, logoUrl: themeLogo } = useTheme();

  const canvasRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<PlateState>(DEFAULT_STATE);
  const [brand, setBrand] = useState<BrandData>({
    companyName: "VAI Prop",
    professionalName: "Profesional inmobiliario",
    license: "",
    phone: "",
    logoUrl: null,
    primaryColor: themeColor || DEFAULT_STATE.primaryColor,
  });
  const [loadingBrand, setLoadingBrand] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setState((prev) => ({ ...prev, primaryColor: themeColor || prev.primaryColor }));
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
          const { data, error } = await supabase
            .from("empresas")
            .select("id, nombre_comercial, matriculado, cpi, telefono, logo_url, color")
            .eq("id", profile.empresa_id)
            .maybeSingle();
          if (error) throw error;
          company = data;
        } else {
          const { data, error } = await supabase
            .from("empresas")
            .select("id, nombre_comercial, matriculado, cpi, telefono, logo_url, color")
            .or(`user_id.eq.${user.id},id_usuario.eq.${user.id}`)
            .limit(1)
            .maybeSingle();
          if (error) throw error;
          company = data;
        }

        if (!active) return;

        const professionalName =
          mode === "asesor"
            ? `${profile.nombre || ""} ${profile.apellido || ""}`.trim()
            : String(
                company?.matriculado ||
                  profile.matriculado_nombre ||
                  company?.nombre_comercial ||
                  "Profesional inmobiliario",
              );

        const license = [company?.matriculado, company?.cpi].filter(Boolean).join(" · ");
        const nextColor = company?.color || themeColor || DEFAULT_STATE.primaryColor;

        setBrand({
          companyName: company?.nombre_comercial || profile.inmobiliaria || "VAI Prop",
          professionalName,
          license,
          phone:
            mode === "asesor"
              ? profile.telefono || company?.telefono || ""
              : company?.telefono || profile.telefono || "",
          logoUrl: assetUrl(company?.logo_url || themeLogo),
          primaryColor: nextColor,
        });

        setState((prev) => ({ ...prev, primaryColor: nextColor }));
      } catch (error) {
        console.error("Error cargando identidad del creador de placas:", error);
        setMessage(
          "No se pudo cargar toda la identidad corporativa. Podés continuar editando manualmente.",
        );
      } finally {
        if (active) setLoadingBrand(false);
      }
    };

    void loadBrand();
    return () => {
      active = false;
    };
  }, [mode, themeColor, themeLogo, user]);

  const size = FORMAT_SIZE[state.format];
  const scale = useMemo(() => {
    const maxPreviewWidth = state.format === "story" ? 430 : 760;
    return Math.min(1, maxPreviewWidth / size.width);
  }, [size.width, state.format]);

  const footerText = [brand.professionalName, brand.license].filter(Boolean).join(" · ");
  const priceText = formatPrice(state.currency, state.price);
  const oldPriceText = formatPrice(state.currency, state.oldPrice);

  const update = <K extends keyof PlateState>(key: K, value: PlateState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

  const handleImages = async (files: FileList | null, imported = false) => {
    if (!files?.length) return;

    const accepted = Array.from(files).filter((file) => {
      if (!file.type.startsWith("image/")) return false;
      if (file.size > MAX_FILE_MB * 1024 * 1024) return false;
      return true;
    });

    if (!accepted.length) {
      setMessage(`Solo se aceptan imágenes de hasta ${MAX_FILE_MB} MB.`);
      return;
    }

    try {
      if (imported) {
        const file = accepted[0];
        const dataUrl = await fileToDataUrl(file);
        setState((prev) => ({
          ...prev,
          importedPlate: { id: crypto.randomUUID(), name: file.name, url: dataUrl },
          useImportedPlateMode: true,
        }));
        return;
      }

      const next = await Promise.all(
        accepted.slice(0, MAX_IMAGES).map(async (file) => ({
          id: crypto.randomUUID(),
          name: file.name,
          url: await fileToDataUrl(file),
        })),
      );

      setState((prev) => ({ ...prev, images: next, useImportedPlateMode: false }));
      setMessage(null);
    } catch (error) {
      console.error("Error leyendo imágenes:", error);
      setMessage("No se pudo leer una de las imágenes seleccionadas.");
    }
  };

  const removeImage = (id: string) => {
    setState((prev) => ({ ...prev, images: prev.images.filter((image) => image.id !== id) }));
  };

  const moveImage = (index: number, direction: -1 | 1) => {
    setState((prev) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.images.length) return prev;
      const next = [...prev.images];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return { ...prev, images: next };
    });
  };

  const download = async (kind: "png" | "jpg") => {
    if (!canvasRef.current) return;

    setExporting(true);
    setMessage("Generando placa...");

    try {
      const common = {
        cacheBust: true,
        width: size.width,
        height: size.height,
        pixelRatio: 2,
        canvasWidth: size.width,
        canvasHeight: size.height,
        skipFonts: false,
      };

      const dataUrl =
        kind === "png"
          ? await toPng(canvasRef.current, common)
          : await toJpeg(canvasRef.current, {
              ...common,
              quality: 0.94,
              backgroundColor: "#ffffff",
            });

      const link = document.createElement("a");
      link.download = `${safeFileName(state.title)}-${state.format}.${kind === "png" ? "png" : "jpg"}`;
      link.href = dataUrl;
      link.click();

      setMessage("Placa descargada correctamente.");
    } catch (error) {
      console.error("Error exportando placa:", error);
      setMessage("No se pudo generar la imagen. Probá con imágenes más livianas o volvé a cargarlas.");
    } finally {
      setExporting(false);
      window.setTimeout(() => setMessage(null), 3500);
    }
  };

  const renderImage = (image: LocalImage | undefined, className = "") => (
    <div className={`relative overflow-hidden bg-slate-200 ${className}`}>
      {image ? (
        <>
          <img
            src={image.url}
            alt="Propiedad"
            className="absolute inset-0 h-full w-full object-cover opacity-25 blur-xl scale-110"
            style={{ objectPosition: objectPosition(state.imagePosition) }}
          />
          <img
            src={image.url}
            alt="Propiedad"
            className="relative h-full w-full object-contain"
            style={{
              objectPosition: objectPosition(state.imagePosition),
              transform: `scale(${state.imageZoom})`,
              transformOrigin: "center center",
            }}
          />
        </>
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300 text-center font-semibold text-slate-500">
          Cargá una foto de la propiedad
        </div>
      )}
    </div>
  );

  const StatusStamp = () =>
    state.showStatus && state.status ? (
      <div
        className="absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 rotate-[-10deg] rounded-2xl border-[8px] px-10 py-5 text-center text-4xl font-black uppercase tracking-[0.22em] shadow-2xl"
        style={{
          borderColor: state.primaryColor,
          color: state.primaryColor,
          backgroundColor: "rgba(255,255,255,.88)",
        }}
      >
        {state.status}
      </div>
    ) : null;

  const PriceBlock = ({ dark = false }: { dark?: boolean }) =>
    state.showPrice ? (
      <div className="space-y-1">
        {state.showOldPrice && state.oldPrice ? (
          <div className={`text-lg font-bold line-through opacity-70 ${dark ? "text-white" : "text-slate-600"}`}>
            {oldPriceText}
          </div>
        ) : null}
        <div className={`text-4xl font-black leading-none ${dark ? "text-white" : "text-slate-950"}`}>
          {priceText}
        </div>
      </div>
    ) : null;

  const FeatureLine = ({ dark = false }: { dark?: boolean }) => {
    if (!state.showFeatures) return null;
    const items = [
      state.bedrooms && `${state.bedrooms} dorm.`,
      state.bathrooms && `${state.bathrooms} baños`,
      state.garages && `${state.garages} coch.`,
      state.coveredArea && `${state.coveredArea} m² cub.`,
      state.totalArea && `${state.totalArea} m² tot.`,
    ].filter(Boolean);

    if (!items.length) return null;

    return <div className={`text-lg font-semibold ${dark ? "text-white/90" : "text-slate-700"}`}>{items.join("  •  ")}</div>;
  };

  const Footer = ({ dark = false }: { dark?: boolean }) =>
    state.showFooter ? (
      <div className={`flex items-center justify-between gap-5 border-t pt-4 ${dark ? "border-white/30 text-white" : "border-slate-300 text-slate-800"}`}>
        <div className="min-w-0">
          <div className="truncate text-lg font-bold">{footerText || brand.companyName}</div>
          {brand.phone ? <div className="text-base opacity-80">{brand.phone}</div> : null}
        </div>
        {state.showLogo && brand.logoUrl ? (
          <img src={brand.logoUrl} alt={brand.companyName} className="max-h-12 max-w-[120px] object-contain" />
        ) : null}
      </div>
    ) : null;

  const commonInfo = (dark = false) => (
    <div className="space-y-4">
      <div className="text-lg font-black uppercase tracking-[0.18em]" style={{ color: state.primaryColor }}>
        {state.operation}
      </div>
      <h2 className={`text-5xl font-black uppercase leading-[0.98] ${dark ? "text-white" : "text-slate-950"}`}>{state.title}</h2>
      {state.showLocation && state.location ? (
        <div className={`text-2xl font-semibold ${dark ? "text-white/90" : "text-slate-700"}`}>📍 {state.location}</div>
      ) : null}
      <FeatureLine dark={dark} />
      {state.highlight ? <div className={`text-xl ${dark ? "text-white/80" : "text-slate-600"}`}>{state.highlight}</div> : null}
    </div>
  );

  const renderTemplate = () => {
    const images = state.images;

    if (state.useImportedPlateMode && state.importedPlate) {
      return (
        <div className="relative h-full w-full overflow-hidden bg-black">
          <img src={state.importedPlate.url} alt="Placa importada" className="h-full w-full object-cover" />
          <StatusStamp />
        </div>
      );
    }

    switch (state.templateId) {
      case "bottom":
        return (
          <div className="relative flex h-full w-full flex-col bg-white">
            {renderImage(images[0], "h-[66%] w-full")}
            <div className="flex flex-1 flex-col justify-between px-[5%] py-[4%]">
              <div className="flex items-start justify-between gap-8">
                <div className="max-w-[65%]">{commonInfo(false)}</div>
                <PriceBlock />
              </div>
              <Footer />
            </div>
            <StatusStamp />
          </div>
        );
      case "side":
        return (
          <div className="relative flex h-full w-full bg-white">
            {renderImage(images[0], "h-full w-[66%]")}
            <div className="flex w-[34%] flex-col justify-between p-[4%]" style={{ backgroundColor: state.secondaryColor, color: "white" }}>
              <div>{commonInfo(true)}</div>
              <div className="space-y-6">
                <PriceBlock dark />
                <Footer dark />
              </div>
            </div>
            <StatusStamp />
          </div>
        );
      case "mosaic2":
        return (
          <div className="relative h-full w-full bg-white">
            <div className="grid h-[70%] grid-cols-[2fr_1fr] gap-2 bg-white">
              {renderImage(images[0], "h-full")}
              {renderImage(images[1], "h-full")}
            </div>
            <div className="flex h-[30%] items-center justify-between gap-8 px-[5%] py-[3%]">
              <div className="max-w-[65%]">{commonInfo(false)}</div>
              <div className="space-y-5">
                <PriceBlock />
                <Footer />
              </div>
            </div>
            <StatusStamp />
          </div>
        );
      case "mosaic3":
        return (
          <div className="relative h-full w-full bg-white">
            <div className="grid h-[68%] grid-cols-[1.7fr_1fr] grid-rows-2 gap-2 bg-white">
              {renderImage(images[0], "row-span-2 h-full")}
              {renderImage(images[1], "h-full")}
              {renderImage(images[2], "h-full")}
            </div>
            <div className="flex h-[32%] items-center justify-between gap-8 px-[5%] py-[3%]">
              <div className="max-w-[65%]">{commonInfo(false)}</div>
              <div className="space-y-4">
                <PriceBlock />
                <Footer />
              </div>
            </div>
            <StatusStamp />
          </div>
        );
      case "minimal":
        return (
          <div className="relative flex h-full w-full flex-col bg-[#f7f7f4] p-[5%]">
            <div className="mb-[3%] flex items-center justify-between">
              <div className="text-2xl font-black uppercase tracking-[0.25em]" style={{ color: state.primaryColor }}>
                {state.operation}
              </div>
              {state.showLogo && brand.logoUrl ? (
                <img src={brand.logoUrl} alt={brand.companyName} className="max-h-12 max-w-[120px] object-contain" />
              ) : null}
            </div>
            {renderImage(images[0], "min-h-0 flex-1 rounded-[28px]")}
            <div className="grid grid-cols-[1fr_auto] items-end gap-10 pt-[4%]">
              <div>{commonInfo(false)}</div>
              <PriceBlock />
            </div>
            <div className="pt-[3%]">
              <Footer />
            </div>
            <StatusStamp />
          </div>
        );
      case "hero":
      default:
        return (
          <div className="relative h-full w-full overflow-hidden bg-black">
            {renderImage(images[0], "absolute inset-0 h-full w-full")}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent" />
            <div className="absolute inset-x-[5%] bottom-[5%] z-10 space-y-6">
              <div className="flex items-end justify-between gap-10">
                <div className="max-w-[68%]">{commonInfo(true)}</div>
                <PriceBlock dark />
              </div>
              <Footer dark />
            </div>
            <StatusStamp />
          </div>
        );
    }
  };

  return (
    <div className="space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">VAI Studio · acceso por URL</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950">Creador de placas inmobiliarias</h1>
        <p className="mt-1 text-sm text-slate-600">
          La propiedad es la protagonista. Las fotos y placas se procesan localmente y no se guardan.
        </p>
        {loadingBrand ? <p className="mt-2 text-xs text-slate-500">Cargando identidad corporativa...</p> : null}
      </header>

      <div className="grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
        <aside className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <Section title="Formato y plantilla">
            <select className="input" value={state.format} onChange={(e) => update("format", e.target.value as PlateFormat)}>
              {Object.entries(FORMAT_SIZE).map(([key, value]) => (
                <option key={key} value={key}>
                  {value.label}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              {TEMPLATE_OPTIONS.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => update("templateId", template.id)}
                  className={`rounded-xl border p-3 text-left ${state.templateId === template.id ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 hover:bg-slate-50"}`}
                >
                  <div className="text-sm font-bold">{template.name}</div>
                  <div className={`mt-1 text-[11px] ${state.templateId === template.id ? "text-white/70" : "text-slate-500"}`}>
                    {template.detail}
                  </div>
                </button>
              ))}
            </div>
          </Section>

          <Section title="Fotos de la propiedad">
            <input type="file" accept="image/*" multiple onChange={(e) => void handleImages(e.target.files)} className="block w-full text-sm" />
            <div className="text-xs text-slate-500">
              Hasta 4 imágenes, máximo {MAX_FILE_MB} MB cada una. Para exportar mejor, se convierten localmente y no se guardan.
            </div>
            {state.images.length > 0 ? (
              <div className="space-y-2">
                {state.images.map((image, index) => (
                  <div key={image.id} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2">
                    <img src={image.url} alt="" className="h-12 w-12 rounded object-cover" />
                    <div className="min-w-0 flex-1 truncate text-xs">{index + 1}. {image.name}</div>
                    <button type="button" onClick={() => moveImage(index, -1)} className="mini">↑</button>
                    <button type="button" onClick={() => moveImage(index, 1)} className="mini">↓</button>
                    <button type="button" onClick={() => removeImage(image.id)} className="mini">×</button>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <Field label="Encuadre">
                <select className="input" value={state.imagePosition} onChange={(e) => update("imagePosition", e.target.value as ImagePosition)}>
                  <option value="center">Centro</option>
                  <option value="top">Arriba</option>
                  <option value="bottom">Abajo</option>
                  <option value="left">Izquierda</option>
                  <option value="right">Derecha</option>
                </select>
              </Field>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Zoom manual ({state.imageZoom.toFixed(1)}x)
                <input
                  type="range"
                  min="1"
                  max="1.8"
                  step="0.1"
                  value={state.imageZoom}
                  onChange={(e) => update("imageZoom", Number(e.target.value))}
                  className="mt-2 w-full"
                />
              </label>
            </div>
          </Section>

          <Section title="Aplicar sello a una placa existente">
            <input type="file" accept="image/*" onChange={(e) => void handleImages(e.target.files, true)} className="block w-full text-sm" />
            <label className="check">
              <input type="checkbox" checked={state.useImportedPlateMode} onChange={(e) => update("useImportedPlateMode", e.target.checked)} disabled={!state.importedPlate} />
              Usar la placa importada como base
            </label>
          </Section>

          <Section title="Datos de la propiedad">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Operación">
                <input className="input" value={state.operation} onChange={(e) => update("operation", e.target.value)} placeholder="Operación" />
              </Field>
              <Field label="Ubicación">
                <input className="input" value={state.location} onChange={(e) => update("location", e.target.value)} placeholder="Ubicación" />
              </Field>
            </div>
            <Field label="Título principal">
              <input className="input" value={state.title} onChange={(e) => update("title", e.target.value)} placeholder="Título" maxLength={70} />
            </Field>
            <div className="grid grid-cols-[90px_1fr] gap-2">
              <Field label="Moneda">
                <input className="input" value={state.currency} onChange={(e) => update("currency", e.target.value)} placeholder="USD" />
              </Field>
              <Field label="Precio actual">
                <input className="input" value={state.price} onChange={(e) => update("price", e.target.value)} placeholder="Precio nuevo" />
              </Field>
            </div>
            <Field label="Precio anterior">
              <input className="input" value={state.oldPrice} onChange={(e) => update("oldPrice", e.target.value)} placeholder="Precio anterior" />
            </Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Dormitorios">
                <input className="input" value={state.bedrooms} onChange={(e) => update("bedrooms", e.target.value)} placeholder="Dorm." />
              </Field>
              <Field label="Baños">
                <input className="input" value={state.bathrooms} onChange={(e) => update("bathrooms", e.target.value)} placeholder="Baños" />
              </Field>
              <Field label="Cochera">
                <input className="input" value={state.garages} onChange={(e) => update("garages", e.target.value)} placeholder="Coch." />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="m² cubiertos">
                <input className="input" value={state.coveredArea} onChange={(e) => update("coveredArea", e.target.value)} placeholder="m² cubiertos" />
              </Field>
              <Field label="m² totales">
                <input className="input" value={state.totalArea} onChange={(e) => update("totalArea", e.target.value)} placeholder="m² totales" />
              </Field>
            </div>
            <Field label="Texto destacado">
              <input className="input" value={state.highlight} onChange={(e) => update("highlight", e.target.value)} placeholder="Texto destacado" maxLength={90} />
            </Field>
          </Section>

          <Section title="Sello y visibilidad">
            <Field label="Sello / estado">
              <select className="input" value={state.status} onChange={(e) => update("status", e.target.value as PropertyStatus)}>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status || "none"} value={status}>
                    {status || "Sin sello"}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Toggle label="Mostrar sello" value={state.showStatus} onChange={(value) => update("showStatus", value)} />
              <Toggle label="Precio" value={state.showPrice} onChange={(value) => update("showPrice", value)} />
              <Toggle label="Precio anterior" value={state.showOldPrice} onChange={(value) => update("showOldPrice", value)} />
              <Toggle label="Ubicación" value={state.showLocation} onChange={(value) => update("showLocation", value)} />
              <Toggle label="Características" value={state.showFeatures} onChange={(value) => update("showFeatures", value)} />
              <Toggle label="Pie profesional" value={state.showFooter} onChange={(value) => update("showFooter", value)} />
              <Toggle label="Logo pequeño" value={state.showLogo} onChange={(value) => update("showLogo", value)} />
            </div>
          </Section>

          <Section title="Colores">
            <div className="grid grid-cols-2 gap-3">
              <ColorInput label="Principal" value={state.primaryColor} onChange={(value) => update("primaryColor", value)} />
              <ColorInput label="Secundario" value={state.secondaryColor} onChange={(value) => update("secondaryColor", value)} />
            </div>
            <button type="button" className="secondary" onClick={() => update("primaryColor", brand.primaryColor)}>
              Restaurar color corporativo
            </button>
          </Section>

          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={exporting} onClick={() => void download("png")} className="primary">
              Descargar PNG
            </button>
            <button type="button" disabled={exporting} onClick={() => void download("jpg")} className="secondary">
              Descargar JPG
            </button>
          </div>

          {message ? <div className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700">{message}</div> : null}
        </aside>

        <main className="min-w-0 rounded-2xl border border-slate-200 bg-slate-100 p-4 shadow-inner">
          <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
            <span>Vista previa</span>
            <span>{size.width} × {size.height}px</span>
          </div>
          <div className="overflow-auto">
            <div style={{ width: size.width * scale, height: size.height * scale }}>
              <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: size.width, height: size.height }}>
                <div ref={canvasRef} style={{ width: size.width, height: size.height }} className="overflow-hidden bg-white font-sans text-slate-950">
                  {renderTemplate()}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <style jsx global>{`
        .input { width:100%; border:1px solid #cbd5e1; border-radius:0.75rem; padding:0.65rem 0.75rem; font-size:0.875rem; background:white; }
        .input:focus { outline:none; border-color:#0f172a; box-shadow:0 0 0 2px rgba(15,23,42,.08); }
        .primary { border-radius:0.8rem; background:#0f172a; color:white; padding:0.8rem 1rem; font-weight:700; font-size:0.875rem; }
        .primary:disabled { opacity:.55; }
        .secondary { border-radius:0.8rem; border:1px solid #cbd5e1; background:white; color:#0f172a; padding:0.8rem 1rem; font-weight:700; font-size:0.875rem; }
        .mini { height:1.8rem; min-width:1.8rem; border-radius:.45rem; border:1px solid #cbd5e1; background:white; font-weight:700; }
        .check { display:flex; align-items:center; gap:.5rem; font-size:.82rem; color:#334155; }
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
    <label className="check rounded-lg border border-slate-200 p-2">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="text-xs font-semibold text-slate-600">
      {label}
      <div className="mt-1 flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-12 rounded border" />
        <input className="input" value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </label>
  );
}
