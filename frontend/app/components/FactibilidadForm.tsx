'use client';

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

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

  superficieDemoler: number | null;     // solo informativo (no resta)
  superficieConservar: number | null;   // solo informativo (no resta)

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

  // 🔹 Perfilería (opcional)
  perfilAnguloGrados: number | null;   // ej. 45°
  perfilDesdePiso: number | null;      // ej. 8

  // Bloque 3: Usos y eficiencia (simplificado)
  eficienciaGlobal: number | null;     // ej. 0.80
  metrosPorUnidad: number | null;      // ej. 40 (m²)
  valorVentaPorUnidad: number | null;  // ej. 40000 (ARS, USD, etc.)

  // Bloque 5: Incidencia
  indiceIncidenciaZonal: number | null; // ej. 0.10 (10%)

  // Conclusión
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
    ? '—'
    : n.toLocaleString('es-AR', {
        style: 'currency',
        currency: 'ARS',
        maximumFractionDigits: 0,
      });

const numero = (n: number | null | undefined, dec = 0) =>
  n == null || isNaN(n)
    ? '—'
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
    if (
      name === 'requiereCorazonManzana' ||
      name === 'permiteSubsuelo'
    ) {
      setFormData((prev) => ({
        ...prev,
        [name]: value === 'true',
      }));
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
      'nivelesSubsuelo',
      'perfilAnguloGrados',
      'perfilDesdePiso',
      'indiceIncidenciaZonal',
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
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
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

    setFormData((prev) => ({
      ...prev,
      fotoLoteBase64: b64,
      fotoLoteUrl: '',
    }));
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

    // Superficie por FOT (tope absoluto)
    const superficieMaxPorFOT =
      sLote > 0 && FOT !== null ? sLote * FOT : null;

    // Superficie por altura/pisos (con o sin perfilería)
    let superficieMaxPorAltura: number | null = null;

    if (sLote > 0 && FOS !== null && pisos !== null && pisos > 0) {
      const plantaBase = sLote * FOS;

      const ang = formData.perfilAnguloGrados ?? null;
      const desde = formData.perfilDesdePiso ?? null;
      const fondo = formData.fondo ?? null;

      // Sin perfilería → homogéneo
      if (
        ang == null ||
        isNaN(ang) ||
        desde == null ||
        isNaN(desde) ||
        fondo == null ||
        isNaN(fondo) ||
        fondo <= 0 ||
        ang <= 0
      ) {
        superficieMaxPorAltura = plantaBase * pisos;
      } else {
        // Con perfilería: reducimos profundidad a partir de "desde"
        const angleRad = (ang * Math.PI) / 180;
        const avancePorPiso = Math.tan(angleRad) * 3; // 3m por piso
        const anchoBase = plantaBase / fondo;

        let suma = 0;
        for (let p = 1; p <= pisos; p++) {
          if (p < desde) {
            suma += plantaBase;
          } else {
            const pasos = p - (desde - 1);
            const profundidad = Math.max(fondo - avancePorPiso * pasos, 0);
            const areaPiso = Math.max(anchoBase * profundidad, 0);
            suma += areaPiso;
          }
        }
        superficieMaxPorAltura = suma;
      }
    }

    // Tomar el mínimo que exista, o el único que haya
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

    // Superficie vendible (según eficiencia)
    const eff = formData.eficienciaGlobal ?? null;
    const superficieVendibleTotal =
      superficieConstruibleTotal !== null && eff !== null
        ? superficieConstruibleTotal * eff
        : null;

    // Cálculo interno para precio de lote (no se muestran intermedios)
    let unidadesPosibles: number | null = null;
    if (
      superficieVendibleTotal !== null &&
      formData.metrosPorUnidad !== null &&
      formData.metrosPorUnidad > 0
    ) {
      unidadesPosibles = Math.floor(
        superficieVendibleTotal / formData.metrosPorUnidad
      );
    }

    let valorTotalVentas: number | null = null;
    if (
      unidadesPosibles !== null &&
      formData.valorVentaPorUnidad !== null &&
      formData.valorVentaPorUnidad > 0
    ) {
      valorTotalVentas = unidadesPosibles * formData.valorVentaPorUnidad;
    }

    let precioSugeridoLote: number | null = null;
    if (
      valorTotalVentas !== null &&
      formData.indiceIncidenciaZonal !== null &&
      formData.indiceIncidenciaZonal >= 0
    ) {
      precioSugeridoLote = valorTotalVentas * formData.indiceIncidenciaZonal;
    }

    return {
      superficieMaxPorFOT,
      superficieMaxPorAltura,
      superficieConstruibleTotal,
      superficieVendibleTotal,
      precioSugeridoLote,
    };
  }, [formData]);
  /* =========================
   *  Guardar / Cargar
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

      // Subimos foto (si hay base64)
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

      const res = await fetch(
        `/api/factibilidad/get?id=${encodeURIComponent(loadIdInput)}`
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || 'No se pudo obtener el informe');
      }

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
   *  PDF (simplificado para esta versión)
   * ========================= */

  const handleDownloadPDF = async () => {
    const { jsPDF } = await import('jspdf');

    const doc = new jsPDF('p', 'pt', 'a4');
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 40;
    let y = margin;

    const themeLogo = (theme as any)?.logoUrlBusted ?? (theme as any)?.logoUrl ?? null;
    const anyUser = user as any;

    const hexToRgb = (hex: string) => {
      const m = hex.replace('#', '');
      const int = parseInt(m.length === 3 ? m.split('').map((c) => c + c).join('') : m, 16);
      return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
    };

    const pc = hexToRgb(effectivePrimaryColor);

    // Título centrado
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(pc.r, pc.g, pc.b);
    doc.text('Factibilidad Constructiva', pageW / 2, y, { align: 'center' });
    doc.setTextColor(0, 0, 0);

    // Fecha a la derecha
    doc.setFontSize(10);
    doc.text(
      new Date(formData.date || new Date().toISOString()).toLocaleDateString('es-AR'),
      pageW - margin,
      y,
      { align: 'right' }
    );

    // Logo opcional centrado debajo del título
    if (themeLogo) {
      try {
        const base64Img = await fetchToDataURL(themeLogo);
        if (base64Img) {
          const logoW = 70;
          const logoH = 70;
          const centerX = pageW / 2 - logoW / 2;
          doc.addImage(base64Img, 'PNG', centerX, y + 10, logoW, logoH, undefined, 'FAST');
        }
      } catch (err) {
        console.warn('No se pudo cargar el logo en PDF factibilidad', err);
      }
    }

    y += 95;

    // Separador
    doc.setDrawColor(pc.r, pc.g, pc.b);
    doc.setLineWidth(0.8);
    doc.line(margin, y, pageW - margin, y);
    y += 18;

    // Bloque: Datos del lote (resumen)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(pc.r, pc.g, pc.b);
    doc.text('Datos del Lote', pageW / 2, y, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    y += 16;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const lh = 14;

    const linesLote = [
      `Proyecto: ${formData.nombreProyecto || '—'}`,
      `Dirección: ${formData.direccion || '—'}`,
      `Localidad: ${formData.localidad || '—'}`,
      `Barrio: ${formData.barrio || '—'}`,
      `Zona / Distrito: ${formData.zona || '—'}`,
      `Superficie de lote: ${numero(formData.superficieLote)} m²`,
      `Frente: ${numero(formData.frente)} m`,
      `Fondo: ${numero(formData.fondo)} m`,
      `Implantación: ${
        formData.tipoImplantacion === 'entre_medianeras'
          ? 'Entre medianeras'
          : formData.tipoImplantacion === 'esquina'
          ? 'Esquina'
          : formData.tipoImplantacion === 'dos_frentes'
          ? 'Dos frentes'
          : 'Otro'
      }`,
    ];

    let yTemp = y;
    linesLote.forEach((t) => {
      doc.text(t, margin, yTemp);
      yTemp += lh;
    });

    // Foto (si hay)
    let fotoDataURL: string | null = null;
    if (formData.fotoLoteBase64) fotoDataURL = formData.fotoLoteBase64;
    else if (formData.fotoLoteUrl) fotoDataURL = await fetchToDataURL(formData.fotoLoteUrl);

    if (fotoDataURL) {
      try {
        const imgW = 180;
        const imgH = 135;
        doc.addImage(fotoDataURL, 'JPEG', pageW - margin - imgW, y, imgW, imgH, undefined, 'FAST');
        yTemp = Math.max(yTemp, y + imgH + 8);
      } catch (err) {
        console.warn('No se pudo agregar foto de lote al PDF', err);
      }
    }
    y = yTemp + 6;

    if (y > pageH - 160) {
      doc.addPage();
      y = margin;
    }

    // Bloque: Normativa y morfología (resumen)
    doc.setDrawColor(pc.r, pc.g, pc.b);
    doc.line(margin, y, pageW - margin, y);
    y += 18;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(pc.r, pc.g, pc.b);
    doc.text('Normativa y Morfología', pageW / 2, y, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    y += 16;

    const normasIzq = [
      `FOS: ${numero(formData.FOS, 2)}`,
      `FOT: ${numero(formData.FOT, 2)}`,
      `Altura máxima: ${numero(formData.alturaMaxima)} m`,
      `Pisos máximos: ${numero(formData.pisosMaximos)}`,
    ];

    const normasDer = [
      `Retiros frente: ${numero(formData.retiroFrente)} m`,
      `Retiros fondo: ${numero(formData.retiroFondo)} m`,
      `Retiros laterales: ${numero(formData.retiroLaterales)} m`,
      `Perfilería: ${
        formData.perfilAnguloGrados != null && formData.perfilDesdePiso != null
          ? `${numero(formData.perfilAnguloGrados)}° desde piso ${numero(formData.perfilDesdePiso)}`
          : '—'
      }`,
    ];

    let yN1 = y;
    normasIzq.forEach((t) => {
      doc.text(t, margin, yN1);
      yN1 += lh;
    });

    let yN2 = y;
    normasDer.forEach((t) => {
      doc.text(t, pageW / 2, yN2);
      yN2 += lh;
    });

    y = Math.max(yN1, yN2) + 8;

    if (y > pageH - 160) {
      doc.addPage();
      y = margin;
    }

    // Bloque: Usos y eficiencia (resumen)
    doc.setDrawColor(pc.r, pc.g, pc.b);
    doc.line(margin, y, pageW - margin, y);
    y += 18;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(pc.r, pc.g, pc.b);
    doc.text('Usos y Eficiencia', pageW / 2, y, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    y += 16;

    const usos = [
      `Eficiencia global: ${numero(formData.eficienciaGlobal, 2)}`,
      `m² por unidad: ${numero(formData.metrosPorUnidad)}`,
      `Valor de venta por unidad: ${peso(formData.valorVentaPorUnidad || null)}`,
    ];
    usos.forEach((t) => {
      doc.text(t, margin, y);
      y += lh;
    });

    if (y > pageH - 160) {
      doc.addPage();
      y = margin;
    }

    // Bloque: Resultado (solo Precio Sugerido del Lote)
    doc.setDrawColor(pc.r, pc.g, pc.b);
    doc.line(margin, y, pageW - margin, y);
    y += 18;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(pc.r, pc.g, pc.b);
    doc.text('Resultado', pageW / 2, y, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    y += 24;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    const precioTxt = peso(calculos.precioSugeridoLote ?? null);
    doc.text(`Precio sugerido del lote: ${precioTxt}`, pageW / 2, y, { align: 'center' });
    y += 28;

    if (y > pageH - 160) {
      doc.addPage();
      y = margin;
    }

    // Bloque: Conclusión
    doc.setDrawColor(pc.r, pc.g, pc.b);
    doc.line(margin, y, pageW - margin, y);
    y += 18;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(pc.r, pc.g, pc.b);
    doc.text('Conclusión', pageW / 2, y, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    y += 14;

    const block = (title: string, text: string) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(title, margin, y);
      y += 12;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(text || '—', pageW - margin * 2);
      doc.text(lines as any, margin, y);
      y += (Array.isArray(lines) ? (lines as string[]).length : 1) * 14 + 8;
      if (y > pageH - 80) {
        doc.addPage();
        y = margin;
      }
    };

    block('Observaciones', formData.observaciones);
    block('Riesgos', formData.riesgos);
    block('Oportunidades', formData.oportunidades);
    block('Notas adicionales', formData.notasAdicionales);

    // Footer simple
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    const footerText = `${(anyUser?.nombre || '—')} ${(anyUser?.apellido || '')}`.trim();
    doc.text(footerText || '—', pageW / 2, pageH - 30, { align: 'center' });

    doc.save('Informe_Factibilidad.pdf');
  };

  /* =========================
   *  Render
   * ========================= */

  return (
    <>
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header del formulario (nuevo layout) */}
        <div className="flex items-center justify-between gap-4 mb-2 border-b pb-3">
          <div className="w-24" />
          <div className="text-xl sm:text-2xl font-semibold text-center grow">
            Factibilidad Constructiva
          </div>
          <div className="text-sm whitespace-nowrap">
            {new Date(formData.date || new Date().toISOString()).toLocaleDateString('es-AR')}
          </div>
        </div>

        {/* 1) Datos del lote + Foto */}
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
                  placeholder="Ej: 250"
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
                  placeholder="Ej: 25"
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

        {/* 2) Normativa / Morfología */}
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
                placeholder="Ej: 0.6"
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
              <label className="block text-sm font-medium text-gray-700">Perfilería – Ángulo (°)</label>
              <input
                name="perfilAnguloGrados"
                type="number"
                inputMode="decimal"
                value={formData.perfilAnguloGrados ?? ''}
                onChange={handleSimpleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                placeholder="Ej: 45"
              />
              <p className="text-[11px] text-gray-500">Si se deja vacío, se asume edificio homogéneo en todos los pisos.</p>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Perfilería – Desde el piso N°</label>
              <input
                name="perfilDesdePiso"
                type="number"
                inputMode="decimal"
                value={formData.perfilDesdePiso ?? ''}
                onChange={handleSimpleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                placeholder="Ej: 8"
              />
              <p className="text-[11px] text-gray-500">Se aplica la reducción de planta desde este nivel inclusive.</p>
            </div>
          </div>
        </div>

        {/* 3) Usos previstos y eficiencia (simplificado) */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-semibold" style={{ color: effectivePrimaryColor }}>
              3. Usos previstos y eficiencia
            </h2>
          </div>

          <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Eficiencia global del proyecto</label>
              <input
                name="eficienciaGlobal"
                type="number"
                inputMode="decimal"
                value={formData.eficienciaGlobal ?? ''}
                onChange={handleSimpleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                placeholder="Ej: 0.80"
              />
              <p className="text-[11px] text-gray-500">Proporción vendible sobre la superficie construible total.</p>
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

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Valor de venta por unidad</label>
              <input
                name="valorVentaPorUnidad"
                type="number"
                inputMode="decimal"
                value={formData.valorVentaPorUnidad ?? ''}
                onChange={handleSimpleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                placeholder="Ej: 40000"
              />
            </div>
          </div>
        </div>

        {/* 4) Resultado: solo Precio sugerido del lote */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-semibold" style={{ color: effectivePrimaryColor }}>
              4. Incidencia del lote y precio sugerido
            </h2>
          </div>

          <div className="p-4 sm:p-6 space-y-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Índice de incidencia zonal del terreno</label>
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
                Proporción del valor total de ventas que se asigna al valor del terreno.
              </p>
            </div>

            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm sm:text-base">
              <p className="font-semibold mb-1">Precio sugerido del lote</p>
              <p className="text-2xl font-bold">
                {peso(calculos.precioSugeridoLote ?? null)}
              </p>
            </div>
          </div>
        </div>

        {/* 5) Conclusión */}
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
              <p className={saveMsg.type === 'success' ? 'text-green-600' : 'text-red-600'}>
                {saveMsg.text}
              </p>
            )}
            {loadMsg && (
              <p className={loadMsg.type === 'success' ? 'text-green-600' : 'text-red-600'}>
                {loadMsg.text}
              </p>
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
