export interface NormalVitalSigns {
  temp: string;
  fc: string;
  fr: string;
  ta: string;
  so2: string;
  ageCategory: string;
}

/**
 * Calculates normal pediatric vital signs based on patient age string.
 * Examples: "3 años 2 meses", "8 meses", "28 días", "10 años", "RN"
 */
export function getPediatricNormalVitals(ageStr: string): NormalVitalSigns {
  const ageLower = (ageStr || '').toLowerCase();

  // Recién nacido / Días
  if (ageLower.includes('rn') || ageLower.includes('recién nacido') || ageLower.includes('recien nacido') || ageLower.includes('día') || ageLower.includes('dia')) {
    const daysMatch = ageLower.match(/(\d+)\s*d[ií]a/);
    const days = daysMatch ? parseInt(daysMatch[1]) : 1;
    if (days <= 28 || ageLower.includes('rn') || ageLower.includes('nacido')) {
      return {
        temp: '37.0°C',
        fc: '140 bpm',
        fr: '45 rpm',
        ta: '70/45 mmHg',
        so2: '98%',
        ageCategory: 'Recién Nacido'
      };
    }
  }

  // Meses (Lactante menor)
  if (ageLower.includes('mes')) {
    const monthsMatch = ageLower.match(/(\d+)\s*mes/);
    const months = monthsMatch ? parseInt(monthsMatch[1]) : 6;
    if (months < 12 && !ageLower.includes('año')) {
      return {
        temp: '37.0°C',
        fc: '120 bpm',
        fr: '32 rpm',
        ta: '85/55 mmHg',
        so2: '98%',
        ageCategory: 'Lactante Menor'
      };
    }
  }

  // Años
  const yearsMatch = ageLower.match(/(\d+)\s*año/);
  const years = yearsMatch ? parseInt(yearsMatch[1]) : 3;

  if (years < 2) {
    return {
      temp: '37.0°C',
      fc: '115 bpm',
      fr: '28 rpm',
      ta: '90/60 mmHg',
      so2: '98%',
      ageCategory: 'Lactante Mayor'
    };
  } else if (years <= 5) {
    return {
      temp: '36.8°C',
      fc: '105 bpm',
      fr: '24 rpm',
      ta: '95/60 mmHg',
      so2: '98%',
      ageCategory: 'Preescolar'
    };
  } else if (years <= 12) {
    return {
      temp: '36.5°C',
      fc: '90 bpm',
      fr: '20 rpm',
      ta: '100/65 mmHg',
      so2: '98%',
      ageCategory: 'Escolar'
    };
  } else {
    return {
      temp: '36.5°C',
      fc: '75 bpm',
      fr: '16 rpm',
      ta: '110/70 mmHg',
      so2: '98%',
      ageCategory: 'Adolescente'
    };
  }
}
