// frontend/app/dashboard/soporte/InformesTable.tsx
"use client";

type InformeItem = {
  id: string;
  titulo?: string | null;
  estado: string;
  fecha_creacion: string; // ISO
};

type Props = {
  informes: InformeItem[];
};

function fmtDateOnly(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString();
}

export default function InformesTable({ informes }: Props) {
  const isEmpty = !informes || informes.length === 0;

  return (
    <div className="overflow-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 dark:bg-neutral-900">
          <tr className="text-left">
            <th className="px-3 py-2">Título</th>
            <th className="px-3 py-2">Estado</th>
            <th className="px-3 py-2">Fecha</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {isEmpty ? (
            <tr>
              <td colSpan={4} className="px-3 py-6 text-center text-gray-500">
                Sin informes recientes.
              </td>
            </tr>
          ) : (
            informes.map((inf) => (
              <tr key={inf.id} className="border-t">
                <td className="px-3 py-2">{inf.titulo || "Informe VAI"}</td>
                <td className="px-3 py-2">
                  <span
                    className={
                      inf.estado?.toLowerCase() === "aprobado" ||
                      inf.estado?.toLowerCase() === "completado"
                        ? "inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-green-100 text-green-700"
                        : inf.estado?.toLowerCase() === "pendiente"
                        ? "inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-amber-100 text-amber-700"
                        : "inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-gray-100 text-gray-700"
                    }
                  >
                    {inf.estado}
                  </span>
                </td>
                <td className="px-3 py-2">{fmtDateOnly(inf.fecha_creacion)}</td>
                <td className="px-3 py-2">
                  <a
                    href={`/dashboard/empresa/informes/${inf.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    Ver
                  </a>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
