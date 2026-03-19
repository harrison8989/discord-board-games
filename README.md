# Discord Board Games Bot

This is a Discord bot designed to host and manage various board games directly within Discord channels using modern interaction features like buttons and select menus.

Currently, the bot supports:
- **Incan Gold**: A push-your-luck game where players explore a temple, collecting gems while trying to avoid hazards.
- **Rock Paper Scissors**: A classic challenge command.

## Tech Stack
- **Node.js**: The core runtime.
- **Express**: Handles incoming Discord interaction webhooks.
- **Discord Interactions API**: Utilizes slash commands, buttons, and message components for a rich user experience.
- **Railway**: The bot is deployed and hosted on [Railway](https://railway.app/).

## Project Structure
```
├── game/
│   └── incan_gold/     -> Logic and state management for Incan Gold
├── app.js              -> Main entry point and interaction router
├── commands.js         -> Slash command definitions and registration
├── game_manager.js     -> Manages active game instances
├── base_game.js        -> Base class for board game implementations
├── utils.js            -> Discord API helpers and utilities
└── package.json
```

## Setup and Deployment

### Environment Variables
You'll need the following in your `.env` file:
- `APP_ID`: Your Discord Application ID
- `DISCORD_TOKEN`: Your Bot Token
- `PUBLIC_KEY`: Your Discord App's Public Key (for request verification)
- `PORT`: (Optional) The port to run the server on (defaults to 3000)

### Installation
1. Install dependencies:
   ```bash
   npm install
   ```
2. Register slash commands:
   ```bash
   npm run register
   ```
3. Start the bot:
   ```bash
   npm start
   ```

## Development
The bot uses a webhook-based interaction model. For local development, use a tool like `ngrok` to expose your local port to the internet and update your Discord App's Interaction Endpoint URL.
