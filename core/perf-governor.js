import { getProfile } from "./profiles.js";

export class PerfGovernor {
  constructor(initialProfile = "lite") {
    this.current = getProfile(initialProfile);
  }

  apply(profileName) {
    this.current = getProfile(profileName);
    if (typeof document !== "undefined" && document.body) {
      document.body.dataset.perfProfile = this.current.id;
    }
    return this.current;
  }

  getConfig() {
    return { ...this.current };
  }
}

export const perfGovernor = new PerfGovernor("lite");
