Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "SequelizeAuto", {
    enumerable: true,
    get: function() {
        return SequelizeAuto;
    }
});
const _lodash = /*#__PURE__*/ _interop_require_default(require("lodash"));
const _sequelize = require("sequelize");
const _autobuilder = require("./auto-builder");
const _autogenerator = require("./auto-generator");
const _autorelater = require("./auto-relater");
const _autowriter = require("./auto-writer");
const _dialects = require("./dialects/dialects");
function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {
    try {
        var info = gen[key](arg);
        var value = info.value;
    } catch (error) {
        reject(error);
        return;
    }
    if (info.done) {
        resolve(value);
    } else {
        Promise.resolve(value).then(_next, _throw);
    }
}
function _async_to_generator(fn) {
    return function() {
        var self = this, args = arguments;
        return new Promise(function(resolve, reject) {
            var gen = fn.apply(self, args);
            function _next(value) {
                asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value);
            }
            function _throw(err) {
                asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err);
            }
            _next(undefined);
        });
    };
}
function _define_property(obj, key, value) {
    if (key in obj) {
        Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    } else {
        obj[key] = value;
    }
    return obj;
}
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
class SequelizeAuto {
    run() {
        var _this = this;
        return _async_to_generator(function*() {
            let td = yield _this.build();
            td = _this.relate(td);
            const tt = _this.generate(td);
            td.text = tt;
            yield _this.write(td);
            return td;
        })();
    }
    build() {
        const builder = new _autobuilder.AutoBuilder(this.sequelize, this.options);
        return builder.build().then((tableData)=>{
            if (this.options.closeConnectionAutomatically) {
                return this.sequelize.close().then(()=>tableData);
            }
            return tableData;
        });
    }
    relate(td) {
        const relater = new _autorelater.AutoRelater(this.options);
        return relater.buildRelations(td);
    }
    generate(tableData) {
        const dialect = _dialects.dialects[this.sequelize.getDialect()];
        const generator = new _autogenerator.AutoGenerator(tableData, dialect, this.options);
        return generator.generateText();
    }
    write(tableData) {
        const writer = new _autowriter.AutoWriter(tableData, this.options);
        return writer.write();
    }
    getDefaultPort(dialect) {
        switch(dialect){
            case 'mssql':
                return 1433;
            case 'postgres':
                return 5432;
            default:
                return 3306;
        }
    }
    constructor(database, username, password, options){
        _define_property(this, "sequelize", void 0);
        _define_property(this, "options", void 0);
        if (options && options.dialect === 'sqlite' && !options.storage && database) {
            options.storage = database;
        }
        if (options && options.dialect === 'mssql') {
            // set defaults for tedious, to silence the warnings
            options.dialectOptions = options.dialectOptions || {};
            options.dialectOptions.options = options.dialectOptions.options || {};
            options.dialectOptions.options.trustServerCertificate = true;
            options.dialectOptions.options.enableArithAbort = true;
            options.dialectOptions.options.validateBulkLoadParameters = true;
        }
        if (database instanceof _sequelize.Sequelize) {
            this.sequelize = database;
        } else {
            this.sequelize = new _sequelize.Sequelize(database, username, password, options || {});
        }
        this.options = _lodash.default.extend({
            spaces: true,
            indentation: 2,
            directory: './models',
            additional: {},
            host: 'localhost',
            port: this.getDefaultPort(options.dialect),
            closeConnectionAutomatically: true
        }, options || {});
        if (!this.options.directory) {
            this.options.noWrite = true;
        }
    }
}
module.exports = SequelizeAuto;
module.exports.SequelizeAuto = SequelizeAuto;
module.exports.default = SequelizeAuto;
