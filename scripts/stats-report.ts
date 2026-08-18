import { collectUsageStats } from "../src/server/stats/service";

const metrics = await collectUsageStats();
console.log(`生成时间：${metrics.generatedAt}`);
console.log(`注册用户：${metrics.registeredUsers}`);
console.log(`已验证用户：${metrics.verifiedUsers}`);
console.log(`DAU / WAU / MAU：${metrics.dau} / ${metrics.wau} / ${metrics.mau}`);
console.log(`成功诊断：${metrics.successfulDiagnoses}`);
console.log(`人均诊断：${metrics.averageDiagnosesPerRegisteredUser}`);
console.log(`七日回访：${metrics.sevenDayReturnUsers}`);
