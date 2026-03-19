import 'dotenv/config';
import { getRPSChoices } from './game.js';
import { capitalize, InstallGlobalCommands, InstallGuildCommands } from './utils.js';

// Get the game choices from game.js
function createCommandChoices() {
  const choices = getRPSChoices();
  const commandChoices = [];

  for (let choice of choices) {
    commandChoices.push({
      name: capitalize(choice),
      value: choice.toLowerCase(),
    });
  }

  return commandChoices;
}

// Simple test command
const TEST_COMMAND = {
  name: 'test',
  description: 'Basic command',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

// Command containing options
const CHALLENGE_COMMAND = {
  name: 'challenge',
  description: 'Challenge to a match of rock paper scissors',
  options: [
    {
      type: 3,
      name: 'object',
      description: 'Pick your object',
      required: true,
      choices: createCommandChoices(),
    },
  ],
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 2],
};

const INCAN_GOLD_COMMAND = {
  name: 'incan_gold',
  description: 'Play a game of Incan Gold',
  options: [
    {
      type: 3, // STRING
      name: 'players',
      description: 'List of players to include (mentions or usernames separated by space)',
      required: true,
    }
  ],
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

const ALL_COMMANDS = [TEST_COMMAND, CHALLENGE_COMMAND, INCAN_GOLD_COMMAND];

// Register global commands
InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);

// Register guild commands (uncomment and add your guild ID)
// InstallGuildCommands(process.env.APP_ID, process.env.GUILD_ID, ALL_COMMANDS);
