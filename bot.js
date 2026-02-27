const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, REST, Routes, SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// ============================================================
// PROMPT & RESPONSE — A card game for humans and their AI
// The Dealer Bot — Discord-Only Edition
// ============================================================

const CONFIG_PATH = path.join(__dirname, 'config.json');
let config = {};
try {
  config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
} catch {
  console.error('Missing config.json');
  process.exit(1);
}

const TOKEN = config.token;
const GAME_CHANNEL_ID = config.gameChannelId;
const HUMAN_USER_ID = config.humanUserId;
const AI_CHANNEL_ID = config.aiChannelId || config.danteChannelId; // backwards compat
const AI_BOT_ID = config.aiBotId || config.entesBotId; // backwards compat

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'cards.json'), 'utf8'));
const ALL_WHITE = raw.white;
const ALL_BLACK = raw.black;
const PACKS = raw.packs;

let game = null;

const MAX_CARD_LENGTH = 95; // Discord select menu label limit is 100, leave room for truncation

function createDeck(packFilter = 'official') {
  let whiteIndices = new Set();
  let blackIndices = new Set();
  const packs = PACKS.filter(p => {
    if (packFilter === 'official') return p.official === true;
    if (packFilter === 'all') return true;
    if (typeof packFilter === 'string') return p.name.toLowerCase().includes(packFilter.toLowerCase());
    return false;
  });
  for (const pack of packs) {
    (pack.white || []).forEach(i => whiteIndices.add(i));
    (pack.black || []).forEach(i => blackIndices.add(i));
  }
  // Filter out white cards that exceed Discord's label length limit
  const whites = [...whiteIndices].map(i => ALL_WHITE[i]).filter(c => c && c.length <= MAX_CARD_LENGTH);
  const blacks = [...blackIndices].map(i => ALL_BLACK[i]).filter(Boolean);
  const pick1Blacks = blacks.filter(b => b.pick === 1);
  const skippedCount = [...whiteIndices].map(i => ALL_WHITE[i]).filter(c => c && c.length > MAX_CARD_LENGTH).length;
  if (skippedCount > 0) console.log(`⚠️  Filtered out ${skippedCount} white cards exceeding ${MAX_CARD_LENGTH} chars`);
  console.log(`📦 Deck built: ${whites.length} white cards, ${pick1Blacks.length} black cards from ${packs.length} packs`);
  return { whites: shuffle([...whites]), blacks: shuffle([...pick1Blacks]) };
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function newGame(packFilter = 'official') {
  const deck = createDeck(packFilter);
  game = {
    deck,
    humanHand: deck.whites.splice(0, 7),
    aiHand: deck.whites.splice(0, 7),
    currentBlack: null,
    humanPlay: null,
    aiPlay: null,
    round: 0,
    phase: 'idle',
    history: [],
    autoDeal: true,
  };
  return game;
}

function dealBlack() {
  if (!game || game.deck.blacks.length === 0) return null;
  game.currentBlack = game.deck.blacks.pop();
  game.humanPlay = null;
  game.aiPlay = null;
  game.round++;
  game.phase = 'prompt';
  return game.currentBlack;
}

function humanPlayCard(index) {
  if (!game || game.phase === 'reveal' || game.phase === 'idle') return null;
  if (index < 0 || index >= game.humanHand.length) return null;
  const card = game.humanHand.splice(index, 1)[0];
  game.humanPlay = card;
  if (game.deck.whites.length > 0) game.humanHand.push(game.deck.whites.pop());
  game.phase = 'ai_turn';
  return card;
}

function aiPlayCard(index) {
  if (!game || game.phase !== 'ai_turn') return null;
  if (index < 0 || index >= game.aiHand.length) return null;
  const card = game.aiHand.splice(index, 1)[0];
  game.aiPlay = card;
  if (game.deck.whites.length > 0) game.aiHand.push(game.deck.whites.pop());
  game.phase = 'reveal';
  game.history.push({
    round: game.round,
    black: game.currentBlack.text,
    humanCard: game.humanPlay,
    aiCard: game.aiPlay,
  });
  return { humanCard: game.humanPlay, aiCard: game.aiPlay, black: game.currentBlack };
}

function formatBlackCard(text) {
  return text.replace(/_/g, '______');
}

// ============================================================
// Discord Bot
// ============================================================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

const commands = [
  new SlashCommandBuilder().setName('deal').setDescription('Start a new game of Prompt & Response')
    .addStringOption(opt => opt.setName('pack').setDescription('Card pack filter (default: official)').setRequired(false)),
  new SlashCommandBuilder().setName('next').setDescription('Deal the next black card'),
  new SlashCommandBuilder().setName('stop').setDescription('Stop the game after this round'),
  new SlashCommandBuilder().setName('score').setDescription('Show game history and stats'),
  new SlashCommandBuilder().setName('hand').setDescription('View your current hand'),
  new SlashCommandBuilder().setName('packs').setDescription('List available card pack categories'),
];

client.once('ready', async () => {
  console.log(`🃏 Prompt & Response dealer online as ${client.user.tag}`);
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands.map(c => c.toJSON()) });
    console.log('✅ Slash commands registered');
  } catch (err) {
    console.error('Failed to register commands:', err);
  }
  if (AI_CHANNEL_ID) {
    const ch = client.channels.cache.get(AI_CHANNEL_ID);
    console.log(ch ? `🎯 AI channel: #${ch.name}` : '⚠️  AI channel not in cache yet');
  }
});

// --- Interactions ---
client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'deal') {
      const pack = interaction.options.getString('pack') || 'official';
      newGame(pack);
      const black = dealBlack();
      if (!black) return interaction.reply('❌ No black cards available.');

      const embed = new EmbedBuilder()
        .setColor(0x000000)
        .setTitle('🎴 Prompt & Response')
        .setDescription(`**Round ${game.round}**`)
        .addFields({ name: '⬛ PROMPT', value: formatBlackCard(black.text) })
        .setFooter({ text: `${game.deck.blacks.length} prompts · ${game.deck.whites.length} responses remaining` });

      await interaction.reply({ embeds: [embed] });
      await sendHandToHuman(interaction);
      return;
    }

    if (interaction.commandName === 'next') {
      if (!game) return interaction.reply('No game running. Use `/deal` to start.');
      if (game.phase !== 'reveal' && game.phase !== 'idle' && game.round > 0)
        return interaction.reply('⏳ Round still in progress!');

      const black = dealBlack();
      if (!black) return interaction.reply('🃏 No more prompts! Game over.');

      const embed = new EmbedBuilder()
        .setColor(0x000000)
        .setTitle(`Round ${game.round}`)
        .addFields({ name: '⬛ PROMPT', value: formatBlackCard(black.text) })
        .setFooter({ text: `${game.deck.blacks.length} prompts remaining` });

      await interaction.reply({ embeds: [embed] });
      await sendHandToHuman(interaction);
      return;
    }

    if (interaction.commandName === 'stop') {
      if (!game) return interaction.reply('No game running.');
      game.autoDeal = false;
      return interaction.reply('🛑 Auto-deal stopped. Use `/next` to continue manually or `/deal` for a new game.');
    }

    if (interaction.commandName === 'score') {
      if (!game || game.history.length === 0) return interaction.reply('No rounds played yet!');
      const lines = game.history.map((h, i) =>
        `**Round ${i + 1}:** ${formatBlackCard(h.black)}\n🧑 Human: ${h.humanCard}\n🤖 AI: ${h.aiCard}`
      );
      const embed = new EmbedBuilder().setColor(0x1a1a2e).setTitle('📜 Game History').setDescription(lines.join('\n\n'));
      return interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === 'packs') {
      const officialCount = PACKS.filter(p => p.official === true).length;
      const unofficialCount = PACKS.filter(p => p.official !== true).length;
      const totalWhite = ALL_WHITE.length;
      const totalBlack = ALL_BLACK.length;
      const msg = [
        '🃏 **Card Pack Options**',
        '',
        `\`/deal\` or \`/deal official\` — ${officialCount} official CAH packs`,
        `\`/deal all\` — ALL ${PACKS.length} packs (${totalWhite} white, ${totalBlack} black cards)`,
        `\`/deal [name]\` — Search packs by name`,
        '',
        '**Popular searches:** dirty, trump, humanity, cats, crabs, guards, profanity, maturity, kids, catholic, kiwi, weed, pride, theatre',
      ].join('\n');
      return interaction.reply(msg);
    }

    if (interaction.commandName === 'hand') {
      if (!game) return interaction.reply({ content: 'No game running.', ephemeral: true });
      if (interaction.user.id === HUMAN_USER_ID) {
        return sendHandToHuman(interaction, true);
      }
      return interaction.reply({ content: 'Check the AI hand channel.', ephemeral: true });
    }
  }

  // --- Human card selection from DM ---
  if (interaction.isStringSelectMenu() && interaction.customId === 'pick_card') {
    if (interaction.user.id !== HUMAN_USER_ID)
      return interaction.reply({ content: 'Not your cards!', ephemeral: true });
    if (!game || (game.phase !== 'prompt' && game.phase !== 'human_turn'))
      return interaction.reply({ content: 'Not your turn.', ephemeral: true });

    const cardIndex = parseInt(interaction.values[0]);
    const played = humanPlayCard(cardIndex);
    if (!played) return interaction.reply({ content: '❌ Invalid.', ephemeral: true });

    await interaction.update({
      content: `✅ You played: **${played}**\n\n⏳ Waiting for your AI...`,
      components: [],
    });

    // Notify game channel
    const gameChannel = client.channels.cache.get(GAME_CHANNEL_ID);
    if (gameChannel) await gameChannel.send('🔒 **Human** locked in. AI\'s turn...');

    // Send AI's hand to private channel
    await sendHandToAI();
    return;
  }
});

// --- Listen for AI's pick (message from AI bot in private channel) ---
client.on('messageCreate', async (message) => {
  if (message.channel.id !== AI_CHANNEL_ID) return;
  if (message.author.id !== AI_BOT_ID) return;
  if (!game || game.phase !== 'ai_turn') return;

  const content = message.content.trim();
  const num = parseInt(content.replace(/^pick\s*/i, ''));
  if (isNaN(num) || num < 1 || num > game.aiHand.length) {
    await message.reply('❌ Send a number 1-' + game.aiHand.length);
    return;
  }

  const result = aiPlayCard(num - 1);
  if (!result) {
    await message.reply('❌ Something went wrong.');
    return;
  }

  await message.reply(`✅ Locked in.`);
  await postReveal(result);
});

// --- Send hand to Human via DM ---
async function sendHandToHuman(interaction, ephemeral = false) {
  const hand = game.humanHand;
  if (!hand.length) return;

  const options = hand.map((card, i) => ({
    label: card.length > MAX_CARD_LENGTH ? card.substring(0, MAX_CARD_LENGTH - 3) + '...' : card,
    value: i.toString(),
  }));

  const select = new StringSelectMenuBuilder()
    .setCustomId('pick_card')
    .setPlaceholder('Pick your response...')
    .addOptions(options);

  const row = new ActionRowBuilder().addComponents(select);
  const promptText = game.currentBlack ? formatBlackCard(game.currentBlack.text) : 'No prompt';
  const content = `⬛ **${promptText}**\n\n🃏 **Your hand:**\n${hand.map((c, i) => `${i + 1}. ${c}`).join('\n')}`;

  try {
    if (ephemeral) {
      await interaction.reply({ content, components: [row], ephemeral: true });
    } else {
      const user = await client.users.fetch(HUMAN_USER_ID);
      await user.send({ content, components: [row] });
    }
  } catch (err) {
    console.error('Failed to send hand:', err.message);
  }
}

// --- Send hand to AI via private channel ---
async function sendHandToAI() {
  if (!AI_CHANNEL_ID) return console.error('No AI channel configured!');
  const channel = client.channels.cache.get(AI_CHANNEL_ID);
  if (!channel) return console.error('AI channel not found!');

  const hand = game.aiHand;
  const promptText = game.currentBlack ? formatBlackCard(game.currentBlack.text) : 'No prompt';
  const handList = hand.map((c, i) => `${i + 1}. ${c}`).join('\n');

  const msg = `PROMPT: ${promptText}\n\nYOUR HAND:\n${handList}\n\nPick by sending a number 1-${hand.length}`;

  await channel.send(msg);
  console.log('📤 Sent AI hand to private channel');
}

// --- Post Reveal ---
async function postReveal(result) {
  const channel = client.channels.cache.get(GAME_CHANNEL_ID);
  if (!channel) return;

  const prompt = formatBlackCard(result.black.text);
  const msg = `🎉 **Round ${game.round} Reveal!**\n\n⬛ ${prompt}\n\n🧑 Human played: **${result.humanCard}**\n🤖 AI played: **${result.aiCard}**`;

  await channel.send(msg);
  console.log(`🎉 Round ${game.round} reveal posted!`);

  // Auto-deal next round after 7 seconds
  setTimeout(async () => {
    try {
      if (!game || !game.autoDeal) return;
      if (game.deck.blacks.length === 0) {
        await channel.send('🃏 No more prompts! Game over.');
        return;
      }
      const black = dealBlack();
      if (!black) return;

      const prompt = formatBlackCard(black.text);
      await channel.send(`**Round ${game.round}**\n⬛ ${prompt}\n\n_${game.deck.blacks.length} prompts remaining_`);
      
      // Send hands
      const user = await client.users.fetch(HUMAN_USER_ID);
      const hand = game.humanHand;
      const options = hand.map((card, i) => ({
        label: card.length > MAX_CARD_LENGTH ? card.substring(0, MAX_CARD_LENGTH - 3) + '...' : card,
        value: i.toString(),
      }));
      const select = new StringSelectMenuBuilder()
        .setCustomId('pick_card')
        .setPlaceholder('Pick your response...')
        .addOptions(options);
      const row = new ActionRowBuilder().addComponents(select);
      const handContent = `⬛ **${prompt}**\n\n🃏 **Your hand:**\n${hand.map((c, i) => `${i + 1}. ${c}`).join('\n')}`;
      await user.send({ content: handContent, components: [row] });

      console.log(`🔄 Auto-dealt round ${game.round}`);
    } catch (err) {
      console.error(`❌ Auto-deal error (Round ${game?.round || '?'}):`, err.message);
      // Try to notify the game channel so players know
      try {
        await channel.send(`⚠️ Dealer hiccup — use \`/next\` to continue!`);
      } catch (_) {}
    }
  }, 7000);
}

client.login(TOKEN);
