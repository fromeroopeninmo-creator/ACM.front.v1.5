export const dynamic = "force-dynamic";

export default function DashboardFaqsPage() {
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-neutral-900">
          FAQs / Preguntas frecuentes
        </h1>
        <p className="text-sm text-neutral-600">
          Todo lo que necesitás saber sobre VAI Prop. Si todavía tenés dudas,
          podés escribirnos a{" "}
          <a
            href="mailto:soporte@vaiprop.com?subject=Consulta%20sobre%20VAI%20Prop"
            className="text-amber-400 hover:text-amber-300 font-medium underline-offset-2 hover:underline"
          >
            soporte@vaiprop.com
          </a>
          .
        </p>
      </header>

      <main className="space-y-8">
        {/* 1. Cuenta y acceso */}
        <section className="bg-white border border-neutral-200 rounded-xl shadow-sm p-5 space-y-4">
          <h2 className="text-lg font-semibold text-neutral-900">
            1. Sobre la cuenta y el acceso
          </h2>

          <div className="space-y-3 text-sm text-neutral-700">
            <div>
              <h3 className="font-semibold">
                1.1. ¿Qué es VAI Prop?
              </h3>
              <p className="mt-1">
                VAI Prop es una plataforma online para profesionales y empresas del
                rubro inmobiliario y de desarrollos que permite generar:
              </p>
              <ul className="mt-1 list-disc list-inside space-y-1">
                <li>Informes de valuación de activos inmobiliarios (VAI)</li>
                <li>Informes de factibilidad constructiva</li>
              </ul>
              <p className="mt-1">
                De forma ágil, ordenada y con salida en PDF profesional.
              </p>
            </div>

            <div>
              <h3 className="font-semibold">
                1.2. ¿Quiénes pueden usar VAI Prop?
              </h3>
              <p className="mt-1">Principalmente:</p>
              <ul className="mt-1 list-disc list-inside space-y-1">
                <li>Inmobiliarias y desarrolladoras</li>
                <li>Estudios de arquitectura / ingeniería</li>
                <li>Profesionales independientes del sector</li>
                <li>Asesores y agentes que trabajan dentro de una empresa</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold">
                1.3. ¿Cómo creo una cuenta?
              </h3>
              <p className="mt-1">
                Podés crear una cuenta de Empresa desde la página de registro de{" "}
                <span className="font-mono text-xs bg-neutral-100 px-1 py-0.5 rounded">
                  www.vaiprop.com
                </span>
                . Ingresás tus datos, confirmás el correo a través del enlace que
                te enviamos y ya podés acceder al panel.
              </p>
            </div>

            <div>
              <h3 className="font-semibold">
                1.4. ¿Qué diferencia hay entre Empresa y Asesor?
              </h3>
              <p className="mt-1">
                La cuenta Empresa es la titular del plan, y puede:
              </p>
              <ul className="mt-1 list-disc list-inside space-y-1">
                <li>Gestionar planes y pagos</li>
                <li>
                  Configurar datos de la empresa (logo, color, datos del profesional
                  responsable)
                </li>
                <li>Crear y gestionar asesores</li>
              </ul>
              <p className="mt-1">
                Los Asesores se asocian a una Empresa y pueden crear y gestionar
                informes propios, heredando los datos corporativos.
              </p>
            </div>

            <div>
              <h3 className="font-semibold">
                1.5. Olvidé mi contraseña, ¿qué hago?
              </h3>
              <p className="mt-1">
                En la pantalla de acceso hacé clic en{" "}
                <span className="font-medium">“¿Olvidaste tu contraseña?”</span> e
                ingresá tu email. Te vamos a enviar un enlace para restablecerla.
                Revisá también la carpeta de spam o correo no deseado.
              </p>
            </div>
          </div>
        </section>

        {/* 2. Planes, facturación y pagos */}
        <section className="bg-white border border-neutral-200 rounded-xl shadow-sm p-5 space-y-4">
          <h2 className="text-lg font-semibold text-neutral-900">
            2. Planes, facturación y pagos
          </h2>

          <div className="space-y-3 text-sm text-neutral-700">
            <div>
              <h3 className="font-semibold">
                2.1. ¿Qué planes ofrece VAI Prop?
              </h3>
              <p className="mt-1">
                VAI Prop cuenta con diferentes planes que se diferencian por:
              </p>
              <ul className="mt-1 list-disc list-inside space-y-1">
                <li>Cantidad de usuarios/asesores</li>
                <li>Cantidad de informes incluidos</li>
                <li>Herramientas adicionales</li>
                <li>Funcionalidades adicionales</li>
              </ul>
              <p className="mt-1">
                Los detalles actualizados se muestran en la sección{" "}
                <span className="font-medium">“Planes”</span> del dashboard o en la
                web.
              </p>
            </div>

            <div>
              <h3 className="font-semibold">
                2.2. ¿Cómo se realizan los pagos?
              </h3>
              <p className="mt-1">
                Los pagos se realizan de forma segura a través de pasarelas de pago
                (por ejemplo, Mercado Pago). Podés abonar con tarjeta u otros medios
                habilitados por la pasarela.
              </p>
            </div>

            <div>
              <h3 className="font-semibold">
                2.3. ¿Recibo factura por mi plan?
              </h3>
              <p className="mt-1">
                Sí. En los planes pagos emitimos la factura según los datos fiscales
                que cargues en tu perfil de Empresa.
              </p>
            </div>

            <div>
              <h3 className="font-semibold">
                2.4. ¿Puedo cambiar de plan más adelante?
              </h3>
              <p className="mt-1">
                Sí. Podés cambiar a un plan superior o, si está habilitado, a uno
                inferior desde la sección de <span className="font-medium">
                  “Planes”
                </span>{" "}
                de tu cuenta. Los cambios pueden tener impacto en el ciclo de
                facturación actual o en el próximo, según se indique en la pantalla
                de confirmación.
              </p>
            </div>

            <div>
              <h3 className="font-semibold">
                2.5. ¿Qué pasa si no pago o se vence mi plan?
              </h3>
              <p className="mt-1">
                En caso de falta de pago o vencimiento:
              </p>
              <ul className="mt-1 list-disc list-inside space-y-1">
                <li>Podés perder acceso a ciertas funcionalidades.</li>
                <li>
                  Es posible que se limite la creación de nuevos informes hasta
                  regularizar la situación.
                </li>
                <li>
                  Conservamos tus datos por un tiempo razonable para que puedas
                  reactivar tu plan sin perder historial.
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* 3. Informes VAI */}
        <section className="bg-white border border-neutral-200 rounded-xl shadow-sm p-5 space-y-4">
          <h2 className="text-lg font-semibold text-neutral-900">
            3. Informes VAI (valuación)
          </h2>

          <div className="space-y-3 text-sm text-neutral-700">
            <div>
              <h3 className="font-semibold">
                3.1. ¿Puedo editar un informe después de guardarlo?
              </h3>
              <p className="mt-1">
                Sí. Podés volver a abrirlo, modificar datos y guardar los cambios.
                Cuando descargues nuevamente el PDF, se generará con la información
                actualizada.
              </p>
            </div>

            <div>
              <h3 className="font-semibold">
                3.2. ¿Puedo borrar informes?
              </h3>
              <p className="mt-1">
                Sí. Desde la sección de <span className="font-medium">
                  “Informes”
                </span>{" "}
                podés eliminar informes que ya no necesites. Tené en cuenta que
                esta acción es definitiva y no se puede deshacer.
              </p>
            </div>

            <div>
              <h3 className="font-semibold">
                3.3. ¿Los informes son válidos como tasación oficial?
              </h3>
              <p className="mt-1">
                Los informes VAI son herramientas de apoyo y estimación. No son, por
                sí mismos, una tasación oficial, salvo que un profesional habilitado
                los utilice, firme y complemente conforme a la normativa y
                requisitos de su colegio profesional.
              </p>
              <p className="mt-1">
                Recomendamos revisar el{" "}
                <a
                  href="/landing/legales#disclaimer"
                  className="text-amber-400 hover:text-amber-300 font-medium underline-offset-2 hover:underline"
                >
                  Disclaimer
                </a>{" "}
                para entender el alcance de los informes.
              </p>
            </div>

            <div>
              <h3 className="font-semibold">
                3.4. ¿Puedo personalizar los informes con el logo y datos de mi empresa?
              </h3>
              <p className="mt-1">
                Sí. Podés cargar tu logo, color corporativo y datos de tu
                empresa/profesional. Esa información se mostrará en los encabezados
                de los informes generados.
              </p>
            </div>
          </div>
        </section>

        {/* 4. Factibilidad */}
        <section className="bg-white border border-neutral-200 rounded-xl shadow-sm p-5 space-y-4">
          <h2 className="text-lg font-semibold text-neutral-900">
            4. Informes de Factibilidad Constructiva
          </h2>

          <div className="space-y-3 text-sm text-neutral-700">
            <div>
              <h3 className="font-semibold">
                4.1. ¿Qué es un informe de factibilidad constructiva en VAI Prop?
              </h3>
              <p className="mt-1">
                Es un informe que te ayuda a estimar, en base a los parámetros que
                cargues:
              </p>
              <ul className="mt-1 list-disc list-inside space-y-1">
                <li>
                  Superficies aprovechables según FOS/FOT, alturas, retiros, etc.
                </li>
                <li>
                  Costos aproximados de construcción, demolición y otros rubros
                </li>
                <li>Incidencia estimada del valor del lote</li>
              </ul>
              <p className="mt-1">
                Es una herramienta para analizar proyectos, no un proyecto ejecutivo
                ni un cálculo estructural.
              </p>
            </div>

            <div>
              <h3 className="font-semibold">
                4.2. ¿VAI Prop valida automáticamente la normativa urbanística de cada municipio?
              </h3>
              <p className="mt-1">
                No. VAI Prop no sustituye la revisión normativa específica en cada
                jurisdicción. Es responsabilidad del profesional verificar la
                normativa aplicable y cargar los parámetros correctos (FOT, FOS,
                alturas, retiros, etc.).
              </p>
            </div>

            <div>
              <h3 className="font-semibold">
                4.3. ¿Puedo adjuntar una foto del lote?
              </h3>
              <p className="mt-1">
                Sí. Podés cargar la foto del lote al inicio del formulario y se
                incluirá en el informe PDF.
              </p>
            </div>

            <div>
              <h3 className="font-semibold">
                4.4. ¿Los valores de costos e incidencias son exactos?
              </h3>
              <p className="mt-1">
                No. Son estimaciones basadas en los datos y costos que vos ingresás.
                Deben utilizarse como referencia aproximada y siempre contrastarse
                con presupuestos y estudios más detallados.
              </p>
            </div>
          </div>
        </section>

        {/* 5. Seguridad y datos */}
        <section className="bg-white border border-neutral-200 rounded-xl shadow-sm p-5 space-y-4">
          <h2 className="text-lg font-semibold text-neutral-900">
            5. Seguridad y datos
          </h2>

          <div className="space-y-3 text-sm text-neutral-700">
            <div>
              <h3 className="font-semibold">
                5.1. ¿Dónde se guardan mis datos?
              </h3>
              <p className="mt-1">
                Tus datos y los de tus informes se almacenan en servicios de nube de
                terceros (por ejemplo, Supabase, Vercel), que cuentan con medidas de
                seguridad estándar para este tipo de plataformas.
              </p>
            </div>

            <div>
              <h3 className="font-semibold">
                5.2. ¿Quién puede ver mis informes?
              </h3>
              <p className="mt-1">
                Si sos <span className="font-medium">Empresa</span>, podés ver tus
                informes y los de tus Asesores asociados.
              </p>
              <p className="mt-1">
                Si sos <span className="font-medium">Asesor</span>, solo podés ver y
                gestionar tus propios informes.
              </p>
              <p className="mt-1">
                VAI Prop no utiliza tus informes para mostrarlos públicamente.
              </p>
            </div>

            <div>
              <h3 className="font-semibold">
                5.3. ¿Pueden usar mis datos para otros fines?
              </h3>
              <p className="mt-1">
                Utilizamos tus datos para poder brindarte el servicio y para mejorar
                la Plataforma, siguiendo lo detallado en nuestra Política de
                Privacidad.
              </p>
              <p className="mt-1">
                No vendemos tus datos personales identificables a terceros.
              </p>
            </div>
          </div>
        </section>

        {/* 6. Soporte */}
        <section className="bg-white border border-neutral-200 rounded-xl shadow-sm p-5 space-y-4 mb-4">
          <h2 className="text-lg font-semibold text-neutral-900">
            6. Soporte y contacto
          </h2>

          <div className="space-y-3 text-sm text-neutral-700">
            <div>
              <h3 className="font-semibold">
                6.1. Tengo un problema con mi cuenta o un error en la plataforma, ¿qué hago?
              </h3>
              <p className="mt-1">
                Podés escribirnos a{" "}
                <a
                  href="mailto:soporte@vaiprop.com?subject=Problema%20con%20mi%20cuenta%20o%20la%20plataforma"
                  className="text-amber-400 hover:text-amber-300 font-medium underline-offset-2 hover:underline"
                >
                  soporte@vaiprop.com
                </a>{" "}
                detallando el inconveniente (idealmente con capturas de pantalla y
                pasos para reproducirlo). Intentaremos ayudarte lo antes posible.
              </p>
            </div>

            <div>
              <h3 className="font-semibold">
                6.2. ¿Tienen soporte telefónico o por WhatsApp?
              </h3>
              <p className="mt-1">
                Actualmente el soporte se brinda por correo electrónico en{" "}
                <a
                  href="mailto:soporte@vaiprop.com"
                  className="text-amber-400 hover:text-amber-300 font-medium underline-offset-2 hover:underline"
                >
                  soporte@vaiprop.com
                </a>{" "}
                y, en casos específicos, coordinamos una llamada.
              </p>
            </div>

            <div>
              <h3 className="font-semibold">
                6.3. ¿En qué horario responden las consultas?
              </h3>
              <p className="mt-1">
                Tu consulta será respondida lo antes posible por nuestro equipo de
                soporte. Nuestros horarios de atención son de{" "}
                <span className="font-medium">
                  Lunes a Viernes de 09:00 hs a 18:00 hs
                </span>
                .
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
