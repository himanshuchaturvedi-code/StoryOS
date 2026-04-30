"use strict";
/**
 * @storyos/database
 *
 * Exports:
 * 1. Prisma-generated client (PrismaClient, all model types, enums)
 *    — requires `npm run db:generate` to be run first
 * 2. Soft-delete middleware
 * 3. Temporal query helpers
 *
 * Usage in apps/api:
 *   import { PrismaClient } from '@storyos/database';
 *   import { softDeleteMiddleware } from '@storyos/database';
 *   import { asOf, currentlyEffective } from '@storyos/database';
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activeOn = exports.activeDuring = exports.currentlyEffective = exports.asOf = exports.applySoftDelete = void 0;
// Generated Prisma client — run `npm run db:generate` from repo root if this fails
__exportStar(require("./generated/prisma"), exports);
// Soft-delete extension (Prisma 6+)
var soft_delete_1 = require("./middleware/soft-delete");
Object.defineProperty(exports, "applySoftDelete", { enumerable: true, get: function () { return soft_delete_1.applySoftDelete; } });
// Temporal helpers
var temporal_1 = require("./helpers/temporal");
Object.defineProperty(exports, "asOf", { enumerable: true, get: function () { return temporal_1.asOf; } });
Object.defineProperty(exports, "currentlyEffective", { enumerable: true, get: function () { return temporal_1.currentlyEffective; } });
Object.defineProperty(exports, "activeDuring", { enumerable: true, get: function () { return temporal_1.activeDuring; } });
Object.defineProperty(exports, "activeOn", { enumerable: true, get: function () { return temporal_1.activeOn; } });
//# sourceMappingURL=index.js.map