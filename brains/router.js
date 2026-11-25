import { predatorBrain } from "./personas/predator.brain.js";
import { surgeonBrain } from "./personas/surgeon.brain.js";
import { llmBridge } from "./adapters/llm-bridge.js";

const BRAINS = {
  predator: predatorBrain,
  surgeon: surgeonBrain
};

export class BrainRouter {
  getBrain(brainId = "predator") {
    return BRAINS[brainId] || predatorBrain;
  }

  async ask({ prompt, brainId = "predator" }) {
    const persona = this.getBrain(brainId);
    return llmBridge.generate({
      prompt,
      systemPrompt: persona.systemPrompt,
      brain: persona.id
    });
  }
}

export const brainRouter = new BrainRouter();
