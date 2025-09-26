"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

// Definimos el tipo de nuestro contexto
interface ThemeContextType {
  primaryColor: string;
  setPrimaryColor: (color: string) => void;
}

// Creamos el contexto
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Provider que envolverá la app
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [primaryColor, setPrimaryColor] = useState("#2563eb"); // azul por defecto

  return (
    <ThemeContext.Provider value={{ primaryColor, setPrimaryColor }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Hook para usar el contexto en cualquier componente
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme debe usarse dentro de un ThemeProvider");
  }
  return context;
}
