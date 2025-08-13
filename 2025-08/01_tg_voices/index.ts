import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import fs from 'fs/promises';
import path from 'path';
import { config } from 'dotenv';
import { processWithGemini } from './ai/gemini';
import { PayloadElement, ProcessWithAiFunction } from './ai/types';




config();

const processWithAiFunction: ProcessWithAiFunction = processWithGemini;

const DATA_DIR = process.env.DATA_DIR || './data/';
const BOT_TOKEN = process.env.BOT_TOKEN!;
const WEBHOOK_URL = process.env.WEBHOOK_URL!;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET!;
const PORT = Number(process.env.PORT) || 3000;

const bot = new Telegraf(BOT_TOKEN);

const MIN_PHOTO_SIDE = 500;
const MAX_HISTORY_ITEMS = 25;

// Map to store pending message timeouts for debouncing
const pendingResponses = new Map<number, NodeJS.Timeout>();

// Inactivity shutdown configuration
const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour
let lastActivityTime = Date.now();
let inactivityTimer: NodeJS.Timeout;

// Reset inactivity timer whenever there's activity
function resetInactivityTimer(): void {
    lastActivityTime = Date.now();

    // Clear existing timer
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
    }

    // Set new timer
    inactivityTimer = setTimeout(() => {
        console.log(`No activity for ${INACTIVITY_TIMEOUT_MS / 1000} seconds. Shutting down...`);
        process.exit(0);
    }, INACTIVITY_TIMEOUT_MS);
}

function getUserDir(userId: number): string {
    return path.join(DATA_DIR, 'history', userId.toString());
}

async function saveFile(userId: number, content: Buffer | string, extension: string, from: 'user' | 'bot'): Promise<string> {
    const dir = getUserDir(userId);
    await fs.mkdir(dir, { recursive: true });

    const timestamp = Date.now();
    const filename = `${timestamp}_${from}${extension}`;
    const filepath = path.join(dir, filename);

    await fs.writeFile(filepath, content);
    console.log(`Saved: ${filename}`);

    // Trim history to keep only the last MAX_HISTORY_ITEMS
    await trimHistory(userId);

    return filename;
}

async function trimHistory(userId: number): Promise<void> {
    const dir = getUserDir(userId);
    try {
        const files = await fs.readdir(dir);

        // Sort files by timestamp (newest first)
        const sortedFiles = files.sort((a, b) => {
            const timestampA = parseInt(a.split('_')[0]);
            const timestampB = parseInt(b.split('_')[0]);
            return timestampB - timestampA;
        });

        // Keep only the last MAX_HISTORY_ITEMS files
        if (sortedFiles.length > MAX_HISTORY_ITEMS) {
            const filesToDelete = sortedFiles.slice(MAX_HISTORY_ITEMS);
            for (const file of filesToDelete) {
                await fs.unlink(path.join(dir, file));
                console.log(`Deleted old history file: ${file}`);
            }
        }
    } catch (error) {
        console.error('Error trimming history:', error);
    }
}

async function downloadFile(fileId: string, userId: number, extension: string, from: 'user' | 'bot'): Promise<void> {
    const url = await bot.telegram.getFileLink(fileId);
    const response = await fetch(url.href);
    const buffer = Buffer.from(await response.arrayBuffer());

    await saveFile(userId, buffer, extension, from);
}

async function loadHistory(userId: number): Promise<PayloadElement[]> {
    const dir = getUserDir(userId);
    try {
        const files = (await fs.readdir(dir)).sort();
        const history: PayloadElement[] = [];

        for (const file of files) {
            const [_, from] = file.split('_');
            const role = from.startsWith('bot') ? 'bot' : 'user';
            const filePath = path.join(dir, file);
            const ext = path.extname(file);

            if (ext === '.txt') {
                const content = await fs.readFile(filePath, 'utf-8');
                history.push({ from: role, message: content });
            } else {
                history.push({ from: role, file_path: filePath });
            }
        }
        return history;
    } catch {
        return [];
    }
}

bot.command('new', async (ctx) => {
    console.log("/new >>>");
    resetInactivityTimer(); // Reset timer on command
    const dir = getUserDir(ctx.from.id);
    const isRussian = ctx.from.language_code === 'ru';

    try {
        await fs.rm(dir, { recursive: true, force: true });
    } catch { }

    await ctx.reply(isRussian ? 'История очищена!' : 'History cleared!');
});



// Helper function to save message content
async function saveMessageContent(msg: any, userId: number, ctx: any): Promise<boolean> {
    const isRussian = ctx.from.language_code === 'ru';
    const MAX_FILE_SIZE = 1024 * 1024 * 100; // 100MB

    try {
        // Save text content
        if ('text' in msg && msg.text) {
            await saveFile(userId, msg.text, '.txt', 'user');
        } else if ('caption' in msg && msg.caption) {
            await saveFile(userId, msg.caption, '.txt', 'user');
        }

        // Handle photo
        if ('photo' in msg && msg.photo) {
            let selectedPhoto = msg.photo.find((p: any) => p.width >= MIN_PHOTO_SIDE || p.height >= MIN_PHOTO_SIDE);
            if (!selectedPhoto) {
                selectedPhoto = msg.photo[msg.photo.length - 1];
            }
            await downloadFile(selectedPhoto.file_id, userId, '.jpg', 'user');
        }

        // Handle voice
        if ('voice' in msg && msg.voice) {
            await downloadFile(msg.voice.file_id, userId, '.ogg', 'user');
        }

        // Handle document
        if ('document' in msg && msg.document) {
            if ((msg.document.file_size || 0) > MAX_FILE_SIZE) {
                await ctx.reply(isRussian ? 'Файл слишком большой, сорян' : 'File too large');
                return false;
            }
            const ext = path.extname(msg.document.file_name || '') || '.file';
            await downloadFile(msg.document.file_id, userId, ext, 'user');
        }

        // Handle video (not supported)
        if ('video' in msg && msg.video) {
            await ctx.reply(isRussian ? 'Видео не поддерживается, сорян' : 'Video not supported');
            return false;
        }

        // Handle audio
        if ('audio' in msg && msg.audio) {
            if ((msg.audio.file_size || 0) > MAX_FILE_SIZE) {
                await ctx.reply(isRussian ? 'Аудио слишком большое, сорян' : 'Audio too large');
                return false;
            }
            const ext = path.extname(msg.audio.file_name || '') || '.mp3';
            await downloadFile(msg.audio.file_id, userId, ext, 'user');
        }

        return true;
    } catch (error) {
        console.error('Error saving message content:', error);
        return false;
    }
}

// Helper function to process AI response with retry
async function processAiResponse(ctx: any, userId: number, isRussian: boolean, maxRetries: number = 1): Promise<void> {
    // Random thinking messages
    const thinkingMessages = {
        en: [
            "on it! 🧠",
            "digging in... 🔍",
            "give me a sec 🤔",
            "sure thing, wait a sec ⚡",
            "let me think... 💭",
            "processing... 🎯",
            "working on it! 🔧",
            "one moment... ⏳",
            "let me see... 👀",
            "hang tight! 🎪"
        ],
        ru: [
            "уже думаю! 🧠",
            "копаюсь... 🔍",
            "секундочку 🤔",
            "конечно, подожди секунду ⚡",
            "дай подумать... 💭",
            "обрабатываю... 🎯",
            "работаю над этим! 🔧",
            "один момент... ⏳",
            "сейчас посмотрю... 👀",
            "держись! 🎪"
        ]
    };

    // Send initial thinking message
    const messages = isRussian ? thinkingMessages.ru : thinkingMessages.en;
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];

    try {
        await ctx.reply(randomMessage);
    } catch (e) {
        console.error("Failed to send thinking message:", e);
    }

    let attempts = 0;

    while (attempts <= maxRetries) {
        try {
            const history = await loadHistory(userId);

            const streamCallback = async (text: string, isComplete: boolean) => {
                console.log("streamCallback >>>", text);
                if (text) {
                    await ctx.reply(text);
                }
            };

            const lang = isRussian ? 'ru' : 'en';
            const result = await processWithAiFunction(history, streamCallback, 'heavy', lang);
            await saveFile(userId, result.response, '.txt', 'bot');

            // Send token usage info for user 96351452
            if (userId === 96351452 && result.tokenUsage) {
                const { inputTokens, outputTokens, totalCost } = result.tokenUsage;
                const tokenMessage = isRussian
                    ? `📊 Токены:\nВход: ${inputTokens.toLocaleString()}\nВыход: ${outputTokens.toLocaleString()}\n💰 Стоимость: $${totalCost.toFixed(6)}`
                    : `📊 Tokens:\nInput: ${inputTokens.toLocaleString()}\nOutput: ${outputTokens.toLocaleString()}\n💰 Cost: $${totalCost.toFixed(6)}`;
                await ctx.reply(tokenMessage);
            }

            return; // Success - exit function

        } catch (error) {
            console.error(`AI processing attempt ${attempts + 1} failed:`, error);

            if (attempts === 0) {
                // First failure
                await ctx.reply(
                    isRussian
                        ? 'Что-то пошло не так, пробую еще раз...'
                        : 'Something went wrong, trying once more...'
                );
            } else {
                // Second failure
                await ctx.reply(
                    isRussian
                        ? 'Я попытался два раза, но все еще не работает. Попробуйте позже или используйте команду /new для сброса истории.'
                        : 'I tried twice, but it still failed. Please try again later or use /new to reset history.'
                );
            }

            attempts++;
        }
    }
}

bot.on('message', async (ctx) => {
    resetInactivityTimer(); // Reset timer on message
    const userId = ctx.from.id;
    const msg = ctx.message;
    const isRussian = ctx.from.language_code === 'ru';

    // Save the message content
    const shouldContinue = await saveMessageContent(msg, userId, ctx);
    if (!shouldContinue) {
        return; // Stop if message type not supported or file too large
    }

    // Clear any existing timeout for this user
    const existingTimeout = pendingResponses.get(userId);
    if (existingTimeout) {
        clearTimeout(existingTimeout);
        console.log(`Debouncing response for user ${userId}`);
    }

    // Set a new timeout to respond after 2 seconds
    const timeout = setTimeout(async () => {
        pendingResponses.delete(userId);

        // Process and respond with retry logic
        await processAiResponse(ctx, userId, isRussian);
    }, 2000);

    pendingResponses.set(userId, timeout);
});

bot.launch({
    webhook: WEBHOOK_URL ? {
        domain: WEBHOOK_URL,
        port: PORT,
        path: `/webhook${WEBHOOK_SECRET}`,
    } : undefined
});

console.log(`Bot running on port ${PORT}`);
console.log(`Will auto-shutdown after ${INACTIVITY_TIMEOUT_MS / 1000 / 60} minutes of inactivity`);

// Start the inactivity timer
resetInactivityTimer();

process.once('SIGINT', () => {
    clearTimeout(inactivityTimer);
    bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
    clearTimeout(inactivityTimer);
    bot.stop('SIGTERM');
});
