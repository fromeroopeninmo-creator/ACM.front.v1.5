"use client";

import React, { useState, useEffect } from "react";
import { jsPDF } from "jspdf";
import {
  ACMFormData,
  PropertyType,
  PropertyCondition,
  Orientation,
  LocationQuality,
  TitleType,
  ComparableProperty,
  Services,
} from "@/app/types/acm.types";

export default function ACMForm() {
  const [formData, setFormData] = useState<ACMFormData>({
    date: new Date().toISOString(),
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

  const handleChange = (
  e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
) => {
  const { name, value, type } = e.target;

  if (type === "checkbox") {
    const isChecked = (e.target as HTMLInputElement).checked; // ✅ type guard
    setFormData({
      ...formData,
      [name]: isChecked,
    });
  } else if (type === "number") {
    setFormData({
      ...formData,
      [name]: Number(value),
    });
  } else {
    setFormData({
      ...formData,
      [name]: value,
    });
  }
};

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({
          ...formData,
          mainPhotoUrl: URL.createObjectURL(file),
          mainPhotoBase64: reader.result as string,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleComparableChange = (
    index: number,
    field: keyof ComparableProperty,
    value: string | number
  ) => {
    const copy = [...formData.comparables];
    if (field === "builtArea" || field === "price" || field === "daysPublished" || field === "coefficient") {
      copy[index][field] = Number(value);
    } else {
      (copy[index][field] as string) = value.toString();
    }
    copy[index].pricePerM2 =
      copy[index].builtArea > 0 ? copy[index].price / copy[index].builtArea : 0;
    setFormData({ ...formData, comparables: copy });
  };

  const handleComparablePhoto = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const copy = [...formData.comparables];
        (copy[index] as any).photoBase64 = reader.result as string;
        setFormData({ ...formData, comparables: copy });
      };
      reader.readAsDataURL(file);
    }
  };

  const addComparable = () => {
    if (formData.comparables.length < 4) {
      setFormData({
        ...formData,
        comparables: [
          ...formData.comparables,
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
      });
    }
  };

  const removeComparable = (index: number) => {
    const copy = [...formData.comparables];
    copy.splice(index, 1);
    setFormData({ ...formData, comparables: copy });
  };

  const handleDownloadPDF = async () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Informe ACM", 20, 20);

    doc.setFontSize(12);
    doc.text(`Fecha: ${new Date(formData.date).toLocaleDateString()}`, 20, 30);
    doc.text(`Cliente: ${formData.clientName}`, 20, 40);
    doc.text(`Agente: ${formData.advisorName}`, 20, 50);
    doc.text(`Teléfono: ${formData.phone}`, 20, 60);
    doc.text(`Email: ${formData.email}`, 20, 70);
    doc.text(`Dirección: ${formData.address}`, 20, 80);

    if (formData.mainPhotoBase64) {
      doc.addImage(formData.mainPhotoBase64, "JPEG", 140, 30, 50, 50);
    }

    doc.addPage();
    doc.text("Conclusión", 20, 20);
    doc.text("Observaciones:", 20, 30);
    doc.text(formData.observations || "-", 20, 40);
    doc.text("Fortalezas:", 20, 60);
    doc.text(formData.strengths || "-", 20, 70);
    doc.text("Debilidades:", 20, 90);
    doc.text(formData.weaknesses || "-", 20, 100);
    doc.text("A Considerar:", 20, 120);
    doc.text(formData.considerations || "-", 20, 130);

    doc.save("informe_acm.pdf");
  };

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white shadow rounded-lg">
      <h1 className="text-2xl font-bold mb-6">Análisis Comparativo de Mercado</h1>

      {/* Fecha */}
      <p className="mb-6 text-sm text-gray-600">
        Fecha: {new Date(formData.date).toLocaleDateString()}
      </p>

      {/* Datos de la propiedad + Foto */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="col-span-2 space-y-4">
          <label className="block text-sm font-medium">Cliente</label>
          <input type="text" name="clientName" value={formData.clientName} onChange={handleChange} className="w-full border rounded p-2" />

          <label className="block text-sm font-medium">Agente</label>
          <input type="text" name="advisorName" value={formData.advisorName} onChange={handleChange} className="w-full border rounded p-2" />

          <label className="block text-sm font-medium">Teléfono</label>
          <input type="text" name="phone" value={formData.phone} onChange={handleChange} className="w-full border rounded p-2" />

          <label className="block text-sm font-medium">Email</label>
          <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full border rounded p-2" />

          <label className="block text-sm font-medium">Dirección</label>
          <input type="text" name="address" value={formData.address} onChange={handleChange} className="w-full border rounded p-2" />

          <label className="block text-sm font-medium">Barrio</label>
          <input type="text" name="neighborhood" value={formData.neighborhood} onChange={handleChange} className="w-full border rounded p-2" />

          <label className="block text-sm font-medium">Localidad</label>
          <input type="text" name="locality" value={formData.locality} onChange={handleChange} className="w-full border rounded p-2" />

          <label className="block text-sm font-medium">m² Terreno</label>
          <input type="number" name="landArea" value={formData.landArea} onChange={handleChange} className="w-full border rounded p-2" />

          <label className="block text-sm font-medium">m² Cubiertos</label>
          <input type="number" name="builtArea" value={formData.builtArea} onChange={handleChange} className="w-full border rounded p-2" />

          <label className="block text-sm font-medium">Antigüedad (años)</label>
          <input type="number" name="age" value={formData.age} onChange={handleChange} className="w-full border rounded p-2" />

          <label className="block text-sm font-medium">Estado de Conservación</label>
          <select name="condition" value={formData.condition} onChange={handleChange} className="w-full border rounded p-2">
            {Object.values(PropertyCondition).map((cond) => (
              <option key={cond} value={cond}>{cond}</option>
            ))}
          </select>

          <label className="block text-sm font-medium">Ubicación</label>
          <select name="locationQuality" value={formData.locationQuality} onChange={handleChange} className="w-full border rounded p-2">
            {Object.values(LocationQuality).map((loc) => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>

          <label className="block text-sm font-medium">Orientación</label>
          <select name="orientation" value={formData.orientation} onChange={handleChange} className="w-full border rounded p-2">
            {Object.values(Orientation).map((ori) => (
              <option key={ori} value={ori}>{ori}</option>
            ))}
          </select>
        </div>

        <div className="col-span-1">
          <label className="block text-sm font-medium mb-2">Foto de la propiedad</label>
          <input type="file" accept="image/*" onChange={handlePhotoUpload} />
          {formData.mainPhotoUrl && (
            <img src={formData.mainPhotoUrl} alt="Preview" className="mt-2 rounded shadow w-full" />
          )}
        </div>
      </div>

      {/* Comparables */}
      <h2 className="text-xl font-semibold mb-4">Propiedades comparables</h2>
      {formData.comparables.map((c, i) => (
        <div key={i} className="border p-4 mb-4 rounded">
          <label className="block text-sm font-medium">m² Cubiertos</label>
          <input type="number" value={c.builtArea} onChange={(e) => handleComparableChange(i, "builtArea", e.target.value)} className="w-full border rounded p-2 mb-2" />

          <label className="block text-sm font-medium">Precio publicado</label>
          <input type="number" value={c.price} onChange={(e) => handleComparableChange(i, "price", e.target.value)} className="w-full border rounded p-2 mb-2" />

          <label className="block text-sm font-medium">Link</label>
          <input type="text" value={c.listingUrl} onChange={(e) => handleComparableChange(i, "listingUrl", e.target.value)} className="w-full border rounded p-2 mb-2" />

          <label className="block text-sm font-medium">Descripción</label>
          <textarea value={c.description} onChange={(e) => handleComparableChange(i, "description", e.target.value)} className="w-full border rounded p-2 mb-2" />

          <label className="block text-sm font-medium">Días publicada</label>
          <input type="number" value={c.daysPublished} onChange={(e) => handleComparableChange(i, "daysPublished", e.target.value)} className="w-full border rounded p-2 mb-2" />

          <label className="block text-sm font-medium">Coeficiente</label>
          <select value={c.coefficient} onChange={(e) => handleComparableChange(i, "coefficient", e.target.value)} className="w-full border rounded p-2 mb-2">
            {[...Array(10)].map((_, idx) => {
              const val = (idx + 1) / 10;
              return (
                <option key={val} value={val}>
                  {val.toFixed(1)}
                </option>
              );
            })}
          </select>

          <label className="block text-sm font-medium">Foto</label>
          <input type="file" accept="image/*" onChange={(e) => handleComparablePhoto(i, e)} className="mb-2" />
          {(c as any).photoBase64 && (
            <img src={(c as any).photoBase64} alt="Comparable preview" className="rounded shadow w-32 h-32 object-cover" />
          )}

          <button type="button" onClick={() => removeComparable(i)} className="mt-2 text-red-600">
            Eliminar
          </button>
        </div>
      ))}
      <button type="button" onClick={addComparable} className="px-4 py-2 bg-blue-600 text-white rounded">
        Agregar comparable
      </button>

      {/* Conclusión */}
      <h2 className="text-xl font-semibold mt-8 mb-4">Conclusión</h2>
      <label className="block text-sm font-medium">Observaciones</label>
      <textarea name="observations" value={formData.observations} onChange={handleChange} className="w-full border rounded p-2 mb-4 h-24" />

      <label className="block text-sm font-medium">Fortalezas</label>
      <textarea name="strengths" value={formData.strengths} onChange={handleChange} className="w-full border rounded p-2 mb-4 h-24" />

      <label className="block text-sm font-medium">Debilidades</label>
      <textarea name="weaknesses" value={formData.weaknesses} onChange={handleChange} className="w-full border rounded p-2 mb-4 h-24" />

      <label className="block text-sm font-medium">A Considerar</label>
      <textarea name="considerations" value={formData.considerations} onChange={handleChange} className="w-full border rounded p-2 mb-4 h-24" />

      <button type="button" onClick={handleDownloadPDF} className="px-4 py-2 bg-green-600 text-white rounded">
        Descargar PDF
      </button>
    </div>
  );
}
