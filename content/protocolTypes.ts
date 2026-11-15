import type { RuleId } from '../config/rules';
import type { EscalationLevel } from '../types/telemetry';

export type ProtocolKey = RuleId | 'NOMINAL';

export interface OnboardProtocol {
  id: ProtocolKey;
  title: string;
  urgency: EscalationLevel;
  headline: string;
  immediateSteps: string[];
  redFlags: string[];
  whatNotToDo: string[];
  keywords: string[];
}
