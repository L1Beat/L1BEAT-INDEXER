export type TextPayload = {
    message: string;
    from: 'user' | 'bot';
}

export type FilePayload = {
    file_path: string;
    from: 'user' | 'bot';
}

export type PayloadElement = TextPayload | FilePayload;

export type AiMode = 'light' | 'heavy';

export type StreamCallback = (text: string, isComplete: boolean) => Promise<void>;

export type TokenUsage = {
    inputTokens: number;
    outputTokens: number;
    totalCost: number;
}

export type ProcessWithAiFunction = (
    history: PayloadElement[],
    onStream: StreamCallback,  // Required for streaming-only API
    mode?: AiMode,
    language?: 'ru' | 'en'
) => Promise<{ response: string; tokenUsage?: TokenUsage }>;

export const MAX_MESSAGE_LENGTH = 4096;
export const STREAMING_CHUNK_SIZE = MAX_MESSAGE_LENGTH * 0.7;
