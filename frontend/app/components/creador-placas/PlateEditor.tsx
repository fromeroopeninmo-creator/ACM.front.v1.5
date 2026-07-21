"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { toJpeg, toPng } from "html-to-image";
import { supabase } from "#lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import type { BrandData, PlateFormat, PropertyData, PropertyStatus } from "./types";

const MAX_IMAGES = 4;
const MAX_FILE_MB = 12;

const FORMATS: Record<PlateFormat, { width: number; height: number; label: string }> = {
  square: { width: 1080, height: 1080, label: "Cuadrado · 1080 × 1080" },
  story: { width: 1080, height: 1920, label: "Historia · 1080 × 1920" },
  landscape: { width: 1200, height: 628, label: "Horizontal · 1200 × 628" },
};

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
  primaryColor: "#123f91",
  secondaryColor: "#8dc5ff",
  accentColor: "#ffffff",
};

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

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
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

function formatPrice(currency: string, price: string): string {
  return price.trim() ? `${currency.trim() || "USD"} ${price.trim()}` : "CONSULTAR";
}

export default function PlateEditor({ mode }: { mode: "empresa" | "asesor" }) {
  const { user } = useAuth();
  const { primaryColor: themeColor, logoUrl: themeLogo } = useTheme();
  const plateRef = useRef<HTMLDivElement | null>(null);
  const [format, setFormat] = useState<PlateFormat>("square");
  const [data, setData] = useState<PropertyData>(DEFAULT_DATA);
  const [images, setImages] = useState<string[]>([]);
  const [positions, setPositions] = useState([50, 50, 50, 50]);
  const [brand, setBrand] = useState<BrandData>({
    companyName: "VAI Prop",
    professionalName: "Profesional inmobiliario",
    license: "",
    phone: "",
    logoUrl: null,
    primaryColor: themeColor || DEFAULT_DATA.primaryColor,
  });
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(true);

  const size = FORMATS[format];
  const footerText = [brand.companyName, brand.professionalName, brand.license].filter(Boolean).join(" - ");
  const features = useMemo(
    () => [
      data.coveredArea && `${data.coveredArea} M² CUB`,
      data.totalArea && `TERRENO ${data.totalArea} M²`,
      data.bathrooms && `${data.bathrooms} BAÑOS`,
      data.bedrooms && `${data.bedrooms} DORMITORIOS`,
      data.garages && `${data.garages} COCHERAS`,
      data.hasPool ? "PILETA" : "",
    ].filter(Boolean),
    [data],
  );

  const updateData = <K extends keyof PropertyData>(key: K, value: PropertyData[K]) => {
    setData((previous) => ({ ...previous, [key]: value }));
  };

  useEffect(() => {
    setData((previous) => ({ ...previous, primaryColor: themeColor || previous.primaryColor }));
  }, [themeColor]);

  useEffect(() => {
    let active = true;
    const loadBrand = async () => {
      if (!user?.id) return;
      try {
        const profile = user as any;
        let company: any = null;
        if (mode === "asesor" && profile.empresa_id) {
          const result = await supabase
            .from("empresas")
            .select("id, nombre_comercial, matriculado, cpi, telefono, logo_url, color")
            .eq("id", profile.empresa_id)
            .maybeSingle();
          if (result.error) throw result.error;
          company = result.data;
        } else {
          const result = await supabase
            .from("empresas")
            .select("id, nombre_comercial, matriculado, cpi, telefono, logo_url, color")
            .or(`user_id.eq.${user.id},id_usuario.eq.${user.id}`)
            .limit(1)
            .maybeSingle();
          if (result.error) throw result.error;
          company = result.data;
        }
        if (!active) return;
        const profileName = `${profile?.nombre || ""} ${profile?.apellido || ""}`.trim();
        const nextColor = company?.color || themeColor || DEFAULT_DATA.primaryColor;
        const nextBrand: BrandData = {
          companyName: company?.nombre_comercial || profile?.inmobiliaria || "VAI Prop",
          professionalName:
            profileName || normalizeProfessionalName(company?.matriculado || profile?.matriculado_nombre) || "Profesional inmobiliario",
          license: formatLicense(company?.cpi || profile?.cpi || ""),
          phone: mode === "asesor" ? profile?.telefono || company?.telefono || "" : company?.telefono || profile?.telefono || "",
          logoUrl: company?.logo_url || themeLogo || null,
          primaryColor: nextColor,
        };
        setBrand(nextBrand);
        setData((previous) => ({ ...previous, primaryColor: nextColor }));
        setLogoDataUrl(await remoteImageToDataUrl(nextBrand.logoUrl));
      } catch (error) {
        console.error("Error cargando identidad corporativa:", error);
        setMessage("No se pudo cargar toda la identidad corporativa. Podés continuar igualmente.");
      }
    };
    void loadBrand();
    return () => {
      active = false;
    };
  }, [mode, themeColor, themeLogo, user]);

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const selected = Array.from(files).slice(0, MAX_IMAGES);
    for (const file of selected) {
      if (!file.type.startsWith("image/")) {
        setMessage("Solo se permiten imágenes JPG, PNG o WEBP.");
        return;
      }
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        setMessage(`Cada imagen puede pesar hasta ${MAX_FILE_MB} MB.`);
        return;
      }
    }
    try {
      setImages(await Promise.all(selected.map(fileToDataUrl)));
      setMessage(null);
    } catch {
      setMessage("No se pudieron leer una o más imágenes.");
    }
  };

  const exportPlate = async (kind: "png" | "jpg") => {
    if (!plateRef.current) return;
    setExporting(true);
    setMessage(null);
    try {
      const options = {
        width: size.width,
        height: size.height,
        pixelRatio: 1,
        cacheBust: true,
        backgroundColor: data.accentColor,
      };
      const url = kind === "png" ? await toPng(plateRef.current, options) : await toJpeg(plateRef.current, { ...options, quality: 0.94 });
      const link = document.createElement("a");
      link.download = `${safeFileName(data.title)}-${format}.${kind === "jpg" ? "jpg" : "png"}`;
      link.href = url;
      link.click();
    } catch (error) {
      console.error("Error exportando placa:", error);
      setMessage("No se pudo exportar. Revisá que las imágenes hayan cargado correctamente.");
    } finally {
      setExporting(false);
    }
  };

  const photo = (slot: number, className: string) => (
    <div className={className}>
      {images[slot] ? (
        <img src={images[slot]} alt={`Foto ${slot + 1}`} style={{ objectPosition: `50% ${positions[slot]}%` }} />
      ) : (
        <span>FOTO {slot + 1}</span>
      )}
    </div>
  );

  return (
    <main className="plate-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">VAI Studio</p>
          <h1>Creador de placas</h1>
          <p>Primera plantilla profesional controlada. Fotos y colores editables sin romper la composición.</p>
        </div>
      </header>

      {message && <div className="notice">{message}</div>}

      <div className="editor-grid">
        <section className="controls-card">
          <div className="section-block">
            <h2>Formato</h2>
            <div className="button-grid three">
              {(Object.keys(FORMATS) as PlateFormat[]).map((item) => (
                <button key={item} type="button" className={format === item ? "active" : ""} onClick={() => setFormat(item)}>
                  {FORMATS[item].label.split(" · ")[0]}
                </button>
              ))}
            </div>
          </div>

          <div className="section-block">
            <h2>Fotos</h2>
            <label className="upload-box">
              <strong>Cargar hasta 4 fotos</strong>
              <span>JPG, PNG o WEBP · máximo {MAX_FILE_MB} MB cada una</span>
              <input type="file" accept="image/*" multiple onChange={(event) => void handleFiles(event.target.files)} />
            </label>
            {images.length > 0 && (
              <div className="photo-controls">
                {images.map((image, index) => (
                  <div className="photo-row" key={`${image.slice(0, 24)}-${index}`}>
                    <img src={image} alt="" />
                    <label>
                      Encuadre foto {index + 1}
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={positions[index]}
                        onChange={(event) => setPositions((previous) => previous.map((value, i) => (i === index ? Number(event.target.value) : value)))}
                      />
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="section-block">
            <h2>Propiedad</h2>
            <div className="field-grid">
              <label>Operación<input value={data.operation} onChange={(e) => updateData("operation", e.target.value.toUpperCase())} /></label>
              <label>Título<input value={data.title} onChange={(e) => updateData("title", e.target.value.toUpperCase())} /></label>
              <label>Moneda<input value={data.currency} onChange={(e) => updateData("currency", e.target.value.toUpperCase())} /></label>
              <label>Precio<input value={data.price} onChange={(e) => updateData("price", e.target.value)} /></label>
              <label className="wide">Ubicación<input value={data.location} onChange={(e) => updateData("location", e.target.value)} /></label>
              <label>Ambientes<input value={data.ambients} onChange={(e) => updateData("ambients", e.target.value)} /></label>
              <label>Dormitorios<input value={data.bedrooms} onChange={(e) => updateData("bedrooms", e.target.value)} /></label>
              <label>Baños<input value={data.bathrooms} onChange={(e) => updateData("bathrooms", e.target.value)} /></label>
              <label>Cocheras<input value={data.garages} onChange={(e) => updateData("garages", e.target.value)} /></label>
              <label>M² cubiertos<input value={data.coveredArea} onChange={(e) => updateData("coveredArea", e.target.value)} /></label>
              <label>M² totales<input value={data.totalArea} onChange={(e) => updateData("totalArea", e.target.value)} /></label>
            </div>
          </div>

          <div className="section-block">
            <h2>Colores</h2>
            <div className="color-grid">
              <label>Principal<input type="color" value={data.primaryColor} onChange={(e) => updateData("primaryColor", e.target.value)} /></label>
              <label>Secundario<input type="color" value={data.secondaryColor} onChange={(e) => updateData("secondaryColor", e.target.value)} /></label>
              <label>Fondo<input type="color" value={data.accentColor} onChange={(e) => updateData("accentColor", e.target.value)} /></label>
            </div>
          </div>

          <div className="section-block">
            <h2>Estado y visibilidad</h2>
            <label className="wide-label">Estado<select value={data.status} onChange={(e) => updateData("status", e.target.value as PropertyStatus)}>{STATUS_OPTIONS.map((status) => <option key={status || "none"} value={status}>{status || "Sin estado"}</option>)}</select></label>
            <div className="checks">
              {([
                ["showStatus", "Mostrar estado"], ["showPrice", "Mostrar precio"], ["showLocation", "Mostrar ubicación"],
                ["showFeatures", "Mostrar características"], ["showFooter", "Mostrar pie"], ["showLogo", "Mostrar logo"],
              ] as Array<[keyof PropertyData, string]>).map(([key, label]) => (
                <label key={key}><input type="checkbox" checked={Boolean(data[key])} onChange={(e) => updateData(key, e.target.checked as never)} />{label}</label>
              ))}
            </div>
          </div>
        </section>

        <section className="preview-column">
          <button type="button" className="mobile-preview-toggle" onClick={() => setMobilePreviewOpen((value) => !value)}>
            {mobilePreviewOpen ? "Ocultar vista previa" : "Mostrar vista previa"}
          </button>
          <div className={`preview-sticky ${mobilePreviewOpen ? "open" : "closed"}`}>
            <div className="preview-shell">
              <div className="plate-scaler" style={{ aspectRatio: `${size.width}/${size.height}` }}>
                <div
                  ref={plateRef}
                  className={`plate plate-${format}`}
                  style={{
                    width: size.width,
                    height: size.height,
                    transform: `scale(var(--plate-scale))`,
                    transformOrigin: "top left",
                    "--primary": data.primaryColor,
                    "--secondary": data.secondaryColor,
                    "--accent": data.accentColor,
                  } as CSSProperties & Record<"--primary" | "--secondary" | "--accent", string>}
                >
                  <div className="plate-bg" />
                  {photo(0, "main-photo")}
                  <div className="top-wave" />
                  <div className="bottom-wave" />
                  <div className="operation-pill">{data.operation || "VENTA"}</div>
                  <div className="title-block"><h3>{data.title || "PROPIEDAD"}</h3></div>
                  {data.showPrice && <div className="price-pill">{formatPrice(data.currency, data.price)}</div>}
                  <div className="circle-gallery">
                    {photo(1, "circle-photo circle-one")}
                    {photo(2, "circle-photo circle-two")}
                    {photo(3, "circle-photo circle-three")}
                  </div>
                  {data.showFeatures && (
                    <div className="feature-card">
                      {features.slice(0, 4).map((feature, index) => <div className="feature" key={`${feature}-${index}`}><span className="feature-icon">◆</span><b>{feature}</b></div>)}
                    </div>
                  )}
                  {data.showLocation && <div className="location-badge">⌖ {data.location}</div>}
                  {data.showStatus && data.status && <div className="status-stamp">{data.status}</div>}
                  {data.showFooter && (
                    <div className="brand-footer">
                      {data.showLogo && logoDataUrl ? <img src={logoDataUrl} alt={brand.companyName} /> : <div className="logo-fallback">{brand.companyName.slice(0, 2).toUpperCase()}</div>}
                      <div><strong>{footerText}</strong>{brand.phone && <span>{brand.phone}</span>}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="export-actions">
              <button type="button" disabled={exporting} onClick={() => void exportPlate("png")}>Descargar PNG</button>
              <button type="button" className="secondary" disabled={exporting} onClick={() => void exportPlate("jpg")}>Descargar JPG</button>
            </div>
          </div>
        </section>
      </div>

      <style jsx>{`
        :global(html), :global(body) { max-width: 100%; overflow-x: clip; }
        .plate-page { width: 100%; max-width: 1600px; margin: 0 auto; padding: 24px; overflow: visible; }
        .page-header { margin-bottom: 20px; }
        .eyebrow { margin: 0 0 4px; color: #b68224; font-weight: 800; text-transform: uppercase; letter-spacing: .12em; font-size: 12px; }
        h1 { margin: 0; font-size: clamp(26px, 3vw, 38px); }
        .page-header p:last-child { color: #64748b; margin: 6px 0 0; }
        .notice { margin-bottom: 16px; padding: 12px 14px; border-radius: 12px; background: #fff7ed; border: 1px solid #fed7aa; }
        .editor-grid { display: grid; grid-template-columns: minmax(340px, 440px) minmax(0, 1fr); align-items: start; gap: 24px; overflow: visible; }
        .controls-card { min-width: 0; background: white; border: 1px solid #e2e8f0; border-radius: 18px; padding: 18px; box-shadow: 0 12px 32px rgba(15,23,42,.07); }
        .section-block + .section-block { border-top: 1px solid #e2e8f0; margin-top: 18px; padding-top: 18px; }
        h2 { margin: 0 0 12px; font-size: 16px; }
        .button-grid { display: grid; gap: 8px; }
        .button-grid.three { grid-template-columns: repeat(3, 1fr); }
        button { border: 1px solid #cbd5e1; border-radius: 10px; background: white; padding: 10px 12px; font-weight: 700; cursor: pointer; }
        button.active, .export-actions button { background: #111827; color: white; border-color: #111827; }
        button:disabled { opacity: .6; cursor: wait; }
        .upload-box { display: flex; flex-direction: column; gap: 4px; border: 1px dashed #94a3b8; border-radius: 12px; padding: 14px; cursor: pointer; }
        .upload-box span { font-size: 12px; color: #64748b; }
        .upload-box input { margin-top: 8px; max-width: 100%; }
        .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .field-grid label, .wide-label { display: flex; flex-direction: column; gap: 5px; font-size: 12px; font-weight: 700; color: #475569; }
        .field-grid .wide { grid-column: 1 / -1; }
        input, select { width: 100%; min-width: 0; border: 1px solid #cbd5e1; border-radius: 9px; padding: 10px; background: white; color: #0f172a; }
        .color-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px; }
        .color-grid label { font-size: 11px; font-weight: 700; color: #475569; }
        .color-grid input { padding: 3px; height: 42px; }
        .checks { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; }
        .checks label { display: flex; align-items: center; gap: 7px; font-size: 13px; }
        .checks input { width: auto; }
        .photo-controls { display: grid; gap: 8px; margin-top: 12px; }
        .photo-row { display: grid; grid-template-columns: 56px 1fr; align-items: center; gap: 10px; }
        .photo-row img { width: 56px; height: 44px; object-fit: cover; border-radius: 7px; }
        .photo-row label { font-size: 11px; font-weight: 700; color: #475569; }
        .photo-row input { padding: 0; }
        .preview-column { min-width: 0; align-self: stretch; overflow: visible; }
        .preview-sticky { position: sticky; top: 88px; align-self: start; width: 100%; overflow: visible; }
        .preview-shell { width: 100%; max-height: calc(100vh - 180px); display: flex; justify-content: center; align-items: flex-start; padding: 12px; border: 1px solid #e2e8f0; border-radius: 18px; background: #eef2f7; overflow: hidden; }
        .plate-scaler { position: relative; width: min(100%, 820px); max-height: calc(100vh - 205px); }
        .plate { --plate-scale: min(calc((100vw - 540px) / ${size.width}), calc((100vh - 205px) / ${size.height}), 1); position: absolute; left: 0; top: 0; overflow: hidden; background: var(--accent); font-family: Arial, sans-serif; color: #111827; }
        .plate-bg { position: absolute; inset: 0; background: var(--accent); }
        .main-photo { position: absolute; overflow: hidden; background: #dbe4ef; }
        .main-photo img, .circle-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .main-photo span, .circle-photo span { position: absolute; inset: 0; display: grid; place-items: center; color: #64748b; font-weight: 800; }
        .top-wave, .bottom-wave { position: absolute; background: var(--secondary); }
        .operation-pill { position: absolute; z-index: 5; background: var(--primary); color: white; font-weight: 900; letter-spacing: .04em; text-align: center; }
        .title-block { position: absolute; z-index: 5; color: white; font-weight: 900; text-transform: uppercase; }
        .title-block h3 { margin: 0; font-size: inherit; line-height: .95; }
        .price-pill { position: absolute; z-index: 6; background: white; color: var(--primary); font-weight: 900; box-shadow: 0 10px 22px rgba(15,23,42,.18); }
        .circle-gallery { position: absolute; z-index: 4; }
        .circle-photo { position: absolute; border-radius: 50%; overflow: hidden; border: 7px solid var(--primary); background: #dbe4ef; }
        .feature-card { position: absolute; z-index: 7; background: white; box-shadow: 0 10px 24px rgba(15,23,42,.14); display: grid; grid-template-columns: 1fr 1fr; }
        .feature { display: flex; align-items: center; gap: 12px; color: #1e293b; }
        .feature-icon { width: 34px; height: 34px; border-radius: 50%; background: var(--primary); color: white; display: grid; place-items: center; flex: 0 0 auto; }
        .location-badge { position: absolute; z-index: 8; background: rgba(255,255,255,.92); color: #172554; font-weight: 900; }
        .status-stamp { position: absolute; z-index: 10; background: #b91c1c; color: white; font-weight: 900; transform: rotate(-8deg); box-shadow: 0 8px 20px rgba(0,0,0,.25); }
        .brand-footer { position: absolute; z-index: 9; display: flex; align-items: center; gap: 12px; color: white; }
        .brand-footer img { object-fit: contain; background: rgba(255,255,255,.88); border-radius: 8px; }
        .brand-footer strong, .brand-footer span { display: block; }
        .brand-footer span { opacity: .9; margin-top: 3px; }
        .logo-fallback { display: grid; place-items: center; background: white; color: var(--primary); font-weight: 900; border-radius: 8px; }

        .plate-square .main-photo { left: 45px; top: 175px; width: 780px; height: 660px; border-radius: 0 0 55px 0; }
        .plate-square .top-wave { left: -95px; top: -60px; width: 760px; height: 290px; border-radius: 0 0 82% 0; transform: rotate(-4deg); }
        .plate-square .bottom-wave { left: -100px; bottom: -180px; width: 850px; height: 420px; border-radius: 0 95% 0 0; transform: rotate(5deg); }
        .plate-square .operation-pill { left: 62px; top: 52px; padding: 18px 28px; border-radius: 16px; font-size: 34px; }
        .plate-square .title-block { left: 65px; top: 112px; width: 470px; font-size: 49px; }
        .plate-square .price-pill { left: 62px; bottom: 188px; padding: 17px 24px; border-radius: 15px; font-size: 31px; }
        .plate-square .circle-gallery { right: 22px; top: 185px; width: 250px; height: 610px; }
        .plate-square .circle-photo { width: 210px; height: 210px; right: 0; }
        .plate-square .circle-one { top: 0; }.plate-square .circle-two { top: 185px; }.plate-square .circle-three { top: 370px; }
        .plate-square .feature-card { right: 28px; bottom: 82px; width: 560px; min-height: 150px; border-radius: 0; padding: 24px 26px; gap: 18px 26px; font-size: 20px; }
        .plate-square .location-badge { left: 65px; bottom: 125px; padding: 12px 16px; border-radius: 12px; font-size: 23px; }
        .plate-square .status-stamp { left: 410px; top: 420px; padding: 18px 34px; font-size: 42px; }
        .plate-square .brand-footer { left: 54px; bottom: 24px; width: 420px; font-size: 15px; }
        .plate-square .brand-footer img, .plate-square .logo-fallback { width: 58px; height: 58px; }

        .plate-story .main-photo { left: 300px; top: 70px; width: 735px; height: 1740px; }
        .plate-story .top-wave { left: 0; top: 0; width: 420px; height: 1920px; background: var(--primary); }
        .plate-story .bottom-wave { left: 360px; bottom: -120px; width: 850px; height: 360px; transform: skewX(-18deg); }
        .plate-story .operation-pill { left: 48px; top: 150px; width: 250px; padding: 18px 10px; border: 3px solid var(--secondary); font-size: 34px; }
        .plate-story .title-block { left: 48px; top: 245px; width: 275px; font-size: 58px; }
        .plate-story .price-pill { left: 48px; top: 650px; width: 280px; padding: 18px 14px; font-size: 39px; background: var(--secondary); color: var(--primary); }
        .plate-story .circle-gallery { left: 720px; top: 745px; width: 300px; height: 930px; }
        .plate-story .circle-photo { width: 260px; height: 260px; right: 0; border-color: var(--secondary); }
        .plate-story .circle-one { top: 0; }.plate-story .circle-two { top: 285px; }.plate-story .circle-three { top: 570px; }
        .plate-story .feature-card { left: 45px; bottom: 260px; width: 360px; padding: 26px; grid-template-columns: 1fr; gap: 22px; font-size: 23px; background: var(--accent); }
        .plate-story .location-badge { left: 48px; top: 555px; max-width: 280px; padding: 13px; font-size: 24px; }
        .plate-story .status-stamp { left: 430px; top: 390px; padding: 22px 42px; font-size: 48px; }
        .plate-story .brand-footer { left: 46px; bottom: 55px; width: 900px; font-size: 20px; }
        .plate-story .brand-footer img, .plate-story .logo-fallback { width: 80px; height: 80px; }

        .plate-landscape .main-photo { left: 365px; top: 0; width: 835px; height: 628px; }
        .plate-landscape .top-wave { left: 0; top: 0; width: 470px; height: 628px; background: var(--primary); clip-path: polygon(0 0,100% 0,75% 100%,0 100%); }
        .plate-landscape .bottom-wave { display: none; }
        .plate-landscape .operation-pill { left: 44px; top: 42px; width: 230px; padding: 12px; border: 3px solid var(--secondary); font-size: 28px; }
        .plate-landscape .title-block { left: 44px; top: 120px; width: 330px; font-size: 46px; }
        .plate-landscape .price-pill { left: 44px; top: 300px; padding: 14px 20px; font-size: 32px; }
        .plate-landscape .circle-gallery { right: 35px; bottom: 28px; width: 470px; height: 150px; display: flex; gap: 12px; }
        .plate-landscape .circle-photo { position: relative; width: 145px; height: 145px; border-width: 5px; }
        .plate-landscape .feature-card { left: 40px; bottom: 90px; width: 360px; padding: 16px; gap: 12px; font-size: 16px; background: var(--accent); }
        .plate-landscape .feature-icon { width: 25px; height: 25px; }
        .plate-landscape .location-badge { left: 45px; top: 250px; padding: 8px 10px; font-size: 18px; }
        .plate-landscape .status-stamp { right: 330px; top: 75px; padding: 16px 30px; font-size: 36px; }
        .plate-landscape .brand-footer { left: 44px; bottom: 24px; width: 330px; font-size: 13px; }
        .plate-landscape .brand-footer img, .plate-landscape .logo-fallback { width: 48px; height: 48px; }

        .export-actions { display: flex; justify-content: center; gap: 10px; margin-top: 12px; }
        .export-actions button { min-width: 150px; }
        .export-actions button.secondary { background: white; color: #111827; }
        .mobile-preview-toggle { display: none; width: 100%; margin-bottom: 10px; }

        @media (max-width: 1050px) {
          .editor-grid { grid-template-columns: minmax(300px, 390px) minmax(0, 1fr); }
          .plate { --plate-scale: min(calc((100vw - 455px) / ${size.width}), calc((100vh - 205px) / ${size.height}), 1); }
        }
        @media (max-width: 820px) {
          .plate-page { padding: 14px; overflow-x: clip; }
          .editor-grid { display: flex; flex-direction: column-reverse; gap: 14px; width: 100%; }
          .controls-card, .preview-column { width: 100%; max-width: 100%; }
          .preview-sticky { position: static; top: auto; }
          .preview-shell { max-height: none; padding: 8px; }
          .plate-scaler { width: 100%; max-height: none; }
          .plate { --plate-scale: calc((100vw - 46px) / ${size.width}); }
          .mobile-preview-toggle { display: block; }
          .preview-sticky.closed .preview-shell, .preview-sticky.closed .export-actions { display: none; }
          .button-grid.three, .color-grid { grid-template-columns: 1fr; }
          .field-grid { grid-template-columns: 1fr; }
          .field-grid .wide { grid-column: auto; }
          .checks { grid-template-columns: 1fr; }
          .export-actions { position: sticky; bottom: 8px; z-index: 20; background: rgba(255,255,255,.96); padding: 8px; border-radius: 12px; box-shadow: 0 8px 24px rgba(15,23,42,.16); }
          .export-actions button { min-width: 0; flex: 1; }
        }
      `}</style>
    </main>
  );
}
