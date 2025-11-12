// services/pricingService.ts

import { PokemonRarity } from '../types';

/**
 * Defines the multipliers for each rarity level to calculate Pokémon price.
 */
const RARITY_MULTIPLIER: Record<PokemonRarity, number> = {
  [PokemonRarity.F]: 1.0,
  [PokemonRarity.E]: 1.2,
  [PokemonRarity.D]: 1.5,
  [PokemonRarity.C]: 2.0,
  [PokemonRarity.B]: 2.5,
  [PokemonRarity.A]: 3.5,
  [PokemonRarity.S]: 5.0,
  [PokemonRarity.S_PLUS]: 7.0,
};

const BASE_VALUE = 50;
const MIN_PRICE = 10;
const MAX_PRICE = 10000;
const ROUND_TO = 5;

/**
 * Computes the resell price of a Pokémon based on its rarity.
 * The price is calculated, clamped within min/max bounds, and rounded.
 * @param rarity The rarity of the Pokémon.
 * @returns The calculated price as an integer.
 */
export function computePrice(rarity: PokemonRarity): number {
  const multiplier = RARITY_MULTIPLIER[rarity] || 1.0;

  let price = BASE_VALUE * multiplier;

  // Clamp the price within the defined min/max bounds.
  price = Math.min(Math.max(price, MIN_PRICE), MAX_PRICE);

  // Round to the nearest multiple for a cleaner display.
  price = Math.round(price / ROUND_TO) * ROUND_TO;
  
  return price;
}
