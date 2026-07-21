/**
 * Instelbare knoppen voor de matching-engine. Bijstellen op basis van
 * `npm run calibrate` — geen logica hoeft hiervoor herschreven te worden.
 */
export const matchConfig = {
  /** Gewicht van laag 1 (skills) en laag 2 (semantisch) in de eindscore. Telt op tot 1. */
  skillWeight: 0.4,
  semanticWeight: 0.6,

  /** Binnen laag 1: relatief gewicht van must-have- vs nice-to-have-dekking. Telt op tot 1. */
  mustHaveWeight: 0.8,
  niceToHaveWeight: 0.2,

  /**
   * Knock-out: mist de kandidaat een must-have skill, dan wordt de eindscore
   * gecapt op dit maximum, ongeacht de rest van de beoordeling.
   */
  knockOutCapScore: 70,

  /**
   * Voordrempel voor laag 2 (AI, kost tokens): alleen aanroepen als de
   * must-have-dekking uit laag 1 dit percentage haalt.
   */
  aiCallMustHaveThreshold: 0.5,
} as const;
