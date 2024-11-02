"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addTicks = addTicks;
exports.makeCondition = makeCondition;
const sequelize_1 = require("sequelize");
function addTicks(value) {
    return sequelize_1.Utils.addTicks(value, "'");
}
function makeCondition(columnName, value) {
    return value ? ` AND ${columnName} = ${addTicks(value)} ` : "";
}
//# sourceMappingURL=dialect-options.js.map