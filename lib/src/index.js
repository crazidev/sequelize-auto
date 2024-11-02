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
    AutoOptions: function() {
        return _types.AutoOptions;
    },
    CaseOption: function() {
        return _types.CaseOption;
    },
    FKRelation: function() {
        return _dialectoptions.FKRelation;
    },
    FKSpec: function() {
        return _dialectoptions.FKSpec;
    },
    SequelizeAuto: function() {
        return _auto.SequelizeAuto;
    },
    TableData: function() {
        return _types.TableData;
    },
    default: function() {
        return _default;
    }
});
const _auto = require("./auto");
const _dialectoptions = require("./dialects/dialect-options");
const _types = require("./types");
const _default = _auto.SequelizeAuto;
