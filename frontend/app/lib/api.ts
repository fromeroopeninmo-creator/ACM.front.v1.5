const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function createACMAnalysis(data: ACMFormData) {
  const response = await fetch(`${API_URL}/acm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Error al crear el análisis');
  }

  return response.json();
}

export async function getACMAnalyses(advisorName?: string, clientName?: string) {
  const params = new URLSearchParams();
  if (advisorName) params.append('advisorName', advisorName);
  if (clientName) params.append('clientName', clientName);

  const response = await fetch(`${API_URL}/acm?${params}`);
  
  if (!response.ok) {
    throw new Error('Error al obtener los análisis');
  }

  return response.json();
}

export async function getACMAnalysis(id: string) {
  const response = await fetch(`${API_URL}/acm/${id}`);
  
  if (!response.ok) {
    throw new Error('Error al obtener el análisis');
  }

  return response.json();
}