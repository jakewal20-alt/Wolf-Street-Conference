/**
 * Accelint AI Core Context - Single Source of Truth
 * Defines the reasoning, scoring, and recommendation framework for all Lovable AI functions
 * in the Wolf Street / Accelint ecosystem.
 */

export interface BDPersona {
  name: string;
  mission: string;
  primary_domains: string[];
  neo_stack: {
    CoreUX: string;
    CoreC2: string;
    CoreData: string;
    Conductor: string;
    Artemis: string;
  };
  behavioral_rules: string[];
  out_of_scope_domains: string[];
  commodity_keywords: string[];
  // Backward compatibility properties
  focus_areas: string[];
  focus_description: string;
  out_of_scope_description: string;
}

export interface TagWeightings {
  [tag: string]: number;
}

/**
 * Bucket classifications for opportunity scoring
 */
export type OpportunityBucket = 'CHASE' | 'SHAPE' | 'MONITOR' | 'AVOID';

/**
 * Default tag weightings (1.0 = neutral baseline)
 * Values > 1.0 boost scoring, values < 1.0 reduce scoring
 * These are adaptive and will be refined by ai-feedback-loop
 */
export const DEFAULT_TAG_WEIGHTINGS: TagWeightings = {
  // HIGHEST PRIORITY: Training Modernization & Readiness
  "training modernization": 1.6,
  "readiness automation": 1.6,
  "adaptive training": 1.6,
  "operator training": 1.6,
  "warfighter readiness": 1.6,
  "training simulation": 1.5,
  "LVC training": 1.5,
  "synthetic training": 1.5,
  
  // HIGH PRIORITY: Command and Control (C2)
  "C2": 1.5,
  "JADC2": 1.5,
  "command and control": 1.5,
  "mission planning": 1.5,
  "mission execution": 1.5,
  "battle management": 1.5,
  "air defense": 1.4,
  "IBCS": 1.5,
  
  // HIGH PRIORITY: AI-Driven Decision Systems
  "AI": 1.5,
  "ML": 1.5,
  "AI/ML": 1.5,
  "decision support": 1.5,
  "decision systems": 1.5,
  "autonomy": 1.5,
  "human-machine teaming": 1.5,
  "predictive analytics": 1.4,
  "wargaming": 1.4,
  "simulation": 1.4,
  
  // HIGH PRIORITY: Data Fabric & Edge
  "data fabric": 1.5,
  "edge computing": 1.5,
  "data integration": 1.4,
  "data transformation": 1.4,
  "edge autonomy": 1.5,
  "disconnected ops": 1.4,
  "DDIL": 1.4,
  
  // PRIORITY: Operator Interface (CoreUX)
  "operator interface": 1.5,
  "HMI": 1.5,
  "human-machine interface": 1.5,
  "dashboard": 1.4,
  "UI/UX": 1.4,
  "visualization": 1.4,
  "front-end": 1.4,
  "operator display": 1.4,
  "mission software": 1.4,
  
  // MODERATE: Software Engineering
  "software": 1.3,
  "web app": 1.3,
  "DevSecOps": 1.3,
  "CI/CD": 1.3,
  "software factory": 1.3,
  "platform engineering": 1.3,
  "analytics": 1.3,
  
  // Out of scope tags (suppress heavily)
  "commodity": 0.3,
  "out-of-scope": 0.2,
  "staff-augmentation": 0.3,
  "uniforms": 0.1,
  "apparel": 0.1,
  "clothing": 0.1,
  "boots": 0.1,
  "vehicles": 0.1,
  "fleet": 0.1,
  "janitorial": 0.1,
  "custodial": 0.1,
  "cleaning": 0.1,
  "construction": 0.1,
  "paving": 0.1,
  "furniture": 0.1,
  "office supplies": 0.1,
};

export const BD_PERSONA: BDPersona = {
  name: "Accelint_AI_Core",
  mission: "Evaluate, score, and recommend actions that accelerate readiness for the DoD and its partners through AI-driven training, decision support, and autonomy for warfighters.",
  
  primary_domains: [
    "Training Modernization & Readiness Automation",
    "Command and Control (C2) Modernization",
    "AI-Driven Decision Systems and Simulation",
    "Data Fabric Integration and Autonomy at the Edge",
  ],
  
  neo_stack: {
    CoreUX: "Operator-first interface layer",
    CoreC2: "Mission planning and execution libraries",
    CoreData: "Multi-tier data transformation (Bronze–Silver–Gold)",
    Conductor: "AI orchestration engine using LLMs",
    Artemis: "Software factory and CI/CD backbone",
  },
  
  behavioral_rules: [
    "Always reason from the operator's perspective: human-in-the-loop AI.",
    "Prioritize training, C2, AI, and readiness modernization opportunities.",
    "Deprioritize commodity or non-technical bids.",
    "Use concise output; classify results as CHASE, SHAPE, MONITOR, or AVOID.",
    "Maintain clear, professional, defense-sector tone (no marketing fluff).",
  ],
  
  // Backward compatibility: focus_areas maps to primary_domains + Neo Stack capabilities
  focus_areas: [
    "Training Modernization & Readiness Automation",
    "Command and Control (C2) Modernization",
    "AI-Driven Decision Systems and Simulation",
    "Data Fabric Integration and Autonomy at the Edge",
    "Operator-first interface design (CoreUX)",
    "Mission planning and execution software (CoreC2)",
    "Data transformation pipelines (CoreData)",
    "AI orchestration and LLM integration (Conductor)",
    "Software factory and DevSecOps (Artemis)",
  ],
  
  focus_description: `Accelint accelerates readiness for the DoD through AI-driven training, decision support, and autonomy for warfighters. Core capabilities include Training Modernization & Readiness Automation, C2 Modernization, AI-Driven Decision Systems, and Data Fabric Integration. Technology architecture (Neo Stack): CoreUX (operator interfaces), CoreC2 (mission planning), CoreData (data transformation), Conductor (AI orchestration), Artemis (software factory).`,
  
  out_of_scope_description: `Uniforms, apparel, boots, vehicles, fleets, fuel, janitorial, custodial, cleaning, construction, paving, facilities work, commodity hardware/equipment, furniture, office supplies, staff-augmentation only contracts`,
  
  out_of_scope_domains: [
    "uniforms",
    "apparel",
    "boots",
    "hats",
    "patches",
    "clothing",
    "gear",
    "vehicles",
    "fleets",
    "buses",
    "trucks",
    "fuel",
    "oil",
    "janitorial",
    "custodial",
    "cleaning",
    "laundry",
    "construction",
    "paving",
    "facilities work",
    "commodity hardware",
    "equipment buys",
    "generic laptops",
    "printers",
    "chairs",
    "furniture",
    "office supplies",
    "mowing",
    "landscaping",
    "groundskeeping",
    "staff-augmentation only",
  ],
  
  commodity_keywords: [
    "uniform", "apparel", "clothing", "boot", "shoe", "helmet", "gear", "patch", "hat",
    "vehicle", "fleet", "bus", "truck", "fuel", "oil", "gasoline",
    "janitorial", "custodial", "cleaning", "laundry", "maid",
    "paving", "construction", "asphalt", "roofing", "mowing", "landscaping", "groundskeeping",
    "furniture", "chair", "desk", "table", "office supply", "printer", "toner",
    "commodity", "generic laptop", "generic computer", "generic equipment",
    "staff augmentation", "body shop",
  ],
};

/**
 * Check if opportunity text contains commodity keywords
 * Uses word boundary matching to avoid false positives like "table" in "database table"
 */
export function containsCommodityKeywords(text: string): boolean {
  const normalized = text.toLowerCase();
  
  return BD_PERSONA.commodity_keywords.some(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    return regex.test(normalized);
  });
}

/**
 * Apply tag weightings to a base score
 */
export function applyTagWeightings(baseScore: number, tags: string[], weightings: TagWeightings = DEFAULT_TAG_WEIGHTINGS): number {
  if (tags.length === 0) return baseScore;
  
  const tagMultipliers = tags
    .map(tag => weightings[tag.toLowerCase()] || weightings[tag] || 1.0)
    .filter(mult => mult > 0);
  
  if (tagMultipliers.length === 0) return baseScore;
  
  const avgMultiplier = tagMultipliers.reduce((sum, mult) => sum + mult, 0) / tagMultipliers.length;
  const adjustedScore = Math.min(100, Math.max(0, baseScore * avgMultiplier));
  
  return Math.round(adjustedScore);
}

/**
 * Detect high-value domain keywords (Training, C2, AI, Data Fabric)
 * Also exported as detectFrontEndSolutioning for backward compatibility
 */
export function detectPrimaryDomainFit(text: string): boolean {
  const normalized = text.toLowerCase();
  const domainKeywords = [
    // Training Modernization
    "training modernization", "readiness automation", "adaptive training", "operator training",
    "warfighter readiness", "lvc training", "synthetic training", "training system",
    // C2 Modernization
    "command and control", "c2 modernization", "jadc2", "mission planning", "mission execution",
    "battle management", "air defense", "ibcs",
    // AI Decision Systems
    "ai-driven", "decision support", "decision system", "human-machine teaming",
    "predictive analytics", "wargaming", "simulation", "autonomy",
    // Data Fabric
    "data fabric", "edge computing", "data integration", "edge autonomy", "ddil",
    // Operator Interface
    "operator interface", "operator display", "hmi", "human-machine interface",
    "dashboard modernization", "mission software", "combat interface"
  ];
  return domainKeywords.some(keyword => normalized.includes(keyword));
}

// Backward compatibility alias
export const detectFrontEndSolutioning = detectPrimaryDomainFit;

/**
 * Map score to bucket classification
 */
export function scoreToBucket(score: number): OpportunityBucket {
  if (score >= 80) return 'CHASE';
  if (score >= 60) return 'SHAPE';
  if (score >= 40) return 'MONITOR';
  return 'AVOID';
}

/**
 * Get the Accelint AI Core system prompt
 */
export function getPersonaPromptPrefix(): string {
  return `You are the embedded AI core for Accelint and the Wolf Street BD Intelligence platform.
Your purpose is to evaluate, score, and recommend actions that accelerate readiness for the DoD and its partners.
Always align reasoning with Accelint's mission of AI-driven training, decision support, and autonomy for warfighters.

PRIMARY DOMAINS:
1. Training Modernization & Readiness Automation
2. Command and Control (C2) Modernization
3. AI-Driven Decision Systems and Simulation
4. Data Fabric Integration and Autonomy at the Edge

TECHNOLOGY ARCHITECTURE (Neo Stack):
- CoreUX: Operator-first interface layer
- CoreC2: Mission planning and execution libraries
- CoreData: Multi-tier data transformation (Bronze–Silver–Gold)
- Conductor: AI orchestration engine using LLMs
- Artemis: Software factory and CI/CD backbone

BEHAVIORAL RULES:
- Always reason from the operator's perspective: human-in-the-loop AI.
- Prioritize training, C2, AI, and readiness modernization opportunities.
- Deprioritize commodity or non-technical bids.
- Use concise output; classify results as CHASE, SHAPE, MONITOR, or AVOID.
- Maintain clear, professional, defense-sector tone (no marketing fluff).

OUT OF SCOPE:
${BD_PERSONA.out_of_scope_domains.join(', ')}

SUMMARY OBJECTIVE:
Every evaluation must use this context as its decision baseline. When uncertain, reason through the lens of accelerating readiness via AI-driven training and decision systems.`;
}
