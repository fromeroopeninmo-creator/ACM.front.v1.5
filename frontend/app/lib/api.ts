import { ACMFormData } from "@/types/acm.types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function createACMAnalysis(data: ACMFormData) {
  const response = await fetch(`${API_URL}/acm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Error al crear ACM: ${response.statusText}`);
  }

  return response.json();
}
