"use client";

import React, { useState, useEffect } from "react";
import {
  ACMFormData,
  PropertyType,
  TitleType,
  PropertyCondition,
  LocationQuality,
  Orientation,
  ComparableProperty,
} from "@/app/types/acm.types";

export default function ACMForm() {
  const [formData, setFormData] = useState<ACMFormData>({
    date: "",
    clientName: "",
    advisorName: "",
    phone: "",
    email: "",
    address: "",
    neighborhood: "",
    locality: "",
    propertyType: PropertyType.CASA,
    landArea: 0,
    builtArea: 0,
    hasPlans: false,
    titleType: TitleType.ESCRITURA,
    age: 0,
    condition: PropertyCondition.BUENO,
    locationQuality: LocationQuality.BUENA,
    orientation: Orientation.NORTE,
    services: { luz: false, agua: false, gas: false, cloacas: false, pavimento: false },
    isRented: false,
    mainPhotoUrl: "",
    mainPhotoBase64: undefined,
    comparables: [],
    observations: "",
    considerations: "",
    strengths: "",
    weaknesses: "",
  });

  const [primaryColor, setPrimaryColor] = useState("#2563eb"); // azul por defecto

  // Fecha automática
  useEffect(() => {
    setFormData((prev) => ({ ...prev, date: new Date().toISOString() }));
  }, []);

  // Handle cambios de input genéricos
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : type === "number" ? Number(value) : value,
    }));
  };

  // Manejo de servicios
  const handleServiceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      services: {
        ...prev.services,
        [name]: checked,
      },
    }));
  };

  // Manejo de comparables
  const handleComparableChange = (
  index: number,
  field: keyof ComparableProperty,
  value: string | number
) => {
  const copy = [...formData.comparables];
  if (field === "builtArea" || field === "price" || field === "daysPublished" || field === "coefficient") {
    copy[index][field] = Number(value) as any;
  } else {
    copy[index][field] = value as any;
  }

  // recalcular pricePerM2
  copy[index].pricePerM2 =
    copy[index].builtArea > 0 ? copy[index].price / copy[index].builtArea : 0;

  setFormData({ ...formData, comparables: copy });
};
  
  const addComparable = () => {
    if (formData.comparables.length < 4) {
      setFormData((prev) => ({
        ...prev,
        comparables: [
          ...prev.comparables,
          {
            builtArea: 0,
            price: 0,
            listingUrl: "",
            description: "",
            daysPublished: 0,
            pricePerM2: 0,
            coefficient: 1,
          },
        ],
      }));
    }
  };

  const removeComparable = (index: number) => {
    const copy = [...formData.comparables];
    copy.splice(index, 1);
    setFormData({ ...formData, comparables: copy });
  };

  // Manejo de imagen
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData((prev) => ({
        ...prev,
        mainPhotoUrl: URL.createObjectURL(file),
        mainPhotoBase64: reader.result as string,
      }));
    };
    reader.readAsDataURL(file);
  };

  // Descargar PDF
  const downloadPDF = async () => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();

    doc.setTextColor(primaryColor);
    doc.setFontSize(20);
    doc.text("Informe ACM", 105, 20, { align: "center" });

    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Fecha: ${new Date(formData.date).toLocaleDateString()}`, 14, 35);
    doc.text(`Cliente: ${formData.clientName}`, 14, 45);
    doc.text(`Agente: ${formData.advisorName}`, 14, 52);
    doc.text(`Teléfono: ${formData.phone}`, 14, 59);
    doc.text(`Email: ${formData.email}`, 14, 66);

    doc.text(`Dirección: ${formData.address}`, 14, 73);
    doc.text(`Barrio: ${formData.neighborhood}`, 14, 80);
    doc.text(`Localidad: ${formData.locality}`, 14, 87);
    doc.text(`Tipología: ${formData.propertyType}`, 14, 94);
    doc.text(`m² Terreno: ${formData.landArea}`, 14, 101);
    doc.text(`m² Cubiertos: ${formData.builtArea}`, 14, 108);
    doc.text(`Antigüedad: ${formData.age} años`, 14, 115);
    doc.text(`Estado: ${formData.condition}`, 14, 122);
    doc.text(`Ubicación: ${formData.locationQuality}`, 14, 129);
    doc.text(`Orientación: ${formData.orientation}`, 14, 136);
    doc.text(`Título: ${formData.titleType}`, 14, 143);
    doc.text(`Planos: ${formData.hasPlans ? "Sí" : "No"}`, 14, 150);
    doc.text(`Posee renta: ${formData.isRented ? "Sí" : "No"}`, 14, 157);

    // Servicios
    doc.text("Servicios:", 14, 170);
    const servicios = Object.entries(formData.services);
    servicios.forEach(([key, value], i) => {
      doc.text(`${key}: ${value ? "✓" : "✗"}`, 20, 177 + i * 7);
    });

    // Foto
    if (formData.mainPhotoBase64) {
      doc.addImage(formData.mainPhotoBase64, "JPEG", 120, 40, 80, 60);
    }

    // Comparables
    let y = 220;
    doc.setFontSize(14);
    doc.setTextColor(primaryColor);
    doc.text("Propiedades comparables", 14, y);
    y += 10;
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    formData.comparables.forEach((c, i) => {
      doc.text(
        `#${i + 1}: ${c.builtArea}m² | $${c.price} | $${c.pricePerM2.toFixed(
          2
        )}/m² | Coef: ${c.coefficient} | ${c.daysPublished} días`,
        14,
        y
      );
      y += 7;
      doc.text(`Link: ${c.listingUrl}`, 14, y);
      y += 7;
      doc.text(`Descripción: ${c.description}`, 14, y);
      y += 10;
    });

    // Texto libre
    y += 10;
    doc.setFontSize(12);
    doc.text("Observaciones:", 14, y);
    y += 7;
    doc.text(formData.observations || "-", 14, y);
    y += 10;
    doc.text("A considerar:", 14, y);
    y += 7;
    doc.text(formData.considerations || "-", 14, y);
    y += 10;
    doc.text("Fortalezas:", 14, y);
    y += 7;
    doc.text(formData.strengths || "-", 14, y);
    y += 10;
    doc.text("Debilidades:", 14, y);
    y += 7;
    doc.text(formData.weaknesses || "-", 14, y);

    doc.save("informe-acm.pdf");
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold" style={{ color: primaryColor }}>
        Formulario ACM
      </h1>

      {/* Selector de color */}
      <div>
        <label className="block text-sm font-medium">Color primario</label>
        <input
          type="color"
          value={primaryColor}
          onChange={(e) => setPrimaryColor(e.target.value)}
          className="mt-1"
        />
      </div>

      {/* Fecha */}
      <div className="bg-white shadow rounded-lg p-4">
        <p className="text-sm font-medium">Fecha: {new Date(formData.date).toLocaleDateString()}</p>
      </div>

      {/* Datos Cliente / Propiedad */}
      <div className="bg-white shadow rounded-lg p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <h2 className="col-span-2 text-lg font-semibold" style={{ color: primaryColor }}>
          Datos del Cliente / Propiedad
        </h2>

        <input className="input" placeholder="Cliente" name="clientName" value={formData.clientName} onChange={handleChange} />
        <input className="input" placeholder="Agente" name="advisorName" value={formData.advisorName} onChange={handleChange} />
        <input className="input" placeholder="Teléfono" name="phone" value={formData.phone} onChange={handleChange} />
        <input className="input" placeholder="Email" name="email" value={formData.email} onChange={handleChange} />
        <input className="input" placeholder="Dirección" name="address" value={formData.address} onChange={handleChange} />
        <input className="input" placeholder="Barrio" name="neighborhood" value={formData.neighborhood} onChange={handleChange} />
        <input className="input" placeholder="Localidad" name="locality" value={formData.locality} onChange={handleChange} />

        <select name="propertyType" value={formData.propertyType} onChange={handleChange} className="input">
          {Object.values(PropertyType).map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>

        <input type="number" className="input" placeholder="m² Terreno" name="landArea" value={formData.landArea} onChange={handleChange} />
        <input type="number" className="input" placeholder="m² Cubiertos" name="builtArea" value={formData.builtArea} onChange={handleChange} />
        <input type="number" className="input" placeholder="Antigüedad (años)" name="age" value={formData.age} onChange={handleChange} />

        <select name="condition" value={formData.condition} onChange={handleChange} className="input">
          {Object.values(PropertyCondition).map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>

        <select name="locationQuality" value={formData.locationQuality} onChange={handleChange} className="input">
          {Object.values(LocationQuality).map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>

        <select name="orientation" value={formData.orientation} onChange={handleChange} className="input">
          {Object.values(Orientation).map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>

        <select name="titleType" value={formData.titleType} onChange={handleChange} className="input">
          {Object.values(TitleType).map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>

        <label className="flex items-center space-x-2">
          <input type="checkbox" name="hasPlans" checked={formData.hasPlans} onChange={handleChange} />
          <span>Posee planos</span>
        </label>
        <label className="flex items-center space-x-2">
          <input type="checkbox" name="isRented" checked={formData.isRented} onChange={handleChange} />
          <span>Posee renta</span>
        </label>
      </div>

      {/* Servicios */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4" style={{ color: primaryColor }}>
          Servicios
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {Object.keys(formData.services).map((key) => (
            <label key={key} className="flex items-center space-x-2">
              <input type="checkbox" name={key} checked={formData.services[key as keyof typeof formData.services]} onChange={handleServiceChange} />
              <span>{key}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Foto */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4" style={{ color: primaryColor }}>
          Foto principal
        </h2>
        <input type="file" accept="image/*" onChange={handlePhotoUpload} />
        {formData.mainPhotoUrl && (
          <img src={formData.mainPhotoUrl} alt="preview" className="mt-4 max-h-48 rounded" />
        )}
      </div>

      {/* Comparables */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4" style={{ color: primaryColor }}>
          Propiedades comparables
        </h2>
        {formData.comparables.map((c, i) => (
          <div key={i} className="border rounded p-4 mb-4">
            <input type="number" className="input" placeholder="m² Cubiertos" value={c.builtArea} onChange={(e) => handleComparableChange(i, "builtArea", e.target.value)} />
            <input type="number" className="input" placeholder="Precio" value={c.price} onChange={(e) => handleComparableChange(i, "price", e.target.value)} />
            <input className="input" placeholder="Link" value={c.listingUrl} onChange={(e) => handleComparableChange(i, "listingUrl", e.target.value)} />
            <textarea className="input" placeholder="Descripción" value={c.description} onChange={(e) => handleComparableChange(i, "description", e.target.value)} />
            <input type="number" className="input" placeholder="Días publicada" value={c.daysPublished} onChange={(e) => handleComparableChange(i, "daysPublished", e.target.value)} />
            <p className="text-sm">Precio por m²: ${c.pricePerM2.toFixed(2)}</p>
            <select value={c.coefficient} onChange={(e) => handleComparableChange(i, "coefficient", e.target.value)} className="input">
              {Array.from({ length: 10 }, (_, j) => (j + 1) / 10).map((val) => (
                <option key={val} value={val}>{val.toFixed(1)}</option>
              ))}
            </select>
            <button type="button" onClick={() => removeComparable(i)} className="text-red-600 mt-2">
              Eliminar
            </button>
          </div>
        ))}
        {formData.comparables.length < 4 && (
          <button type="button" onClick={addComparable} className="mt-2 px-3 py-1 bg-gray-200 rounded">
            Agregar comparable
          </button>
        )}
      </div>

      {/* Texto libre */}
      <div className="bg-white shadow rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold" style={{ color: primaryColor }}>
          Texto libre
        </h2>
        <textarea className="input" placeholder="Observaciones" name="observations" value={formData.observations} onChange={handleChange} />
        <textarea className="input" placeholder="A considerar" name="considerations" value={formData.considerations} onChange={handleChange} />
        <textarea className="input" placeholder="Fortalezas" name="strengths" value={formData.strengths} onChange={handleChange} />
        <textarea className="input" placeholder="Debilidades" name="weaknesses" value={formData.weaknesses} onChange={handleChange} />
      </div>

      {/* Botón PDF */}
      <div className="flex justify-end">
        <button
          onClick={downloadPDF}
          className="px-4 py-2 rounded text-white"
          style={{ backgroundColor: primaryColor }}
        >
          Descargar PDF
        </button>
      </div>
    </div>
  );
}
