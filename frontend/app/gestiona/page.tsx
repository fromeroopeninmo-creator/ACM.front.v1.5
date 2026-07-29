import type { Metadata } from "next";
import PublicPage from "../components/PublicPage";

export const metadata: Metadata = { title: "Gestioná oportunidades y equipos inmobiliarios", description: "Tracker, agenda y gestión de equipo para organizar contactos, propiedades, actividades y cierres en una inmobiliaria." };

export default function GestionaPage() {
  return <PublicPage eyebrow="Gestioná" title="Ordená oportunidades, propiedades y equipos sin perder de vista lo importante." intro="VAI Prop acompaña el proceso comercial de tu inmobiliaria desde el primer contacto hasta el cierre, con una lógica simple que puede utilizarse sola o en paralelo con tu CRM actual." closing="Menos información dispersa. Más seguimiento real." tools={[
      { eyebrow: "Seguimiento comercial", title: "Tracker inmobiliario", description: "Centralizá contactos, actividades, propiedades captadas y de terceros, ventas, alquileres y cierres en un flujo pensado para la actividad inmobiliaria.", benefits: ["Seguí cada oportunidad desde el primer contacto.", "Registrá reuniones, prelisting, captaciones y cierres.", "Diferenciá propiedades propias y de terceros."], image: "/landing/images/tracker_actividades.png", imageAlt: "Tracker comercial inmobiliario de VAI Prop" },
      { eyebrow: "Organización diaria", title: "Agenda", description: "Organizá reuniones, visitas, seguimientos y tareas para que cada asesor sepa qué debe hacer y cuándo.", benefits: ["Visualizá compromisos y actividades pendientes.", "Relacioná acciones con contactos y oportunidades.", "Reducí olvidos y mejorá la continuidad comercial."], image: "/landing/images/tools/agenda-inmobiliaria.png", imageAlt: "Agenda inmobiliaria integrada en VAI Prop" },
      { eyebrow: "Dirección comercial", title: "Gestión de equipo", description: "Obtené una visión general e individual del trabajo de tus asesores para acompañar, priorizar y tomar decisiones con evidencia.", benefits: ["Revisá embudos, actividad y evolución por asesor.", "Identificá captaciones, informes, cierres y última actividad.", "Compará períodos sin invadir la cartera de cada profesional."], image: "/landing/images/tools/gestion-de-equipo.png", imageAlt: "Panel de gestión y rendimiento de asesores" },
    ]} />;
}
