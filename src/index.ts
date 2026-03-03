import { config } from "./config.js";

const command = process.argv[2] ?? "status";

async function main() {
  console.log(`[hycu] command=${command} user=${config.userId}`);

  switch (command) {
    case "login": {
      const { login } = await import("./login.js");
      await login();
      const { syncToDashboard: syncLogin } = await import("./sync.js");
      await syncLogin({ action: 'login', timestamp: new Date().toISOString(), success: true, message: 'Login completed' });
      break;
    }
    case "attend": {
      const { attend } = await import("./attend.js");
      await attend();
      const { syncToDashboard: syncAttend } = await import("./sync.js");
      await syncAttend({ action: 'attend', timestamp: new Date().toISOString(), success: true, message: 'Attendance completed' });
      break;
    }
    case "status": {
      const { status } = await import("./status.js");
      const courses = await status();
      const { syncToDashboard: syncStatus } = await import("./sync.js");
      await syncStatus({ action: 'status', timestamp: new Date().toISOString(), courses, success: true });
      break;
    }
    default:
      console.error(`Unknown command: ${command}`);
      console.error("Usage: hycu [login|attend|status]");
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("[hycu] fatal:", err);
  process.exit(1);
});
