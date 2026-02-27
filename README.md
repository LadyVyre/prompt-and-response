# Prompt & Response

A Cards Against Humanity-style Discord game designed for **humans and their AI companions** to play together.

Built by [V & Dante Vyre](https://www.tiktok.com/@lady.vyre) for the [Lodestone Community](https://discord.gg/lodestone).

---

## How It Works

A **Dealer Bot** runs in your Discord server and manages the game. Each round:

1. A black card (prompt) is dealt to the game channel
2. The human gets their hand via DM with a dropdown to pick
3. The AI gets their hand posted in a private channel
4. The AI's companion bot sends back a number to pick a card
5. Both answers are revealed in the game channel

No AI API calls. No LLM dependency. The AI companion reads and responds through Discord — however your AI already communicates.

## What's Included

- `bot.js` — The Dealer Bot (slash commands, auto-deal, DM hand delivery)
- `cards.json` — **5,700+ cards** across 100+ packs (official CAH + community expansions)
- `config.example.json` — Template for your server config
- `BotPic.jpg` — Bot avatar

## Setup

### 1. Create a Discord Bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application** → name it (e.g. "P&R Dealer")
3. Go to **Bot** → click **Reset Token** → copy and save the token
4. Enable these **Privileged Gateway Intents**:
   - Message Content Intent
5. Go to **OAuth2** → **URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Send Messages`, `Use Slash Commands`, `Read Message History`
6. Copy the generated URL and open it to invite the bot to your server

### 2. Set Up Discord Channels

You need two channels:

| Channel | Purpose | Who sees it |
|---------|---------|-------------|
| `#prompt-and-response` | Game channel — prompts and reveals post here | Everyone |
| `#ai-hand` | Private channel — AI's cards get posted here | AI bot only + you |

**Get the channel IDs:** Enable Developer Mode in Discord (Settings → Advanced), then right-click each channel → Copy Channel ID.

### 3. Get Your IDs

- **Your Discord User ID:** Right-click your name → Copy User ID
- **AI Bot ID:** Right-click your AI companion's bot → Copy User ID

### 4. Configure

```bash
cp config.example.json config.json
```

Edit `config.json`:

```json
{
  "token": "your-dealer-bot-token",
  "gameChannelId": "your-game-channel-id",
  "humanUserId": "your-discord-user-id",
  "aiChannelId": "your-ai-hand-channel-id",
  "aiBotId": "your-ai-companions-bot-id"
}
```

### 5. Install & Run

```bash
npm install
npm start
```

## Commands

| Command | Description |
|---------|-------------|
| `/deal` | Start a new game (official packs) |
| `/deal all` | Start with ALL 100+ packs |
| `/deal [name]` | Search packs by name (e.g. `/deal dirty`) |
| `/next` | Deal the next round |
| `/stop` | Stop auto-dealing after current round |
| `/hand` | View your current hand |
| `/score` | Show game history |
| `/packs` | List available pack categories |

## How the AI Picks Cards

The Dealer Bot posts the AI's hand in the private `#ai-hand` channel:

```
PROMPT: _ is a slippery slope that leads to _.

YOUR HAND:
1. Cards Against Humanity.
2. A bleached asshole.
3. Fancy Feast.
4. Bees?
5. Alcoholism.
6. A windmill full of corpses.
7. The placenta.

Pick by sending a number 1-7
```

Your AI companion reads this and sends back a number (e.g. `3`) through its own Discord bot. The Dealer Bot matches the message by the `aiBotId` in your config.

**This works with any AI that can read and send Discord messages** — Claude, ChatGPT, custom bots, whatever your companion runs on.

## Game Flow

```
/deal
  ↓
Black card posted to game channel
  ↓
Human gets DM with dropdown → picks card
  ↓
"Human locked in. AI's turn..."
  ↓
AI hand posted to private channel
  ↓
AI bot sends a number back
  ↓
Both cards revealed in game channel
  ↓
Auto-deals next round in 7 seconds
```

## Card Packs

The `cards.json` file contains the full Cards Against Humanity dataset:

- **Official packs** (default): The base game + official expansions
- **Community packs**: 90+ additional themed packs
- **Total**: 5,700+ white cards, 2,000+ black cards

Popular pack searches: `dirty`, `trump`, `humanity`, `cats`, `crabs`, `profanity`, `maturity`, `kids`, `catholic`, `weed`, `pride`, `theatre`

## License

MIT — do whatever you want with it. If you build something cool, tell us about it in Lodestone.
