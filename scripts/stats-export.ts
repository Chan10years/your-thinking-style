import { collectUsageStats } from "../src/server/stats/service";

console.log(JSON.stringify(await collectUsageStats(), null, 2));
