/**
 * Accelint AI Prompts - Scoring and Analysis Framework
 * Uses CHASE/SHAPE/MONITOR/AVOID classification system
 */

export interface OpportunityDetails {
  title: string;
  agency: string;
  naics?: string;
  psc?: string;
  type?: string;
  description: string;
}

export interface ScoringResponse {
  score: number;
  reason: string;
  tags: string[];
  bucket: 'CHASE' | 'SHAPE' | 'MONITOR' | 'AVOID';
  summary: string;
}

import { BD_PERSONA, getPersonaPromptPrefix } from './bd-persona.ts';

export const SAM_SCORING_PROMPT = (opp: OpportunityDetails): string => `${getPersonaPromptPrefix()}

SCORING RUBRIC (0–100):
• 80–100 (CHASE): Strong fit - AI/C2/Training/Readiness focus, high technical synergy with Neo Stack
• 60–79 (SHAPE): Partial fit - Adjacent tech, moderate opportunity value, worth positioning
• 40–59 (MONITOR): Weak fit - Supporting or tangential value, background awareness
• <40 (AVOID): Out-of-scope - Commodity, construction, or staff-augmentation only

CHASE (score 80-100):
- Strong alignment with Training Modernization, C2, AI Decision Systems, or Data Fabric
- DoD mission where software/AI/operator interfaces are central to delivery
- Clear technical requirements matching Neo Stack capabilities (CoreUX, CoreC2, CoreData, Conductor, Artemis)
- Training systems, readiness automation, or mission software interfaces

SHAPE (score 60-79):
- Partial alignment with Accelint domains, may have software/AI angle or teaming opportunity
- Mixed technical and non-technical elements, but software component is significant
- Worth positioning early or tracking for future capture

MONITOR (score 40-59):
- Minimal alignment with Accelint domains, mostly for market awareness
- Primarily hardware or services with minor software component
- Background intel, weak fit for Training/C2/AI focus

AVOID (score <40):
- Commodity contracts: ${BD_PERSONA.out_of_scope_domains.join(', ')}
- Pure hardware with no software/AI component
- Staff-augmentation only with no technical delivery
- Equipment maintenance without software/analytics

⚠️ CRITICAL HARD RULE: If this opportunity is primarily commodity, construction, vehicles, uniforms, janitorial, or staff-aug only, you MUST:
- Set bucket to "AVOID"
- Set score to 30 or less
- Include "commodity" or "out-of-scope" in tags

⚠️ THIN DESCRIPTION HANDLING: If the description is minimal or missing:
- Synthesize what this opportunity likely involves based on title, agency, NAICS code
- Provide a meaningful "summary" (2-3 sentences) based on inference
- Explain "reason" for the score even with limited information
- Do NOT return empty fields or "insufficient information" - always make your best assessment
- Use the NAICS code to infer the type of work (e.g., 541511 = software, 611430 = training)

Respond in strict JSON with this schema:
{
  "score": <number 0-100>,
  "reason": "<1–3 sentences explaining fit through the lens of accelerating readiness. NEVER leave empty.>",
  "tags": [<3-7 tags like "C2", "AI/ML", "training", "readiness", "CoreUX", "commodity", "out-of-scope", "thin-description", etc>],
  "bucket": "<CHASE | SHAPE | MONITOR | AVOID>",
  "summary": "<1–2 sentence plain-language summary describing what this opportunity is about. NEVER leave empty.>"
}

OPPORTUNITY TO SCORE:
Title: ${opp.title}
Agency: ${opp.agency}
NAICS: ${opp.naics || 'N/A'}
PSC: ${opp.psc || 'N/A'}
Type: ${opp.type || 'N/A'}
Description: ${opp.description.substring(0, 2000)}`;

export interface DailyBriefOpportunity {
  title: string;
  agency: string;
  ai_score: number;
  ai_bucket: string;
  ai_summary: string;
  posted_date: string;
  source: string;
}

export const DAILY_BRIEF_PROMPT = (opportunities: DailyBriefOpportunity[]): string => {
  const grouped = {
    CHASE: opportunities.filter(o => o.ai_bucket === 'CHASE' || o.ai_bucket === 'HIGH_PRIORITY'),
    SHAPE: opportunities.filter(o => o.ai_bucket === 'SHAPE' || o.ai_bucket === 'WATCH'),
    MONITOR: opportunities.filter(o => o.ai_bucket === 'MONITOR' || o.ai_bucket === 'INFO_ONLY'),
  };

  return `You are the Accelint AI core generating a daily intelligence brief for the Wolf Street BD platform.

ACCELINT MISSION: Accelerate readiness for the DoD through AI-driven training, decision support, and autonomy for warfighters.

PRIMARY DOMAINS:
1. Training Modernization & Readiness Automation
2. Command and Control (C2) Modernization  
3. AI-Driven Decision Systems and Simulation
4. Data Fabric Integration and Autonomy at the Edge

TECHNOLOGY ARCHITECTURE (Neo Stack):
- CoreUX: Operator-first interface layer
- CoreC2: Mission planning and execution libraries
- CoreData: Multi-tier data transformation
- Conductor: AI orchestration engine
- Artemis: Software factory backbone

PRIMARY ECOSYSTEMS: Air Force (CBC2, BCCs, CRCs, AOC), Army (IBCS/AMD), Joint (JADC2)

IMPORTANT: Some opportunities are from "The Hatch Report" newsletter - use advisory language like "consider whether this is a fit" rather than directive language.

Generate a concise daily intelligence brief based on these opportunities:

CHASE - Active Pursuit (${grouped.CHASE.length}):
${grouped.CHASE.slice(0, 10).map(o => `- ${o.title} (${o.agency}) - Score: ${o.ai_score} - ${o.ai_summary}${o.source?.toLowerCase().includes('hatch') ? ' [Hatch]' : ''}`).join('\n')}

SHAPE - Position Early (${grouped.SHAPE.length}):
${grouped.SHAPE.slice(0, 5).map(o => `- ${o.title} (${o.agency}) - Score: ${o.ai_score} - ${o.ai_summary}${o.source?.toLowerCase().includes('hatch') ? ' [Hatch]' : ''}`).join('\n')}

MONITOR - Background Awareness (${grouped.MONITOR.length}):
${grouped.MONITOR.slice(0, 5).map(o => `- ${o.title} (${o.agency}) - Score: ${o.ai_score}${o.source?.toLowerCase().includes('hatch') ? ' [Hatch]' : ''}`).join('\n')}

YOUR BRIEF SHOULD:
- Highlight 3–7 most important items tied to warfighter readiness, C2 modernization, or training innovation
- Call out themes/trends (agency focus, C2/training patterns, OTA opportunities)
- For Hatch items: Use advisory language
- Provide actionable insights (e.g., "Prime partner outreach needed", "Training modernization push in Air Force")
- Use short, skimmable bullets
- Emphasize where Accelint can plug in via Neo Stack capabilities

Return markdown text only, no JSON. Use headers, bullets, and emphasis.`;
};

export const SAM_SCORING_SYSTEM_PROMPT = getPersonaPromptPrefix();
