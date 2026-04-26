"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabaseAdmin = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const config_1 = require("./config");
// Service-role client — full DB access, never expose to frontend
exports.supabaseAdmin = (0, supabase_js_1.createClient)(config_1.config.supabaseUrl, config_1.config.supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } });
