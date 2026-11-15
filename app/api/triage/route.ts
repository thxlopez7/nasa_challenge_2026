import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  AI_MAX_QUERY_LENGTH,
  AI_MODEL_ID,
  AI_MODEL_LABEL,
  AI_TEMPERATURE,
  AI_TIMEOUT_MS,
} from '../../../config/ai';
import type { SupportedLang } from '../../../config/missionComms';
import type { MissionProfileId } from '../../../types/mission';
import {
  generateClinicalPrompt,
  type TelemetryPayload,
} from '../../../utils/systemPrompt';

const TriageRequestSchema = z.object({
  query: z.string().trim().min(1, 'El campo query no puede estar vacío.').max(20000),
  telemetry: z.record(z.string(), z.unknown()).optional().default({}),
  missionProfileId: z
    .enum(['ISS_6M', 'LUNAR_ARTEMIS', 'MARS_CONJUNCTION'])
    .optional(),
  lang: z.enum(['es', 'en']).optional(),
  simulateOffline: z.boolean().optional(),
});

const AiSuggestionSchema = z.object({
  summary: z.string().trim().min(1).max(1600),
  differentialConsiderations: z.array(z.string().trim().min(1).max(280)).max(5).default([]),
  questionsForCrew: z.array(z.string().trim().min(1).max(240)).max(4).default([]),
  cautionNote: z.string().trim().min(1).max(360).optional(),
});

type AiSuggestion = z.infer<typeof AiSuggestionSchema>;

function getGenAIClient(apiKey: string): GoogleGenerativeAI {
  return new GoogleGenerativeAI(apiKey);
}

function tryParseStructuredSuggestion(rawText: string): AiSuggestion | null {
  const cleaned = rawText
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  if (!cleaned.startsWith('{')) return null;

  try {
    const parsedJson: unknown = JSON.parse(cleaned);
    const result = AiSuggestionSchema.safeParse(parsedJson);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function formatSuggestionAsText(
  suggestion: AiSuggestion,
  lang: SupportedLang
): string {
  const lines: string[] = [suggestion.summary];

  if (suggestion.differentialConsiderations.length > 0) {
    lines.push(
      lang === 'en'
        ? '\nDifferential & Non-Alert Context:'
        : '\nConsideraciones y diagnóstico diferencial:'
    );
    suggestion.differentialConsiderations.forEach((item) => {
      lines.push(`• ${item}`);
    });
  }

  if (suggestion.questionsForCrew.length > 0) {
    lines.push(
      lang === 'en'
        ? '\nQuick Checks to Verify:'
        : '\nPreguntas / verificaciones rápidas:'
    );
    suggestion.questionsForCrew.forEach((q, idx) => {
      lines.push(`${idx + 1}. ${q}`);
    });
  }

  if (suggestion.cautionNote) {
    lines.push(`\n⚠ ${suggestion.cautionNote}`);
  }

  return lines.join('\n');
}

export async function POST(req: NextRequest) {
  const abortController = new AbortController();
  const timeoutId = setTimeout(
    () => abortController.abort('TIMEOUT'),
    AI_TIMEOUT_MS
  );

  try {
    const rawBody: unknown = await req.json();
    const parsedRequest = TriageRequestSchema.safeParse(rawBody);

    if (!parsedRequest.success) {
      clearTimeout(timeoutId);
      return NextResponse.json(
        {
          error:
            parsedRequest.error.issues[0]?.message ??
            'Carga JSON inválida para triaje.',
        },
        { status: 400 }
      );
    }

    const { query, telemetry, missionProfileId, lang, simulateOffline } =
      parsedRequest.data;

    if (simulateOffline) {
      clearTimeout(timeoutId);
      return NextResponse.json(
        {
          error: 'Simulated Earth-link loss active (offline mode).',
          offline: true,
        },
        { status: 503 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      clearTimeout(timeoutId);
      return NextResponse.json(
        { error: 'GEMINI_API_KEY no configurada en entorno.' },
        { status: 500 }
      );
    }

    const sanitizedQuery = query.slice(0, AI_MAX_QUERY_LENGTH);
    const resolvedLang: SupportedLang = lang === 'en' ? 'en' : 'es';
    const resolvedProfile: MissionProfileId =
      missionProfileId ?? 'MARS_CONJUNCTION';

    const baseInstruction = generateClinicalPrompt(
      telemetry as TelemetryPayload,
      {
        missionProfileId: resolvedProfile,
        lang: resolvedLang,
      }
    );

    const jsonSchemaHint =
      resolvedLang === 'en'
        ? `\n\nRespond ONLY with a valid JSON object matching this exact schema (no markdown fence): {"summary": string, "differentialConsiderations": string[], "questionsForCrew": string[], "cautionNote": string}. Remind crew this is an AI suggestion, not a deterministic clinical alert.`
        : `\n\nResponde ÚNICAMENTE con un objeto JSON válido con este esquema exacto (sin bloques markdown): {"summary": string, "differentialConsiderations": string[], "questionsForCrew": string[], "cautionNote": string}. Recuerda que esto es una sugerencia de IA, no una alerta determinista.`;

    const genAI = getGenAIClient(apiKey);
    const model = genAI.getGenerativeModel({
      model: AI_MODEL_ID,
      systemInstruction: `${baseInstruction}${jsonSchemaHint}`,
      generationConfig: {
        temperature: AI_TEMPERATURE,
        responseMimeType: 'application/json',
      },
    });

    const result = await model.generateContent(sanitizedQuery, {
      signal: abortController.signal,
    });

    const rawText = result.response.text();
    const structured = tryParseStructuredSuggestion(rawText);

    const fallbackSummary = rawText
      .replace(/^```(?:json)?/gi, '')
      .replace(/```$/g, '')
      .trim()
      .slice(0, 1500);

    const finalSuggestion: AiSuggestion = structured ?? {
      summary:
        fallbackSummary ||
        (resolvedLang === 'en'
          ? 'Unable to parse structured AI suggestion; rely on deterministic Onboard Local Triage.'
          : 'No se pudo validar JSON estructurado; priorizar el Triaje Local determinista de a bordo.'),
      differentialConsiderations: [],
      questionsForCrew: [],
      cautionNote:
        resolvedLang === 'en'
          ? 'AI suggestion only — not a deterministic clinical alert.'
          : 'Sugerencia de IA, no es una alerta clínica determinista.',
    };

    return NextResponse.json(
      {
        response: formatSuggestionAsText(finalSuggestion, resolvedLang),
        suggestion: finalSuggestion,
        structuredValid: structured !== null,
        model: `${AI_MODEL_LABEL} (${AI_MODEL_ID})`,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const isAbort =
      error instanceof Error &&
      (error.name === 'AbortError' ||
        error.message.toLowerCase().includes('abort'));

    const errorMessage = isAbort
      ? 'Timeout de API Gemini (>15s). Priorizar Triaje Local de a bordo.'
      : error instanceof Error
        ? error.message
        : 'Error interno al procesar triaje clínico.';

    return NextResponse.json(
      { error: errorMessage },
      { status: isAbort ? 504 : 500 }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
