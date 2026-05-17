import type { Clock } from "../../application/clock";

export const systemClock: Clock = () => Math.floor(Date.now() / 1000);
