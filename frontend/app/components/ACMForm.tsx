// app/components/ACMForm.tsx
'use client';

import React, { useState, useRef, ChangeEvent } from 'react';
import { jsPDF } from 'jspdf';
import {
  ACMFormData,
  ComparableProperty,
  PropertyType,
  TitleType,
  PropertyCondition,
  LocationQuality,
  Orientation,
  Services,
  AppConfig
} from '@/app/types/acm.types';

const initialServices: Services = {
  luz: false,
  agua: false,
  gas: false,
  cloacas: false,
  pavimento: false,
};

const initialComparable: ComparableProperty = {
  id: Date.now().toString(),
  squareMeters: 0,
  price: 0,
  link: '',
  description: '',
  daysPublished: 0,
  pricePerSquareMeter: 0,
  coefficient: 1,
};

const initialFormData: ACMFormData = {
  date: new Date().toLocaleDateString('es-AR'),
  client: '',
  agent: '',
  phone: '',
  email: '',
  address: '',
  neighborhood: '',
  locality: '',
  propertyType: PropertyType.CASA,
  landSquareMeters: 0,
  coveredSquareMeters: 0,
  hasPlans: false,
  titleType: TitleType.ESCRITURA,
  age: 0,
  condition: PropertyCondition.BUENO,
  locationQuality: LocationQuality.BUENA,
  orientation: Orientation.NORTE,
  services: initialServices,
  hasRent: false,
  mainPhoto: null,
  comparables: [],
  observations: '',
  toConsider: '',
  strengths: '',
  weaknesses: '',
};

export default function ACMForm() {
  const [formData, setFormData] = useState<ACMFormData>(initialFormData);
  const [appConfig, setAppConfig] = useState<AppConfig>({
    primaryColor: '#2563eb',
    secondaryColor: '#64748b',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manejo de cambios en inputs de texto
  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({
        ...prev,
        [name]: checked,
      }));
    } else if (type === 'number') {
      setFormData(prev => ({
        ...prev,
        [name]: parseFloat(value) || 0,
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  // Manejo de servicios (checkboxes)
  const handleServiceChange = (service: keyof Services) => {
    setFormData(prev => ({
      ...prev,
      services: {
        ...prev.services,
        [service]: !prev.services[service],
      },
    }));
  };

  // Manejo de foto
  const handlePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          mainPhoto: reader.result as string,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Agregar comparable
  const addComparable = () => {
    if (formData.comparables.length < 4) {
      setFormData(prev => ({
        ...prev,
        comparables: [
          ...prev.comparables,
          { ...initialComparable, id: Date.now().toString() },
        ],
      }));
    }
  };

  // Eliminar comparable
  const removeComparable = (id: string) => {
    setFormData(prev => ({
      ...prev,
      comparables: prev.comparables.filter(c => c.id !== id),
    }));
  };

  // Actualizar comparable
  const updateComparable = (
    id: string,
    field: keyof ComparableProperty,
    value: string | number
  ) => {
    setFormData(prev => ({
      ...prev,
      comparables: prev.comparables.map(c => {
        if (c.id === id) {
          const updated = { ...c };
          
          if (field === 'squareMeters' || field === 'price' || field === 'daysPublished' || field === 'coefficient') {
            updated[field] = parseFloat(value as string) || 0;
          } else {
            (updated as any)[field] = value;
          }
          
          // Calcular precio por m² automáticamente
          if (field === 'squareMeters' || field === 'price') {
            if (updated.squareMeters > 0 && updated.price > 0) {
              updated.pricePerSquareMeter = updated.price / updated.squareMeters;
            }
          }
          
          return updated;
        }
        return c;
      }),
    }));
  };

  // Calcular valor estimado
  const calculateEstimatedValue = () => {
    if (formData.comparables.length === 0 || formData.coveredSquareMeters === 0) {
      return 0;
    }

    const weightedSum = formData.comparables.reduce((sum, comp) => {
      return sum + (comp.pricePerSquareMeter * comp.coefficient);
    }, 0);

    const totalCoefficients = formData.comparables.reduce((sum, comp) => {
      return sum + comp.coefficient;
    }, 0);

    if (totalCoefficients === 0) return 0;

    const avgPricePerM2 = weightedSum / totalCoefficients;
    return avgPricePerM2 * formData.coveredSquareMeters;
  };

  // Generar PDF
  const generatePDF = () => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    let yPosition = 20;
    const lineHeight = 7;
    const margin = 20;
    const pageWidth = 210;
    const contentWidth = pageWidth - (margin * 2);

    // Configurar colores
    const primaryColor = appConfig.primaryColor;
    
    // Título principal
    pdf.setFontSize(20);
    pdf.setTextColor(primaryColor);
    pdf.text('Análisis Comparativo de Mercado', margin, yPosition);
    yPosition += 15;

    // Fecha
    pdf.setFontSize(10);
    pdf.setTextColor('#666666');
    pdf.text(`Fecha: ${formData.date}`, margin, yPosition);
    yPosition += 10;

    // Línea separadora
    pdf.setDrawColor(primaryColor);
    pdf.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;

    // Información del cliente
    pdf.setFontSize(14);
    pdf.setTextColor(primaryColor);
    pdf.text('Información del Cliente', margin, yPosition);
    yPosition += lineHeight;

    pdf.setFontSize(10);
    pdf.setTextColor('#000000');
    pdf.text(`Cliente: ${formData.client}`, margin, yPosition);
    yPosition += lineHeight;
    pdf.text(`Agente: ${formData.agent}`, margin, yPosition);
    yPosition += lineHeight;
    pdf.text(`Teléfono: ${formData.phone}`, margin, yPosition);
    yPosition += lineHeight;
    pdf.text(`Email: ${formData.email}`, margin, yPosition);
    yPosition += 10;

    // Información de la propiedad
    pdf.setFontSize(14);
    pdf.setTextColor(primaryColor);
    pdf.text('Datos de la Propiedad', margin, yPosition);
    yPosition += lineHeight;

    pdf.setFontSize(10);
    pdf.setTextColor('#000000');
    pdf.text(`Dirección: ${formData.address}`, margin, yPosition);
    yPosition += lineHeight;
    pdf.text(`Barrio: ${formData.neighborhood}`, margin, yPosition);
    yPosition += lineHeight;
    pdf.text(`Localidad: ${formData.locality}`, margin, yPosition);
    yPosition += lineHeight;
    pdf.text(`Tipología: ${formData.propertyType}`, margin, yPosition);
    yPosition += lineHeight;
    pdf.text(`m² Terreno: ${formData.landSquareMeters}`, margin, yPosition);
    yPosition += lineHeight;
    pdf.text(`m² Cubiertos: ${formData.coveredSquareMeters}`, margin, yPosition);
    yPosition += lineHeight;
    pdf.text(`Planos: ${formData.hasPlans ? 'Sí' : 'No'}`, margin, yPosition);
    yPosition += lineHeight;
    pdf.text(`Título: ${formData.titleType}`, margin, yPosition);
    yPosition += lineHeight;
    pdf.text(`Antigüedad: ${formData.age} años`, margin, yPosition);
    yPosition += lineHeight;
    pdf.text(`Estado: ${formData.condition}`, margin, yPosition);
    yPosition += lineHeight;
    pdf.text(`Ubicación: ${formData.locationQuality}`, margin, yPosition);
    yPosition += lineHeight;
    pdf.text(`Orientación: ${formData.orientation}`, margin, yPosition);
    yPosition += lineHeight;
    pdf.text(`Posee renta: ${formData.hasRent ? 'Sí' : 'No'}`, margin, yPosition);
    yPosition += 10;

    // Servicios
    pdf.setFontSize(14);
    pdf.setTextColor(primaryColor);
    pdf.text('Servicios', margin, yPosition);
    yPosition += lineHeight;

    pdf.setFontSize(10);
    pdf.setTextColor('#000000');
    const services = Object.entries(formData.services)
      .filter(([_, value]) => value)
      .map(([key, _]) => key.charAt(0).toUpperCase() + key.slice(1))
      .join(', ');
    pdf.text(services || 'Ninguno', margin, yPosition);
    yPosition += 10;

    // Foto principal (si existe)
    if (formData.mainPhoto) {
      pdf.setFontSize(14);
      pdf.setTextColor(primaryColor);
      pdf.text('Foto Principal', margin, yPosition);
      yPosition += lineHeight;
      
      try {
        pdf.addImage(formData.mainPhoto, 'JPEG', margin, yPosition, 80, 60);
        yPosition += 65;
      } catch (error) {
        console.error('Error al agregar imagen al PDF:', error);
      }
    }

    // Nueva página si es necesario
    if (yPosition > 250) {
      pdf.addPage();
      yPosition = 20;
    }

    // Propiedades comparables
    if (formData.comparables.length > 0) {
      pdf.setFontSize(14);
      pdf.setTextColor(primaryColor);
      pdf.text('Propiedades Comparables', margin, yPosition);
      yPosition += lineHeight;

      pdf.setFontSize(10);
      pdf.setTextColor('#000000');

      formData.comparables.forEach((comp, index) => {
        if (yPosition > 250) {
          pdf.addPage();
          yPosition = 20;
        }

        pdf.setFontSize(11);
        pdf.text(`Comparable ${index + 1}:`, margin, yPosition);
        yPosition += lineHeight;
        
        pdf.setFontSize(10);
        pdf.text(`  m² Cubiertos: ${comp.squareMeters}`, margin, yPosition);
        yPosition += lineHeight;
        pdf.text(`  Precio: $${comp.price.toLocaleString('es-AR')}`, margin, yPosition);
        yPosition += lineHeight;
        pdf.text(`  Precio/m²: $${comp.pricePerSquareMeter.toFixed(2)}`, margin, yPosition);
        yPosition += lineHeight;
        pdf.text(`  Coeficiente: ${comp.coefficient}`, margin, yPosition);
        yPosition += lineHeight;
        pdf.text(`  Días publicada: ${comp.daysPublished}`, margin, yPosition);
        yPosition += lineHeight;
        
        if (comp.description) {
          const lines = pdf.splitTextToSize(`  Descripción: ${comp.description}`, contentWidth - 10);
          lines.forEach((line: string) => {
            if (yPosition > 270) {
              pdf.addPage();
              yPosition = 20;
            }
            pdf.text(line, margin, yPosition);
            yPosition += lineHeight;
          });
        }
        yPosition += 5;
      });

      // Valor estimado
      const estimatedValue = calculateEstimatedValue();
      if (estimatedValue > 0) {
        pdf.setFontSize(12);
        pdf.setTextColor(primaryColor);
        pdf.text(`Valor Estimado: $${estimatedValue.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, margin, yPosition);
        yPosition += 10;
      }
    }

    // Nueva página para observaciones si es necesario
    if (yPosition > 200) {
      pdf.addPage();
      yPosition = 20;
    }

    // Secciones de texto libre
    const textSections = [
      { title: 'Observaciones', content: formData.observations },
      { title: 'A Considerar', content: formData.toConsider },
      { title: 'Fortalezas', content: formData.strengths },
      { title: 'Debilidades', content: formData.weaknesses },
    ];

    textSections.forEach(section => {
      if (section.content) {
        if (yPosition > 250) {
          pdf.addPage();
          yPosition = 20;
        }

        pdf.setFontSize(14);
        pdf.setTextColor(primaryColor);
        pdf.text(section.title, margin, yPosition);
        yPosition += lineHeight;

        pdf.setFontSize(10);
        pdf.setTextColor('#000000');
        const lines = pdf.splitTextToSize(section.content, contentWidth);
        lines.forEach((line: string) => {
          if (yPosition > 270) {
            pdf.addPage();
            yPosition = 20;
          }
          pdf.text(line, margin, yPosition);
          yPosition += lineHeight;
        });
        yPosition += 5;
      }
    });

    // Guardar PDF
    pdf.save(`ACM_${formData.client}_${formData.date.replace(/\//g, '-')}.pdf`);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header con configuración de colores */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold" style={{ color: appConfig.primaryColor }}>
              Análisis Comparativo de Mercado
            </h1>
            <div className="flex gap-4 items-center">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Color Principal:</label>
                <input
                  type="color"
                  value={appConfig.primaryColor}
                  onChange={(e) => setAppConfig(prev => ({ ...prev, primaryColor: e.target.value }))}
                  className="w-10 h-10 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>
          <p className="text-gray-600">Fecha: {formData.date}</p>
        </div>

        {/* Formulario principal */}
        <form className="space-y-6">
          {/* Sección: Información del Cliente */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4" style={{ color: appConfig.primaryColor }}>
              Información del Cliente
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cliente
                </label>
                <input
                  type="text"
                  name="client"
                  value={formData.client}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Agente
                </label>
                <input
                  type="text"
                  name="agent"
                  value={formData.agent}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Sección: Ubicación de la Propiedad */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4" style={{ color: appConfig.primaryColor }}>
              Ubicación de la Propiedad
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dirección
                </label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Barrio
                </label>
                <input
                  type="text"
                  name="neighborhood"
                  value={formData.neighborhood}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Localidad
                </label>
                <input
                  type="text"
                  name="locality"
                  value={formData.locality}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Sección: Características de la Propiedad */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4" style={{ color: appConfig.primaryColor }}>
              Características de la Propiedad
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipología
                </label>
                <select
                  name="propertyType"
                  value={formData.propertyType}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {Object.values(PropertyType).map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  m² Terreno
                </label>
                <input
                  type="number"
                  name="landSquareMeters"
                  value={formData.landSquareMeters}
                  onChange={handleInputChange}
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  m² Cubiertos
                </label>
                <input
                  type="number"
                  name="coveredSquareMeters"
                  value={formData.coveredSquareMeters}
                  onChange={handleInputChange}
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Título
                </label>
                <select
                  name="titleType"
                  value={formData.titleType}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {Object.values(TitleType).map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Antigüedad (años)
                </label>
                <input
                  type="number"
                  name="age"
                  value={formData.age}
                  onChange={handleInputChange}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estado
                </label>
                <select
                  name="condition"
                  value={formData.condition}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {Object.values(PropertyCondition).map(condition => (
                    <option key={condition} value={condition}>{condition}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ubicación
                </label>
                <select
                  name="locationQuality"
                  value={formData.locationQuality}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {Object.values(LocationQuality).map(quality => (
                    <option key={quality} value={quality}>{quality}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Orientación
                </label>
                <select
                  name="orientation"
                  value={formData.orientation}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {Object.values(Orientation).map(orientation => (
                    <option key={orientation} value={orientation}>{orientation}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="hasPlans"
                    checked={formData.hasPlans}
                    onChange={handleInputChange}
                    className="mr-2 h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Tiene Planos</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="hasRent"
                    checked={formData.hasRent}
                    onChange={handleInputChange}
                    className="mr-2 h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Posee Renta</span>
                </label>
              </div>
            </div>

            {/* Subsección: Servicios */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-lg font-medium mb-3" style={{ color: appConfig.primaryColor }}>
                Servicios
              </h3>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.services.luz}
                    onChange={() => handleServiceChange('luz')}
                    className="mr-2 h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Luz</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.services.agua}
                    onChange={() => handleServiceChange('agua')}
                    className="mr-2 h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Agua</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.services.gas}
                    onChange={() => handleServiceChange('gas')}
                    className="mr-2 h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Gas</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.services.cloacas}
                    onChange={() => handleServiceChange('cloacas')}
                    className="mr-2 h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Cloacas</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.services.pavimento}
                    onChange={() => handleServiceChange('pavimento')}
                    className="mr-2 h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Pavimento</span>
                </label>
              </div>
            </div>

            {/* Foto principal */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-lg font-medium mb-3" style={{ color: appConfig.primaryColor }}>
                Foto Principal
              </h3>
              <div className="space-y-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Seleccionar Foto
                </button>
                {formData.mainPhoto && (
                  <div className="relative inline-block">
                    <img
                      src={formData.mainPhoto}
                      alt="Foto principal"
                      className="max-w-xs h-48 object-cover rounded-lg shadow-md"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, mainPhoto: null }))}
                      className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sección: Propiedades Comparables */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold" style={{ color: appConfig.primaryColor }}>
                Propiedades Comparables en la Zona
              </h2>
              <button
                type="button"
                onClick={addComparable}
                disabled={formData.comparables.length >= 4}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  formData.comparables.length >= 4
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                + Agregar Comparable ({formData.comparables.length}/4)
              </button>
            </div>

            {formData.comparables.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No hay propiedades comparables. Haga clic en "Agregar Comparable" para comenzar.
              </p>
            ) : (
              <div className="space-y-4">
                {formData.comparables.map((comparable, index) => (
                  <div key={comparable.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-medium text-gray-900">Comparable #{index + 1}</h3>
                      <button
                        type="button"
                        onClick={() => removeComparable(comparable.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Eliminar
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          m² Cubiertos
                        </label>
                        <input
                          type="number"
                          value={comparable.squareMeters}
                          onChange={(e) => updateComparable(comparable.id, 'squareMeters', e.target.value)}
                          min="0"
                          step="0.01"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Precio Publicado
                        </label>
                        <input
                          type="number"
                          value={comparable.price}
                          onChange={(e) => updateComparable(comparable.id, 'price', e.target.value)}
                          min="0"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Precio por m² (calculado)
                        </label>
                        <input
                          type="text"
                          value={comparable.pricePerSquareMeter > 0 ? `${comparable.pricePerSquareMeter.toFixed(2)}` : '$0'}
                          disabled
                          className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-700"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Link de Publicación
                        </label>
                        <input
                          type="text"
                          value={comparable.link}
                          onChange={(e) => updateComparable(comparable.id, 'link', e.target.value)}
                          placeholder="URL o enlace de Drive"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Días Publicada
                        </label>
                        <input
                          type="number"
                          value={comparable.daysPublished}
                          onChange={(e) => updateComparable(comparable.id, 'daysPublished', e.target.value)}
                          min="0"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Coeficiente Multiplicador
                        </label>
                        <select
                          value={comparable.coefficient}
                          onChange={(e) => updateComparable(comparable.id, 'coefficient', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          {[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0].map(value => (
                            <option key={value} value={value}>{value}</option>
                          ))}
                        </select>
                      </div>
                      <div className="md:col-span-3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Descripción
                        </label>
                        <textarea
                          value={comparable.description}
                          onChange={(e) => updateComparable(comparable.id, 'description', e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Mostrar valor estimado */}
            {formData.comparables.length > 0 && formData.coveredSquareMeters > 0 && (
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="text-lg font-semibold text-blue-900 mb-2">Valor Estimado de la Propiedad</h3>
                <p className="text-2xl font-bold text-blue-700">
                  ${calculateEstimatedValue().toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-sm text-blue-600 mt-1">
                  Basado en {formData.comparables.length} propiedad{formData.comparables.length > 1 ? 'es' : ''} comparable{formData.comparables.length > 1 ? 's' : ''}
                </p>
              </div>
            )}
          </div>

          {/* Sección: Observaciones y Análisis */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4" style={{ color: appConfig.primaryColor }}>
              Observaciones y Análisis
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observaciones
                </label>
                <textarea
                  name="observations"
                  value={formData.observations}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ingrese observaciones generales sobre la propiedad..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  A Considerar
                </label>
                <textarea
                  name="toConsider"
                  value={formData.toConsider}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Aspectos importantes a tener en cuenta..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fortalezas
                </label>
                <textarea
                  name="strengths"
                  value={formData.strengths}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Puntos fuertes de la propiedad..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Debilidades
                </label>
                <textarea
                  name="weaknesses"
                  value={formData.weaknesses}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Aspectos a mejorar o considerar..."
                />
              </div>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => setFormData(initialFormData)}
              className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Limpiar Formulario
            </button>
            <button
              type="button"
              onClick={generatePDF}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Exportar a PDF
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
