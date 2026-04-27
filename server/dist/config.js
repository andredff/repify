"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.config = {
    port: Number(process.env['PORT']) || 3000,
    supabaseUrl: process.env['SUPABASE_URL'] ?? '',
    supabaseServiceKey: process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '',
};
const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
for (const key of required) {
    if (!process.env[key]) {
        console.error(`[config] Missing required env var: ${key}`);
        process.exit(1);
    }
}
