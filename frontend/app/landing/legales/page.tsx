// app/landing/legales/page.tsx
export const dynamic = "force-dynamic";

import SiteNavbar from "@/components/SiteNavbar";
import SiteFooter from "@/components/SiteFooter";

export default function LegalesPage() {
  return (
    <div className="flex min-h-screen flex-col bg-black text-neutral-100">
      {/* Navbar */}
      <SiteNavbar />

      {/* Contenido */}
      <main className="flex-1">
        <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:py-14 lg:py-16">
          {/* Encabezado */}
          <header className="mb-10 border-b border-neutral-800 pb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">
              Legales · Privacidad · Uso
            </p>
            <h1 className="mt-3 text-2xl font-bold text-white sm:text-3xl">
              Términos, privacidad y uso de VAI Prop
            </h1>
            <p className="mt-3 text-sm text-neutral-400">
              Esta página resume las condiciones de uso, el tratamiento de tus datos y el alcance
              de los informes generados con la plataforma.
            </p>
          </header>

          <div className="space-y-12 text-sm leading-relaxed text-neutral-200">
            {/* ================== TÉRMINOS ================== */}
            <section id="terminos" className="space-y-4">
              <h2 className="text-lg font-semibold text-amber-400">
                1. Términos y Condiciones de uso
              </h2>
              <p>
                Estos Términos y Condiciones (en adelante, los “Términos”) regulan el acceso y uso
                del sitio web{" "}
                <a
                  href="https://www.vaiprop.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-amber-300 hover:text-amber-200 underline-offset-2 hover:underline"
                >
                  https://www.vaiprop.com
                </a>{" "}
                (el “Sitio”) y de la plataforma de valuaciones e informes de factibilidad
                constructiva (la “Plataforma”).
              </p>

              <h3 className="mt-4 text-base font-semibold text-neutral-100">
                2. Aceptación de los Términos
              </h3>
              <p>
                Al registrarse, acceder o utilizar la Plataforma, usted (el “Usuario”) declara haber
                leído, comprendido y aceptado estos Términos y la Política de Privacidad. Si no está
                de acuerdo con alguna de sus disposiciones, no debe utilizar el Sitio ni la
                Plataforma.
              </p>
              <p>
                VAI Prop se reserva el derecho de actualizar estos Términos en cualquier momento.
                Las modificaciones entrarán en vigencia desde su publicación en el Sitio. El uso
                continuado del servicio implica la aceptación de las nuevas condiciones.
              </p>

              <h3 className="mt-4 text-base font-semibold text-neutral-100">
                3. Descripción del servicio
              </h3>
              <p>
                VAI Prop es una herramienta online que permite a:
              </p>
              <ul className="ml-5 list-disc space-y-1 text-neutral-300">
                <li>
                  Empresas inmobiliarias, desarrolladoras y profesionales (en adelante, “Empresas”),
                </li>
                <li>
                  Sus asesores, agentes o colaboradores (en adelante, “Asesores”),
                </li>
              </ul>
              <p>crear, editar y gestionar:</p>
              <ul className="ml-5 list-disc space-y-1 text-neutral-300">
                <li>Informes de valuación de activos inmobiliarios (VAI).</li>
                <li>Informes de factibilidad constructiva.</li>
              </ul>
              <p>
                La Plataforma se ofrece bajo la modalidad Software como Servicio (SaaS), accesible
                vía internet. No es un servicio de tasación oficial, ni un dictamen técnico, ni
                asesoramiento legal, contable o impositivo.
              </p>

              <h3 className="mt-4 text-base font-semibold text-neutral-100">
                4. Registro de Usuarios y cuentas
              </h3>
              <h4 className="mt-2 text-sm font-semibold text-neutral-100">
                4.1. Tipos de Usuario
              </h4>
              <ul className="ml-5 list-disc space-y-1 text-neutral-300">
                <li>
                  <span className="font-semibold">Usuario Empresa:</span> titular de una cuenta
                  principal, que puede contratar planes, gestionar su perfil y habilitar Asesores
                  asociados a su empresa.
                </li>
                <li>
                  <span className="font-semibold">Usuario Asesor:</span> usuario invitado o
                  registrado bajo una Empresa, con permisos acotados para crear y gestionar
                  informes.
                </li>
              </ul>

              <h4 className="mt-3 text-sm font-semibold text-neutral-100">
                4.2. Obligaciones del Usuario
              </h4>
              <p>El Usuario se compromete a:</p>
              <ul className="ml-5 list-disc space-y-1 text-neutral-300">
                <li>Proporcionar datos verdaderos, completos y actualizados al registrarse.</li>
                <li>Mantener la confidencialidad de sus credenciales de acceso.</li>
                <li>
                  Notificar de inmediato a VAI Prop ante cualquier uso no autorizado de su cuenta.
                </li>
              </ul>
              <p>
                VAI Prop podrá suspender o cancelar cuentas que detecte falsas, inexactas,
                duplicadas o que incumplan estos Términos.
              </p>

              <h3 className="mt-4 text-base font-semibold text-neutral-100">
                5. Planes, precios y pagos
              </h3>
              <h4 className="mt-2 text-sm font-semibold text-neutral-100">5.1. Planes</h4>
              <p>
                VAI Prop ofrece distintos planes (gratuitos o pagos) con funcionalidades, límites y/o
                beneficios diferenciales, publicados en el Sitio o en la sección de “Planes” de la
                Plataforma.
              </p>

              <h4 className="mt-2 text-sm font-semibold text-neutral-100">5.2. Pagos</h4>
              <ul className="ml-5 list-disc space-y-1 text-neutral-300">
                <li>
                  Los pagos se procesan a través de proveedores externos (por ejemplo, Mercado Pago
                  u otros).
                </li>
                <li>
                  La facturación se realizará según la información de facturación que suministre el
                  Usuario Empresa.
                </li>
                <li>
                  Las condiciones específicas de precio, ciclo de facturación, impuestos y medios de
                  pago se informan al momento de la contratación.
                </li>
              </ul>

              <h4 className="mt-2 text-sm font-semibold text-neutral-100">
                5.3. Renovación y cancelación
              </h4>
              <p>
                Salvo indicación en contrario, los planes pagos pueden ser de renovación automática.
                El Usuario puede cancelar la renovación desde su panel de cuenta antes del próximo
                ciclo. La cancelación evita cargos futuros pero no genera, salvo disposición
                expresa, reintegros por períodos ya abonados.
              </p>

              <h4 className="mt-2 text-sm font-semibold text-neutral-100">5.4. Reembolsos</h4>
              <p>
                Como regla general, los pagos efectuados no son reembolsables, salvo error imputable
                a VAI Prop o disposiciones legales aplicables. Cualquier caso particular será
                analizado por soporte a través de{" "}
                <a
                  href="mailto:soporte@vaiprop.com"
                  className="text-amber-300 hover:text-amber-200 underline-offset-2 hover:underline"
                >
                  soporte@vaiprop.com
                </a>
                .
              </p>

              <h3 className="mt-4 text-base font-semibold text-neutral-100">
                6. Uso adecuado del servicio
              </h3>
              <p>
                El Usuario se compromete a utilizar la Plataforma conforme a la legislación vigente,
                la moral, el orden público y estos Términos.
              </p>
              <p>Queda expresamente prohibido:</p>
              <ul className="ml-5 list-disc space-y-1 text-neutral-300">
                <li>Utilizar el servicio para actividades ilícitas o fraudulentas.</li>
                <li>
                  Intentar acceder de forma no autorizada a sistemas, bases de datos o cuentas de
                  terceros.
                </li>
                <li>
                  Copiar, descompilar, modificar o realizar ingeniería inversa del software, excepto
                  cuando la ley lo permita de forma imperativa.
                </li>
                <li>
                  Utilizar la Plataforma para enviar spam o comunicaciones masivas no solicitadas.
                </li>
              </ul>
              <p>
                VAI Prop podrá suspender o cancelar el acceso del Usuario que haga un uso indebido
                del servicio.
              </p>

              <h3 className="mt-4 text-base font-semibold text-neutral-100">
                7. Propiedad intelectual
              </h3>
              <p>Todos los derechos de propiedad intelectual e industrial sobre:</p>
              <ul className="ml-5 list-disc space-y-1 text-neutral-300">
                <li>El Sitio,</li>
                <li>La Plataforma,</li>
                <li>Los diseños, interfaces, código fuente, marcas, logos y contenidos</li>
              </ul>
              <p>
                pertenecen a VAI Prop o a terceros licenciantes. Queda prohibido reproducir,
                distribuir, transformar, comunicar públicamente o explotar de cualquier forma dichos
                contenidos sin autorización previa y por escrito de VAI Prop, salvo aquellos casos
                permitidos por ley.
              </p>

              <h3 className="mt-4 text-base font-semibold text-neutral-100">
                8. Datos de inmuebles e informes generados
              </h3>
              <h4 className="mt-2 text-sm font-semibold text-neutral-100">
                8.1. Datos cargados por el Usuario
              </h4>
              <p>
                Los datos de inmuebles, proyectos, clientes finales y cualquier otra información que
                el Usuario cargue en la Plataforma seguirán siendo de su propiedad o de la de sus
                clientes, cuando corresponda. El Usuario garantiza que tiene derecho a utilizar dichos
                datos.
              </p>

              <h4 className="mt-2 text-sm font-semibold text-neutral-100">
                8.2. Uso de los datos por VAI Prop
              </h4>
              <p>
                El Usuario otorga a VAI Prop una licencia no exclusiva, mundial y limitada al tiempo
                de la relación contractual para:
              </p>
              <ul className="ml-5 list-disc space-y-1 text-neutral-300">
                <li>Almacenar los datos.</li>
                <li>Procesarlos técnicamente para generar informes.</li>
                <li>
                  Analizarlos de forma agregada y anonimizada para mejorar el servicio.
                </li>
              </ul>
              <p>
                VAI Prop no comercializará datos personales identificables de los Usuarios sin su
                consentimiento expreso.
              </p>

              <h4 className="mt-2 text-sm font-semibold text-neutral-100">
                8.3. Informes generados
              </h4>
              <p>
                Los informes generados (en PDF u otro formato) se consideran resultados del uso de la
                Plataforma por parte del Usuario. VAI Prop no se responsabiliza por el uso que el
                Usuario o terceros hagan de dichos informes.
              </p>

              <h3 className="mt-4 text-base font-semibold text-neutral-100">
                9. Disponibilidad del servicio
              </h3>
              <p>
                VAI Prop realizará esfuerzos razonables para mantener la Plataforma disponible y en
                funcionamiento de forma continua. No obstante, podrá haber interrupciones temporales
                por:
              </p>
              <ul className="ml-5 list-disc space-y-1 text-neutral-300">
                <li>Mantenimiento programado,</li>
                <li>Fallas técnicas,</li>
                <li>Causas de fuerza mayor o ajenas a VAI Prop.</li>
              </ul>
              <p>
                VAI Prop no garantiza la disponibilidad ininterrumpida del servicio ni la ausencia de
                errores, pero se compromete a solucionarlos en plazos razonables.
              </p>

              <h3 className="mt-4 text-base font-semibold text-neutral-100">
                10. Limitación de responsabilidad
              </h3>
              <p>
                En la máxima medida permitida por la legislación aplicable:
              </p>
              <ul className="ml-5 list-disc space-y-1 text-neutral-300">
                <li>
                  VAI Prop no será responsable por daños indirectos, lucro cesante, pérdida de datos
                  o de oportunidades de negocio derivados del uso o imposibilidad de uso de la
                  Plataforma.
                </li>
                <li>
                  VAI Prop no garantiza la exactitud absoluta de las valuaciones, proyecciones o
                  resultados que se generen a partir de los datos cargados por el Usuario.
                </li>
                <li>
                  Los informes VAI y de factibilidad son herramientas de apoyo y no reemplazan
                  tasaciones oficiales, dictámenes técnicos profesionales ni asesoramiento legal o
                  contable.
                </li>
              </ul>
              <p>El Usuario es el único responsable de:</p>
              <ul className="ml-5 list-disc space-y-1 text-neutral-300">
                <li>Verificar la información contenida en los informes.</li>
                <li>
                  Decidir qué uso profesional o comercial dará a dichos informes.
                </li>
                <li>
                  Cumplir con las normativas locales aplicables a su actividad.
                </li>
              </ul>

              <h3 className="mt-4 text-base font-semibold text-neutral-100">
                11. Enlaces a sitios de terceros
              </h3>
              <p>
                La Plataforma puede contener enlaces a sitios o servicios de terceros (por ejemplo,
                pasarelas de pago, herramientas externas, etc.). VAI Prop no controla ni garantiza el
                contenido, la seguridad o las prácticas de dichos terceros. El uso de esos servicios
                se rige por los términos y políticas propias de cada tercero.
              </p>

              <h3 className="mt-4 text-base font-semibold text-neutral-100">
                12. Modificaciones del servicio
              </h3>
              <p>
                VAI Prop podrá, en cualquier momento y sin previo aviso:
              </p>
              <ul className="ml-5 list-disc space-y-1 text-neutral-300">
                <li>Introducir mejoras, ampliar o reducir funcionalidades.</li>
                <li>Modificar planes, precios y condiciones comerciales.</li>
              </ul>
              <p>
                En caso de cambios sustanciales en los planes pagos, se intentará notificar al Usuario
                con antelación razonable mediante correo electrónico o avisos dentro de la
                Plataforma.
              </p>

              <h3 className="mt-4 text-base font-semibold text-neutral-100">
                13. Terminación
              </h3>
              <p>
                VAI Prop puede suspender o cancelar definitivamente la cuenta de un Usuario en caso
                de:
              </p>
              <ul className="ml-5 list-disc space-y-1 text-neutral-300">
                <li>Incumplimiento de estos Términos,</li>
                <li>Uso fraudulento o ilícito del servicio,</li>
                <li>Falta de pago de planes contratados.</li>
              </ul>
              <p>
                El Usuario podrá dejar de utilizar el servicio en cualquier momento. La cancelación de
                la cuenta no implica automáticamente la eliminación inmediata de todos los datos, que
                podrán conservarse durante el tiempo necesario según la Política de Privacidad y
                obligaciones legales.
              </p>

              <h3 className="mt-4 text-base font-semibold text-neutral-100">
                14. Comunicaciones
              </h3>
              <p>
                VAI Prop podrá comunicarse con el Usuario a través de:
              </p>
              <ul className="ml-5 list-disc space-y-1 text-neutral-300">
                <li>Correos electrónicos enviados a la dirección registrada.</li>
                <li>Notificaciones dentro de la Plataforma.</li>
                <li>Otros medios de contacto provistos por el Usuario.</li>
              </ul>
              <p>
                El Usuario puede gestionar ciertas preferencias de comunicación (por ejemplo,
                newsletters comerciales), sin perjuicio de las comunicaciones estrictamente necesarias
                para la prestación del servicio.
              </p>

              <h3 className="mt-4 text-base font-semibold text-neutral-100">
                15. Ley aplicable y jurisdicción
              </h3>
              <p>
                Estos Términos se rigen por las leyes de la República Argentina. Para cualquier
                controversia que pudiera derivarse de su interpretación o cumplimiento, las partes se
                someten a la jurisdicción de los tribunales ordinarios de Córdoba Capital,
                renunciando a cualquier otro fuero o jurisdicción que pudiera corresponder.
              </p>
            </section>

            {/* ================== PRIVACIDAD ================== */}
            <section id="privacidad" className="space-y-4">
              <h2 className="text-lg font-semibold text-amber-400">
                Política de Privacidad y Cookies
              </h2>

              <h3 className="mt-2 text-base font-semibold text-neutral-100">
                1. Responsable del tratamiento
              </h3>
              <p>El responsable del tratamiento de los datos personales es:</p>
              <ul className="ml-5 list-disc space-y-1 text-neutral-300">
                <li>Razón social: Vai Prop</li>
                <li>CUIT: 20-33415425-5</li>
                <li>Domicilio legal: Santa Rosa 1409, Córdoba Capital.</li>
                <li>
                  Correo de contacto para privacidad:{" "}
                  <a
                    href="mailto:soporte@vaiprop.com"
                    className="text-amber-300 hover:text-amber-200 underline-offset-2 hover:underline"
                  >
                    soporte@vaiprop.com
                  </a>
                </li>
              </ul>

              <h3 className="mt-3 text-base font-semibold text-neutral-100">
                2. Datos que recopilamos
              </h3>
              <h4 className="mt-2 text-sm font-semibold text-neutral-100">
                2.1. Datos de registro y cuenta
              </h4>
              <ul className="ml-5 list-disc space-y-1 text-neutral-300">
                <li>Nombre y apellido.</li>
                <li>Correo electrónico.</li>
                <li>Teléfono.</li>
                <li>Contraseña (almacenada de forma cifrada).</li>
                <li>Rol de usuario (empresa / asesor).</li>
              </ul>

              <h4 className="mt-2 text-sm font-semibold text-neutral-100">
                2.2. Datos de empresa
              </h4>
              <ul className="ml-5 list-disc space-y-1 text-neutral-300">
                <li>Nombre comercial / razón social.</li>
                <li>CUIT.</li>
                <li>Domicilio comercial.</li>
                <li>Teléfonos de contacto.</li>
                <li>Datos de profesionales responsables (matrícula, colegio, etc.).</li>
                <li>Logo, colores corporativos y otros datos de perfil.</li>
              </ul>

              <h4 className="mt-2 text-sm font-semibold text-neutral-100">
                2.3. Datos de uso de la Plataforma
              </h4>
              <ul className="ml-5 list-disc space-y-1 text-neutral-300">
                <li>Informes creados (valuación, factibilidad).</li>
                <li>
                  Parámetros de inmuebles y proyectos (ubicación, superficies, costos estimados,
                  etc.).
                </li>
                <li>Configuración de planes y facturación.</li>
                <li>Registros de acceso y actividad básica (logs).</li>
              </ul>

              <h4 className="mt-2 text-sm font-semibold text-neutral-100">
                2.4. Datos de pago
              </h4>
              <p>
                Los pagos pueden procesarse a través de terceros (por ejemplo, Mercado Pago). VAI Prop
                no almacena directamente los datos completos de tarjetas de crédito/débito. El
                tratamiento de estos datos se realiza bajo la exclusiva responsabilidad de la pasarela
                de pago, conforme a sus propias políticas.
              </p>

              <h4 className="mt-2 text-sm font-semibold text-neutral-100">
                2.5. Datos técnicos
              </h4>
              <ul className="ml-5 list-disc space-y-1 text-neutral-300">
                <li>Dirección IP.</li>
                <li>Tipo de navegador y dispositivo.</li>
                <li>Páginas visitadas, tiempo de uso y acciones básicas dentro de la Plataforma.</li>
                <li>Cookies y tecnologías similares (ver apartado 8).</li>
              </ul>

              <h3 className="mt-3 text-base font-semibold text-neutral-100">
                3. Finalidades del tratamiento
              </h3>
              <p>Utilizamos los datos personales para:</p>
              <ul className="ml-5 list-disc space-y-1 text-neutral-300">
                <li>Permitir el registro y autenticación de Usuarios.</li>
                <li>Prestar y mantener la Plataforma y sus funcionalidades.</li>
                <li>Generar informes de valuación y factibilidad a pedido del Usuario.</li>
                <li>Gestionar planes, pagos y facturación.</li>
                <li>Brindar soporte técnico y responder consultas.</li>
                <li>
                  Enviar comunicaciones relacionadas con el servicio (notificaciones, cambios en
                  Términos, etc.).
                </li>
                <li>
                  Enviar comunicaciones comerciales y novedades (cuando el Usuario lo haya consentido
                  o la ley lo permita).
                </li>
                <li>
                  Analizar de forma agregada y anonimizada el uso de la Plataforma con fines
                  estadísticos y de mejora.
                </li>
              </ul>

              <h3 className="mt-3 text-base font-semibold text-neutral-100">
                4. Base legal del tratamiento
              </h3>
              <p>La base legal para el tratamiento de los datos personales incluye:</p>
              <ul className="ml-5 list-disc space-y-1 text-neutral-300">
                <li>
                  La ejecución del contrato de prestación de servicios entre VAI Prop y el Usuario.
                </li>
                <li>El cumplimiento de obligaciones legales (por ejemplo, contables y fiscales).</li>
                <li>
                  El interés legítimo de VAI Prop en mejorar el servicio y prevenir fraudes.
                </li>
                <li>
                  El consentimiento expreso del Usuario para ciertas finalidades (ej. comunicaciones
                  comerciales).
                </li>
              </ul>

              <h3 className="mt-3 text-base font-semibold text-neutral-100">
                5. Destinatarios y transferencias de datos
              </h3>
              <p>Podemos compartir datos con:</p>
              <ul className="ml-5 list-disc space-y-1 text-neutral-300">
                <li>
                  Proveedores de infraestructura y hosting (por ejemplo, servicios en la nube donde
                  se aloja la base de datos y la Plataforma).
                </li>
                <li>Supabase (backend / base de datos y autenticación).</li>
                <li>Vercel u otros servicios de despliegue del frontend.</li>
                <li>Pasarelas de pago (ej. Mercado Pago) para procesar transacciones.</li>
                <li>
                  Servicios de correo electrónico para el envío de notificaciones y comunicaciones.
                </li>
                <li>
                  Profesionales y asesores externos que presten servicios a VAI Prop (por ejemplo,
                  contables o legales), sujetos a deberes de confidencialidad.
                </li>
              </ul>
              <p>
                No vendemos datos personales identificables a terceros con fines comerciales. En caso
                de transferencias internacionales de datos, se procurará que se realicen a países o
                entidades con niveles adecuados de protección o mediante mecanismos contractuales
                aceptados por la normativa aplicable.
              </p>

              <h3 className="mt-3 text-base font-semibold text-neutral-100">
                6. Plazo de conservación
              </h3>
              <p>Conservaremos los datos personales:</p>
              <ul className="ml-5 list-disc space-y-1 text-neutral-300">
                <li>
                  Mientras la cuenta se encuentre activa y sea necesario para prestar el servicio.
                </li>
                <li>Durante los plazos adicionales exigidos por obligaciones legales.</li>
                <li>
                  Durante un período razonable posterior a la baja de la cuenta, para resolver
                  eventuales conflictos o reclamaciones.
                </li>
              </ul>
              <p>
                Una vez transcurridos los plazos, los datos podrán ser anonimizados o eliminados de
                forma segura.
              </p>

              <h3 className="mt-3 text-base font-semibold text-neutral-100">
                7. Derechos de los Usuarios
              </h3>
              <p>El Usuario podrá ejercer los derechos de:</p>
              <ul className="ml-5 list-disc space-y-1 text-neutral-300">
                <li>Acceso.</li>
                <li>Rectificación.</li>
                <li>Actualización.</li>
                <li>Supresión (cuando sea legalmente posible).</li>
                <li>Oposición y/o limitación del tratamiento (en determinados supuestos).</li>
              </ul>
              <p>
                Para ejercer estos derechos, el Usuario puede contactarnos a{" "}
                <a
                  href="mailto:soporte@vaiprop.com"
                  className="text-amber-300 hover:text-amber-200 underline-offset-2 hover:underline"
                >
                  soporte@vaiprop.com
                </a>
                , indicando claramente su identidad y la solicitud concreta.
              </p>
              <p>
                La Agencia de Acceso a la Información Pública, en carácter de Órgano de Control de la
                Ley 25.326, tiene la atribución de atender las denuncias y reclamos que se interpongan
                con relación al incumplimiento de las normas sobre protección de datos personales.
              </p>

              <h3 className="mt-3 text-base font-semibold text-neutral-100">
                8. Cookies y tecnologías similares
              </h3>
              <p>
                El Sitio y la Plataforma utilizan cookies y tecnologías similares para:
              </p>
              <ul className="ml-5 list-disc space-y-1 text-neutral-300">
                <li>Mantener la sesión iniciada del Usuario.</li>
                <li>Recordar preferencias básicas.</li>
                <li>Obtener estadísticas de uso.</li>
                <li>Mejorar el rendimiento del sitio.</li>
              </ul>
              <p>
                El Usuario puede configurar su navegador para bloquear o eliminar cookies. Sin embargo,
                algunas funcionalidades pueden no funcionar correctamente si se deshabilitan ciertas
                cookies necesarias.
              </p>
              <p>
                Podemos implementar herramientas de análisis que recolectan información de manera
                agregada y anónima sobre el uso del Sitio.
              </p>

              <h3 className="mt-3 text-base font-semibold text-neutral-100">
                9. Seguridad de la información
              </h3>
              <p>
                Implementamos medidas técnicas y organizativas razonables para proteger los datos
                personales contra:
              </p>
              <ul className="ml-5 list-disc space-y-1 text-neutral-300">
                <li>Acceso no autorizado.</li>
                <li>Pérdida o destrucción.</li>
                <li>Uso indebido o divulgación no autorizada.</li>
              </ul>
              <p>
                No obstante, ningún sistema es completamente invulnerable. El Usuario acepta los
                riesgos inherentes al uso de servicios en línea. En caso de incidente de seguridad que
                pueda impactar datos personales, VAI Prop actuará conforme a la normativa aplicable,
                incluyendo informar a los Usuarios y a la autoridad competente cuando corresponda.
              </p>

              <h3 className="mt-3 text-base font-semibold text-neutral-100">
                10. Cambios en la Política de Privacidad
              </h3>
              <p>
                Podemos actualizar esta Política de Privacidad para reflejar cambios en el servicio, en
                la normativa o en nuestras prácticas internas. La versión vigente estará siempre
                disponible en el Sitio. En caso de cambios significativos, procuraremos notificar al
                Usuario a través de la Plataforma o por correo electrónico.
              </p>

              <h3 className="mt-3 text-base font-semibold text-neutral-100">11. Contacto</h3>
              <p>
                Para consultas relacionadas con esta Política de Privacidad o el tratamiento de datos
                personales, el Usuario puede escribir a{" "}
                <a
                  href="mailto:soporte@vaiprop.com"
                  className="text-amber-300 hover:text-amber-200 underline-offset-2 hover:underline"
                >
                  soporte@vaiprop.com
                </a>
                , indicando en el asunto “Privacidad” o similar.
              </p>
            </section>

            {/* ================== DISCLAIMER ================== */}
            <section id="disclaimer" className="space-y-4">
              <h2 className="text-lg font-semibold text-amber-400">
                Disclaimer profesional / legal
              </h2>

              <h3 className="mt-2 text-base font-semibold text-neutral-100">
                1. Naturaleza de los informes generados
              </h3>
              <p>
                Los informes generados a través de VAI Prop, incluyendo pero no limitándose a:
              </p>
              <ul className="ml-5 list-disc space-y-1 text-neutral-300">
                <li>Informes de valuación de activos inmobiliarios (VAI).</li>
                <li>Informes de factibilidad constructiva.</li>
              </ul>
              <p>son estimaciones y proyecciones realizadas a partir de:</p>
              <ul className="ml-5 list-disc space-y-1 text-neutral-300">
                <li>Datos aportados por el Usuario.</li>
                <li>Parámetros y supuestos técnicos predefinidos.</li>
                <li>Precios de referencia y criterios generales.</li>
              </ul>
              <p>En consecuencia, no constituyen:</p>
              <ul className="ml-5 list-disc space-y-1 text-neutral-300">
                <li>
                  Una tasación oficial o informe pericial aceptado por entidades bancarias,
                  judiciales o administrativas, salvo que un profesional habilitado los suscriba
                  conforme a las normas aplicables.
                </li>
                <li>
                  Un dictamen técnico completo de arquitectura, ingeniería, agrimensura o similar.
                </li>
                <li>Asesoramiento legal, fiscal, contable o financiero.</li>
              </ul>

              <h3 className="mt-3 text-base font-semibold text-neutral-100">
                2. Responsabilidad del Usuario y del profesional a cargo
              </h3>
              <p>El Usuario (Empresa o Asesor) es el único responsable de:</p>
              <ul className="ml-5 list-disc space-y-1 text-neutral-300">
                <li>
                  Verificar la exactitud y completitud de los datos ingresados en la Plataforma.
                </li>
                <li>
                  Revisar el contenido de los informes antes de entregarlos a clientes, inversores u
                  otras partes.
                </li>
                <li>
                  Determinar si el informe es adecuado para el propósito concreto para el cual se lo
                  empleará.
                </li>
                <li>
                  Cumplir con la normativa vigente, los requisitos de colegios profesionales y
                  cualquier regulación aplicable a su actividad.
                </li>
              </ul>
              <p>
                Cuando el informe se emite bajo la firma de un profesional matriculado (datos de
                matrícula, colegio, etc.), dicho profesional es quien asume la responsabilidad técnica
                y ética frente a sus clientes y organismos competentes.
              </p>

              <h3 className="mt-3 text-base font-semibold text-neutral-100">
                3. Limitaciones y supuestos
              </h3>
              <p>Los resultados de los informes dependen de:</p>
              <ul className="ml-5 list-disc space-y-1 text-neutral-300">
                <li>
                  Información proporcionada por el Usuario, que puede ser incompleta, estimada o
                  sujeta a error.
                </li>
                <li>
                  Supuestos de mercado, costos de construcción, índices, coeficientes normativos y
                  otros parámetros que pueden variar en el tiempo y según la fuente.
                </li>
                <li>
                  Criterios de cálculo y metodologías implementadas por VAI Prop, que pueden
                  actualizarse de forma periódica.
                </li>
              </ul>
              <p>
                Por lo tanto, VAI Prop no garantiza que los valores resultantes coincidan con precios
                finales de mercado, tasaciones oficiales, costos reales de obra ni rendimientos
                económicos efectivos. Pequeñas variaciones en los datos de entrada pueden generar
                diferencias significativas en los resultados.
              </p>

              <h3 className="mt-3 text-base font-semibold text-neutral-100">
                4. No sustitución de asesoramiento profesional integral
              </h3>
              <p>El uso de VAI Prop no sustituye:</p>
              <ul className="ml-5 list-disc space-y-1 text-neutral-300">
                <li>
                  La revisión del proyecto por parte de arquitectos, ingenieros, agrimensores u otros
                  profesionales habilitados.
                </li>
                <li>El asesoramiento jurídico, notarial o contable.</li>
                <li>
                  La consulta a autoridades competentes sobre normativa urbanística, de edificación o
                  impositiva.
                </li>
              </ul>
              <p>
                Se recomienda que los informes generados por la Plataforma se utilicen siempre como
                herramienta de apoyo dentro de un proceso de análisis más amplio, con intervención de
                los profesionales correspondientes.
              </p>

              <h3 className="mt-3 text-base font-semibold text-neutral-100">
                5. Limitación de responsabilidad de VAI Prop
              </h3>
              <p>
                En la máxima medida permitida por la legislación aplicable:
              </p>
              <ul className="ml-5 list-disc space-y-1 text-neutral-300">
                <li>
                  VAI Prop no será responsable por decisiones de inversión, construcción,
                  comercialización o financiación que el Usuario o terceros adopten basados total o
                  parcialmente en los informes generados.
                </li>
                <li>
                  VAI Prop no responderá por beneficios esperados, lucro cesante, pérdida de
                  oportunidades de negocio ni por daños indirectos derivados del uso de los informes.
                </li>
                <li>
                  VAI Prop no asume responsabilidad frente a terceros (clientes finales, entidades
                  financieras, organismos públicos, etc.) por la interpretación o uso de los informes
                  VAI o de factibilidad.
                </li>
              </ul>
              <p>
                El mero acceso o descarga de un informe generado por la Plataforma implica que el
                Usuario ha leído y acepta este disclaimer.
              </p>
            </section>

            {/* ============= PLACEHOLDER FAQS (hasta que me pases el contenido) ============= */}
            <section id="faqs" className="space-y-2 border-t border-neutral-800 pt-6">
              <h2 className="text-lg font-semibold text-amber-400">
                Preguntas frecuentes (FAQs)
              </h2>
              <p className="text-neutral-300">
                Próximamente vas a encontrar aquí una sección completa de preguntas frecuentes sobre
                el uso de VAI Prop, planes, facturación y aspectos operativos de la plataforma.
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
