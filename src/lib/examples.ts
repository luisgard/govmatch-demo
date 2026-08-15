import type { Language } from "./types";

/**
 * The 5 test-case descriptions that fill the discovery textarea.
 * Case 5 is intentionally hard — the honest answer is usually "no strong match".
 */
interface Example {
  labelKey: "example1" | "example2" | "example3" | "example4" | "example5";
  text: Record<Language, string>;
}

export const EXAMPLES: Example[] = [
  {
    labelKey: "example1",
    text: {
      en: "I have a health startup in Utah, 15 employees, we build AI software that reduces administrative work for nurses. We have about $1M in ARR and we're looking for $500K-$2M for development and hospital pilots.",
      es: "Tengo una startup de salud en Utah, 15 empleados, creamos software de IA que reduce el trabajo administrativo de las enfermeras. Tenemos alrededor de $1M en ingresos recurrentes anuales y buscamos entre $500K y $2M para desarrollo y pilotos en hospitales.",
    },
  },
  {
    labelKey: "example2",
    text: {
      en: "We're a lightweight aerospace manufacturing startup in Utah with 35 employees and about $3M in revenue. We build advanced lightweight components and we need $2M-$5M to scale production and tooling.",
      es: "Somos una startup de manufactura aeroespacial ligera en Utah con 35 empleados y alrededor de $3M en ingresos. Fabricamos componentes ligeros avanzados y necesitamos entre $2M y $5M para escalar la producción y el herramental.",
    },
  },
  {
    labelKey: "example3",
    text: {
      en: "Utah startup, 10 employees, we combine sensors and AI to detect municipal water loss and leaks in city water systems. We're looking for $500K-$3M to run pilots with water utilities.",
      es: "Startup de Utah, 10 empleados, combinamos sensores e IA para detectar pérdidas y fugas de agua en los sistemas de agua municipales. Buscamos entre $500K y $3M para realizar pilotos con empresas de agua.",
    },
  },
  {
    labelKey: "example4",
    text: {
      en: "We build AI cybersecurity software for small and medium businesses. Based in Utah, 22 employees, about $2M ARR. We need $1M-$3M to expand our threat-detection platform.",
      es: "Creamos software de ciberseguridad con IA para pequeñas y medianas empresas. Con sede en Utah, 22 empleados, alrededor de $2M en ingresos recurrentes anuales. Necesitamos entre $1M y $3M para ampliar nuestra plataforma de detección de amenazas.",
    },
  },
  {
    labelKey: "example5",
    text: {
      en: "We run an online marketplace that helps parents find and book activities for their kids. We're in Utah, 8 employees, pre-revenue-ish, and we're looking for $250K-$1M to grow.",
      es: "Operamos un marketplace en línea que ayuda a los padres a encontrar y reservar actividades para sus hijos. Estamos en Utah, 8 empleados, casi sin ingresos, y buscamos entre $250K y $1M para crecer.",
    },
  },
];
