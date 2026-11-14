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

export async function POST(req: NextRequest) {
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

    const genAI = new GoogleGenerativeAI(apiKey);

    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: generateClinicalPrompt(telemetry),
      generationConfig: {
        temperature: 0.2, // Determinismo clínico
      },
    });

    const result = await model.generateContent(query);
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
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Internal server error processing clinical triage';

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
