Object.defineProperty(exports, "__esModule", {
    value: true
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    addTicks: function() {
        return addTicks;
    },
    makeCondition: function() {
        return makeCondition;
    }
});
const _sequelize = require("sequelize");
function addTicks(value) {
    return _sequelize.Utils.addTicks(value, "'");
}
function makeCondition(columnName, value) {
    return value ? ` AND ${columnName} = ${addTicks(value)} ` : "";
}
