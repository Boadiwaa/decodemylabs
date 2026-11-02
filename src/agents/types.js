/**
 * Agent interface definitions — shared contract for all Decode My Labs agents.
 *
 * Every agent in src/agents/ MUST:
 *   1. Export a default object with { name: string, run: function }
 *   2. Call createAgentOutput() to build its return value
 *   3. Never return null — always return an AgentOutput (use low confidence
 *      and a fallback message if inference failed)
 *
 * AgentOutput shape:
 *   {
 *     agentName:  string,       // e.g. 'LabInterpretationAgent'
 *     confidence: number,       // 0–1, where <0.5 means the model was uncertain
 *     output:     object,       // agent-specific structured result
 *     reasoning:  string,       // model's chain-of-thought (may be empty)
 *     citations:  string[],     // source references if any
 *     warnings:   string[],     // safety/disclaimer messages
 *     timestamp:  string,       // ISO 8601
 *   }
 */

/**
 * Factory function to create a standardised AgentOutput.
 * Use this in every agent's run() method instead of building the object manually.
 *
 * @param {string} agentName   - Agent identifier (use the file/class name)
 * @param {object} output      - The agent's main result payload
 * @param {object} [options]   - Optional overrides
 * @param {number} [options.confidence=0.8]
 * @param {string} [options.reasoning='']
 * @param {string[]} [options.citations=[]]
 * @param {string[]} [options.warnings]    - Defaults to prototype disclaimer
 * @returns {AgentOutput}
 */
export function createAgentOutput(agentName, output, options = {}) {
  return {
    agentName,
    confidence: options.confidence ?? 0.8,
    output,
    reasoning: options.reasoning ?? '',
    citations: options.citations ?? [],
    // Always include the prototype safety disclaimer unless explicitly overridden
    warnings: options.warnings ?? ['Prototype output — not for clinical use'],
    timestamp: new Date().toISOString(),
  };
}

/**
 * Validate that an AgentOutput contains all required fields.
 * Used by AgentOrchestrator to discard malformed outputs before rendering.
 *
 * @param {object} output - The output to validate
 * @returns {boolean} true if valid
 */
export function validateAgentOutput(output) {
  const required = ['agentName', 'confidence', 'output', 'reasoning', 'warnings', 'timestamp'];
  return required.every(field => output[field] !== undefined);
}