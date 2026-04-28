"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const config_1 = require("./config");
const health_route_1 = __importDefault(require("./routes/health.route"));
const checkin_route_1 = __importDefault(require("./routes/checkin.route"));
const profile_route_1 = __importDefault(require("./routes/profile.route"));
const posts_route_1 = __importDefault(require("./routes/posts.route"));
const users_route_1 = __importDefault(require("./routes/users.route"));
const notifications_route_1 = __importDefault(require("./routes/notifications.route"));
const ranking_route_1 = __importDefault(require("./routes/ranking.route"));
const workouts_route_1 = __importDefault(require("./routes/workouts.route"));
const upload_route_1 = __importDefault(require("./routes/upload.route"));
const app = (0, express_1.default)();
// ── Security & parsing ──────────────────────────────────────────────────────
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            ...helmet_1.default.contentSecurityPolicy.getDefaultDirectives(),
            'img-src': ["'self'", 'data:', 'https://*.supabase.co'],
        },
    },
}));
const allowedOrigins = [
    'http://localhost:4200',
    'http://localhost:4201',
    ...(process.env['CORS_ORIGINS']?.split(',').map(o => o.trim()).filter(Boolean) ?? []),
];
app.use((0, cors_1.default)({
    origin: (origin, cb) => {
        // Permite requests sem Origin (curl, mobile webviews) e qualquer origem na whitelist
        if (!origin || allowedOrigins.includes(origin))
            return cb(null, true);
        cb(new Error(`CORS blocked: ${origin}`));
    },
}));
app.use(express_1.default.json({ limit: '1mb' }));
app.use(express_1.default.urlencoded({ extended: false }));
// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/health', health_route_1.default);
app.use('/api/checkin', checkin_route_1.default);
app.use('/api/profile', profile_route_1.default);
app.use('/api/posts', posts_route_1.default);
app.use('/api/users', users_route_1.default);
app.use('/api/notifications', notifications_route_1.default);
app.use('/api/ranking', ranking_route_1.default);
app.use('/api/workouts', workouts_route_1.default);
app.use('/api/upload', upload_route_1.default);
// ── 404 fallback ────────────────────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ error: 'Not found.' });
});
// ── Start ────────────────────────────────────────────────────────────────────
app.listen(config_1.config.port, () => {
    console.log(`[repify-server] running on http://localhost:${config_1.config.port}`);
});
exports.default = app;
