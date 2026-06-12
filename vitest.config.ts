import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    testTimeout: 30000,
    hookTimeout: 30000,
    // Hermetic Firebase config: the cloud-sync runtime tests gate on
    // isFirebaseConfigured(), which reads VITE_FIREBASE_*. Without these the
    // suite only passed on machines with a populated .env.local. All network
    // access is mocked via __setLearningCloudSyncApiForTest, so dummy values
    // are never used for real connections.
    env: {
      VITE_FIREBASE_API_KEY: "test-api-key",
      VITE_FIREBASE_AUTH_DOMAIN: "test.firebaseapp.com",
      VITE_FIREBASE_PROJECT_ID: "blearn-test",
      VITE_FIREBASE_STORAGE_BUCKET: "blearn-test.appspot.com",
      VITE_FIREBASE_MESSAGING_SENDER_ID: "000000000000",
      VITE_FIREBASE_APP_ID: "1:000000000000:web:testappid",
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
