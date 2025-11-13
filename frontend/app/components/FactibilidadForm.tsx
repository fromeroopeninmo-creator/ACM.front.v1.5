'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';

/* =========================
 *  Tipos
 * ========================= */

interface FactibilidadFormData {
  // Meta
  date: string;
  titulo: string;

  // Bloque 1: Datos del lote
  nombreProyecto: string;
  direccion: string;
  localidad: string;
  barrio: string;
  zona: string;
  superficieLote: number | null;
  frente: number | null;
  fondo: number | null;
  tipoImplantacion: 'entre_medianeras' | 'esquina' | 'dos_frentes' | 'otro';

  superficieDemoler: number | null;
  superficieConservar: number | null;

  fotoLoteUrl?: string;
  fotoLoteBase64?: string;

  // Bloque 2: Normativa / morfología
  FOS: number | null;
  FOT: number | null;
  alturaMaxima: number | null;
  pisosMaximos: number | null;

  retiroFrente: number | null;
  retiroFondo: number | null;
  retiroLaterales: number | null;

  requiereCorazonManzana: boolean;
  porcentajeLibreInterior: number | null;

  permiteSubsuelo: boolean;
  nivelesSubsuelo: number | null;

  // Perfilería opcional
  perfilAnguloGrados: number | null;
  perfilDesdePiso: number | null;

  // Bloque 3: Usos y eficiencia
  eficienciaGlobal: number | null;
  metrosPorUnidad: number | null;
  valorVentaPorUnidad: number | null;

  // Bloque 4: Incidencia
  indiceIncidenciaZonal: number | null;
  costoDemolicionM2: number | null; // usado para descontar del precio sugerido

  // Bloque 5: Conclusión
  observaciones: string;
  riesgos: string;
  oportunidades: string;
  notasAdicionales: string;
}

type InlineMsg = { type: 'success' | 'error'; text: string } | null;

/* =========================
 *  Helpers
 * ========================= */

const peso = (n: number | null | undefined) =>
  n == null || isNaN(n)
    ? '-'
    : n.toLocaleString('es-AR', {
        style: 'currency',
        currency: 'ARS',
        maximumFractionDigits: 0,
      });

const numero = (n: number | null | undefined, dec = 0) =>
  n == null || isNaN(n)
    ? '-'
    : n.toLocaleString('es-AR', {
        maximumFractionDigits: dec,
        minimumFractionDigits: dec,
      });

const isDataUrl = (s?: string) => !!s && s.startsWith('data:image/');

function dataUrlToFile(dataUrl: string, filename: string) {
  const arr = dataUrl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bstr =
    typeof window !== 'undefined'
      ? atob(arr[1])
      : Buffer.from(arr[1], 'base64').toString('binary');
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new File([u8arr], filename, { type: mime });
}

// Comprimir a JPEG ≤ 40KB y máx 560px
async function compressFileToDataUrl(
  file: File,
  opts?: {
    maxWidth?: number;
    maxHeight?: number;
    maxBytes?: number;
    initialQuality?: number;
    minQuality?: number;
    step?: number;
  }
): Promise<string> {
  const {
    maxWidth = 560,
    maxHeight = 560,
    maxBytes = 40 * 1024,
    initialQuality = 0.7,
    minQuality = 0.3,
    step = 0.07,
  } = opts || {};

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = URL.createObjectURL(file);
  });

  let { width, height } = img;
  const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
  width = Math.max(1, Math.floor(width * ratio));
  height = Math.max(1, Math.floor(height * ratio));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }
  ctx.drawImage(img, 0, 0, width, height);

  let q = initialQuality;
  let blob: Blob | null = null;
  while (q >= minQuality) {
    blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', q)
    );
    if (blob && blob.size <= maxBytes) break;
    q -= step;
  }
  if (!blob) {
    blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b || new Blob()), 'image/jpeg', minQuality)
    );
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = reject;
    fr.readAsDataURL(blob!);
  });

  URL.revokeObjectURL(img.src);
  return dataUrl;
}

const fetchToDataURL = async (url?: string | null): Promise<string | null> => {
  try {
    if (!url) return null;
    const r = await fetch(url);
    if (!r.ok) return null;
    const b = await r.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(b);
    });
  } catch {
    return null;
  }
};

/* =========================
 *  Estado inicial
 * ========================= */

const makeInitialData = (): FactibilidadFormData => ({
  date: new Date().toISOString(),
  titulo: 'Informe de Factibilidad Constructiva',

  nombreProyecto: '',
  direccion: '',
  localidad: '',
  barrio: '',
  zona: '',
  superficieLote: null,
  frente: null,
  fondo: null,
  tipoImplantacion: 'entre_medianeras',

  superficieDemoler: null,
  superficieConservar: null,

  fotoLoteUrl: '',
  fotoLoteBase64: undefined,

  FOS: null,
  FOT: null,
  alturaMaxima: null,
  pisosMaximos: null,

  retiroFrente: null,
  retiroFondo: null,
  retiroLaterales: null,

  requiereCorazonManzana: false,
  porcentajeLibreInterior: null,

  permiteSubsuelo: false,
  nivelesSubsuelo: null,

  perfilAnguloGrados: null,
  perfilDesdePiso: null,

  eficienciaGlobal: null,
  metrosPorUnidad: null,
  valorVentaPorUnidad: null,

  indiceIncidenciaZonal: null,
  costoDemolicionM2: null,

  observaciones: '',
  riesgos: '',
  oportunidades: '',
  notasAdicionales: '',
});

/* =========================
 *  Componente principal
 * ========================= */

export default function FactibilidadForm() {
  const { user } = useAuth();
  const theme = useTheme();

  const [formData, setFormData] = useState<FactibilidadFormData>(() =>
    makeInitialData()
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveMsg, setSaveMsg] = useState<InlineMsg>(null);
  const [loadMsg, setLoadMsg] = useState<InlineMsg>(null);
  const [informeId, setInformeId] = useState<string | null>(null);
  const [loadOpen, setLoadOpen] = useState(false);
  const [loadIdInput, setLoadIdInput] = useState('');

  const fotoLoteInputRef = useRef<HTMLInputElement | null>(null);

  const themePrimaryColor = (theme as any)?.primaryColor as string | undefined;
  const themeCompanyName = (theme as any)?.companyName as string | undefined;
  const themeLogoUrl =
    (theme as any)?.logoUrlBusted ?? (theme as any)?.logoUrl ?? undefined;
  const effectivePrimaryColor = themePrimaryColor || '#0ea5e9';

  // Aseguramos fecha
  useEffect(() => {
    if (!formData.date) {
      setFormData((prev) => ({
        ...prev,
        date: new Date().toISOString(),
      }));
    }
  }, [formData.date]);

  /* =========================
   *  Autoload (?id= / ?informeId=)
   * ========================= */
  useEffect(() => {
    const autoLoad = async () => {
      if (typeof window === 'undefined') return;
      const qs = new URLSearchParams(window.location.search);
      const id = qs.get('id') || qs.get('informeId');
      if (!id) return;

      try {
        const res = await fetch(
          `/api/factibilidad/get?id=${encodeURIComponent(id)}`
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'No se pudo obtener');

        const inf = data?.informe ?? data;
        const payload: FactibilidadFormData | undefined = inf?.datos_json;
        if (!payload) throw new Error('El informe no contiene datos_json');

        const fotoUrl: string = inf?.foto_lote_url || '';

        setFormData((prev) => ({
          ...prev,
          ...payload,
          fotoLoteUrl: fotoUrl || payload.fotoLoteUrl || prev.fotoLoteUrl || '',
          fotoLoteBase64: undefined,
        }));
        setInformeId(inf?.id || id);
      } catch (e) {
        console.error('Autoload factibilidad:', e);
      }
    };

    autoLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* =========================
   *  Handlers
   * ========================= */

  const handleSimpleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    // Booleanos
    if (name === 'requiereCorazonManzana' || name === 'permiteSubsuelo') {
      setFormData((prev) => ({ ...prev, [name]: value === 'true' }));
      return;
    }

    // Numéricos
    const numericFields = new Set([
      'superficieLote',
      'frente',
      'fondo',
      'superficieDemoler',
      'superficieConservar',
      'FOS',
      'FOT',
      'alturaMaxima',
      'pisosMaximos',
      'retiroFrente',
      'retiroFondo',
      'retiroLaterales',
      'porcentajeLibreInterior',
      'eficienciaGlobal',
      'metrosPorUnidad',
      'valorVentaPorUnidad',
      'indiceIncidenciaZonal',
      'costoDemolicionM2',
      'perfilAnguloGrados',
      'perfilDesdePiso',
    ]);

    if (numericFields.has(name)) {
      const raw = value.replace(',', '.');
      const n = raw === '' ? null : Number(raw);
      setFormData((prev) => ({
        ...prev,
        [name]: n === null || isNaN(n) ? null : n,
      }));
      return;
    }

    // Tipo implantación
    if (name === 'tipoImplantacion') {
      setFormData((prev) => ({
        ...prev,
        tipoImplantacion: value as FactibilidadFormData['tipoImplantacion'],
      }));
      return;
    }

    // El resto texto
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFotoLoteSelect = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const b64 = await compressFileToDataUrl(f, {
      maxWidth: 560,
      maxHeight: 560,
      maxBytes: 40 * 1024,
      initialQuality: 0.7,
      minQuality: 0.3,
      step: 0.07,
    });

    setFormData((prev) => ({ ...prev, fotoLoteBase64: b64, fotoLoteUrl: '' }));
    if (fotoLoteInputRef.current) fotoLoteInputRef.current.value = '';
  };

  /* =========================
   *  Cálculos (memo)
   * ========================= */

  const calculos = useMemo(() => {
    const sLote = formData.superficieLote || 0;
    const FOT = formData.FOT ?? null;
    const FOS = formData.FOS ?? null;
    const pisos = formData.pisosMaximos ?? null;
    const frente = formData.frente ?? null;
    const fondo = formData.fondo ?? null;

    const conservar = formData.superficieConservar ?? 0;
    const demoler = formData.superficieDemoler ?? 0;

    // Lote efectivo para nueva planta por conservación
    // (ejemplo del usuario: 500 m² lote, FOS 0.8, conservar 100 → planta = (500-100)*0.8 = 320)
    const loteEfectivo = Math.max(0, sLote - conservar);

    // Planta base por FOS
    const plantaBase =
      loteEfectivo > 0 && FOS !== null ? loteEfectivo * FOS : null;

    // Cálculo por altura/pisos con perfilería (opcional)
    let superficieMaxPorAltura: number | null = null;
    if (pisos !== null && pisos > 0 && plantaBase !== null) {
      const ang = formData.perfilAnguloGrados ?? null;
      const desde = formData.perfilDesdePiso ?? null;
      const alturaPiso = 3; // m por piso

      // Si no hay perfilería o faltan frente/fondo para geometría, usamos plantaBase * pisos
      if (
        ang == null ||
        desde == null ||
        isNaN(ang) ||
        isNaN(desde) ||
        desde <= 1 ||
        frente == null ||
        fondo == null ||
        frente <= 0 ||
        fondo <= 0
      ) {
        superficieMaxPorAltura = plantaBase * pisos;
      } else {
        const rad = (ang * Math.PI) / 180;
        const deltaProfPorPiso = Math.tan(rad) * alturaPiso; // retiro lineal por piso en metros

        let total = 0;
        for (let p = 1; p <= pisos; p++) {
          if (p < desde) {
            total += plantaBase;
          } else {
            const pisosDesde = p - (desde - 1);
            const profundidad = Math.max(fondo - deltaProfPorPiso * pisosDesde, 0);
            const areaGeometrica = Math.max(frente * profundidad, 0);
            // El área efectiva del piso no puede exceder la plantaBase (por FOS)
            const areaPiso = Math.min(plantaBase, areaGeometrica);
            total += areaPiso;
          }
        }
        superficieMaxPorAltura = total;
      }
    }

    // Cálculo por FOT (tope total)
    const superficieMaxPorFOT =
      sLote > 0 && FOT !== null ? sLote * FOT : null;

    // Tomar el mínimo de las restricciones válidas
    let superficieConstruibleTotal: number | null = null;
    if (superficieMaxPorFOT !== null && superficieMaxPorAltura !== null) {
      superficieConstruibleTotal = Math.min(
        superficieMaxPorFOT,
        superficieMaxPorAltura
      );
    } else if (superficieMaxPorFOT !== null) {
      superficieConstruibleTotal = superficieMaxPorFOT;
    } else if (superficieMaxPorAltura !== null) {
      superficieConstruibleTotal = superficieMaxPorAltura;
    }

    // Superficie vendible / común
    const eff = formData.eficienciaGlobal ?? null;
    const superficieVendibleTotal =
      superficieConstruibleTotal !== null && eff !== null
        ? superficieConstruibleTotal * eff
        : null;

    const superficieComun =
      superficieConstruibleTotal !== null && superficieVendibleTotal !== null
        ? Math.max(superficieConstruibleTotal - superficieVendibleTotal, 0)
        : null;

    // Unidades vendibles y valor total de ventas
    const m2Unidad = formData.metrosPorUnidad ?? null;
    const valorPorUnidad = formData.valorVentaPorUnidad ?? null;

    const unidadesVendibles =
      superficieVendibleTotal !== null && m2Unidad !== null && m2Unidad > 0
        ? Math.floor(superficieVendibleTotal / m2Unidad)
        : null;

    const valorTotalUnidadesVendibles =
      unidadesVendibles !== null && valorPorUnidad !== null
        ? unidadesVendibles * valorPorUnidad
        : null;

    // Precio sugerido del lote (solo con incidencia y valor ventas, menos demolición)
    const indice = formData.indiceIncidenciaZonal ?? null;
    const costoDem2 = formData.costoDemolicionM2 ?? null;

    const costoDemolicionTotal =
      demoler > 0 && costoDem2 !== null ? demoler * costoDem2 : 0;

    const precioSugeridoLote =
      indice !== null && valorTotalUnidadesVendibles !== null
        ? Math.max(valorTotalUnidadesVendibles * indice - costoDemolicionTotal, 0)
        : null;

    return {
      plantaBase,
      superficieMaxPorFOT,
      superficieMaxPorAltura,
      superficieConstruibleTotal,
      superficieVendibleTotal,
      superficieComun,
      unidadesVendibles,
      valorTotalUnidadesVendibles,
      costoDemolicionTotal,
      precioSugeridoLote,
    };
  }, [formData]);

       /* ========= PDF profesional – Factibilidad ========= */
const handleDownloadPDF = async () => {
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF("p", "pt", "a4");
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Layout
  const M = 40;               // margen
  const COL_GAP = 24;
  const LH = 16;              // line height base
  let y = M;

  // Colores / estilo
  const hexToRgb = (hex: string) => {
    const m = hex.replace("#", "");
    const int = parseInt(m.length === 3 ? m.split("").map((c) => c + c).join("") : m, 16);
    return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
  };
  const pc = hexToRgb(effectivePrimaryColor || "#E6A930"); // dorado por defecto

  // Helpers de dibujo
  const ensureRoom = (needed = 100) => {
    if (y + needed > pageH - M) {
      doc.addPage();
      y = M;
    }
  };

  // Dibuja una línea separadora de sección
  const sectionRule = () => {
    ensureRoom(20);
    doc.setDrawColor(pc.r, pc.g, pc.b);
    doc.setLineWidth(0.8);
    doc.line(M, y, pageW - M, y);
    y += 20;
  };

  // Título de sección centrado
  const sectionTitle = (text: string) => {
    ensureRoom(28);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(pc.r, pc.g, pc.b);
    doc.text(text, pageW / 2, y, { align: "center" });
    doc.setTextColor(0, 0, 0);
    y += 24;
  };

  // Par (Label: value) con salto ordenado (value indentado en líneas siguientes)
  const drawKV = (label: string, value: string, x: number, maxW: number, valueIndent = 110) => {
    ensureRoom(LH + 8);
    // Label
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`${label}:`, x, y);

    // Value (envoltura y sangría)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const avail = Math.max(60, maxW - valueIndent);
    const lines = doc.splitTextToSize(value || "—", avail) as string[];
    doc.text(lines, x + valueIndent, y);
    y += LH * Math.max(1, lines.length);
  };

  // Carga de imagen (URL o base64)
  const getDataURL = async (url?: string | null) => {
    try {
      if (!url) return null;
      const r = await fetch(url);
      if (!r.ok) return null;
      const b = await r.blob();
      return await new Promise<string>((resolve) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result));
        fr.readAsDataURL(b);
      });
    } catch {
      return null;
    }
  };

  // ===== Datos Auth / Theme (empresa/profesional/asesor) =====
  const anyUser = user as any;
  const role = (anyUser?.role || "").toLowerCase();
  const isAsesor = role === "asesor";

  let matriculado = anyUser?.matriculado_nombre || "—";
  let cpi = anyUser?.cpi || "—";
  let inmobiliaria = (theme as any)?.companyName || anyUser?.inmobiliaria || "—";
  const asesorNombre =
    anyUser?.nombre && anyUser?.apellido ? `${anyUser.nombre} ${anyUser.apellido}` : "—";

  // Completar desde empresas si falta algo
  if (inmobiliaria === "—" || matriculado === "—" || cpi === "—") {
    try {
      const { supabase } = await import("#lib/supabaseClient");
      let query = supabase.from("empresas")
        .select("id, nombre_comercial, matriculado, cpi, user_id")
        .limit(1);

      if (isAsesor && anyUser?.empresa_id) query = query.eq("id", anyUser.empresa_id);
      else if (anyUser?.id) query = query.eq("user_id", anyUser.id);

      const { data: empresaRow, error } = await query.maybeSingle();
      if (!error && empresaRow) {
        if (inmobiliaria === "—" && empresaRow.nombre_comercial) inmobiliaria = empresaRow.nombre_comercial;
        if (matriculado === "—" && empresaRow.matriculado) matriculado = empresaRow.matriculado;
        if (cpi === "—" && empresaRow.cpi) cpi = empresaRow.cpi;
      }
    } catch {/* no-op */}
  }

  // ===== Título principal =====
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(pc.r, pc.g, pc.b);
  doc.text("Informe de Factibilidad Constructiva", pageW / 2, y, { align: "center" });
  doc.setTextColor(0, 0, 0);
  y += 26;

  // ===== Encabezado: izquierda (3 filas) – logo centrado – derecha (2 filas) =====
  const headerLeftX = M;
  const headerRightX = pageW - M - 210; // bloque derecho (ancho referencial 250)
  const headerBlockH = 50; // alto mínimo, luego ajustamos

  // Izquierda (tres filas, misma línea por campo)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Empresa: ${inmobiliaria}`, headerLeftX, y);
  doc.text(`Profesional: ${matriculado}`, headerLeftX, y + 16);
  doc.text(`Matrícula N°: ${cpi}`, headerLeftX, y + 32);

  // Derecha (dos filas, misma línea por campo)
  doc.text(`Asesor: ${isAsesor ? asesorNombre : "—"}`, headerRightX, y);
  doc.text(
    `Fecha: ${new Date(formData.date || new Date().toISOString()).toLocaleDateString("es-AR")}`,
    headerRightX,
    y + 16
  );

  // Logo centrado
  const themeLogo = (theme as any)?.logoUrlBusted ?? (theme as any)?.logoUrl ?? null;
  if (themeLogo) {
    try {
      const base64Img = await getDataURL(themeLogo);
      if (base64Img) {
        const logoW = 70;
        const logoH = 70;
        const centerX = pageW / 2 - logoW / 2;
        doc.addImage(base64Img, "PNG", centerX, y - 10, logoW, logoH, undefined, "FAST");
      }
    } catch { /* no-op */ }
  }

  y += Math.max(headerBlockH, 60);

  // ===== Separador =====
  sectionRule();

  // ===== 1) Datos del lote (lista alineada) + foto a la derecha en marco =====
  sectionTitle("Datos del lote");

  // Layout: columna izquierda (texto) + columna derecha (foto)
  const textColW = pageW - M * 2 - 200 - COL_GAP; // dejamos 200 px para foto + gap
  const leftX = M;
  const rightBoxW = 200;
  const rightX = pageW - M - rightBoxW;

  // Guardamos y0 para calcular la altura total de la fila
  const yStartDatos = y;

  // Bloque texto (izquierda)
  const kv = (label: string, value: string) => drawKV(label, value, leftX, textColW, 120);

  kv("Proyecto", formData.nombreProyecto || "-");
  kv("Dirección", formData.direccion || "-");
  kv("Localidad", formData.localidad || "-");
  kv("Barrio", formData.barrio || "-");
  kv("Zona / Distrito", formData.zona || "-");
  kv("Superficie del lote", `${numero(formData.superficieLote)} m²`);
  kv("Frente", `${numero(formData.frente)} m`);
  kv("Fondo", `${numero(formData.fondo)} m`);
  kv("Superficie a demoler", `${numero(formData.superficieDemoler)} m²`);
  kv("Superficie a conservar", `${numero(formData.superficieConservar)} m²`);

  // Bloque foto (derecha con marco)
  const yPhotoTop = yStartDatos; // alineado arriba con el bloque de texto
  const photoPad = 8;
  let photoBoxH = 150;

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.8);
  doc.rect(rightX, yPhotoTop, rightBoxW, photoBoxH);

  let fotoDataURL: string | null = null;
  if (formData.fotoLoteBase64) fotoDataURL = formData.fotoLoteBase64;
  else if (formData.fotoLoteUrl) fotoDataURL = await fetchToDataURL(formData.fotoLoteUrl);

  if (fotoDataURL) {
    try {
      // Insertamos imagen con padding y ajuste (cover-like)
      const imgW = rightBoxW - photoPad * 2;
      const imgH = photoBoxH - photoPad * 2;
      doc.addImage(
        fotoDataURL,
        "JPEG",
        rightX + photoPad,
        yPhotoTop + photoPad,
        imgW,
        imgH,
        undefined,
        "FAST"
      );
    } catch {
      // si falla, dejamos marco vacío
    }
  }

  // Empujar y hasta el mayor extremo entre texto y foto
  y = Math.max(y, yPhotoTop + photoBoxH) + 12;

  // ===== Separador =====
  sectionRule();

  // ===== 2) Normativa urbanística y morfología =====
  sectionTitle("Normativa urbanística y morfología");

  const perfTxt =
    (formData as any).perfilAnguloGrados != null && (formData as any).perfilDesdePiso != null
      ? `${numero((formData as any).perfilAnguloGrados)}° desde piso ${numero((formData as any).perfilDesdePiso)}`
      : "—";

  drawKV("FOS", `${numero(formData.FOS, 2)}`, M, pageW - M * 2, 120);
  drawKV("FOT", `${numero(formData.FOT, 2)}`, M, pageW - M * 2, 120);
  drawKV("Altura máxima", `${numero(formData.alturaMaxima)} m`, M, pageW - M * 2, 120);
  drawKV("Pisos máximos", `${numero(formData.pisosMaximos)}`, M, pageW - M * 2, 120);
  drawKV("Retiros frente", `${numero(formData.retiroFrente)} m`, M, pageW - M * 2, 120);
  drawKV("Retiros fondo", `${numero(formData.retiroFondo)} m`, M, pageW - M * 2, 120);
  drawKV("Retiros laterales", `${numero(formData.retiroLaterales)} m`, M, pageW - M * 2, 120);
  drawKV("Perfilería", perfTxt, M, pageW - M * 2, 120);

  // ===== Separador =====
  sectionRule();

  // ===== 3) Usos previstos y eficiencia (métricas) =====
  sectionTitle("Usos previstos y eficiencia");

  // Lectura de cálculos ya memorizados en el componente
  const sConstruible = (calculos as any)?.superficieConstruibleTotal ?? null;
  const sVendible = (calculos as any)?.superficieVendibleTotal ?? null;
  const sComun =
    (calculos as any)?.superficieComun ??
    (sConstruible != null && sVendible != null ? sConstruible - sVendible : null);

  const m2xUnidad = (formData as any).metrosPorUnidad ?? null;
  const valorUnidad = (formData as any).valorVentaPorUnidad ?? null;
  const unidadesVendibles =
    sVendible != null && m2xUnidad && Number(m2xUnidad) > 0
      ? Math.floor(Number(sVendible) / Number(m2xUnidad))
      : (calculos as any)?.unidadesVendibles ?? null;

  const valorTotalVendible =
    (calculos as any)?.valorTotalUnidadesVendibles ??
    (unidadesVendibles != null && valorUnidad != null
      ? Number(unidadesVendibles) * Number(valorUnidad)
      : null);

  drawKV("m² construibles (estimados)", `${numero(sConstruible)} m²`, M, pageW - M * 2, 180);
  drawKV("m² vendibles (estimados)", `${numero(sVendible)} m²`, M, pageW - M * 2, 180);
  drawKV("m² no vendibles (estimados)", `${numero(sComun)} m²`, M, pageW - M * 2, 180);
  drawKV("Unidades vendibles (aprox.)", `${numero(unidadesVendibles)}`, M, pageW - M * 2, 180);
  drawKV("m² por unidad", `${numero(m2xUnidad)} m²`, M, pageW - M * 2, 180);
  drawKV("Valor de venta por unidad", `${peso(valorUnidad ?? null)}`, M, pageW - M * 2, 180);
  drawKV("Valor total de unidades vendibles", `${peso(valorTotalVendible ?? null)}`, M, pageW - M * 2, 180);

  // ===== Separador =====
  sectionRule();

  // ===== 4) Incidencia del lote y precio sugerido =====
  sectionTitle("Incidencia del lote y precio sugerido");

  const indice = formData.indiceIncidenciaZonal ?? null;
  const costoDemolicionM2 = (formData as any).costoDemolicionM2 ?? null;
  const costoDemoTotal =
    formData.superficieDemoler != null && costoDemolicionM2 != null
      ? Number(formData.superficieDemoler) * Number(costoDemolicionM2)
      : null;

  // Precio sugerido: (Valor total vendible × índice) − costo demolición
  const precioSugeridoLote =
    (calculos as any)?.precioSugeridoLote ??
    (indice != null && valorTotalVendible != null
      ? Number(valorTotalVendible) * Number(indice) - (costoDemoTotal ?? 0)
      : null);

  drawKV(
    "Índice de incidencia zonal",
    indice != null ? `${(indice * 100).toFixed(2)} %` : "—",
    M,
    pageW - M * 2,
    180
  );
  drawKV("Superficie a demoler", `${numero(formData.superficieDemoler)} m²`, M, pageW - M * 2, 180);
  drawKV("Precio de demolición por m²", `${peso(costoDemolicionM2 ?? null)}`, M, pageW - M * 2, 180);
  drawKV("Costo total de demolición", `${peso(costoDemoTotal ?? null)}`, M, pageW - M * 2, 180);

  // Recuadro del precio sugerido (centrado)
  ensureRoom(90);
  y += 6;
  doc.setDrawColor(pc.r, pc.g, pc.b);
  doc.setLineWidth(0.8);
  // Caja centrada
  const boxW = 360;
  const boxH = 54;
  const boxX = pageW / 2 - boxW / 2;
  doc.rect(boxX, y, boxW, boxH);

  // Título y valor al centro
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(pc.r, pc.g, pc.b);
  doc.text("Precio sugerido del lote", pageW / 2, y + 18, { align: "center" });

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(18);
  doc.text(peso(precioSugeridoLote ?? null), pageW / 2, y + 40, { align: "center" });

  y += boxH + 20;

  // ===== Separador =====
  sectionRule();

  // ===== 5) Conclusión =====
  sectionTitle("Conclusión");

  const addPara = (title: string, text: string) => {
    ensureRoom(60);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(title, M, y);
    y += 12;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(text || "—", pageW - M * 2) as string[];
    doc.text(lines, M, y);
    y += LH * Math.max(1, lines.length) + 6;
  };

  addPara("Observaciones", formData.observaciones);
  addPara("Riesgos", formData.riesgos);
  addPara("Oportunidades", formData.oportunidades);
  addPara("Notas adicionales", formData.notasAdicionales);

  // ===== Footer =====
  const footerText = `${matriculado}  |  Matrícula N°: ${cpi}`;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.text(footerText, pageW / 2, pageH - 30, { align: "center" });

  doc.save("Informe_Factibilidad.pdf");
};


  /* =========================
   *  Guardar / Cargar (sin cambios de endpoints)
   * ========================= */
  const saveInforme = async () => {
    try {
      setIsSubmitting(true);
      setSaveMsg(null);

      // Clonar datos y adjuntar snapshot de cálculos
      const datosLimpios = structuredClone(formData) as FactibilidadFormData & {
        calculos?: any;
      };
      datosLimpios['calculos'] = calculos;

      const fotoB64 = datosLimpios.fotoLoteBase64;
      datosLimpios.fotoLoteBase64 = undefined;

      const payload = {
        id: informeId || undefined,
        datos: datosLimpios,
        titulo: datosLimpios.titulo || 'Informe de Factibilidad Constructiva',
      };

      const res = await fetch('/api/factibilidad/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errTxt = await res.text().catch(() => '');
        throw new Error(`Error al guardar el informe. ${errTxt}`);
      }

      const data = await res.json();
      const id: string | undefined = data?.informe?.id;
      if (!id) throw new Error('No se recibió ID de informe.');

      setInformeId(id);

      // Subir foto si hay base64
      let nuevaFotoUrl = '';
      if (isDataUrl(fotoB64)) {
        const file = dataUrlToFile(fotoB64!, 'foto_lote.jpg');
        const fd = new FormData();
        fd.append('file', file);
        fd.append('informeId', id);
        fd.append('slot', 'foto_lote');

        const up = await fetch('/api/factibilidad/upload', {
          method: 'POST',
          body: fd,
        });
        const upData = await up.json();
        if (up.ok && upData?.url) {
          nuevaFotoUrl = String(upData.url);
        } else {
          console.warn('Upload foto_lote falló:', upData?.error || up.statusText);
        }
      }

      // Actualizar JSON con URL final
      const datosConUrl: FactibilidadFormData & { calculos?: any } =
        structuredClone(datosLimpios);
      datosConUrl.fotoLoteUrl =
        nuevaFotoUrl || formData.fotoLoteUrl || datosConUrl.fotoLoteUrl || '';

      const upd = await fetch('/api/factibilidad/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, datos: datosConUrl }),
      });

      if (!upd.ok) {
        const t = await upd.text().catch(() => '');
        console.warn('Update datos_json con URL falló:', t);
      }

      setFormData((prev) => ({
        ...prev,
        fotoLoteUrl: datosConUrl.fotoLoteUrl,
        fotoLoteBase64: undefined,
      }));

      setSaveMsg({ type: 'success', text: `Informe guardado con éxito. ID: ${id}` });
    } catch (err: any) {
      console.error('Guardar Factibilidad', err);
      setSaveMsg({ type: 'error', text: err?.message || 'No se pudo guardar el informe' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const loadInforme = () => {
    setLoadMsg(null);
    setLoadIdInput('');
    setLoadOpen(true);
  };

  const handleConfirmLoad = async () => {
    if (!loadIdInput) {
      setLoadMsg({ type: 'error', text: 'Por favor, ingresá un ID válido.' });
      return;
    }

    try {
      setLoadMsg(null);

      const res = await fetch(`/api/factibilidad/get?id=${encodeURIComponent(loadIdInput)}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data?.error || 'No se pudo obtener el informe');

      const inf = data?.informe ?? data;
      const payload: FactibilidadFormData | undefined = inf?.datos_json;
      if (!payload) throw new Error('El informe no contiene datos_json');

      const fotoUrl: string = inf?.foto_lote_url || '';

      setFormData((prev) => ({
        ...prev,
        ...payload,
        fotoLoteUrl: fotoUrl || payload.fotoLoteUrl || prev.fotoLoteUrl || '',
        fotoLoteBase64: undefined,
      }));

      const loadedId = inf?.id || loadIdInput;
      setInformeId(loadedId);
      setLoadMsg({ type: 'success', text: `Informe cargado correctamente (ID: ${loadedId}).` });
      setLoadOpen(false);
    } catch (err: any) {
      console.error('Cargar Factibilidad', err);
      setLoadMsg({ type: 'error', text: `Error al cargar: ${err?.message || 'desconocido'}` });
    }
  };

  /* =========================
   *  Render
   * ========================= */
  return (
    <>
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header del formulario */}
        <div className="flex items-center justify-between gap-4 mb-2 border-b pb-3">
          <div className="w-24" />
          <div className="text-xl sm:text-2xl font-semibold text-center grow">
            Factibilidad Constructiva
          </div>
          <div className="text-sm whitespace-nowrap">
            {new Date(formData.date || new Date().toISOString()).toLocaleDateString('es-AR')}
          </div>
        </div>

        {/* Bloque 1: Datos del lote + Foto */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-semibold" style={{ color: effectivePrimaryColor }}>
              1. Datos del lote y foto de referencia
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-4 sm:p-6">
            {/* Datos del lote */}
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1 md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Título del informe</label>
                <input
                  name="titulo"
                  value={formData.titulo}
                  onChange={handleSimpleChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                  placeholder="Ej: Factibilidad Constructiva - Laprida 1234"
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Nombre del proyecto</label>
                <input
                  name="nombreProyecto"
                  value={formData.nombreProyecto}
                  onChange={handleSimpleChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                  placeholder="Ej: Torre Residencial Laprida"
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Dirección</label>
                <input
                  name="direccion"
                  value={formData.direccion}
                  onChange={handleSimpleChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                  placeholder="Calle y número"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Localidad</label>
                <input
                  name="localidad"
                  value={formData.localidad}
                  onChange={handleSimpleChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                  placeholder="Localidad"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Barrio</label>
                <input
                  name="barrio"
                  value={formData.barrio}
                  onChange={handleSimpleChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                  placeholder="Barrio"
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Zona / Distrito urbanístico</label>
                <input
                  name="zona"
                  value={formData.zona}
                  onChange={handleSimpleChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                  placeholder="Ej: R2b, C3, etc."
                />
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Superficie del lote (m²)</label>
                <input
                  name="superficieLote"
                  type="number"
                  inputMode="decimal"
                  value={formData.superficieLote ?? ''}
                  onChange={handleSimpleChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                  placeholder="Ej: 500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Frente (m)</label>
                <input
                  name="frente"
                  type="number"
                  inputMode="decimal"
                  value={formData.frente ?? ''}
                  onChange={handleSimpleChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                  placeholder="Ej: 10"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Fondo (m)</label>
                <input
                  name="fondo"
                  type="number"
                  inputMode="decimal"
                  value={formData.fondo ?? ''}
                  onChange={handleSimpleChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                  placeholder="Ej: 50"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Tipo de implantación</label>
                <select
                  name="tipoImplantacion"
                  value={formData.tipoImplantacion}
                  onChange={handleSimpleChange}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                >
                  <option value="entre_medianeras">Entre medianeras</option>
                  <option value="esquina">Esquina</option>
                  <option value="dos_frentes">Dos frentes</option>
                  <option value="otro">Otro</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Superficie a demoler (m²)</label>
                <input
                  name="superficieDemoler"
                  type="number"
                  inputMode="decimal"
                  value={formData.superficieDemoler ?? ''}
                  onChange={handleSimpleChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                  placeholder="Opcional"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Superficie a conservar (m²)</label>
                <input
                  name="superficieConservar"
                  type="number"
                  inputMode="decimal"
                  value={formData.superficieConservar ?? ''}
                  onChange={handleSimpleChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                  placeholder="Fachada / Patrimonio (opcional)"
                />
                <p className="text-[11px] text-gray-500">
                  Esta superficie reduce el área efectiva antes de aplicar FOS para el cálculo de planta base.
                </p>
              </div>
            </div>

            {/* Foto del lote */}
            <div className="lg:col-span-1">
              <h3 className="mb-2 text-sm font-semibold text-gray-800 text-center sm:text-left">
                Foto del lote (referencia visual)
              </h3>

              {(() => {
                const src = formData.fotoLoteBase64 || formData.fotoLoteUrl || '';
                if (src) {
                  return (
                    <div className="overflow-hidden rounded-lg border border-gray-200">
                      <img src={src} alt="Foto del lote" className="h-48 sm:h-64 w-full object-cover" />
                      <div className="p-2 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() =>
                            setFormData((p) => ({ ...p, fotoLoteBase64: undefined, fotoLoteUrl: '' }))
                          }
                          className="inline-flex items-center rounded-md border border-gray-300 bg-white px-2 py-1 text-xs sm:text-sm text-gray-700 hover:bg-gray-50"
                        >
                          Quitar
                        </button>
                        <button
                          type="button"
                          onClick={() => fotoLoteInputRef.current?.click()}
                          className="inline-flex items-center rounded-md border border-gray-300 bg-white px-2 py-1 text-xs sm:text-sm text-gray-700 hover:bg-gray-50"
                        >
                          Cambiar foto
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="rounded-lg border border-dashed border-gray-300 p-4 text-center">
                    <p className="mb-2 text-xs text-gray-500">Subir imagen (JPG/PNG)</p>
                    <button
                      type="button"
                      onClick={() => fotoLoteInputRef.current?.click()}
                      className="inline-flex items-center rounded-md border border-gray-300 bg-white px-2 py-1 text-xs sm:text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Subir foto
                    </button>
                    {!informeId && (
                      <p className="mt-2 text-[11px] text-gray-500">
                        Consejo: guardá el informe para subir la foto al Storage.
                      </p>
                    )}
                  </div>
                );
              })()}

              <input
                ref={fotoLoteInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFotoLoteSelect}
              />
            </div>
          </div>
        </div>

        {/* Bloque 2: Normativa / Morfología */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-semibold" style={{ color: effectivePrimaryColor }}>
              2. Normativa urbanística y morfología
            </h2>
          </div>

          <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">FOS (Factor de Ocupación del Suelo)</label>
              <input
                name="FOS"
                type="number"
                inputMode="decimal"
                value={formData.FOS ?? ''}
                onChange={handleSimpleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                placeholder="Ej: 0.8"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">FOT (Factor de Ocupación Total)</label>
              <input
                name="FOT"
                type="number"
                inputMode="decimal"
                value={formData.FOT ?? ''}
                onChange={handleSimpleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                placeholder="Ej: 3.0"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Altura máxima (m)</label>
              <input
                name="alturaMaxima"
                type="number"
                inputMode="decimal"
                value={formData.alturaMaxima ?? ''}
                onChange={handleSimpleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                placeholder="Opcional"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Pisos máximos</label>
              <input
                name="pisosMaximos"
                type="number"
                inputMode="decimal"
                value={formData.pisosMaximos ?? ''}
                onChange={handleSimpleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                placeholder="Ej: 8"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Retiro frente (m)</label>
              <input
                name="retiroFrente"
                type="number"
                inputMode="decimal"
                value={formData.retiroFrente ?? ''}
                onChange={handleSimpleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                placeholder="Opcional"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Retiro fondo (m)</label>
              <input
                name="retiroFondo"
                type="number"
                inputMode="decimal"
                value={formData.retiroFondo ?? ''}
                onChange={handleSimpleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                placeholder="Opcional"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Retiros laterales (m)</label>
              <input
                name="retiroLaterales"
                type="number"
                inputMode="decimal"
                value={formData.retiroLaterales ?? ''}
                onChange={handleSimpleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                placeholder="Opcional"
              />
            </div>

            {/* Perfilería opcional */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Perfilería (ángulo en °)</label>
              <input
                name="perfilAnguloGrados"
                type="number"
                inputMode="decimal"
                value={formData.perfilAnguloGrados ?? ''}
                onChange={handleSimpleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                placeholder="Ej: 45"
              />
              <p className="text-[11px] text-gray-500">
                Si se completa junto con &ldquo;Desde piso N°&rdquo;, se calculará el setback por piso con 3 m/piso.
              </p>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Desde piso N°</label>
              <input
                name="perfilDesdePiso"
                type="number"
                inputMode="decimal"
                value={formData.perfilDesdePiso ?? ''}
                onChange={handleSimpleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                placeholder="Ej: 8"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Requiere corazón de manzana</label>
              <select
                name="requiereCorazonManzana"
                value={String(formData.requiereCorazonManzana)}
                onChange={handleSimpleChange}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
              >
                <option value="false">No</option>
                <option value="true">Sí</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Área libre / interior mínima (%)</label>
              <input
                name="porcentajeLibreInterior"
                type="number"
                inputMode="decimal"
                value={formData.porcentajeLibreInterior ?? ''}
                onChange={handleSimpleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                placeholder="Opcional"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Permite subsuelo</label>
              <select
                name="permiteSubsuelo"
                value={String(formData.permiteSubsuelo)}
                onChange={handleSimpleChange}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
              >
                <option value="false">No</option>
                <option value="true">Sí</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Niveles de subsuelo</label>
              <input
                name="nivelesSubsuelo"
                type="number"
                inputMode="decimal"
                value={formData.nivelesSubsuelo ?? ''}
                onChange={handleSimpleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                placeholder="Opcional"
              />
            </div>
          </div>
        </div>

        {/* Bloque 3: Usos previstos y eficiencia */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-semibold" style={{ color: effectivePrimaryColor }}>
              3. Usos previstos y eficiencia
            </h2>
          </div>

          <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1 md:col-span-2">
              <p className="text-xs text-gray-500">
                Primero definí la <strong>eficiencia global</strong> del proyecto y los <strong>m² por unidad</strong>.
                Con eso estimamos cuántas unidades podrían venderse (redondeo hacia abajo).
              </p>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Eficiencia global del proyecto</label>
              <input
                name="eficienciaGlobal"
                type="number"
                inputMode="decimal"
                value={formData.eficienciaGlobal ?? ''}
                onChange={handleSimpleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                placeholder="Ej: 0.8 (80% vendible sobre total construido)"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">m² por unidad</label>
              <input
                name="metrosPorUnidad"
                type="number"
                inputMode="decimal"
                value={formData.metrosPorUnidad ?? ''}
                onChange={handleSimpleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                placeholder="Ej: 40"
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Valor de venta por unidad</label>
              <input
                name="valorVentaPorUnidad"
                type="number"
                inputMode="decimal"
                value={formData.valorVentaPorUnidad ?? ''}
                onChange={handleSimpleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                placeholder="Ej: 40000000"
              />
            </div>

            {/* Card de métricas clave */}
            <div className="md:col-span-2 mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs sm:text-sm">
              <p className="font-semibold mb-1">Métricas estimadas</p>
              <p>
                m² construibles (estimados):{' '}
                <strong>{numero(calculos.superficieConstruibleTotal)} m²</strong>
              </p>
              <p>
                m² vendibles (estimados): <strong>{numero(calculos.superficieVendibleTotal)} m²</strong>
              </p>
              <p>
                m² no vendibles (estimados): <strong>{numero(calculos.superficieComun)} m²</strong>
              </p>
              <p>
                Unidades posibles (aprox.): <strong>{numero(calculos.unidadesVendibles)}</strong>
              </p>
              <p>
                Valor total de unidades vendibles:{' '}
                <strong>{peso(calculos.valorTotalUnidadesVendibles || null)}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Bloque 4: Incidencia del lote y precio sugerido */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-semibold" style={{ color: effectivePrimaryColor }}>
              4. Incidencia del lote y precio sugerido
            </h2>
          </div>

          <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Índice de incidencia zonal del terreno
              </label>
              <input
                name="indiceIncidenciaZonal"
                type="number"
                inputMode="decimal"
                value={formData.indiceIncidenciaZonal ?? ''}
                onChange={handleSimpleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                placeholder="Ej: 0.10 → 10%"
              />
              <p className="text-[11px] text-gray-500">
                Se aplica sobre el <em>valor total de unidades vendibles</em> para estimar cuánto debería valer el lote.
              </p>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Precio de demolición por m²</label>
              <input
                name="costoDemolicionM2"
                type="number"
                inputMode="decimal"
                value={formData.costoDemolicionM2 ?? ''}
                onChange={handleSimpleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                placeholder="Ej: 60000"
              />
              <p className="text-[11px] text-gray-500">
                Se descuenta del precio sugerido: (m² a demoler) × (precio por m²).
              </p>
            </div>

            {/* Card de resultado único */}
            <div className="md:col-span-2 mt-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm sm:text-base space-y-1">
              <p className="font-semibold">Resultado</p>
              <p>
                Precio sugerido del lote:{' '}
                <span className="font-bold">
                  {peso(calculos.precioSugeridoLote ?? null)}
                </span>
              </p>
              <p className="text-xs text-gray-600">
                Fórmula: (Valor total de unidades vendibles × índice) − (m² a demoler × precio demolición/m²).
              </p>
            </div>
          </div>
        </div>

        {/* Bloque 5: Conclusión */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-semibold" style={{ color: effectivePrimaryColor }}>
              5. Conclusión
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:gap-5 p-4 sm:p-6">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Observaciones generales</label>
              <textarea
                name="observaciones"
                value={formData.observaciones}
                onChange={handleSimpleChange}
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                placeholder="Aspectos relevantes a considerar sobre el lote y el proyecto."
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Riesgos</label>
              <textarea
                name="riesgos"
                value={formData.riesgos}
                onChange={handleSimpleChange}
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                placeholder="Riesgos normativos, de mercado, constructivos, etc."
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Oportunidades</label>
              <textarea
                name="oportunidades"
                value={formData.oportunidades}
                onChange={handleSimpleChange}
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                placeholder="Potenciales fortalezas del proyecto y de la localización."
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Notas adicionales</label>
              <textarea
                name="notasAdicionales"
                value={formData.notasAdicionales}
                onChange={handleSimpleChange}
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                placeholder="Cualquier otra información relevante para la decisión."
              />
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="mt-6">
          <div className="flex flex-col sm:flex-row flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={saveInforme}
                disabled={isSubmitting}
                className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-white w-full sm:w-auto text-center disabled:opacity-60"
                style={{ backgroundColor: effectivePrimaryColor }}
              >
                {isSubmitting ? 'Guardando...' : 'Guardar Informe'}
              </button>

              <button
                type="button"
                onClick={loadInforme}
                className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold w-full sm:w-auto text-center border"
              >
                Cargar Informe
              </button>
            </div>

            <div>
              <button
                type="button"
                onClick={handleDownloadPDF}
                className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-white w-full sm:w-auto text-center"
                style={{ backgroundColor: effectivePrimaryColor }}
              >
                Descargar PDF
              </button>
            </div>
          </div>

          <div className="mt-3 space-y-1">
            {saveMsg && (
              <p className={saveMsg.type === 'success' ? 'text-green-600' : 'text-red-600'}>{saveMsg.text}</p>
            )}
            {loadMsg && (
              <p className={loadMsg.type === 'success' ? 'text-green-600' : 'text-red-600'}>{loadMsg.text}</p>
            )}
            {informeId && (
              <p className="text-xs text-gray-500">ID actual del informe: {informeId}</p>
            )}
          </div>
        </div>
      </div>

      {/* Modal de carga */}
      {loadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5">
            <h3 className="text-lg font-semibold text-gray-800 mb-1">
              Informe de Factibilidad Constructiva
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Ingresá el ID del informe que querés cargar
            </p>

            <input
              type="text"
              value={loadIdInput}
              onChange={(e) => setLoadIdInput(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-sky-500"
              placeholder="Ej: 4b3a6d1e-...."
            />

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setLoadOpen(false)}
                className="px-4 py-2 rounded-lg border text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmLoad}
                className="px-4 py-2 rounded-lg text-white"
                style={{ backgroundColor: effectivePrimaryColor }}
              >
                Cargar
              </button>
            </div>

            {loadMsg && (
              <p className={loadMsg.type === 'success' ? 'text-green-600 mt-3' : 'text-red-600 mt-3'}>
                {loadMsg.text}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
