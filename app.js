import 'dotenv/config';
import express from 'express';
import {
  ButtonStyleTypes,
  InteractionResponseFlags,
  InteractionResponseType,
  InteractionType,
  MessageComponentTypes,
  verifyKeyMiddleware,
} from 'discord-interactions';
import { getRandomEmoji, DiscordRequest } from './utils.js';
import { getShuffledOptions, getResult } from './game.js';
import { gameManager } from './game_manager.js';
import { IncanGoldGame } from './game/incan_gold/state.js';

// Create an express app
const app = express();
// Get port, or default to 3000
const PORT = process.env.PORT || 3000;
// To keep track of our active games
const activeGames = {};

async function getExplicitPlayers(interaction) {
  const { data, context, guild_id, channel_id } = interaction;
  const playersStr = data.options.find(o => o.name === 'players')?.value || '';
  const sender = interaction.member?.user || interaction.user;
  let players = [{ id: sender.id, username: sender.username }]; // Initiator is always in

  // Find mentions in the string (e.g., <@123>)
  const mentions = playersStr.match(/<@!?(\d+)>/g) || [];
  const mentionedIds = mentions.map(m => m.match(/\d+/)[0]);

  // Fetch all potential candidates to resolve names/mentions
  let candidates = [];
  try {
    if (context === 0) { // Guild
      const res = await DiscordRequest(`guilds/${guild_id}/members?limit=100`, { method: 'GET' });
      const members = await res.json();
      candidates = members.map(m => ({ id: m.user.id, username: m.user.username }));
    } else if (context === 2) { // GDM
      const res = await DiscordRequest(`channels/${channel_id}`, { method: 'GET' });
      const channel = await res.json();
      if (channel.recipients) {
        candidates = channel.recipients.map(u => ({ id: u.id, username: u.username }));
      }
    }
  } catch (err) {
    console.error('Error fetching candidates:', err);
  }

  // Resolve Mention IDs
  for (const id of mentionedIds) {
    const user = candidates.find(c => c.id === id);
    if (user && !players.find(p => p.id === user.id)) {
      players.push(user);
    }
  }

  // Resolve Usernames from names provided (naive space-separation)
  const names = playersStr.replace(/<@!?\d+>/g, ' ').split(/\s+/).filter(n => n.length > 0);
  for (const name of names) {
    const user = candidates.find(c => c.username.toLowerCase() === name.toLowerCase());
    if (user && !players.find(p => p.id === user.id)) {
      players.push(user);
    }
  }

  return players;
}

/**
 * Interactions endpoint URL where Discord will send HTTP requests
 * Parse request body and verifies incoming requests using discord-interactions package
 */
app.post('/interactions', verifyKeyMiddleware(process.env.PUBLIC_KEY), async function (req, res) {
  // Interaction id, type and data
  const { id, type, data, context } = req.body;
  const user = req.body.member?.user || req.body.user;
  const username = user ? user.username : 'Unknown';
  
  if (type === InteractionType.APPLICATION_COMMAND) {
    console.log(`Interaction (Command): ${data.name} by ${username} (${user?.id})`);
  } else if (type === InteractionType.MESSAGE_COMPONENT) {
    console.log(`Interaction (Component): ${data.custom_id} by ${username} (${user?.id})`);
  } else if (type !== InteractionType.PING) {
    console.log(`Interaction (Type ${type}) by ${username} (${user?.id})`);
  }

  /**
   * Handle verification requests
   */
  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  /**
   * Handle slash command requests
   * See https://discord.com/developers/docs/interactions/application-commands#slash-commands
   */
  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;

    // "test" command
    if (name === 'test') {
      // Send a message into the channel where command was triggered from
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: InteractionResponseFlags.IS_COMPONENTS_V2,
          components: [
            {
              type: MessageComponentTypes.TEXT_DISPLAY,
              // Fetches a random emoji to send from a helper function
              content: `${getRandomEmoji()} hello world ${getRandomEmoji()}`
            }
          ]
        },
      });
    }

    // "incan gold command"
    if (name === 'incan_gold') {
      // Defer the response immediately to avoid the 3-second timeout
      res.send({
        type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: InteractionResponseFlags.IS_COMPONENTS_V2
        }
      });

      // Perform slow operations asynchronously
      try {
        const players = await getExplicitPlayers(req.body);
        const game = gameManager.createGame(id, IncanGoldGame, players);
        const payload = game.getMessagePayload();

        // Update the original message with the game state
        const endpoint = `webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`;
        await DiscordRequest(endpoint, {
          method: 'PATCH',
          body: {
            ...payload,
            flags: InteractionResponseFlags.IS_COMPONENTS_V2
          },
        });
      } catch (err) {
        console.error('Error in incan_gold setup:', err);
        // Update the original message with an error
        const endpoint = `webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`;
        await DiscordRequest(endpoint, {
          method: 'PATCH',
          body: {
            content: `Failed to start Incan Gold: ${err.message}`,
          },
        }).catch(console.error);
      }
      return;
    }

    // "challenge" command
    if (name === 'challenge' && id) {
          // Interaction context
          const context = req.body.context;
          // User ID is in user field for (G)DMs, and member for servers
          const userId = context === 0 ? req.body.member.user.id : req.body.user.id;
          // User's object choice
          const objectName = req.body.data.options[0].value;

          // Create active game using message ID as the game ID
          activeGames[id] = {
              id: userId,
              objectName,
          };

          return res.send({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: {
                  flags: InteractionResponseFlags.IS_COMPONENTS_V2,
                  components: [
                      {
                          type: MessageComponentTypes.TEXT_DISPLAY,
                          // Fetches a random emoji to send from a helper function
                          content: `Rock papers scissors challenge from <@${userId}>`,
                      },
                      {
                          type: MessageComponentTypes.ACTION_ROW,
                          components: [
                              {
                                  type: MessageComponentTypes.BUTTON,
                                  // Append the game ID to use later on
                                  custom_id: `accept_button_${req.body.id}`,
                                  label: 'Accept',
                                  style: ButtonStyleTypes.PRIMARY,
                              },
                          ],
                      },
                  ],
              },
          });
    }

    console.error(`unknown command: ${name}`);
    return res.status(400).json({ error: 'unknown command' });
  }

  if (type === InteractionType.MESSAGE_COMPONENT) {
        // custom_id set in payload when sending message component
        const componentId = data.custom_id;

        // Route to Incan Gold
        if (componentId.startsWith('incan_')) {
            const parts = componentId.split('_');
            const gameId = parts[parts.length - 1];
            const game = gameManager.getGame(gameId);
            
            if (game) {
                if (componentId.startsWith('incan_next_')) {
                    game.startNextRound();
                }
                const payload = game.handleInteraction(req.body);
                
                // If it's a "You are not in this game" message, it returns an ephemeral response
                if (payload.flags === 64) {
                    return res.send({
                        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                        data: payload
                    });
                }

                // Otherwise, update the original message
                return res.send({
                    type: InteractionResponseType.UPDATE_MESSAGE,
                    data: payload
                });
            }
        }

        if (componentId.startsWith('accept_button_')) {
            // get the associated game ID
            const gameId = componentId.replace('accept_button_', '');
            // Delete message with token in request body
            const endpoint = `webhooks/${process.env.APP_ID}/${req.body.token}/messages/${req.body.message.id}`;
            try {
                await res.send({
                    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: {
                        // Indicates it'll be an ephemeral message
                        flags: InteractionResponseFlags.EPHEMERAL | InteractionResponseFlags.IS_COMPONENTS_V2,
                        components: [
                            {
                                type: MessageComponentTypes.TEXT_DISPLAY,
                                content: 'What is your object of choice?',
                            },
                            {
                                type: MessageComponentTypes.ACTION_ROW,
                                components: [
                                    {
                                        type: MessageComponentTypes.STRING_SELECT,
                                        // Append game ID
                                        custom_id: `select_choice_${gameId}`,
                                        options: getShuffledOptions(),
                                    },
                                ],
                            },
                        ],
                    },
                });
                // Delete previous message
                await DiscordRequest(endpoint, { method: 'DELETE' });
            } catch (err) {
                console.error('Error sending message:', err);
            }
        } else if (componentId.startsWith('select_choice_')) {
            // get the associated game ID
            const gameId = componentId.replace('select_choice_', '');

            if (activeGames[gameId]) {
                // Interaction context
                const context = req.body.context;
                // Get user ID and object choice for responding user
                // User ID is in user field for (G)DMs, and member for servers
                const userId = context === 0 ? req.body.member.user.id : req.body.user.id;
                const objectName = data.values[0];
                // Calculate result from helper function
                const resultStr = getResult(activeGames[gameId], {
                    id: userId,
                    objectName,
                });

                // Remove game from storage
                delete activeGames[gameId];
                // Update message with token in request body
                const endpoint = `webhooks/${process.env.APP_ID}/${req.body.token}/messages/${req.body.message.id}`;

                try {
                    // Send results
                    await res.send({
                        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                        data: {
                            flags: InteractionResponseFlags.IS_COMPONENTS_V2,
                            components: [
                                {
                                    type: MessageComponentTypes.TEXT_DISPLAY,
                                    content: resultStr
                                }
                            ]
                        },
                    });
                    // Update ephemeral message
                    await DiscordRequest(endpoint, {
                        method: 'PATCH',
                        body: {
                            components: [
                                {
                                    type: MessageComponentTypes.TEXT_DISPLAY,
                                    content: 'Nice choice ' + getRandomEmoji()
                                }
                            ],
                        },
                    });
                } catch (err) {
                    console.error('Error sending message:', err);
                }
            }
        }

        return;
  }

  console.error('unknown interaction type', type);
  return res.status(400).json({ error: 'unknown interaction type' });
});

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});
