export class GameManager {
  constructor() {
    this.activeGames = new Map();
  }

  /**
   * Initializes a new game instance
   * @param {string} gameId - Unique ID (usually the original interaction ID)
   * @param {class} GameClass - The class of the game to create
   * @param {Array} players - List of initial players
   * @returns {BaseGame}
   */
  createGame(gameId, GameClass, players) {
    const game = new GameClass(gameId, players);
    this.activeGames.set(gameId, game);
    return game;
  }

  /**
   * Retrieves an active game by ID
   * @param {string} gameId
   * @returns {BaseGame|undefined}
   */
  getGame(gameId) {
    return this.activeGames.get(gameId);
  }

  /**
   * Removes a game from active management
   * @param {string} gameId
   */
  deleteGame(gameId) {
    this.activeGames.delete(gameId);
  }

  /**
   * Handles an interaction by finding the corresponding game
   * @param {string} gameId
   * @param {object} interaction
   * @returns {Promise<object|null>}
   */
  async handleInteraction(gameId, interaction) {
    const game = this.getGame(gameId);
    if (!game) return null;

    const response = await game.handleInteraction(interaction);
    if (game.status === 'finished') {
      this.deleteGame(gameId);
    }
    return response;
  }
}

export const gameManager = new GameManager();
