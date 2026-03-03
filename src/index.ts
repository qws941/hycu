import { config } from "./config.js";

const command = process.argv[2] ?? "status";

async function main() {
  console.log(`[hycu] command=${command} user=${config.userId}`);

  switch (command) {
    case "login": {
      const { login } = await import("./login.js");
      await login();
      break;
    }
    case "attend": {
      const { attend } = await import("./attend.js");
      await attend();
      break;
    }
    case "status": {
      const { status } = await import("./status.js");
      await status();
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
