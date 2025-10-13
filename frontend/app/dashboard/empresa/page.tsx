"use client";

import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import PlanStatusBanner from "./components/PlanStatusBanner";

export default function EmpresaDashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      {/* 🧭 Banner de plan */}
      <PlanStatusBanner />

      {/* 🏢 Bienvenida */}
      <section className="bg-white shadow-sm rounded-xl p-6">
        <h1 className="text-2xl font-bold mb-2">
          Bienvenido, {user?.user_metadata?.nombre || "Usuario"}
        </h1>
        <p className="text-gray-600 mb-4">
          Panel principal de tu inmobiliaria. Desde aquí podés gestionar tu
          equipo, tus planes y toda la configuración de tu empresa.
        </p>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard/empresa/asesores"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
          >
            👥 Gestionar Asesores
          </Link>

          <Link
            href="/dashboard/empresa/planes"
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
          >
            💼 Ver Planes
          </Link>
        </div>
      </section>

      {/* 🧾 Info básica */}
      <section className="bg-white shadow-sm rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-4">Datos de la empresa</h2>
        <ul className="space-y-2 text-gray-700">
          <li>
            <strong>Inmobiliaria:</strong>{" "}
            {user?.user_metadata?.inmobiliaria || "No especificado"}
          </li>
          <li>
            <strong>Razón Social:</strong>{" "}
            {user?.user_metadata?.razon_social || "No especificado"}
          </li>
          <li>
            <strong>Condición Fiscal:</strong>{" "}
            {user?.user_metadata?.condicion_fiscal || "No especificado"}
          </li>
          <li>
            <strong>Provincia:</strong>{" "}
            {user?.user_metadata?.provincia || "No especificado"}
          </li>
          <li>
            <strong>Email:</strong> {user?.email}
          </li>
          <li>
            <strong>Teléfono:</strong>{" "}
            {user?.user_metadata?.telefono || "No especificado"}
          </li>
        </ul>
      </section>
    </div>
  );
}
