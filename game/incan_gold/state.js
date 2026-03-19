import { BaseGame } from '../../base_game.js';
import { CARD_TYPES, DECISIONS, GAME_PHASES } from './constants.js';
import { createInitialDeck, divideGems, shuffle } from './logic.js';
import { MessageComponentTypes, ButtonStyleTypes } from 'discord-interactions';

export class IncanGoldGame extends BaseGame {
  constructor(id, players) {
    super(id, players);
    this.deck = createInitialDeck();
    this.artifactDeck = [
      { type: CARD_TYPES.ARTIFACT, value: 5 },
      { type: CARD_TYPES.ARTIFACT, value: 5 },
      { type: CARD_TYPES.ARTIFACT, value: 5 },
      { type: CARD_TYPES.ARTIFACT, value: 10 },
      { type: CARD_TYPES.ARTIFACT, value: 10 },
    ];
    this.currentRound = 0;
    this.revealedCards = [];
    this.pathGems = 0;
    this.roundHazards = new Set();
    this.playerStates = new Map(players.map(p => [p.id, {
      id: p.id,
      username: p.username,
      bankedGems: 0,
      roundGems: 0,
      isInTemple: false,
      decision: null,
      artifacts: 0
    }]));
    this.phase = GAME_PHASES.WAITING_FOR_DECISIONS;
    this.lastEvent = '';
    this.startNextRound();
  }

  startNextRound() {
    this.currentRound++;
    if (this.currentRound > 5) {
      this.phase = GAME_PHASES.GAME_OVER;
      this.status = 'finished';
      return;
    }

    // Reset players
    for (let state of this.playerStates.values()) {
      state.isInTemple = true;
      state.roundGems = 0;
      state.decision = null;
    }

    // Shuffle current deck with a new artifact
    const currentArtifact = this.artifactDeck.shift();
    this.currentDeck = shuffle([...this.deck, currentArtifact]);
    this.revealedCards = [];
    this.roundHazards = new Set();
    this.pathGems = 0;
    
    this.lastEvent = `🚨 **ROUND ${this.currentRound} START!** 🚨\n*The expedition enters a new part of the temple...*`;
    
    // Draw first card immediately
    this.revealNextCard();
  }

  revealNextCard() {
    const card = this.currentDeck.shift();
    if (!card) {
      this.endRound(false);
      return;
    }
    this.revealedCards.push(card);

    if (card.type === CARD_TYPES.TREASURE) {
      const activePlayers = Array.from(this.playerStates.values()).filter(p => p.isInTemple);
      const { share, remainder } = divideGems(card.value, activePlayers.length);
      activePlayers.forEach(p => p.roundGems += share);
      this.pathGems += remainder;
      this.lastEvent = `💎 **Treasure!** Revealed: ${this.formatCard(card)}\n*Each explorer gets ${share} gems. ${remainder} left on the path.*`;
    } else if (card.type === CARD_TYPES.HAZARD) {
      if (this.roundHazards.has(card.hazardType)) {
        // Round ends in failure
        this.lastEvent = `💀 **TRAP ACTIVATED!** Another ${card.hazardType} appeared!\n*Everyone still in the temple flees in terror, losing their round gems!*`;
        this.endRound(true, card.hazardType);
        return;
      }
      this.roundHazards.add(card.hazardType);
      this.lastEvent = `⚠️ **Danger!** A ${card.hazardType} was spotted. One more of these and it's over!`;
    } else if (card.type === CARD_TYPES.ARTIFACT) {
      this.lastEvent = `✨ **Artifact Found!** A ${this.formatCard(card)} lies on the path.\n*Only someone leaving ALONE can claim it.*`;
    }
    // Artifacts stay on path until someone leaves alone

    this.phase = GAME_PHASES.WAITING_FOR_DECISIONS;
    // Reset decisions for the new card
    for (let p of this.playerStates.values()) {
      if (p.isInTemple) p.decision = null;
    }
  }

  endRound(failure, hazardType = null) {
    if (failure) {
      // Everyone in temple loses round gems
      for (let p of this.playerStates.values()) {
        if (p.isInTemple) {
          p.roundGems = 0;
          p.isInTemple = false;
        }
      }
      // Remove one instance of the triggering hazard from the deck permanently
      const index = this.deck.findIndex(c => c.type === CARD_TYPES.HAZARD && c.hazardType === hazardType);
      if (index !== -1) this.deck.splice(index, 1);
    } else {
      this.lastEvent = `⛺ **Round Over.** All explorers have returned to camp.`;
    }
    
    if (this.currentRound >= 5) {
      this.phase = GAME_PHASES.GAME_OVER;
      this.status = 'finished';
    } else {
      this.phase = GAME_PHASES.ROUND_ENDED;
    }
  }

  handleInteraction(interaction) {
    const userId = interaction.member?.user?.id || interaction.user?.id;
    const player = this.playerStates.get(userId);

    if (!player) {
      return {
        components: [{
          type: MessageComponentTypes.TEXT_DISPLAY,
          content: "❌ You are not a player in this game."
        }],
        flags: 64
      };
    }

    if (this.phase === GAME_PHASES.GAME_OVER) {
      return this.getMessagePayload();
    }

    const customId = interaction.data.custom_id;

    // Handle Next Round button
    if (customId.includes('next')) {
      if (this.phase !== GAME_PHASES.ROUND_ENDED) {
        return this.getMessagePayload();
      }
      this.startNextRound();
      return this.getMessagePayload();
    }

    // Handle decisions
    if (this.phase !== GAME_PHASES.WAITING_FOR_DECISIONS) {
      return {
        components: [{
          type: MessageComponentTypes.TEXT_DISPLAY,
          content: "⏳ The round has already moved on."
        }],
        flags: 64
      };
    }

    if (!player.isInTemple) {
      return {
        components: [{
          type: MessageComponentTypes.TEXT_DISPLAY,
          content: "🏠 You have already returned to camp for this round. You'll join the expedition again in the next round!"
        }],
        flags: 64
      };
    }

    if (player.decision !== null) {
      return {
        components: [{
          type: MessageComponentTypes.TEXT_DISPLAY,
          content: `✅ You have already decided to **${player.decision}** for this turn. Please wait for the other explorers!`
        }],
        flags: 64
      };
    }

    if (customId.includes('continue')) {
      player.decision = DECISIONS.CONTINUE;
    } else if (customId.includes('leave')) {
      player.decision = DECISIONS.LEAVE;
    } else {
      // Not a decision button
      return this.getMessagePayload();
    }

    // Check if everyone has decided
    const activePlayers = Array.from(this.playerStates.values()).filter(p => p.isInTemple);
    const allDecided = activePlayers.every(p => p.decision !== null);

    if (allDecided) {
      this.resolveDecisions();
    }

    return this.getMessagePayload();
  }

  resolveDecisions() {
    const activePlayers = Array.from(this.playerStates.values()).filter(p => p.isInTemple);
    const leavingPlayers = activePlayers.filter(p => p.decision === DECISIONS.LEAVE);
    const stayingPlayers = activePlayers.filter(p => p.decision === DECISIONS.CONTINUE);

    // Leaving players split path gems
    if (leavingPlayers.length > 0) {
      const { share, remainder } = divideGems(this.pathGems, leavingPlayers.length);
      let leavingMsg = `🚶 **${leavingPlayers.length} explorer(s) left the temple.**`;
      
      leavingPlayers.forEach(p => {
        p.bankedGems += p.roundGems + share;
        p.roundGems = 0;
        p.isInTemple = false;
      });
      this.pathGems = remainder;

      // Special Artifact rule: only if exactly one person leaves
      if (leavingPlayers.length === 1) {
        const artifactsOnPath = this.revealedCards.filter(c => c.type === CARD_TYPES.ARTIFACT && !c.claimed);
        if (artifactsOnPath.length > 0) {
          artifactsOnPath.forEach(a => {
            leavingPlayers[0].bankedGems += a.value;
            a.claimed = true;
          });
          leavingMsg += ` They also claimed ${artifactsOnPath.length} artifact(s)!`;
        }
      }
      this.lastEvent = leavingMsg;
    }

    if (stayingPlayers.length === 0) {
      this.endRound(false);
    } else {
      this.revealNextCard();
    }
  }

  getMessagePayload() {
    let content = `# 🏺 Incan Gold - Round ${this.currentRound}/5\n`;
    
    content += `## ${this.lastEvent}\n\n`;

    // Show path
    const pathIcons = this.revealedCards.map((c, i) => {
      const formatted = this.formatCard(c);
      return (i === this.revealedCards.length - 1) ? `➡️ **${formatted}**` : formatted;
    });
    content += `**Path:** ${pathIcons.join(' ')}\n`;
    content += `**Gems on Path:** 💎 ${this.pathGems}\n\n`;

    // Show players
    content += `**Status of Explorers:**\n`;
    for (let p of this.playerStates.values()) {
      const status = p.isInTemple ? (p.decision ? '✅ Ready' : '⏳ Deciding...') : '⛺ Safe at Camp';
      content += `> <@${p.id}>: **${p.roundGems}** round / **${p.bankedGems}** total [${status}]\n`;
    }

    if (this.phase === GAME_PHASES.WAITING_FOR_DECISIONS) {
      content += `\n**What will you do?** Continue deeper into the temple, or leave with your current gems?`;
    }

    const textDisplay = {
      type: MessageComponentTypes.TEXT_DISPLAY,
      content
    };

    if (this.phase === GAME_PHASES.GAME_OVER) {
       let gameOverContent = `\n# 🏆 GAME OVER! 🏆\n`;
       const sorted = Array.from(this.playerStates.values()).sort((a,b) => b.bankedGems - a.bankedGems);
       gameOverContent += `**The Winner is <@${sorted[0].id}> with ${sorted[0].bankedGems} gems!**\n\n`;
       
       gameOverContent += `**Final Scores:**\n`;
       sorted.forEach((p, i) => {
         gameOverContent += `${i+1}. <@${p.id}>: ${p.bankedGems} gems\n`;
       });
       
       return {
         components: [
           {
             type: MessageComponentTypes.TEXT_DISPLAY,
             content: content + gameOverContent
           }
         ]
       };
    }

    if (this.phase === GAME_PHASES.ROUND_ENDED) {
        return {
            components: [
                textDisplay,
                {
                    type: MessageComponentTypes.ACTION_ROW,
                    components: [{
                        type: MessageComponentTypes.BUTTON,
                        custom_id: `incan_next_${this.id}`,
                        label: 'Proceed to Next Round',
                        style: ButtonStyleTypes.SUCCESS,
                        emoji: { name: '🏹' }
                    }]
                }
            ]
        };
    }

    // Decision Buttons
    const components = [
      textDisplay,
      {
        type: MessageComponentTypes.ACTION_ROW,
        components: [
          {
            type: MessageComponentTypes.BUTTON,
            custom_id: `incan_continue_${this.id}`,
            label: 'Keep Exploring',
            style: ButtonStyleTypes.PRIMARY,
            emoji: { name: '🧗' }
          },
          {
            type: MessageComponentTypes.BUTTON,
            custom_id: `incan_leave_${this.id}`,
            label: 'Return to Camp',
            style: ButtonStyleTypes.DANGER,
            emoji: { name: '🚶' }
          }
        ]
      }
    ];

    return { components };
  }

  formatCard(card) {
    if (card.type === CARD_TYPES.TREASURE) return `[💎${card.value}]`;
    if (card.type === CARD_TYPES.HAZARD) return `[⚠️${card.hazardType}]`;
    if (card.type === CARD_TYPES.ARTIFACT) return card.claimed ? `[✨claimed]` : `[✨${card.value}]`;
    return '[?]';
  }
}
