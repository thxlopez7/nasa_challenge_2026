import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  generateClinicalPrompt,
  TelemetryPayload,
} from '../../../utils/systemPrompt';

interface TriageRequestBody {
  query?: string;
  telemetry?: TelemetryPayload;
}

const MAX_QUERY_LENGTH = 6000;
const GEMINI_TIMEOUT_MS = 15_000;

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
    GEMINI_TIMEOUT_MS
  );

  try {
    const body = (await req.json()) as TriageRequestBody;
    const { query, telemetry } = body;

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

    const apiKey = process.env.GEMINI_API_KEY as string;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured on the server' },
        { status: 500 }
      );
    }

    const sanitizedQuery = query.trim().slice(0, MAX_QUERY_LENGTH);
    const genAI = getGenAIClient(apiKey);

    const model = genAI.getGenerativeModel({
      model: 'gemini-3-flash-preview',
      systemInstruction: generateClinicalPrompt(telemetry),
      generationConfig: {
        temperature: 0.2, // Determinismo clínico
      },
    });

    const result = await model.generateContent(sanitizedQuery, {
      signal: abortController.signal,
    });
    const responseText = result.response.text();

    return NextResponse.json(
      {
        response: responseText,
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
