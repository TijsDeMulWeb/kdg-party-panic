import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    // The Laravel app (served by Herd). Proxying keeps the game and the API on
    // one origin, so the session cookie and CSRF protection just work.
    const backend = env.BACKEND_URL ?? 'http://party-panic.test';

    return {
        server: {
            port: 5173,
            host: true,
            proxy: {
                '/api': { target: backend, changeOrigin: true },
                '/broadcasting': { target: backend, changeOrigin: true },
            },
        },
        build: {
            target: 'es2022',
            chunkSizeWarningLimit: 800,
        },
    };
});
