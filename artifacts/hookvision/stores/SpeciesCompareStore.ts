/**
 * Singleton store — when the user sends a species-tagged image from the
 * Community Intel tab to the Analyser, we record what they expected.
 * The Analyser tab reads this to show a "why different?" comparison card.
 */
export const SpeciesCompareStore: {
  expectedSpecies: string | null;
  demoNum: number | null;
} = {
  expectedSpecies: null,
  demoNum: null,
};
