'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ACMFormData,
  ComparableProperty,
  LocationQuality,
  Orientation,
  PropertyCondition,
  PropertyType,
  Services,
  TitleType,
} from '@/app/types/acm.types';

export default function ACMForm() {
  // Estado principal
  const [formData, setFormData] = useState<ACMFormData>(() => ({
    date: new Date().toISOString(), // ISO automático
    clientName: '',
    advisorName: '',
    phone: '',
    email: '',
    address: '',
    neighborhood: '',
    locality: '',
    propertyType: PropertyType.CASA,
    landArea: 0,
    builtArea: 0,
    hasPlans: false,
    titleType: TitleType.ESCRITURA,
    age: 0,
    condition: PropertyCondition.BUENO,
    locationQuality: LocationQuality.BUENA,
    orientation: Orientation.NORTE,
    services: {
      luz: false,
      agua: false,
      gas: false,
      cloacas: false,
      pavimento: false,
    },
    isRented: false,
    mainPhotoUrl: '',
    mainPhotoBase64: undefined,
    comparables: [
      {
        builtArea: 0,
        price: 0,
        listingUrl: '',
        description: '',
        daysPublished: 0,
        pricePerM2: 0,
        coefficient: 1,
      },
    ],
    observations: '',
    considerations: '',
    strengths: '',
    weaknesses: '',
  }));

  const [primaryColor, setPrimaryColor] = useState<string>('#1d4ed8'); // color configurable (azul tailwind 700 aprox.)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Asegura que la fecha sea formato YYYY-MM-DD para mostrar arriba si querés
  const displayDate = useMemo(() => formData.date.substring(0, 10), [formData.date]);

  // ---------- Helpers de cambio (sin checked) ----------

  // Texto o número genérico (para inputs y selects de enums/números)
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value,
    }));
  };

  // Select Sí/No -> boolean (para hasPlans / isRented)
  const handleBooleanSelect = (name: keyof Pick<ACMFormData, 'hasPlans' | 'isRented'>, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value === 'true' }));
  };

  // Servicios (cada uno es boolean con Sí/No)
  const handleServiceSelect = (field: keyof Services, value: string) => {
    setFormData((prev) => ({
      ...prev,
      services: { ...prev.services, [field]: value === 'true' },
    }));
  };

  // Comparables: distintos tipos de campo
  const handleComparableChange = <K extends keyof ComparableProperty>(
    index: number,
    field: K,
    rawValue: string
  ) => {
    setFormData((prev) => {
      const comps = [...prev.comparables];
      const current = { ...comps[index] };

      const numericFields: Array<keyof ComparableProperty> = [
        'builtArea',
        'price',
        'daysPublished',
        'pricePerM2',
        'coefficient',
      ];

      if (numericFields.includes(field)) {
        const num = field === 'coefficient' ? parseFloat(rawValue) : Number(rawValue);
        (current[field] as unknown as number) = Number.isFinite(num) ? num : 0;
      } else {
        (current[field] as unknown as string) = rawValue;
      }

      // Recalcular valor m²
      current.pricePerM2 = current.builtArea > 0 ? current.price / current.builtArea : 0;

      comps[index] = current;
      return { ...prev, comparables: comps };
    });
  };

  const addComparable = () => {
    setFormData((prev) => {
      if (prev.comparables.length >= 4) return prev;
      return {
        ...prev,
        comparables: [
          ...prev.comparables,
          {
            builtArea: 0,
            price: 0,
            listingUrl: '',
            description: '',
            daysPublished: 0,
            pricePerM2: 0,
            coefficient: 1,
          },
        ],
      };
    });
  };

  const removeComparable = (index: number) => {
    setFormData((prev) => {
      if (prev.comparables.length <= 1) return prev;
      const comps = [...prev.comparables];
      comps.splice(index, 1);
      return { ...prev, comparables: comps };
    });
  };

  // Foto principal -> base64 + preview
  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const toBase64 = (file: File) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

    const base64 = await toBase64(file);
    const url = URL.createObjectURL(file);

    setFormData((prev) => ({
      ...prev,
      mainPhotoBase64: base64,
      mainPhotoUrl: url,
    }));
  };

  // Orden alfabético de Tipologías
  const propertyTypeOptions = useMemo(
    () => Object.values(PropertyType).sort((a, b) => a.localeCompare(b, 'es')),
    []
  );

  // Opciones de enums
  const titleTypeOptions = Object.values(TitleType);
  const conditionOptions = Object.values(PropertyCondition);
  const locationOptions = Object.values(LocationQuality);
  const orientationOptions = Object.values(Orientation);

  // Coeficiente 0.1 a 1.0
  const coefficientOptions = useMemo(() => {
    const arr: number[] = [];
    for (let x = 0.1; x <= 1.0 + 1e-9; x += 0.1) {
      arr.push(Number(x.toFixed(1)));
    }
    return arr;
  }, []);

  // ---------- PDF ----------
  const downloadPdf = async () => {
    try {
      setIsGeneratingPdf(true);
      const { jsPDF } = await import('jspdf');

      const doc = new jsPDF({ unit: 'pt' });
      const marginX = 40;
      let y = 50;

      // Encabezado
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(primaryColor);
      doc.text('Informe ACM', marginX, y);
      y += 24;

      doc.setFontSize(10);
      doc.setTextColor('#111111');
      doc.setFont('helvetica', 'normal');
      doc.text(`Fecha: ${displayDate}`, marginX, y);
      y += 18;
      doc.text(`Agente: ${formData.advisorName || '-'}`, marginX, y);
      y += 18;
      doc.text(`Cliente: ${formData.clientName || '-'}`, marginX, y);
      y += 26;

      // Datos Propiedad
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(primaryColor);
      doc.text('Datos de la Propiedad', marginX, y);
      y += 16;

      doc.setTextColor('#111111');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);

      const lines: string[] = [
        `Dirección: ${formData.address || '-'}`,
        `Barrio: ${formData.neighborhood || '-'} | Localidad: ${formData.locality || '-'}`,
        `Tipología: ${formData.propertyType}`,
        `m² Terreno: ${formData.landArea} | m² Cubiertos: ${formData.builtArea}`,
        `Antigüedad: ${formData.age} | Título: ${formData.titleType}`,
        `Estado: ${formData.condition} | Ubicación: ${formData.locationQuality} | Orientación: ${formData.orientation}`,
        `Planos: ${formData.hasPlans ? 'Sí' : 'No'} | Posee renta: ${formData.isRented ? 'Sí' : 'No'}`,
      ];

      lines.forEach((t) => {
        doc.text(t, marginX, y);
        y += 16;
      });

      // Servicios
      y += 8;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(primaryColor);
      doc.text('Servicios', marginX, y);
      y += 16;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor('#111111');
      const serviciosTxt = [
        `Luz: ${formData.services.luz ? '✓' : '✗'}`,
        `Agua: ${formData.services.agua ? '✓' : '✗'}`,
        `Gas: ${formData.services.gas ? '✓' : '✗'}`,
        `Cloacas: ${formData.services.cloacas ? '✓' : '✗'}`,
        `Pavimento: ${formData.services.pavimento ? '✓' : '✗'}`,
      ].join('   |   ');
      doc.text(serviciosTxt, marginX, y);
      y += 20;

      // Foto (si existe)
      if (formData.mainPhotoBase64) {
        const imgWidth = 240;
        const imgHeight = 160;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(primaryColor);
        doc.text('Foto de la propiedad', marginX, y);
        y += 10;
        doc.addImage(formData.mainPhotoBase64, 'JPEG', marginX, y, imgWidth, imgHeight);
        y += imgHeight + 20;
      }

      // Comparables
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(primaryColor);
      doc.text('Propiedades comparadas en la zona', marginX, y);
      y += 16;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor('#111111');
      doc.setFontSize(10);

      // Cabecera tabla
      const headers = ['m²', 'Precio', 'Precio/m²', 'Coef.', 'Días', 'Link'];
      const colX = [marginX, marginX + 60, marginX + 160, marginX + 260, marginX + 320, marginX + 370];
      doc.setFont('helvetica', 'bold');
      headers.forEach((h, i) => doc.text(h, colX[i], y));
      y += 14;
      doc.setFont('helvetica', 'normal');

      formData.comparables.forEach((c) => {
        const row = [
          String(c.builtArea),
          formatCurrency(c.price),
          formatCurrency(c.pricePerM2),
          String(c.coefficient),
          String(c.daysPublished),
          c.listingUrl || '-',
        ];
        row.forEach((cell, i) => {
          const maxWidth = i === 5 ? 200 : 90; // link más ancho
          const split = doc.splitTextToSize(cell, maxWidth);
          doc.text(split, colX[i], y);
        });
        y += 18;
      });

      // Conclusión
      y += 10;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(primaryColor);
      doc.text('Conclusión', marginX, y);
      y += 16;

      doc.setFont('helvetica', 'bold');
      doc.setTextColor('#111111');
      doc.setFontSize(11);
      y = addParagraphBlock(doc, 'Observaciones', formData.observations, marginX, y);
      y = addParagraphBlock(doc, 'Fortalezas', formData.strengths, marginX, y);
      y = addParagraphBlock(doc, 'Debilidades', formData.weaknesses, marginX, y);
      y = addParagraphBlock(doc, 'A Considerar', formData.considerations, marginX, y);

      // Pie
      y += 10;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor('#666');
      doc.text(`Generado el ${new Date().toLocaleString()}`, marginX, y);

      doc.save(`informe-acm-${displayDate}.pdf`);
    } catch (err) {
      console.error(err);
      alert('No se pudo generar el PDF.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // ---------- UI ----------
  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Encabezado + color primario */}
      <div className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Análisis Comparativo de Mercado (ACM)</h1>
          <p className="text-sm text-gray-600">Fecha: <span className="font-medium">{displayDate}</span></p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600">Color primario</label>
          <input
            type="color"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="w-10 h-10 rounded border border-gray-200"
            aria-label="Elegir color primario"
          />
        </div>
      </div>

      {/* Datos del cliente / propiedad + foto derecha */}
      <section className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 border-b pb-3 mb-6">Datos del Cliente / Propiedad</h2>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna izquierda (2/3) */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
            <TextField label="Cliente" name="clientName" value={formData.clientName} onChange={handleChange} />
            <TextField label="Agente" name="advisorName" value={formData.advisorName} onChange={handleChange} />
            <TextField label="Teléfono" name="phone" value={formData.phone} onChange={handleChange} />
            <TextField label="Email" type="email" name="email" value={formData.email} onChange={handleChange} />
            <TextField label="Dirección" name="address" value={formData.address} onChange={handleChange} />
            <TextField label="Barrio" name="neighborhood" value={formData.neighborhood} onChange={handleChange} />
            <TextField label="Localidad" name="locality" value={formData.locality} onChange={handleChange} />

            {/* Tipología (alfabética) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tipología</label>
              <select
                name="propertyType"
                value={formData.propertyType}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {propertyTypeOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <NumberField label="m² Terreno" name="landArea" value={formData.landArea} onChange={handleChange} />
            <NumberField label="m² Cubiertos" name="builtArea" value={formData.builtArea} onChange={handleChange} />

            {/* Planos (Sí/No) */}
            <BooleanSelect
              label="Planos"
              value={formData.hasPlans}
              onChange={(v) => handleBooleanSelect('hasPlans', v)}
            />

            {/* Título */}
            <EnumSelect
              label="Título"
              name="titleType"
              value={formData.titleType}
              options={titleTypeOptions}
              onChange={handleChange}
            />

            <NumberField label="Antigüedad" name="age" value={formData.age} onChange={handleChange} />

            {/* Estado / Ubicación / Orientación */}
            <EnumSelect
              label="Estado"
              name="condition"
              value={formData.condition}
              options={conditionOptions}
              onChange={handleChange}
            />
            <EnumSelect
              label="Ubicación"
              name="locationQuality"
              value={formData.locationQuality}
              options={locationOptions}
              onChange={handleChange}
            />
            <EnumSelect
              label="Orientación"
              name="orientation"
              value={formData.orientation}
              options={orientationOptions}
              onChange={handleChange}
            />

            {/* Servicios */}
            <div className="md:col-span-2">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Servicios</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <ServiceSelect label="Luz" value={formData.services.luz} onChange={(v) => handleServiceSelect('luz', v)} />
                <ServiceSelect label="Agua" value={formData.services.agua} onChange={(v) => handleServiceSelect('agua', v)} />
                <ServiceSelect label="Gas" value={formData.services.gas} onChange={(v) => handleServiceSelect('gas', v)} />
                <ServiceSelect label="Cloacas" value={formData.services.cloacas} onChange={(v) => handleServiceSelect('cloacas', v)} />
                <ServiceSelect label="Pavimento" value={formData.services.pavimento} onChange={(v) => handleServiceSelect('pavimento', v)} />
              </div>
            </div>

            {/* Renta (Sí/No) */}
            <BooleanSelect
              label="Posee renta actualmente"
              value={formData.isRented}
              onChange={(v) => handleBooleanSelect('isRented', v)}
            />
          </div>

          {/* Columna derecha (1/3) - Foto */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">Foto de la propiedad</label>
            <input
              type="file"
              accept="image/*"
              onChange={handlePhoto}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {formData.mainPhotoUrl ? (
              <img
                src={formData.mainPhotoUrl}
                alt="Foto de la propiedad"
                className="w-full aspect-video object-cover rounded-lg border"
              />
            ) : (
              <div className="w-full aspect-video rounded-lg border border-dashed grid place-items-center text-gray-400 text-sm">
                Sin imagen
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Comparables */}
      <section className="bg-white rounded-lg shadow p-6 mb-8">
        <div className="flex items-center justify-between border-b pb-3 mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Propiedades comparadas en la zona</h2>
          <button
            type="button"
            onClick={addComparable}
            className="px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={formData.comparables.length >= 4}
          >
            Agregar comparable
          </button>
        </div>

        <div className="space-y-6">
          {formData.comparables.map((c, i) => (
            <div key={i} className="rounded-lg border p-4">
              <div className="flex items-start justify-between">
                <h3 className="font-semibold text-gray-900">Comparable #{i + 1}</h3>
                <button
                  type="button"
                  onClick={() => removeComparable(i)}
                  className="text-sm text-red-600 hover:text-red-700"
                  disabled={formData.comparables.length <= 1}
                >
                  Eliminar
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <NumberField
                  label="m² Cubiertos"
                  name={`builtArea-${i}`}
                  value={c.builtArea}
                  onChange={(e) => handleComparableChange(i, 'builtArea', e.target.value)}
                />
                <NumberField
                  label="Precio publicado"
                  name={`price-${i}`}
                  value={c.price}
                  onChange={(e) => handleComparableChange(i, 'price', e.target.value)}
                />
                <NumberField
                  label="Días publicada"
                  name={`daysPublished-${i}`}
                  value={c.daysPublished}
                  onChange={(e) => handleComparableChange(i, 'daysPublished', e.target.value)}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Link publicación / Drive</label>
                  <input
                    type="url"
                    value={c.listingUrl}
                    onChange={(e) => handleComparableChange(i, 'listingUrl', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="https://..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Coeficiente</label>
                  <select
                    value={c.coefficient}
                    onChange={(e) => handleComparableChange(i, 'coefficient', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {coefficientOptions.map((v) => (
                      <option key={v} value={v}>
                        {v.toFixed(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Precio por m²</label>
                  <input
                    type="text"
                    value={formatCurrency(c.pricePerM2)}
                    readOnly
                    className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-600"
                  />
                </div>

                <div className="md:col-span-2 lg:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Descripción</label>
                  <textarea
                    value={c.description}
                    onChange={(e) => handleComparableChange(i, 'description', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Conclusión */}
      <section className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 border-b pb-3 mb-6">Conclusión</h2>
        <div className="grid grid-cols-1 gap-6">
          <TextAreaField
            label="Observaciones"
            name="observations"
            value={formData.observations}
            onChange={handleChange}
          />
          <TextAreaField label="Fortalezas" name="strengths" value={formData.strengths} onChange={handleChange} />
          <TextAreaField
            label="Debilidades"
            name="weaknesses"
            value={formData.weaknesses}
            onChange={handleChange}
          />
          <TextAreaField
            label="A Considerar"
            name="considerations"
            value={formData.considerations}
            onChange={handleChange}
          />
        </div>
      </section>

      {/* Acciones */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={downloadPdf}
          className="px-4 py-2 rounded-lg text-white"
          style={{ backgroundColor: primaryColor }}
          disabled={isGeneratingPdf}
        >
          {isGeneratingPdf ? 'Generando PDF…' : 'Descargar PDF'}
        </button>
      </div>
    </div>
  );
}

/* ---------- Inputs reutilizables ---------- */

function TextField({
  label,
  name,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>
  );
}

function NumberField({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <input
        type="number"
        name={name}
        value={Number.isFinite(value) ? value : 0}
        onChange={onChange}
        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>
  );
}

function TextAreaField({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <textarea
        name={name}
        value={value}
        onChange={onChange}
        rows={4}
        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>
  );
}

function EnumSelect<T extends string>({
  label,
  name,
  value,
  options,
  onChange,
}: {
  label: string;
  name: string;
  value: T;
  options: T[];
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <select
        name={name}
        value={value}
        onChange={onChange}
        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        {options.map((op) => (
          <option key={op} value={op}>
            {op}
          </option>
        ))}
      </select>
    </div>
  );
}

function BooleanSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <select
        value={value ? 'true' : 'false'}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        <option value="false">No</option>
        <option value="true">Sí</option>
      </select>
    </div>
  );
}

function ServiceSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <select
        value={value ? 'true' : 'false'}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        <option value="false">No</option>
        <option value="true">Sí</option>
      </select>
    </div>
  );
}

/* ---------- Utils ---------- */

function formatCurrency(n: number): string {
  if (!Number.isFinite(n)) return '-';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
}

function addParagraphBlock(doc: any, title: string, content: string, x: number, y: number) {
  doc.setFont('helvetica', 'bold');
  doc.text(title, x, y);
  y += 14;
  doc.setFont('helvetica', 'normal');

  const maxWidth = 520;
  const lines = doc.splitTextToSize(content || '-', maxWidth);
  doc.text(lines, x, y);
  y += lines.length * 14 + 10;
  return y;
}
