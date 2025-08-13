import { GoogleGenAI, Content, Part } from "@google/genai";
import * as fs from "fs/promises";
import mime from "mime-types";
import { ProcessWithAiFunction, PayloadElement, FilePayload, AiMode, STREAMING_CHUNK_SIZE, TokenUsage } from "./types";
import dotenv from "dotenv";

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set in environment variables. Please add it to your .env file.");
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
const model = "gemini-2.5-pro";
const tools = [
    { urlContext: {} },
    { googleSearch: {} },
];

async function fileToPart(file: FilePayload): Promise<Part> {
    const buffer = await fs.readFile(file.file_path);
    const mimeType = mime.lookup(file.file_path);
    if (!mimeType) throw new Error(`Could not determine mime type for ${file.file_path}`);
    return {
        inlineData: {
            data: buffer.toString("base64"),
            mimeType,
        },
    };
}

// Gemini 2.5 Pro pricing per million tokens
const PRICING = {
    input: {
        standard: 1.25,  // ≤200k tokens
        extended: 2.50   // >200k tokens
    },
    output: {
        standard: 10.0,  // ≤200k tokens
        extended: 15.0   // >200k tokens
    }
};

export const processWithGemini: ProcessWithAiFunction = async (history, onStream, mode = 'light', language = 'en') => {
    console.log("<<< Processing with Gemini");

    const contents: Content[] = [];

    // Add system prompt based on mode and language
    const systemPrompts = {
        en: "You are a helpful AI assistant. Be concise and direct. Get straight to the point without sacrificing important details. Adapt your tone to match the user's speaking style - find a balance between neutral professionalism and their way of communicating. Stay concise unless they explicitly ask for more detail. Use plain text only - no markdown, no formatting.",
        ru: "Ты полезный AI-ассистент. Будь краток и точен. Переходи сразу к сути, сохраняя важные детали. Адаптируй свой тон под стиль общения пользователя - найди баланс между нейтральной вежливостью и его манерой общения. Оставайся кратким, если только не попросят подробнее. Используй только простой текст - без markdown, без форматирования."
    };

    contents.push({
        role: 'user',
        parts: [{ text: systemPrompts[language] }]
    });

    for (const item of history) {
        const role = item.from === 'bot' ? 'model' : 'user';
        const parts: Part[] = [];
        if ('message' in item) {
            parts.push({ text: item.message });
        } else {
            try {
                parts.push(await fileToPart(item));
            } catch (e) {
                parts.push({ text: `[system: could not process file ${item.file_path}]` });
            }
        }
        // Merge consecutive same-role messages
        const last = contents[contents.length - 1];
        if (last && last.role === role && Array.isArray(last.parts)) {
            last.parts.push(...parts);
        } else {
            contents.push({ role, parts });
        }
    }
    if (contents.length === 0) {
        const greetings = {
            en: "Hello there! How can I help you today?",
            ru: "Привет! Чем могу помочь?"
        };
        return { response: greetings[language] };
    }

    // Configure thinking budget based on mode
    const config = {
        thinkingConfig: { thinkingBudget: mode === 'light' ? 128 : -1 },
        tools,
    };

    try {
        const stream = await ai.models.generateContentStream({ model, config, contents });
        console.log("<<< Sent request");
        let fullText = '';
        let buffer = '';
        let hassentFirstNewline = false;
        let lastChunk: any = null;

        for await (const chunk of stream) {
            lastChunk = chunk;
            const chunkText = chunk.candidates?.[0]?.content?.parts?.[0]?.text || '';
            fullText += chunkText;
            buffer += chunkText;

            console.log("chunk >>>", chunkText);

            // Send immediately on first newline
            if (!hassentFirstNewline && buffer.includes('\n')) {
                const firstNewline = buffer.indexOf('\n');
                const chunkToSend = buffer.substring(0, firstNewline + 1);
                await onStream(chunkToSend, false);
                buffer = buffer.substring(firstNewline + 1);
                hassentFirstNewline = true;
                continue;
            }

            // After first newline, use normal chunking logic
            const shouldSend = buffer.length >= STREAMING_CHUNK_SIZE && buffer.includes('\n');
            if (shouldSend) {
                // Find the last newline to send a complete chunk
                const lastNewline = buffer.lastIndexOf('\n');
                const chunkToSend = buffer.substring(0, lastNewline + 1);
                await onStream(chunkToSend, false);
                buffer = buffer.substring(lastNewline + 1); // Keep remainder in buffer
            }
        }

        // Send final chunk if there's remaining content
        if (buffer.length > 0) {
            await onStream(buffer, true);
        } else {
            // Signal completion if all text was already sent
            await onStream('', true);
        }

        // Get token usage from the last chunk's usage metadata
        let tokenUsage: TokenUsage | undefined;

        const usage = lastChunk?.usageMetadata;

        if (usage) {
            const inputTokens = usage.promptTokenCount || 0;
            const outputTokens = usage.candidatesTokenCount || 0;

            // Calculate price based on token count thresholds
            const inputPrice = inputTokens > 200000 ? PRICING.input.extended : PRICING.input.standard;
            const outputPrice = outputTokens > 200000 ? PRICING.output.extended : PRICING.output.standard;

            // Calculate total cost in USD
            const inputCost = (inputTokens / 1_000_000) * inputPrice;
            const outputCost = (outputTokens / 1_000_000) * outputPrice;
            const totalCost = inputCost + outputCost;

            tokenUsage = {
                inputTokens,
                outputTokens,
                totalCost
            };
        }

        return { response: fullText || "[No response from Gemini]", tokenUsage };
    } catch (e) {
        console.error("Error processing with Gemini:", e);
        return { response: "Sorry, I had an issue with the AI. Please try again." };
    }
};
