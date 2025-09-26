'use client';

import { useState } from 'react';
import { ACMFormData, ComparableProperty, PropertyType, Orientation, LocationQuality, PropertyCondition, TitleType } from '@/app/types/acm.types';
import { createACMAnalysis } from '@/app/lib/api';

const initialFormData: ACMFormData = {
  clientName: '',
  advisorName: '',
  phone: '',
  email: '',
  address: '',
  neighborhood: '',
  propertyType: PropertyType.CASA,
  age: 0,
  landArea: 0,
  builtArea: 0,
  hasPlans: false,
  orientation: Orientation.NORTE,
  locationQuality: LocationQuality.BUENA,
  condition: PropertyCondition.BUENO,
  hasGas: true,
  hasElectricity: true,
  hasSewer: true,
  hasWater: true,
  titleType: TitleType.ESCRITURA,
  isRented: false,
  mainPhotoUrl: '',
  comparables: []
};

const initialComparable: ComparableProperty = {
  address: '',
  photoUrl: '',
  listingUrl: '',
  builtArea: 0,
  price: 0,
  description: ''
};

export default function ACMForm() {
  const [formData, setFormData] = useState<ACMFormData>(initialFormData);
  const [comparables, setComparables] = useState<ComparableProperty[]>([{ ...initialComparable }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (type === 'number') {
      setFormData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleComparableChange = (index: number, field: keyof ComparableProperty, value: any) => {
    const updatedComparables = [...comparables];
    updatedComparables[index] = {
      ...updatedComparables[index],
      [field]: field === 'builtArea' || field === 'price' ? parseFloat(value) || 0 : value
    };
    setComparables(updatedComparables);
  };

  const addComparable = () => {
    if (comparables.length < 4) {
      setComparables([...comparables, { ...initialComparable }]);
    }
  };

  const removeComparable = (index: number) => {
    if (comparables.length > 1) {
      setComparables(comparables.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const dataToSubmit = {
        ...formData,
        comparables: comparables.filter(c => c.address && c.price > 0 && c.builtArea > 0)
      };

      const response = await createACMAnalysis(dataToSubmit);
      setResult(response);
      
      // Reset form
      setFormData(initialFormData);
      setComparables([{ ...initialComparable }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear el análisis');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <form onSubmit={handleSubmit} className="space-y-8 bg-white rounded-lg shadow-lg p-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-8">
            Análisis Comparativo de Mercado (ACM)
          </h2>
        </div>

        {/* Datos del Cliente */}
        <div className="border-b pb-8">
          <h3 className="text-xl font-semibold mb-6">Datos del Cliente</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre del Cliente *
              </label>
              <input
                type="text"
                name="clientName"
                value={formData.clientName}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Asesor *
              </label>
              <input
                type="text"
                name="advisorName"
                value={formData.advisorName}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Teléfono *
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Datos de la Propiedad */}
        <div className="border-b pb-8">