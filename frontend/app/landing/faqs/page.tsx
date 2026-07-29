// frontend/app/landing/faqs/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import SiteNavbar from "@/components/SiteNavbar";

export const metadata: Metadata = {
  title: "Preguntas frecuentes sobre VAI Prop",
  description:
    "Conocé cómo VAI Prop protege los datos de tus clientes, cómo funcionan sus herramientas, los planes disponibles y las respuestas a las consultas más frecuentes.",
  alternates: {
    canonical: "https://vaiprop.com/landing/faqs",
  },
  openGraph: {
    title: "Preguntas frecuentes sobre VAI Prop",
    description:
      "Seguridad de datos, funcionamiento de las herramientas, planes, pagos y soporte para inmobiliarias y brokers.",
    url: "https://vaiprop.com/landing/faqs",
    siteName: "VAI Prop",
    locale: "es_AR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Preguntas frecuentes sobre VAI Prop",
    description:
      "Seguridad de datos, herramientas, planes y soporte para inmobiliarias y brokers.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

type Faq = {
  question: string;
  answer: React.ReactNode;
};

type FaqSection = {
  id: string;
  title: string;
  description: string;
  faqs: Faq[];
};

const linkClass =
  "font-medium text-amber-300 underline decoration-amber-300/40 underline-offset-4 transition hover:text-amber-200";

function List({ children }: { children: React.ReactNode }) {
  return (
    <ul className="mt-3 space-y-2 pl-5 text-neutral-300 marker:text-amber-400">
      {children}
    </ul>
  );
}

function FaqCard({ faq }: { faq: Faq }) {
  return (
    <details className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] transition hover:border-amber-400/25 hover:bg-white/[0.05]">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-5 px-5 py-5 text-left text-base font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400 sm:px-6">
        <span>{faq.question}</span>
        <span
          aria-hidden="true"
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 text-lg font-light text-amber-300 transition duration-200 group-open:rotate-45 group-open:border-amber-400/30 group-open:bg-amber-400/10"
        >
          +
        </span>
      </summary>
      <div className="border-t border-white/10 px-5 py-5 text-sm leading-7 text-neutral-300 sm:px-6">
        {faq.answer}
      </div>
    </details>
  );
}

export default function FaqsPage() {
  const mailtoSoporte =
    "mailto:soporte@vaiprop.com?subject=Consulta%20sobre%20VAI%20Prop";
  const whatsappUrl =
    "https://wa.me/5493513280798?text=Hola%2C%20quiero%20hacer%20una%20consulta%20sobre%20VAI%20Prop.";

  const sections: FaqSection[] = [
    {
      id: "seguridad",
      title: "1. Seguridad, privacidad y datos sensibles",
      description:
        "Lo más importante antes de comenzar: qué información es opcional, quién puede verla y cómo se utilizan los datos.",
      faqs: [
        {
          question:
            "¿Tengo que cargar el nombre, teléfono o email de mis clientes y prospectos?",
          answer: (
            <>
              <p>
                No. Los datos personales o sensibles de clientes y prospectos
                no son obligatorios para utilizar las herramientas principales
                de VAI Prop. Podés trabajar con referencias internas, iniciales,
                códigos o descripciones que te permitan identificar cada caso
                dentro de tu empresa.
              </p>
              <p className="mt-3">
                La plataforma está diseñada para que una inmobiliaria pueda
                analizar propiedades, gestionar actividades y medir resultados
                sin exponer necesariamente su cartera de contactos.
              </p>
            </>
          ),
        },
        {
          question:
            "¿Es obligatorio cargar la dirección exacta de una propiedad?",
          answer: (
            <>
              <p>
                No. Podés utilizar una ubicación aproximada, barrio, zona o una
                referencia interna cuando no quieras registrar la dirección
                exacta. Algunos informes pueden necesitar más precisión para
                obtener un resultado útil, pero la decisión sobre qué datos
                identificatorios cargar siempre queda en manos de la empresa.
              </p>
            </>
          ),
        },
        {
          question: "¿VAI Prop puede apropiarse de mis clientes o contactos?",
          answer: (
            <>
              <p>
                No. La información que cargás pertenece a tu operación y se
                utiliza para brindarte las funcionalidades de la plataforma.
                VAI Prop no vende bases de contactos ni publica la información
                identificable de tus clientes, prospectos o propiedades.
              </p>
              <p className="mt-3">
                Recomendamos igualmente evitar la carga de información
                innecesaria y respetar siempre las obligaciones legales de
                privacidad aplicables a tu actividad.
              </p>
            </>
          ),
        },
        {
          question: "¿Quién puede ver la información de mi empresa?",
          answer: (
            <>
              <p>
                La plataforma separa la información por empresa. La cuenta
                Empresa puede acceder a sus datos corporativos y al trabajo de
                los asesores vinculados. Cada Asesor accede a su propia
                actividad e información de acuerdo con los permisos del sistema.
              </p>
              <p className="mt-3">
                La información no se publica automáticamente ni queda visible
                para otras inmobiliarias.
              </p>
            </>
          ),
        },
        {
          question:
            "¿Qué información se comparte con VAI Market Data?",
          answer: (
            <>
              <p>
                VAI Market Data trabaja con información estadística agregada y
                anónima. No muestra nombres, teléfonos, emails, direcciones
                exactas ni datos que permitan identificar a un cliente,
                propietario, asesor o inmobiliaria.
              </p>
              <p className="mt-3">
                Su objetivo es generar referencias de mercado basadas en
                operaciones, zonas, tipologías, valores y tiempos, manteniendo
                separados los datos sensibles.
              </p>
            </>
          ),
        },
        {
          question: "¿Dónde se almacenan los datos?",
          answer: (
            <>
              <p>
                VAI Prop utiliza infraestructura tecnológica de terceros como
                Supabase y Vercel, junto con controles de acceso, autenticación
                y reglas de seguridad para separar la información de cada
                cuenta.
              </p>
              <p className="mt-3">
                Podés consultar más detalles en la{" "}
                <Link href="/landing/legales" className={linkClass}>
                  sección legal y de privacidad
                </Link>
                .
              </p>
            </>
          ),
        },
      ],
    },
    {
      id: "plataforma",
      title: "2. Sobre VAI Prop",
      description:
        "Qué es la plataforma, a quién está dirigida y cómo convive con las herramientas que ya utiliza una inmobiliaria.",
      faqs: [
        {
          question: "¿Qué es VAI Prop?",
          answer: (
            <>
              <p>
                VAI Prop es una plataforma de inteligencia y rendimiento
                inmobiliario creada para inmobiliarias, brokers y equipos
                comerciales. Reúne herramientas para analizar propiedades,
                gestionar oportunidades y medir la actividad del negocio desde
                un mismo entorno.
              </p>
              <List>
                <li>Valuación inmobiliaria e informes profesionales.</li>
                <li>Factibilidad constructiva preliminar.</li>
                <li>PER y datos de mercado.</li>
                <li>Tracker, agenda y gestión de equipos.</li>
                <li>Analytics, calculadoras e indicadores económicos.</li>
              </List>
            </>
          ),
        },
        {
          question: "¿VAI Prop es un CRM inmobiliario?",
          answer: (
            <>
              <p>
                No es un CRM tradicional. VAI Prop se enfoca en el análisis
                inmobiliario, la producción de informes, el seguimiento
                operativo y la medición del rendimiento.
              </p>
              <p className="mt-3">
                Puede utilizarse como plataforma principal para esos procesos o
                convivir en paralelo con el CRM que la inmobiliaria ya utiliza,
                sin obligarla a reemplazarlo.
              </p>
            </>
          ),
        },
        {
          question: "¿Quién puede usar VAI Prop?",
          answer: (
            <>
              <p>
                Está orientado principalmente a inmobiliarias, brokers,
                titulares de equipos y asesores inmobiliarios. La cuenta Empresa
                administra el plan, la configuración y los asesores; las
                cuentas Asesor trabajan dentro de la empresa con acceso a sus
                herramientas y actividad.
              </p>
            </>
          ),
        },
        {
          question: "¿Cómo creo una cuenta?",
          answer: (
            <>
              <p>
                Ingresá en{" "}
                <Link href="/auth/register" className={linkClass}>
                  Crear cuenta
                </Link>
                , completá los datos solicitados y confirmá tu correo
                electrónico. Luego podrás acceder al período de prueba y
                configurar la información básica de tu inmobiliaria.
              </p>
            </>
          ),
        },
        {
          question: "¿Qué diferencia hay entre Empresa y Asesor?",
          answer: (
            <>
              <p>
                La cuenta Empresa es titular del plan y administra la
                configuración corporativa, los asesores, los pagos y la visión
                general del equipo. El Asesor pertenece a una empresa y trabaja
                con su propia actividad, informes, agenda y seguimiento, según
                las funcionalidades habilitadas.
              </p>
            </>
          ),
        },
      ],
    },
    {
      id: "como-usar",
      title: "3. Cómo usar las herramientas",
      description:
        "Una guía rápida para comprender qué hace cada módulo y en qué momento del trabajo inmobiliario conviene utilizarlo.",
      faqs: [
        {
          question: "¿Cómo se utiliza el Valuador VAI?",
          answer: (
            <>
              <p>
                Ingresá las características de la propiedad, incorporá los
                comparables disponibles, revisá sus diferencias y completá el
                análisis. VAI Prop organiza la información y genera un informe
                profesional que podés revisar, guardar y descargar en PDF.
              </p>
              <p className="mt-3">
                Es especialmente útil para preparar una captación, fundamentar
                el precio sugerido y conversar con el propietario usando
                criterios comparativos.
              </p>
              <a
                href="/landing/docs/ejemplo_Informe_VAI.pdf"
                target="_blank"
                rel="noreferrer"
                className={`${linkClass} mt-3 inline-flex`}
              >
                Ver informe VAI de ejemplo
              </a>
            </>
          ),
        },
        {
          question: "¿Cómo se utiliza la Factibilidad Constructiva?",
          answer: (
            <>
              <p>
                Cargá los datos del lote y los parámetros urbanísticos que hayas
                verificado, como FOS, altura, retiros y superficies. La
                herramienta permite estimar el potencial construible,
                superficies vendibles, eficiencia, unidades y otros indicadores
                preliminares.
              </p>
              <p className="mt-3">
                Es una herramienta de prefactibilidad: no reemplaza el estudio
                profesional, el anteproyecto, la consulta normativa ni la
                aprobación municipal.
              </p>
              <a
                href="/landing/docs/ejemplo_Informe_Factibilidad.pdf"
                target="_blank"
                rel="noreferrer"
                className={`${linkClass} mt-3 inline-flex`}
              >
                Ver informe de factibilidad de ejemplo
              </a>
            </>
          ),
        },
        {
          question: "¿Cómo se utiliza VAI Market Data?",
          answer: (
            <>
              <p>
                Seleccioná operación, ubicación, tipología, dormitorios, moneda,
                superficie y período. Cuando existe una muestra suficiente, el
                tablero presenta referencias como precio promedio, mediana,
                rango observado, valor por metro cuadrado, brecha entre
                publicación y cierre, tiempos de venta y zonas más activas.
              </p>
              <p className="mt-3">
                Sirve como acelerador de venta porque ayuda a respaldar una
                conversación comercial con referencias agregadas del mercado,
                sin mostrar información sensible.
              </p>
            </>
          ),
        },
        {
          question: "¿Cómo se utiliza el PER inmobiliario?",
          answer: (
            <>
              <p>
                Cargá el valor de la propiedad y la renta de referencia para
                estimar cuántos años de alquiler serían necesarios para
                recuperar el valor de compra. El resultado ayuda a comparar
                oportunidades y explicar de manera simple la relación entre
                precio y renta.
              </p>
              <p className="mt-3">
                Es un indicador orientativo y un acelerador comercial; no
                reemplaza un análisis financiero, impositivo o de inversión
                completo.
              </p>
            </>
          ),
        },
        {
          question: "¿Cómo se utiliza el Tracker?",
          answer: (
            <>
              <p>
                Registrá contactos y oportunidades, actualizá su estado y
                relacioná actividades, propiedades captadas, propiedades de
                terceros, reservas y cierres. También podés trabajar con ventas
                y alquileres y consultar el avance por período.
              </p>
              <p className="mt-3">
                No es obligatorio cargar datos sensibles: podés identificar los
                contactos mediante referencias internas.
              </p>
            </>
          ),
        },
        {
          question: "¿Cómo se utiliza la Agenda?",
          answer: (
            <>
              <p>
                Creá actividades con fecha y hora, como llamadas, reuniones,
                visitas, seguimientos o tareas comerciales. La Empresa puede
                organizar y visualizar la actividad del equipo, mientras que el
                Asesor trabaja con su propia agenda.
              </p>
            </>
          ),
        },
        {
          question: "¿Cómo funciona Gestión de Equipo?",
          answer: (
            <>
              <p>
                Desde la cuenta Empresa podés crear y administrar asesores,
                consultar su actividad y revisar indicadores como prospectos,
                reuniones, informes, captaciones, cierres, conversión, días
                activos y últimos movimientos.
              </p>
              <p className="mt-3">
                El objetivo es acompañar y mejorar el rendimiento, no controlar
                información privada ajena a la actividad registrada en la
                plataforma.
              </p>
            </>
          ),
        },
        {
          question: "¿Cómo se utilizan Analytics y los indicadores?",
          answer: (
            <>
              <p>
                Elegí un período y aplicá los filtros disponibles para analizar
                prospectos, captaciones, cierres, honorarios, operaciones,
                evolución y rendimiento por asesor. Los indicadores se
                construyen a partir de la información registrada en las
                herramientas de VAI Prop.
              </p>
              <p className="mt-3">
                Cuanto más consistente sea la carga de actividad, más útil será
                la lectura del negocio.
              </p>
            </>
          ),
        },
        {
          question:
            "¿Cómo se usan las calculadoras de alquileres y créditos UVA?",
          answer: (
            <>
              <p>
                Ingresá los valores y fechas solicitados para simular escenarios
                de actualización de alquiler o evolución de un crédito UVA. Los
                resultados sirven como referencia para explicar alternativas y
                acompañar conversaciones con clientes.
              </p>
              <p className="mt-3">
                Son cálculos orientativos y no reemplazan información bancaria,
                contractual, legal o contable actualizada.
              </p>
            </>
          ),
        },
        {
          question:
            "¿Qué muestran los indicadores económicos y la cotización del dólar?",
          answer: (
            <>
              <p>
                La plataforma presenta referencias económicas útiles para
                contextualizar operaciones inmobiliarias. Las cotizaciones y
                los indicadores dependen de fuentes externas y pueden tener
                horarios o demoras de actualización, por lo que deben tomarse
                como información orientativa.
              </p>
            </>
          ),
        },
      ],
    },
    {
      id: "planes",
      title: "4. Planes, prueba y pagos",
      description:
        "Cómo se diferencian los planes actuales y qué sucede con las renovaciones o vencimientos.",
      faqs: [
        {
          question: "¿Todos los planes incluyen las mismas herramientas?",
          answer: (
            <>
              <p>
                Sí. Todos los planes públicos incluyen acceso completo a VAI
                Prop. La diferencia principal es la cantidad de usuarios
                habilitados para trabajar dentro de la inmobiliaria.
              </p>
            </>
          ),
        },
        {
          question: "¿Cuáles son los planes disponibles?",
          answer: (
            <>
              <List>
                <li>
                  <strong className="text-white">Broker:</strong> un usuario
                  titular, sin asesores adicionales.
                </li>
                <li>
                  <strong className="text-white">Equipo:</strong> titular más
                  hasta cinco asesores.
                </li>
                <li>
                  <strong className="text-white">Team Pro:</strong> titular más
                  hasta diez asesores.
                </li>
                <li>
                  <strong className="text-white">Enterprise:</strong> cupo y
                  condiciones definidos mediante acuerdo comercial.
                </li>
              </List>
              <p className="mt-3">
                Podés consultar precios y condiciones actualizadas en{" "}
                <Link href="/planes" className={linkClass}>
                  Planes
                </Link>
                .
              </p>
            </>
          ),
        },
        {
          question: "¿Cuánto dura el período de prueba?",
          answer: (
            <>
              <p>
                El Trial dura 30 días e incluye acceso completo para que puedas
                conocer la plataforma. Al finalizar, la cuenta titular debe
                elegir un plan pago para continuar utilizando el servicio.
              </p>
            </>
          ),
        },
        {
          question: "¿Cómo se realizan los pagos?",
          answer: (
            <>
              <p>
                Los planes públicos pueden abonarse mediante los medios
                disponibles en Mercado Pago. Los precios publicados se expresan
                más IVA cuando corresponda. Enterprise se gestiona mediante una
                propuesta y acuerdo comercial.
              </p>
            </>
          ),
        },
        {
          question: "¿Puedo cambiar de plan?",
          answer: (
            <>
              <p>
                Sí. Desde la sección Planes podés revisar las opciones
                disponibles. Un cambio anticipado a otro plan inicia un nuevo
                ciclo cuando el pago es aprobado y no utiliza prorrateo. Si
                renovás el mismo plan antes del vencimiento, el nuevo ciclo se
                agrega al finalizar el actual para que no pierdas días.
              </p>
            </>
          ),
        },
        {
          question: "¿Qué sucede cuando vence el plan?",
          answer: (
            <>
              <p>
                Cada ciclo pago dura 30 días. Si vence sin una renovación
                aprobada, la cuenta se suspende hasta regularizar el pago. La
                sección Planes permanece disponible para que la Empresa pueda
                renovar o elegir una opción habilitada.
              </p>
            </>
          ),
        },
        {
          question: "¿Cómo funciona el Plan Enterprise?",
          answer: (
            <>
              <p>
                Enterprise está pensado para equipos que necesitan una cantidad
                de usuarios o condiciones comerciales especiales. Se activa
                únicamente mediante acuerdo comercial, donde se definen el
                cupo, el precio y la vigencia.
              </p>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className={`${linkClass} mt-3 inline-flex`}
              >
                Consultar Plan Enterprise
              </a>
            </>
          ),
        },
      ],
    },
    {
      id: "informes",
      title: "5. Informes y alcance profesional",
      description:
        "Edición, personalización y alcance de los documentos generados por la plataforma.",
      faqs: [
        {
          question: "¿Puedo editar un informe después de guardarlo?",
          answer: (
            <>
              <p>
                Sí. Podés abrir nuevamente el informe, actualizar los datos y
                guardar los cambios. La próxima descarga del PDF reflejará la
                información vigente.
              </p>
            </>
          ),
        },
        {
          question: "¿Puedo personalizar los informes?",
          answer: (
            <>
              <p>
                Sí. La cuenta Empresa puede configurar logo, color corporativo y
                datos profesionales para que los informes mantengan la identidad
                de la inmobiliaria.
              </p>
            </>
          ),
        },
        {
          question: "¿Los informes VAI son una tasación oficial?",
          answer: (
            <>
              <p>
                Son herramientas profesionales de apoyo y estimación. Su
                carácter oficial depende de la intervención, firma,
                habilitación y responsabilidad del profesional que corresponda,
                además de los requisitos de la jurisdicción aplicable.
              </p>
            </>
          ),
        },
        {
          question:
            "¿La factibilidad reemplaza un estudio técnico o municipal?",
          answer: (
            <>
              <p>
                No. La factibilidad de VAI Prop es preliminar. No reemplaza un
                estudio profesional, proyecto, cálculo estructural, revisión de
                normativa, consulta municipal ni aprobación de autoridad
                competente.
              </p>
            </>
          ),
        },
        {
          question: "¿Puedo eliminar informes?",
          answer: (
            <>
              <p>
                Sí, cuando la opción se encuentra disponible en la sección de
                informes. Antes de confirmar, verificá que no necesites
                conservar el documento, porque la eliminación puede ser
                definitiva.
              </p>
            </>
          ),
        },
      ],
    },
    {
      id: "soporte",
      title: "6. Acceso, soporte y contacto",
      description:
        "Recuperación de cuenta, canales de ayuda y material para aprender a utilizar la plataforma.",
      faqs: [
        {
          question: "Olvidé mi contraseña, ¿qué hago?",
          answer: (
            <>
              <p>
                En{" "}
                <Link href="/auth/login" className={linkClass}>
                  Ingresar
                </Link>{" "}
                seleccioná la opción para recuperar la contraseña e indicá tu
                email. Revisá también la carpeta de correo no deseado o spam.
              </p>
            </>
          ),
        },
        {
          question: "¿Dónde encuentro ayuda para usar la plataforma?",
          answer: (
            <>
              <p>
                Podés consultar la sección de{" "}
                <Link href="/landing/tutoriales" className={linkClass}>
                  Tutoriales
                </Link>{" "}
                y los artículos del{" "}
                <Link href="/blog" className={linkClass}>
                  Blog
                </Link>
                . También iremos incorporando webinars y nuevos materiales de
                capacitación.
              </p>
            </>
          ),
        },
        {
          question: "¿Cómo contacto a soporte?",
          answer: (
            <>
              <p>
                Escribinos a{" "}
                <a href={mailtoSoporte} className={linkClass}>
                  soporte@vaiprop.com
                </a>{" "}
                indicando tu cuenta, una descripción del inconveniente y, cuando
                sea posible, una captura de pantalla. También podés comunicarte
                por{" "}
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={linkClass}
                >
                  WhatsApp
                </a>
                .
              </p>
            </>
          ),
        },
        {
          question: "¿Cuál es el horario de atención?",
          answer: (
            <>
              <p>
                El horario habitual de atención es de lunes a viernes, de 09:00
                a 18:00, hora de Argentina. Las consultas recibidas fuera de ese
                horario se responden en cuanto vuelve a estar disponible el
                equipo.
              </p>
            </>
          ),
        },
      ],
    },
  ];

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: sections.flatMap((section) =>
      section.faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: {
          "@type": "Answer",
          text:
            typeof faq.answer === "string"
              ? faq.answer
              : "Consultá la respuesta completa en la página de preguntas frecuentes de VAI Prop.",
        },
      })),
    ),
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-black text-neutral-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <SiteNavbar />

      <main className="bg-[radial-gradient(circle_at_top,_rgba(230,169,48,0.10),_transparent_32%),linear-gradient(to_bottom,#050505,#0a0a0a,#000)]">
        <section className="mx-auto max-w-6xl px-4 pb-20 pt-12 sm:px-6 md:pt-16 lg:px-8">
          <header className="mx-auto max-w-4xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-amber-400">
              Centro de ayuda
            </p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
              Preguntas frecuentes sobre VAI Prop
            </h1>
            <p className="mx-auto mt-5 max-w-3xl text-base leading-7 text-neutral-300 md:text-lg">
              Conocé cómo protegemos la información de tu inmobiliaria, cómo se
              utiliza cada herramienta y qué incluye cada plan.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/auth/register"
                className="rounded-xl bg-[#E6A930] px-5 py-3 text-sm font-bold text-black transition hover:bg-amber-300"
              >
                Probá gratis 30 días
              </Link>
              <Link
                href="/landing/tutoriales"
                className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:border-amber-400/40 hover:bg-white/10"
              >
                Ver tutoriales
              </Link>
            </div>
          </header>

          <nav
            aria-label="Secciones de preguntas frecuentes"
            className="mx-auto mt-12 flex max-w-5xl flex-wrap justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.035] p-3"
          >
            {sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="rounded-xl px-3 py-2 text-xs font-semibold text-neutral-300 transition hover:bg-amber-400/10 hover:text-amber-300 sm:text-sm"
              >
                {section.title.replace(/^\d+\.\s*/, "")}
              </a>
            ))}
          </nav>

          <div className="mx-auto mt-14 max-w-5xl space-y-16">
            {sections.map((section) => (
              <section
                key={section.id}
                id={section.id}
                className="scroll-mt-28"
              >
                <div className="mb-6">
                  <h2 className="text-2xl font-semibold text-white sm:text-3xl">
                    {section.title}
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-400 sm:text-base">
                    {section.description}
                  </p>
                </div>

                <div className="space-y-3">
                  {section.faqs.map((faq) => (
                    <FaqCard key={faq.question} faq={faq} />
                  ))}
                </div>
              </section>
            ))}
          </div>

          <section className="mx-auto mt-16 max-w-5xl rounded-3xl border border-amber-400/20 bg-gradient-to-br from-amber-400/10 via-white/[0.04] to-transparent p-6 text-center sm:p-9">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-400">
              ¿Todavía tenés dudas?
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-white">
              Hablemos sobre tu inmobiliaria
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-neutral-300 sm:text-base">
              Podemos ayudarte a elegir el plan adecuado, configurar tu cuenta
              o entender cómo incorporar VAI Prop a tu forma de trabajo.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-[#E6A930] px-5 py-3 text-sm font-bold text-black transition hover:bg-amber-300"
              >
                Consultar por WhatsApp
              </a>
              <a
                href={mailtoSoporte}
                className="rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:border-amber-400/40 hover:bg-white/5"
              >
                Escribir a soporte
              </a>
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}
