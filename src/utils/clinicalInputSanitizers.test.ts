import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeNumericDecimal,
  sanitizeBloodPressure,
  isNumericLabTest,
  isRespiratoryPanelTest,
  sanitizeLabInputValue,
  normalizeOptionalTaDisplay,
} from './clinicalInputSanitizers';
import {
  HISTORIA_CLINICA_TUTORIAL_STEPS,
  TABLERO_CAMAS_TUTORIAL_STEPS,
  computeCoachmarkPosition,
  getTutorialStepsByTour,
} from './tutorialSteps';

describe('clinicalInputSanitizers', () => {
  it('sanitizeNumericDecimal strips letters, converts comma to dot, and allows only one dot', () => {
    assert.equal(sanitizeNumericDecimal('abc37.5°C'), '37.5');
    assert.equal(sanitizeNumericDecimal('12,45 kg'), '12.45');
    assert.equal(sanitizeNumericDecimal('37..5.2'), '37.52');
    assert.equal(sanitizeNumericDecimal('solo letras'), '');
    assert.equal(sanitizeNumericDecimal('-3.5', false), '3.5');
    assert.equal(sanitizeNumericDecimal('-3.5 mEq/L', true), '-3.5');
    assert.equal(sanitizeNumericDecimal('12-3', true), '123');
  });

  it('sanitizeBloodPressure allows only digits and at most one slash, keeping empty blank', () => {
    assert.equal(sanitizeBloodPressure(''), '');
    assert.equal(sanitizeBloodPressure('abc100/60mmHg'), '100/60');
    assert.equal(sanitizeBloodPressure('110/70/80'), '110/7080');
    assert.equal(sanitizeBloodPressure('/100/60'), '100/60');
    assert.equal(sanitizeBloodPressure('normal'), '');
  });

  it('normalizeOptionalTaDisplay returns empty string when blank and trims non-empty values', () => {
    assert.equal(normalizeOptionalTaDisplay(undefined), '');
    assert.equal(normalizeOptionalTaDisplay(''), '');
    assert.equal(normalizeOptionalTaDisplay('   '), '');
    assert.equal(normalizeOptionalTaDisplay(' 100/60 '), '100/60');
  });

  it('enforces numeric-only across Hematología, Química, Electrolitos, Gases, and numeric Orina/Micro tests', () => {
    assert.equal(isNumericLabTest('Hemoglobina', 'Hematología y Coagulación'), true);
    assert.equal(isNumericLabTest('Glicemia', 'Química Sanguínea'), true);
    assert.equal(isNumericLabTest('Sodio (Na)', 'Electrolitos y Minerales'), true);
    assert.equal(isNumericLabTest('pH', 'Gases Arteriales'), true);
    assert.equal(isNumericLabTest('EB', 'Gases Arteriales'), true);

    assert.equal(isNumericLabTest('Densidad', 'Orina y Heces'), true);
    assert.equal(isNumericLabTest('pH Orina', 'Orina y Heces'), true);
    assert.equal(isNumericLabTest('Color / Aspecto', 'Orina y Heces'), false);

    assert.equal(isNumericLabTest('Células LCR', 'Microbiología, LCR y Serología'), true);
    assert.equal(isNumericLabTest('Glucosa LCR', 'Microbiología, LCR y Serología'), true);
    assert.equal(isNumericLabTest('Proteínas LCR', 'Microbiología, LCR y Serología'), true);
    assert.equal(isNumericLabTest('Hemocultivo', 'Microbiología, LCR y Serología'), false);
  });

  it('keeps Panel Respiratorio strictly text-friendly while sanitizing numeric labs', () => {
    assert.equal(isRespiratoryPanelTest('Panel Respiratorio', 'Panel Respiratorio'), true);
    assert.equal(isNumericLabTest('Panel Respiratorio', 'Panel Respiratorio'), false);
    assert.equal(
      sanitizeLabInputValue('Panel Respiratorio', 'VSR positivo, Influenza A negativo', 'Panel Respiratorio'),
      'VSR positivo, Influenza A negativo'
    );
    assert.equal(sanitizeLabInputValue('Hemoglobina', 'abc12,8 g/dL', 'Hematología y Coagulación'), '12.8');
    assert.equal(sanitizeLabInputValue('EB', '-2,4 mEq/L', 'Gases Arteriales'), '-2.4');
    assert.equal(sanitizeLabInputValue('Densidad', 'esp 1020', 'Orina y Heces'), '1020');
    assert.equal(sanitizeLabInputValue('Hemocultivo', 'Negativo a las 48h', 'Microbiología, LCR y Serología'), 'Negativo a las 48h');
  });
});

describe('tutorialSteps', () => {
  it('contains the full 46-step Historia Clínica tour covering Pages 1-8, Quick-Jump Dropdown, Quick Fill, Restore Normal, Vista Previa and Hospitalization', () => {
    assert.equal(HISTORIA_CLINICA_TUTORIAL_STEPS.length, 46);
    assert.equal(HISTORIA_CLINICA_TUTORIAL_STEPS[0].id, 'hc-01-inicio-btn');
    assert.equal(HISTORIA_CLINICA_TUTORIAL_STEPS[0].advanceOnTargetClick, true);
    const labDecision = HISTORIA_CLINICA_TUTORIAL_STEPS.find(s => s.id === 'hc-35-p7-pregunta-labs');
    assert.ok(labDecision?.decisionActions && labDecision.decisionActions.length === 2);
    assert.equal(getTutorialStepsByTour('historia_clinica').length, 46);
    assert.equal(getTutorialStepsByTour('tablero_camas').length, TABLERO_CAMAS_TUTORIAL_STEPS.length);
  });

  it('computeCoachmarkPosition clamps card inside viewport bounds', () => {
    const coords = computeCoachmarkPosition({
      targetRect: { top: 20, left: 10, width: 120, height: 40, right: 130, bottom: 60 },
      cardWidth: 360,
      cardHeight: 200,
      viewportWidth: 390,
      viewportHeight: 844,
    });
    assert.ok(coords.left >= 14);
    assert.ok(coords.top >= 14);
    assert.ok(coords.top + 200 <= 844);

    const fallbackCenter = computeCoachmarkPosition({
      targetRect: null,
      cardWidth: 360,
      cardHeight: 200,
      viewportWidth: 1280,
      viewportHeight: 800,
    });
    assert.equal(fallbackCenter.placement, 'center');
  });
});
