import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { memoryApiPlugin } from "./src/server/memoryApi";
import { llmApiPlugin } from "./src/server/llmApi";
import { transcribeApiPlugin } from "./src/server/transcribeApi";
import { nexusApiPlugin } from "./src/server/nexusApi";
import { schedulerApiPlugin } from "./src/server/schedulerApi";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const memoryRoot = env.BIGBOSS_MEMORY_ROOT || "./memory";

  return {
    plugins: [
      react(),
      memoryApiPlugin({ root: memoryRoot }),
      llmApiPlugin({
        fccBaseUrl: env.FCC_BASE_URL,
        fccModel: env.FCC_MODEL,
        fccApiKey: env.FCC_API_KEY,
        ollamaBaseUrl: env.OLLAMA_BASE_URL,
        ollamaModel: env.OLLAMA_MODEL,
      }),
      transcribeApiPlugin({ whisperUrl: env.WHISPER_URL }),
      nexusApiPlugin({
        baseUrl: env.NEXUS_URL,
        email: env.NEXUS_EMAIL,
        password: env.NEXUS_PASSWORD,
      }),
      schedulerApiPlugin({
        memoryRoot,
        hourLocal: env.SCHEDULER_HOUR ? Number(env.SCHEDULER_HOUR) : 9,
        enabled: env.SCHEDULER_ENABLED !== "false",
        fccBaseUrl: env.FCC_BASE_URL,
        fccModel: env.FCC_MODEL,
        fccApiKey: env.FCC_API_KEY,
        ollamaBaseUrl: env.OLLAMA_BASE_URL,
        ollamaModel: env.OLLAMA_MODEL,
      }),
    ],
    test: {
      environment: "node",
    },
  };
});
