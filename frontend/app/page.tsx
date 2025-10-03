// app/page.tsx
"use client";

import ProtectedRoute from "./context/ProtectedRoute";
import HomePage from "./(protected)/page";

export default function RootPage() {
  return (
    <ProtectedRoute>
      <HomePage />
    </ProtectedRoute>
  );
}
