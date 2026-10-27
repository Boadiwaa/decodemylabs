/**
 * AgentOrchestrator — manages and sequences all AI agents in the pipeline.
 *
 * Agents are registered once at app startup and then run together for each
 * lab analysis request. By keeping the orchestrator separate from individual
 * agents, new agents (e.g. a DietaryAdviceAgent, a TrendForecastAgent) can
 * be added without changing any other code — just call register().
 *
 * Data flow:
 *   PatientDetailScreen
 *     → orchestrator.runAll({ patient, lab, trend, mode })
 *       → LabInterpretationAgent.run()   (Gemma inference)
 *       → [future agents...]
 *     ← array of validated AgentOutput objects
 *     → rendered in PatientDetailScreen / AIInsightCard
 */

import { validateAgentOutput } from './types';

export class AgentOrchestrator {
  constructor() {
    // Ordered list of registered agents. Agents run sequentially (not in
    // parallel) to avoid overwhelming the on-device LLM context.
    this.agents = [];
  }

  /**
   * Register an agent with the orchestrator.
   * Agents must conform to the interface defined in types.js:
   *   { name: string, run: (input) => Promise<AgentOutput> }
   *
   * @param {object} agent - Agent instance conforming to the agent interface
   */
  register(agent) {
    this.agents.push(agent);
  }

  /**
   * Run all registered agents against the given input.
   * Each agent runs independently — if one fails, the others still run.
   * Invalid outputs (missing required fields) are discarded with a warning.
   *
   * @param {object} input - Shared input for all agents:
   *   @param {object} input.patient      - Patient demographics + profile
   *   @param {object} input.lab          - Single parsed lab result to interpret
   *   @param {object} [input.trend]      - Historical trend data for this test
   *   @param {string} [input.mode]       - 'patient' (currently only mode)
   * @returns {Promise<AgentOutput[]>} Array of validated outputs from each agent
   */
  async runAll(input) {
    const results = [];

    for (const agent of this.agents) {
      try {
        const output = await agent.run(input);

        // Only pass through outputs that satisfy the required field contract.
        // This prevents downstream components from crashing on partial output.
        if (validateAgentOutput(output)) {
          results.push(output);
        } else {
          console.warn(`[AgentOrchestrator] Agent ${agent.name} produced invalid output — skipping`);
        }
      } catch (error) {
        // Isolated failure: log and continue so other agents still run.
        // The UI will fall back to rule-based display if no agent succeeds.
        console.error(`[AgentOrchestrator] Agent ${agent.name} failed:`, error);
      }
    }

    return results;
  }
}