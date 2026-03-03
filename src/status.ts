import { config } from "./config.js";

/**
 * Show current lecture/attendance status.
 *
 * Uses the LMS API endpoints discovered in the HAR:
 * - lms.hycu.ac.kr/api/wholeNoticeLessionList.do
 * - lms.hycu.ac.kr/api/selectStdProgressRatio.do
 *
 * These APIs require a session token. For now, just print config.
 * Full implementation will extract token from saved cookies and
 * call the APIs directly.
 */
export async function status(): Promise<void> {
  console.log("[status] HYCU LMS Status");
  console.log(`  User: ${config.userId} (${config.userName})`);
  console.log(`  FIDO Key ID: ${config.fido.keyId.substring(0, 8)}...`);
  console.log(`  SSO: ${config.urls.sso}`);
  console.log(`  Road: ${config.urls.road}`);
  console.log(`  LMS: ${config.urls.lms}`);

  // TODO: After login is implemented, read saved cookies,
  // extract LMS token, and call:
  // - GET lms.hycu.ac.kr/api/wholeNoticeLessionList.do?token=...&userNo=...&year=2026&semester=10
  // - GET lms.hycu.ac.kr/api/selectStdProgressRatio.do?token=...&userNo=...&progressType=C
  console.log("\n  Run 'login' to authenticate, then 'status' for live data.");
}
