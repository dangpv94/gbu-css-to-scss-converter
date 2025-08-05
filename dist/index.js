"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImprovedCSSToSCSSConverter = exports.AdvancedCSSToSCSSConverter = exports.UltimateCSSToSCSSConverter = exports.default = exports.CSSToSCSSConverter = void 0;
var variable_enhanced_converter_1 = require("./variable-enhanced-converter");
Object.defineProperty(exports, "CSSToSCSSConverter", { enumerable: true, get: function () { return variable_enhanced_converter_1.VariableEnhancedCSSToSCSSConverter; } });
var variable_enhanced_converter_2 = require("./variable-enhanced-converter");
Object.defineProperty(exports, "default", { enumerable: true, get: function () { return variable_enhanced_converter_2.VariableEnhancedCSSToSCSSConverter; } });
// Legacy exports
var ultimate_converter_1 = require("./ultimate-converter");
Object.defineProperty(exports, "UltimateCSSToSCSSConverter", { enumerable: true, get: function () { return ultimate_converter_1.UltimateCSSToSCSSConverter; } });
var advanced_converter_1 = require("./advanced-converter");
Object.defineProperty(exports, "AdvancedCSSToSCSSConverter", { enumerable: true, get: function () { return advanced_converter_1.AdvancedCSSToSCSSConverter; } });
var improved_converter_1 = require("./improved-converter");
Object.defineProperty(exports, "ImprovedCSSToSCSSConverter", { enumerable: true, get: function () { return improved_converter_1.ImprovedCSSToSCSSConverter; } });
//# sourceMappingURL=index.js.map