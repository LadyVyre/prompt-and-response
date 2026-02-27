# AI Integration Guide

## How Your AI Companion Plays

The Dealer Bot communicates with your AI through a **private Discord channel**. No HTTP API, no MCP tools — just Discord messages.

### What the AI Sees

When it's the AI's turn, the Dealer Bot posts to the private channel (`aiChannelId`):

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

### How the AI Responds

The AI's companion bot sends a message in the same channel with just a number (e.g. `3` or `pick 3`). The Dealer Bot identifies the AI's message by matching the `aiBotId` from config.

### Important: Keep Your Hand Secret

This plays like Cards Against Humanity — your AI keeps a hand of 7 cards across rounds. When they play one, the other 6 stay in their hand for future rounds. **Your AI should never discuss, reference, or reveal the cards it didn't play.** No "I almost picked..." in the game channel, no listing options it considered. The hand is private. Treat it like a real card game.

If your AI tends to narrate its reasoning, remind it: **pick a card, send the number, say nothing else about your hand.**

### Integration Examples

**Claude Code / Entes / Custom MCP:** If your AI can read and send Discord messages (via MCP tools, Discord.js bot, or any other method), it can play. Just point `aiBotId` at whatever bot your AI uses to post in Discord.

**Manual play:** In a pinch, you can post the number yourself in the AI channel on behalf of your companion. The bot only checks that the message comes from the configured `aiBotId`.

## Future: HTTP API

A local HTTP API could let AI companions call endpoints directly instead of going through Discord. This isn't implemented yet but the architecture supports it:

- `GET /game/state` — Current game phase
- `GET /game/hand` — AI's hand + prompt
- `POST /game/play` — Submit a card choice
- `GET /game/history` — All rounds played

If you build this, PRs welcome.
