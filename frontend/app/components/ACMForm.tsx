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

const ACMForm: React.FC = () => {
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
    services: {
      luz: false,
      agua: false,
      gas: false,
      cloacas: false,
      pavimento: false,
    },
    isRented: false,
    mainPhotoUrl: "",
    mainPhotoBase64: undefined,
    comparables: [],
    observations: "",
    considerations: "",
    strengths: "",
    weaknesses: "",
  });

  // Fecha automática al montar
  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      date: new Date().toISOString().split("T")[0],
    }));
  }, []);

 const handleChange = (
  e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
) => {
  const { name, value, type } = e.target;

  setFormData({
    ...formData,
    [name]: type === "number" ? Number(value) : value,
  });
};

  // Comparables
  const handleComparableChange = (
    index: number,
    field: keyof ComparableProperty,
    value: string | number
  ) => {
    const copy = [...formData.comparables];
    if (field === "builtArea" || field === "price" || field === "daysPublished") {
      copy[index][field] = Number(value);
    } else if (field === "coefficient") {
      copy[index][field] = Number(value);
    } else {
      copy[index][field] = value as any;
    }
    copy[index].pricePerM2 =
      copy[index].builtArea > 0 ? copy[index].price / copy[index].builtArea : 0;
    setFormData({ ...formData, comparables: copy });
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

  // Subir foto
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData({
        ...formData,
        mainPhotoUrl: URL.createObjectURL(file),
        mainPhotoBase64: reader.result as string,
      });
    };
    reader.readAsDataURL(file);
  };

  // Exportar PDF
  const generatePDF = async () => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Informe ACM", 14, 20);

    doc.setFontSize(12);
    doc.text(`Fecha: ${formData.date}`, 14, 30);
    doc.text(`Cliente: ${formData.clientName}`, 14, 40);
    doc.text(`Asesor: ${formData.advisorName}`, 14, 50);
    doc.text(`Teléfono: ${formData.phone}`, 14, 60);
    doc.text(`Email: ${formData.email}`, 14, 70);
    doc.text(`Dirección: ${formData.address}`, 14, 80);
    doc.text(`Barrio: ${formData.neighborhood}`, 14, 90);
    doc.text(`Localidad: ${formData.locality}`, 14, 100);

    // Foto
    if (formData.mainPhotoBase64) {
      doc.addImage(formData.mainPhotoBase64, "JPEG", 150, 30, 40, 40);
    }

    // Servicios
    doc.text("Servicios:", 14, 120);
    Object.entries(formData.services).forEach(([key, value], i) => {
      doc.text(`${key}: ${value ? "✓" : "✗"}`, 20, 130 + i * 10);
    });

    // Comparables
    doc.text("Propiedades comparables:", 14, 200);
    formData.comparables.forEach((c, i) => {
      doc.text(
        `${i + 1}) m²: ${c.builtArea}, Precio: $${c.price}, $/m²: ${c.pricePerM2.toFixed(
          2
        )}, Coef: ${c.coefficient}, Días: ${c.daysPublished}`,
        20,
        210 + i * 10
      );
    });

    // Conclusión
    doc.addPage();
    doc.setFontSize(14);
    doc.text("Conclusión", 14, 20);
    doc.setFontSize(12);
    doc.text(`Observaciones: ${formData.observations}`, 14, 40);
    doc.text(`Fortalezas: ${formData.strengths}`, 14, 60);
    doc.text(`Debilidades: ${formData.weaknesses}`, 14, 80);
    doc.text(`A Considerar: ${formData.considerations}`, 14, 100);

    doc.save("informe-acm.pdf");
  };

  return (
    <div className="max-w-7xl mx-auto bg-white shadow rounded-lg p-6 space-y-6">
      <h2 className="text-xl font-bold mb-4">Análisis Comparativo de Mercado</h2>

      {/* Fecha */}
      <p className="text-sm text-gray-500">Fecha: {formData.date}</p>

      {/* Datos de cliente y propiedad */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <input
            name="clientName"
            placeholder="Cliente"
            value={formData.clientName}
            onChange={handleChange}
            className="w-full border rounded p-2"
          />
          <input
            name="advisorName"
            placeholder="Agente"
            value={formData.advisorName}
            onChange={handleChange}
            className="w-full border rounded p-2"
          />
          <input
            name="phone"
            placeholder="Teléfono"
            value={formData.phone}
            onChange={handleChange}
            className="w-full border rounded p-2"
          />
          <input
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
            className="w-full border rounded p-2"
          />
          <input
            name="address"
            placeholder="Dirección"
            value={formData.address}
            onChange={handleChange}
            className="w-full border rounded p-2"
          />
          <input
            name="neighborhood"
            placeholder="Barrio"
            value={formData.neighborhood}
            onChange={handleChange}
            className="w-full border rounded p-2"
          />
          <input
            name="locality"
            placeholder="Localidad"
            value={formData.locality}
            onChange={handleChange}
            className="w-full border rounded p-2"
          />
        </div>

        {/* Foto */}
        <div>
          <label className="block text-sm font-medium mb-2">Foto de la propiedad</label>
          <input type="file" accept="image/*" onChange={handlePhotoUpload} />
          {formData.mainPhotoUrl && (
            <img
              src={formData.mainPhotoUrl}
              alt="Vista previa"
              className="mt-2 w-40 h-40 object-cover rounded"
            />
          )}
        </div>
      </div>

      {/* Servicios */}
      <div>
        <h3 className="font-semibold mb-2">Servicios</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {Object.keys(formData.services).map((service) => (
            <label key={service} className="flex items-center space-x-2">
              <input
                type="checkbox"
                name={service}
                checked={formData.services[service as keyof typeof formData.services]}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    services: {
                      ...formData.services,
                      [service]: e.target.checked,
                    },
                  })
                }
              />
              <span>{service}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Comparables */}
      <div>
        <h3 className="font-semibold mb-2">Propiedades comparables</h3>
        {formData.comparables.map((c, i) => (
          <div key={i} className="border p-4 rounded mb-4">
            <input
              type="number"
              placeholder="m² Cubiertos"
              value={c.builtArea}
              onChange={(e) => handleComparableChange(i, "builtArea", e.target.value)}
              className="w-full border rounded p-2 mb-2"
            />
            <input
              type="number"
              placeholder="Precio"
              value={c.price}
              onChange={(e) => handleComparableChange(i, "price", e.target.value)}
              className="w-full border rounded p-2 mb-2"
            />
            <input
              type="text"
              placeholder="Link"
              value={c.listingUrl}
              onChange={(e) => handleComparableChange(i, "listingUrl", e.target.value)}
              className="w-full border rounded p-2 mb-2"
            />
            <input
              type="text"
              placeholder="Descripción"
              value={c.description}
              onChange={(e) => handleComparableChange(i, "description", e.target.value)}
              className="w-full border rounded p-2 mb-2"
            />
            <input
              type="number"
              placeholder="Días publicada"
              value={c.daysPublished}
              onChange={(e) =>
                handleComparableChange(i, "daysPublished", e.target.value)
              }
              className="w-full border rounded p-2 mb-2"
            />
            <select
              value={c.coefficient}
              onChange={(e) =>
                handleComparableChange(i, "coefficient", e.target.value)
              }
              className="w-full border rounded p-2 mb-2"
            >
              {[...Array(10)].map((_, idx) => (
                <option key={idx} value={(idx + 1) / 10}>
                  {(idx + 1) / 10}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => removeComparable(i)}
              className="text-red-600 text-sm"
            >
              Eliminar
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addComparable}
          className="mt-2 bg-blue-600 text-white px-4 py-2 rounded"
        >
          Agregar comparable
        </button>
      </div>

      {/* Conclusión */}
      <div>
        <h3 className="font-semibold mb-2">Conclusión</h3>
        <textarea
          name="observations"
          placeholder="Observaciones"
          value={formData.observations}
          onChange={handleChange}
          className="w-full border rounded p-2 mb-2 h-24"
        />
        <textarea
          name="strengths"
          placeholder="Fortalezas"
          value={formData.strengths}
          onChange={handleChange}
          className="w-full border rounded p-2 mb-2 h-24"
        />
        <textarea
          name="weaknesses"
          placeholder="Debilidades"
          value={formData.weaknesses}
          onChange={handleChange}
          className="w-full border rounded p-2 mb-2 h-24"
        />
        <textarea
          name="considerations"
          placeholder="A considerar"
          value={formData.considerations}
          onChange={handleChange}
          className="w-full border rounded p-2 mb-2 h-24"
        />
      </div>

      {/* Botón PDF */}
      <button
        type="button"
        onClick={generatePDF}
        className="bg-green-600 text-white px-6 py-2 rounded shadow"
      >
        Descargar PDF
      </button>
    </div>
  );
};

export default ACMForm;
