import { CARD_TYPES, HAZARD_TYPES } from './constants.js';

export function createInitialDeck() {
  const deck = [];

  // 15 Treasure Cards
  const treasureValues = [1, 2, 3, 4, 5, 5, 7, 7, 9, 11, 11, 13, 14, 15, 17];
  for (let value of treasureValues) {
    deck.push({ type: CARD_TYPES.TREASURE, value });
  }

  // 15 Hazard Cards (3 of each type)
  for (let type of Object.values(HAZARD_TYPES)) {
    for (let i = 0; i < 3; i++) {
      deck.push({ type: CARD_TYPES.HAZARD, hazardType: type });
    }
  }

  // Artifact Cards (not in the initial deck, but we'll manage them per round)
  return shuffle(deck);
}

export function shuffle(array) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export function divideGems(totalGems, numPlayers) {
  if (numPlayers === 0) return { share: 0, remainder: totalGems };
  const share = Math.floor(totalGems / numPlayers);
  const remainder = totalGems % numPlayers;
  return { share, remainder };
}
