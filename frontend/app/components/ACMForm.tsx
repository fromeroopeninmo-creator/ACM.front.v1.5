"use client";

import React, { useState, useEffect } from "react";
import {
  ACMFormData,
  ComparableProperty,
  PropertyType,
  PropertyCondition,
  Orientation,
  LocationQuality,
  TitleType,
} from "@/app/types/acm.types";

export default function ACMForm() {
  const [primaryColor, setPrimaryColor] = useState<string>("#1d4ed8"); // color de acento (UI/PDF)

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

  // Fecha automática al montar
  useEffect(() => {
    setFormData((prev) => ({ ...prev, date: new Date().toISOString().split("T")[0] }));
  }, []);

  // Campos numéricos para castear sin mirar e.target.type (evita problemas de union types)
  const numericFields = new Set([
    "landArea",
    "builtArea",
    "age",
  ]);

  // Cambios genéricos (inputs/selects/textarea) con casteo según campo
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    let finalValue: any = value;

    if (numericFields.has(name)) {
      finalValue = Number(value);
    } else {
      // casteos a enums cuando corresponde
      if (name === "propertyType") finalValue = value as PropertyType;
      if (name === "titleType") finalValue = value as TitleType;
      if (name === "condition") finalValue = value as PropertyCondition;
      if (name === "locationQuality") finalValue = value as LocationQuality;
      if (name === "orientation") finalValue = value as Orientation;
    }

    setFormData((prev) => ({ ...prev, [name]: finalValue } as ACMFormData));
  };

  // Cambios booleanos (select Sí/No) para hasPlans, isRented
  const handleBooleanChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target; // "true" | "false"
    const boolVal = value === "true";
    setFormData((prev) => ({ ...prev, [name]: boolVal } as ACMFormData));
  };

  // Servicios: select Sí/No por cada servicio
  const handleServiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target; // name es un key de services
    const boolVal = value === "true";
    setFormData((prev) => ({
      ...prev,
      services: { ...prev.services, [name]: boolVal },
    }));
  };

  // Comparables
  const handleComparableChange = (
    index: number,
    field: keyof ComparableProperty,
    rawValue: string
  ) => {
    const copy = [...formData.comparables];
    if (field === "builtArea" || field === "price" || field === "daysPublished" || field === "coefficient") {
      (copy[index][field] as number) = Number(rawValue);
    } else {
      (copy[index][field] as any) = rawValue;
    }
    // recálculo de $/m²
    copy[index].pricePerM2 =
      copy[index].builtArea > 0 ? copy[index].price / copy[index].builtArea : 0;

    setFormData((prev) => ({ ...prev, comparables: copy }));
  };

  const addComparable = () => {
    if (formData.comparables.length >= 4) return;
    const nuevo: ComparableProperty = {
      builtArea: 0,
      price: 0,
      listingUrl: "",
      description: "",
      daysPublished: 0,
      pricePerM2: 0,
      coefficient: 1,
    };
    setFormData((prev) => ({ ...prev, comparables: [...prev.comparables, nuevo] }));
  };

  const removeComparable = (index: number) => {
    const copy = [...formData.comparables];
    copy.splice(index, 1);
    setFormData((prev) => ({ ...prev, comparables: copy }));
  };

  // Foto principal
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

  // Helpers PDF
  const hexToRgb = (hex: string) => {
    const h = hex.replace("#", "");
    const bigint = parseInt(h, 16);
    return {
      r: (bigint >> 16) & 255,
      g: (bigint >> 8) & 255,
      b: bigint & 255,
    };
  };

  const fmt = (n: number) =>
    isFinite(n) ? n.toLocaleString("es-AR", { maximumFractionDigits: 2 }) : "0";

  // Descargar PDF (jsPDF import dinámico)
  const handleDownloadPDF = async () => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const marginX = 14;
    let y = 18;

    const { r, g, b } = hexToRgb(primaryColor);

    // Encabezado
    doc.setFontSize(18);
    doc.setTextColor(r, g, b);
    doc.text("Informe ACM", marginX, y);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    y += 8;
    doc.text(`Fecha: ${formData.date || "-"}`, marginX, y);
    y += 8;

    // Datos del cliente/propiedad
    doc.setTextColor(r, g, b);
    doc.setFontSize(14);
    doc.text("Datos del Cliente / Propiedad", marginX, y);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    y += 7;

    const putLine = (label: string, value: string) => {
      doc.text(`${label}: ${value || "-"}`, marginX, y);
      y += 6;
      if (y > 270) {
        doc.addPage();
        y = 18;
      }
    };

    putLine("Cliente", formData.clientName);
    putLine("Agente", formData.advisorName);
    putLine("Teléfono", formData.phone);
    putLine("Email", formData.email);
    putLine("Dirección", formData.address);
    putLine("Barrio", formData.neighborhood);
    putLine("Localidad", formData.locality);
    putLine("Tipología", formData.propertyType);
    putLine("m² Terreno", String(formData.landArea));
    putLine("m² Cubiertos", String(formData.builtArea));
    putLine("Antigüedad", String(formData.age));
    putLine("Planos", formData.hasPlans ? "Sí" : "No");
    putLine("Título", formData.titleType);
    putLine("Estado", formData.condition);
    putLine("Ubicación", formData.locationQuality);
    putLine("Orientación", formData.orientation);
    putLine("Posee renta", formData.isRented ? "Sí" : "No");

    // Servicios
    doc.setTextColor(r, g, b);
    doc.setFontSize(14);
    doc.text("Servicios", marginX, y);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    y += 7;

    const sv = formData.services;
    const check = (v: boolean) => (v ? "✓" : "✗");
    putLine("Luz", check(sv.luz));
    putLine("Agua", check(sv.agua));
    putLine("Gas", check(sv.gas));
    putLine("Cloacas", check(sv.cloacas));
    putLine("Pavimento", check(sv.pavimento));

    // Foto principal (si hay)
    if (formData.mainPhotoBase64) {
      // estimar tamaño
      const imgType = formData.mainPhotoBase64.startsWith("data:image/png") ? "PNG" : "JPEG";
      const imgWidth = 90;
      const imgHeight = 60;
      if (y + imgHeight > 270) {
        doc.addPage();
        y = 18;
      }
      doc.addImage(formData.mainPhotoBase64, imgType as any, marginX, y, imgWidth, imgHeight);
      y += imgHeight + 6;
    }

    // Comparables
    doc.setTextColor(r, g, b);
    doc.setFontSize(14);
    doc.text("Propiedades comparadas en la zona", marginX, y);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    y += 6;

    // Cabecera de tabla
    const colX = [marginX, marginX + 26, marginX + 64, marginX + 96, marginX + 118, marginX + 144];
    doc.text("m²", colX[0], y);
    doc.text("Precio", colX[1], y);
    doc.text("$ / m²", colX[2], y);
    doc.text("Coef.", colX[3], y);
    doc.text("Días", colX[4], y);
    doc.text("Link", colX[5], y);
    y += 5;

    doc.setFontSize(9);
    formData.comparables.forEach((c, idx) => {
      if (y > 270) {
        doc.addPage();
        y = 18;
      }
      doc.text(String(c.builtArea || 0), colX[0], y);
      doc.text(`$ ${fmt(c.price || 0)}`, colX[1], y);
      doc.text(`$ ${fmt(c.pricePerM2 || 0)}`, colX[2], y);
      doc.text(String(c.coefficient || 0), colX[3], y);
      doc.text(String(c.daysPublished || 0), colX[4], y);
      const link = c.listingUrl ? (c.listingUrl.length > 28 ? c.listingUrl.slice(0, 28) + "…" : c.listingUrl) : "-";
      doc.text(link, colX[5], y);
      y += 5;

      // Descripción en línea aparte
      if (c.description) {
        const descLines = doc.splitTextToSize(`Desc: ${c.description}`, 180);
        descLines.forEach((line: string) => {
          if (y > 270) {
            doc.addPage();
            y = 18;
          }
          doc.text(line, marginX, y);
          y += 4;
        });
      }
    });

    // Conclusiones
    doc.setTextColor(r, g, b);
    doc.setFontSize(14);
    if (y > 260) {
      doc.addPage();
      y = 18;
    }
    doc.text("Conclusiones", marginX, y);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    y += 7;

    const putMultiline = (title: string, text: string) => {
      if (y > 260) {
        doc.addPage();
        y = 18;
      }
      doc.setFont(undefined, "bold");
      doc.text(title, marginX, y);
      doc.setFont(undefined, "normal");
      y += 5;
      if (text) {
        const lines = doc.splitTextToSize(text, 180);
        lines.forEach((ln: string) => {
          if (y > 270) {
            doc.addPage();
            y = 18;
          }
          doc.text(ln, marginX, y);
          y += 5;
        });
      } else {
        doc.text("-", marginX, y);
        y += 5;
      }
      y += 3;
    };

    putMultiline("Observaciones", formData.observations);
    putMultiline("Fortalezas", formData.strengths);
    putMultiline("Debilidades", formData.weaknesses);
    putMultiline("A Considerar", formData.considerations);

    // Pie
    if (y > 270) {
      doc.addPage();
      y = 18;
    }
    doc.setDrawColor(r, g, b);
    doc.line(marginX, 285, 200, 285);
    doc.setFontSize(9);
    doc.text(
      `Asesor: ${formData.advisorName || "-"} | Generado: ${new Date().toLocaleDateString("es-AR")}`,
      marginX,
      292
    );

    doc.save(`Informe-ACM-${formData.clientName || "propiedad"}.pdf`);
  };

  return (
    <form className="space-y-8 p-6 bg-white shadow rounded-lg">
      {/* Color primario y fecha */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
        <div>
          <label className="block text-sm font-medium">Fecha</label>
          <input
            type="date"
            name="date"
            value={formData.date}
            disabled
            className="mt-1 block w-48 border rounded-md p-2 bg-gray-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Color principal</label>
          <input
            type="color"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="mt-1 h-10 w-16 p-0 border rounded-md"
            aria-label="Selector de color principal"
          />
        </div>
      </div>

      {/* Datos + Foto */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna de datos (2/3) */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold" style={{ color: primaryColor }}>
            Datos del Cliente / Propiedad
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium">Cliente</label>
              <input
                name="clientName"
                value={formData.clientName}
                onChange={handleChange}
                className="mt-1 w-full border rounded-md p-2"
                placeholder="Nombre completo"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Agente</label>
              <input
                name="advisorName"
                value={formData.advisorName}
                onChange={handleChange}
                className="mt-1 w-full border rounded-md p-2"
                placeholder="Nombre del asesor"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Teléfono</label>
              <input
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="mt-1 w-full border rounded-md p-2"
                placeholder="+54 ..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Email</label>
              <input
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="mt-1 w-full border rounded-md p-2"
                placeholder="correo@dominio.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Dirección</label>
              <input
                name="address"
                value={formData.address}
                onChange={handleChange}
                className="mt-1 w-full border rounded-md p-2"
                placeholder="Calle, número"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Barrio</label>
              <input
                name="neighborhood"
                value={formData.neighborhood}
                onChange={handleChange}
                className="mt-1 w-full border rounded-md p-2"
                placeholder="Barrio"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Localidad</label>
              <input
                name="locality"
                value={formData.locality}
                onChange={handleChange}
                className="mt-1 w-full border rounded-md p-2"
                placeholder="Ciudad / Localidad"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Tipología</label>
              <select
                name="propertyType"
                value={formData.propertyType}
                onChange={handleChange}
                className="mt-1 w-full border rounded-md p-2"
              >
                {Object.values(PropertyType)
                  .sort()
                  .map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium">m² Terreno</label>
              <input
                type="number"
                name="landArea"
                value={formData.landArea}
                onChange={handleChange}
                className="mt-1 w-full border rounded-md p-2"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">m² Cubiertos</label>
              <input
                type="number"
                name="builtArea"
                value={formData.builtArea}
                onChange={handleChange}
                className="mt-1 w-full border rounded-md p-2"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Antigüedad (años)</label>
              <input
                type="number"
                name="age"
                value={formData.age}
                onChange={handleChange}
                className="mt-1 w-full border rounded-md p-2"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Planos</label>
              <select
                name="hasPlans"
                value={String(formData.hasPlans)}
                onChange={handleBooleanChange}
                className="mt-1 w-full border rounded-md p-2"
              >
                <option value="false">No</option>
                <option value="true">Sí</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium">Título</label>
              <select
                name="titleType"
                value={formData.titleType}
                onChange={handleChange}
                className="mt-1 w-full border rounded-md p-2"
              >
                {Object.values(TitleType).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium">Estado de conservación</label>
              <select
                name="condition"
                value={formData.condition}
                onChange={handleChange}
                className="mt-1 w-full border rounded-md p-2"
              >
                {Object.values(PropertyCondition).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium">Ubicación</label>
              <select
                name="locationQuality"
                value={formData.locationQuality}
                onChange={handleChange}
                className="mt-1 w-full border rounded-md p-2"
              >
                {Object.values(LocationQuality).map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium">Orientación</label>
              <select
                name="orientation"
                value={formData.orientation}
                onChange={handleChange}
                className="mt-1 w-full border rounded-md p-2"
              >
                {Object.values(Orientation).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium">Posee renta</label>
              <select
                name="isRented"
                value={String(formData.isRented)}
                onChange={handleBooleanChange}
                className="mt-1 w-full border rounded-md p-2"
              >
                <option value="false">No</option>
                <option value="true">Sí</option>
              </select>
            </div>
          </div>
        </div>

        {/* Columna de foto (1/3) */}
        <div>
          <h2 className="text-lg font-semibold mb-2" style={{ color: primaryColor }}>
            Foto de la Propiedad
          </h2>
          <input type="file" accept="image/*" onChange={handlePhotoUpload} className="mb-4" />
          {formData.mainPhotoUrl ? (
            <img src={formData.mainPhotoUrl} alt="Preview" className="w-full rounded-md shadow" />
          ) : (
            <div className="w-full h-48 bg-gray-100 rounded-md flex items-center justify-center text-gray-400">
              Sin imagen
            </div>
          )}
        </div>
      </div>

      {/* Servicios */}
      <div>
        <h2 className="text-lg font-semibold mb-2" style={{ color: primaryColor }}>
          Servicios
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {(
            [
              ["luz", "Luz"],
              ["agua", "Agua"],
              ["gas", "Gas"],
              ["cloacas", "Cloacas"],
              ["pavimento", "Pavimento"],
            ] as Array<[keyof ACMFormData["services"], string]>
          ).map(([key, label]) => (
            <div key={key}>
              <label className="block text-sm font-medium">{label}</label>
              <select
                name={key}
                value={String(formData.services[key])}
                onChange={handleServiceChange}
                className="mt-1 w-full border rounded-md p-2"
              >
                <option value="false">No</option>
                <option value="true">Sí</option>
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Comparables */}
      <div>
        <h2 className="text-lg font-semibold mb-2" style={{ color: primaryColor }}>
          Propiedades comparadas en la zona
        </h2>

        {formData.comparables.map((c, i) => (
          <div key={i} className="border p-4 rounded-md space-y-3 mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium">m² Cubiertos</label>
                <input
                  type="number"
                  value={c.builtArea}
                  onChange={(e) => handleComparableChange(i, "builtArea", e.target.value)}
                  className="mt-1 w-full border rounded-md p-2"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Precio</label>
                <input
                  type="number"
                  value={c.price}
                  onChange={(e) => handleComparableChange(i, "price", e.target.value)}
                  className="mt-1 w-full border rounded-md p-2"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Días publicada</label>
                <input
                  type="number"
                  value={c.daysPublished}
                  onChange={(e) => handleComparableChange(i, "daysPublished", e.target.value)}
                  className="mt-1 w-full border rounded-md p-2"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium">Coeficiente</label>
                <select
                  value={c.coefficient}
                  onChange={(e) => handleComparableChange(i, "coefficient", e.target.value)}
                  className="mt-1 w-full border rounded-md p-2"
                >
                  {Array.from({ length: 10 }, (_, idx) => (idx + 1) / 10).map((coef) => (
                    <option key={coef} value={coef}>
                      {coef}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">$ / m² (auto)</label>
                <input
                  value={c.pricePerM2 ? c.pricePerM2.toFixed(2) : "0"}
                  disabled
                  className="mt-1 w-full border rounded-md p-2 bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Link</label>
                <input
                  type="text"
                  value={c.listingUrl}
                  onChange={(e) => handleComparableChange(i, "listingUrl", e.target.value)}
                  className="mt-1 w-full border rounded-md p-2"
                  placeholder="URL publicación / Drive"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium">Descripción</label>
              <input
                type="text"
                value={c.description}
                onChange={(e) => handleComparableChange(i, "description", e.target.value)}
                className="mt-1 w-full border rounded-md p-2"
                placeholder="Texto libre"
              />
            </div>

            <button
              type="button"
              onClick={() => removeComparable(i)}
              className="text-red-600 hover:underline"
            >
              Eliminar
            </button>
          </div>
        ))}

        {formData.comparables.length < 4 && (
          <button
            type="button"
            onClick={addComparable}
            className="px-4 py-2 rounded-md text-white"
            style={{ backgroundColor: primaryColor }}
          >
            Agregar comparable
          </button>
        )}
      </div>

      {/* Conclusiones */}
      <div>
        <h2 className="text-lg font-semibold mb-2" style={{ color: primaryColor }}>
          Conclusiones
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Observaciones</label>
            <textarea
              name="observations"
              value={formData.observations}
              onChange={handleChange}
              className="mt-1 w-full border rounded-md p-2 h-28"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Fortalezas</label>
            <textarea
              name="strengths"
              value={formData.strengths}
              onChange={handleChange}
              className="mt-1 w-full border rounded-md p-2 h-28"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Debilidades</label>
            <textarea
              name="weaknesses"
              value={formData.weaknesses}
              onChange={handleChange}
              className="mt-1 w-full border rounded-md p-2 h-28"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">A Considerar</label>
            <textarea
              name="considerations"
              value={formData.considerations}
              onChange={handleChange}
              className="mt-1 w-full border rounded-md p-2 h-28"
            />
          </div>
        </div>
      </div>

      {/* Acciones */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleDownloadPDF}
          className="px-4 py-2 rounded-md text-white"
          style={{ backgroundColor: primaryColor }}
        >
          Descargar PDF
        </button>
      </div>
    </form>
  );
}
