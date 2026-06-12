import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { fileURLToPath, URL } from "node:url";

// https://vitejs.dev/config/
export default defineConfig(() => {
  const webDevPort = 5173;
  const vendorChunks = [
    { name: "react-vendor", match: ["react/", "react-dom/", "scheduler/"] },
    { name: "firebase-firestore", match: ["firebase/firestore"] },
    { name: "firebase-auth", match: ["firebase/auth"] },
    { name: "firebase-app", match: ["firebase/app"] },
    { name: "firebase-shared", match: ["@firebase/", "firebase/"] },
    { name: "motion", match: ["framer-motion"] },
    { name: "radix", match: ["@radix-ui"] },
    { name: "query", match: ["@tanstack/react-query"] },
    { name: "forms", match: ["react-hook-form", "@hookform/resolvers", "zod", "input-otp"] },
    { name: "router", match: ["react-router", "@remix-run/router"] },
    { name: "icons", match: ["lucide-react"] },
    { name: "theme", match: ["next-themes", "sonner"] },
    { name: "capacitor", match: ["@capacitor"] },
    { name: "anime", match: ["animejs"] },
    { name: "alby", match: ["@getalby/", "nostr-tools", "@noble/", "@scure/"] },
    { name: "learning-engine", match: ["sql.js", "ts-fsrs", "fflate", "fzstd"] },
    { name: "ui-extras", match: ["cmdk", "embla-carousel-react", "react-day-picker", "react-resizable-panels", "vaul"] },
    { name: "utils", match: ["date-fns", "clsx", "class-variance-authority", "tailwind-merge"] },
  ] as const;

  return {
    base: "./",
    server: {
      host: "127.0.0.1",
      port: webDevPort,
      strictPort: true,
      hmr: {
        overlay: false,
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return undefined;
            const normalizedId = id.replace(/\\/g, "/");

            for (const chunk of vendorChunks) {
              if (chunk.match.some((pattern) => normalizedId.includes(pattern))) {
                return chunk.name;
              }
            }

            return "vendor-misc";
          },
        },
      },
    },
  };
});
