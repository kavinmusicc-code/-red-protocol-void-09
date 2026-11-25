export const PROFILES = {
  lite: {
    id: "lite",
    fpsCap: 30,
    enableGlow: false,
    enableParticles: false,
    scanIntervalMs: 350,
    maxContextMessages: 12
  },
  balanced: {
    id: "balanced",
    fpsCap: 45,
    enableGlow: true,
    enableParticles: false,
    scanIntervalMs: 200,
    maxContextMessages: 24
  },
  full: {
    id: "full",
    fpsCap: 60,
    enableGlow: true,
    enableParticles: true,
    scanIntervalMs: 100,
    maxContextMessages: 50
  }
};

export function getProfile(name = "lite") {
  return PROFILES[name] || PROFILES.lite;
}
