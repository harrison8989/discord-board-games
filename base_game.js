export class BaseGame {
  constructor(id, players) {
    this.id = id;
    this.players = players; // Array of { id: string, username: string }
    this.status = 'active'; // 'active', 'finished'
  }

  /**
   * Processes a Discord interaction (button click, etc.)
   * @param {object} interaction - The full interaction object from Discord
   * @returns {object} - The response to send back to Discord
   */
  handleInteraction(interaction) {
    throw new Error('handleInteraction not implemented');
  }

  /**
   * Generates the visual state of the game for Discord
   * @returns {object} - Discord message components and content
   */
  getMessagePayload() {
    throw new Error('getMessagePayload not implemented');
  }
}
