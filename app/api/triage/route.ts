import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  AI_MAX_QUERY_LENGTH,
  AI_MODEL_ID,
  AI_TEMPERATURE,
  AI_TIMEOUT_MS,
} from '../../../config/ai';
import type { SupportedLang } from '../../../config/missionComms';
import type { MissionProfileId } from '../../../types/mission';
import {
  generateClinicalPrompt,
  TelemetryPayload,
} from '../../../utils/systemPrompt';

interface TriageRequestBody {
  query?: string;
  telemetry?: TelemetryPayload;
  missionProfileId?: MissionProfileId;
  lang?: SupportedLang;
}

let cachedGenAI: GoogleGenerativeAI | null = null;
let cachedKey: string | null = null;

function getGenAIClient(apiKey: string): GoogleGenerativeAI {
  if (!cachedGenAI || cachedKey !== apiKey) {
    cachedGenAI = new GoogleGenerativeAI(apiKey);
    cachedKey = apiKey;
  }
  return cachedGenAI;
}

export async function POST(req: NextRequest) {
  const abortController = new AbortController();
  const timeoutId = setTimeout(
    () => abortController.abort(),
    AI_TIMEOUT_MS
  );

  try {
    const body = (await req.json()) as TriageRequestBody;
    const { query, telemetry, missionProfileId, lang } = body;

    if (
      !query ||
      typeof query !== 'string' ||
      !query.trim() ||
      !telemetry ||
      typeof telemetry !== 'object'
    ) {
      return NextResponse.json(
        { error: 'Missing query or telemetry' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured on the server' },
        { status: 500 }
      );
    }

    const sanitizedQuery = query.trim().slice(0, AI_MAX_QUERY_LENGTH);
    const genAI = getGenAIClient(apiKey);

    const model = genAI.getGenerativeModel({
      model: AI_MODEL_ID,
      systemInstruction: generateClinicalPrompt(telemetry, {
        missionProfileId,
        lang,
      }),
      generationConfig: {
        temperature: AI_TEMPERATURE,
      },
    });

    const result = await model.generateContent(sanitizedQuery, {
      signal: abortController.signal,
    });
    const responseText = result.response.text();

    return NextResponse.json(
      {
        response: responseText,
        model: AI_MODEL_ID,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error('[ExoVitals Triage API Error]:', error);

    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Clinical AI request timed out after 15 seconds' },
        { status: 504 }
      );
    }

    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Internal server error processing clinical triage';

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  } finally {
    clearTimeout(timeoutId);
  }
}
