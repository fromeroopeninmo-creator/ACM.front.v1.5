// frontend/app/dashboard/soporte/AsesoresTable.tsx
"use client";

type AsesorItem = {
  id: string;
  nombre: string;
  apellido?: string | null;
  email: string;
  activo: boolean;
  fecha_creacion?: string | null;
};

type Props = {
  asesores: AsesorItem[];
};

function fmtDateOnly(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString();
}

export default function AsesoresTable({ asesores }: Props) {
  const isEmpty = !asesores || asesores.length === 0;

  return (
    <div className="overflow-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 dark:bg-neutral-900">
          <tr className="text-left">
            <th className="px-3 py-2">Nombre</th>
            <th className="px-3 py-2">Email</th>
            <th className="px-3 py-2">Activo</th>
            <th className="px-3 py-2">Alta</th>
          </tr>
        </thead>
        <tbody>
          {isEmpty ? (
            <tr>
              <td colSpan={4} className="px-3 py-6 text-center text-gray-500">
                Sin asesores.
              </td>
            </tr>
          ) : (
            asesores.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="px-3 py-2">
                  {a.nombre} {a.apellido || ""}
                </td>
                <td className="px-3 py-2">{a.email}</td>
                <td className="px-3 py-2">
                  <span
                    className={
                      a.activo
                        ? "inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-green-100 text-green-700"
                        : "inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-amber-100 text-amber-700"
                    }
                  >
                    {a.activo ? "Activo" : "Suspendido"}
                  </span>
                </td>
                <td className="px-3 py-2">{fmtDateOnly(a.fecha_creacion || null)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
