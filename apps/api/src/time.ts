export type Clock = () => number;

export const systemClock: Clock = () => Math.floor(Date.now() / 1000);
