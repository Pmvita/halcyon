import { getHalcyon } from "./index";

const app = await getHalcyon();
const health = await app.health();
console.log(`Halcyon seeded. Providers tracked: ${health.providers.length}.`);
