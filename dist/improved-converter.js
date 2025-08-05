"use strict";
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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImprovedCSSToSCSSConverter = void 0;
const csstree = __importStar(require("css-tree"));
class ImprovedCSSToSCSSConverter {
    constructor(options = {}) {
        this.options = {
            indentSize: options.indentSize || 2,
            indentType: options.indentType || 'spaces',
            preserveComments: options.preserveComments !== false,
            sortProperties: options.sortProperties || false,
        };
    }
    async convert(cssContent) {
        try {
            const ast = csstree.parse(cssContent);
            const rules = this.extractRules(ast);
            const nestedStructure = this.buildNestedStructure(rules);
            return this.formatSCSS(nestedStructure);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to convert CSS: ${errorMessage}`);
        }
    }
    extractRules(ast) {
        const rules = [];
        csstree.walk(ast, (node) => {
            if (node.type === 'Rule') {
                const rule = node;
                const selectorText = csstree.generate(rule.prelude);
                const declarations = [];
                if (rule.block && rule.block.children) {
                    rule.block.children.forEach((child) => {
                        if (child.type === 'Declaration') {
                            const declaration = child;
                            declarations.push({
                                type: 'declaration',
                                property: declaration.property,
                                value: csstree.generate(declaration.value),
                                important: declaration.important === true
                            });
                        }
                    });
                }
                // Handle multiple selectors
                selectorText.split(',').forEach((selector) => {
                    const trimmedSelector = selector.trim();
                    rules.push({
                        selector: trimmedSelector,
                        declarations: [...declarations],
                        specificity: this.calculateSpecificity(trimmedSelector)
                    });
                });
            }
        });
        return rules;
    }
    calculateSpecificity(selector) {
        // Simple specificity calculation for sorting
        const ids = (selector.match(/#/g) || []).length;
        const classes = (selector.match(/\./g) || []).length;
        const elements = selector.split(/[\s>+~]/).filter(s => s && !s.match(/[#.:]/) && s !== '').length;
        return [ids, classes, elements];
    }
    buildNestedStructure(rules) {
        const root = { selector: '', declarations: [], children: new Map() };
        // Group rules by their nesting potential
        const rulesByBase = this.groupRulesByBase(rules);
        // Build nested structure
        rulesByBase.forEach((groupRules, baseSelector) => {
            this.buildNestedGroup(baseSelector, groupRules, root);
        });
        return root;
    }
    groupRulesByBase(rules) {
        const groups = new Map();
        rules.forEach(rule => {
            const parts = this.parseSelector(rule.selector);
            const baseSelector = parts[0] || rule.selector;
            if (!groups.has(baseSelector)) {
                groups.set(baseSelector, []);
            }
            groups.get(baseSelector).push(rule);
        });
        return groups;
    }
    parseSelector(selector) {
        // Better selector parsing that handles complex cases
        const parts = [];
        let current = '';
        let inBrackets = 0;
        let inParens = 0;
        for (let i = 0; i < selector.length; i++) {
            const char = selector[i];
            if (char === '[')
                inBrackets++;
            else if (char === ']')
                inBrackets--;
            else if (char === '(')
                inParens++;
            else if (char === ')')
                inParens--;
            else if (char === ' ' && inBrackets === 0 && inParens === 0) {
                if (current.trim()) {
                    parts.push(current.trim());
                    current = '';
                }
                continue;
            }
            current += char;
        }
        if (current.trim()) {
            parts.push(current.trim());
        }
        return parts;
    }
    buildNestedGroup(baseSelector, rules, root) {
        if (!root.children.has(baseSelector)) {
            root.children.set(baseSelector, {
                selector: baseSelector,
                declarations: [],
                children: new Map()
            });
        }
        const baseNode = root.children.get(baseSelector);
        rules.forEach(rule => {
            const parts = this.parseSelector(rule.selector);
            if (parts.length === 1 && parts[0] === baseSelector) {
                // Direct rule for base selector
                baseNode.declarations.push(...rule.declarations);
            }
            else if (parts.length > 1 && parts[0] === baseSelector) {
                // Nested rule
                this.insertNestedRule(parts.slice(1), rule.declarations, baseNode);
            }
            else if (rule.selector.includes(baseSelector)) {
                // Complex selector that contains base selector
                this.handleComplexSelector(rule, baseNode, baseSelector);
            }
        });
    }
    insertNestedRule(selectorParts, declarations, parent) {
        let current = parent;
        selectorParts.forEach((part, index) => {
            if (!current.children.has(part)) {
                current.children.set(part, {
                    selector: part,
                    declarations: [],
                    children: new Map()
                });
            }
            current = current.children.get(part);
        });
        current.declarations.push(...declarations);
    }
    handleComplexSelector(rule, baseNode, baseSelector) {
        // Handle selectors like .btn.btn-secondary or .container .header:hover
        const selector = rule.selector;
        if (selector.includes(':') && selector.startsWith(baseSelector)) {
            // Pseudo-class/element on base selector
            const pseudoPart = selector.substring(baseSelector.length);
            if (!baseNode.children.has(pseudoPart)) {
                baseNode.children.set(pseudoPart, {
                    selector: pseudoPart,
                    declarations: [],
                    children: new Map()
                });
            }
            baseNode.children.get(pseudoPart).declarations.push(...rule.declarations);
        }
        else if (selector.includes('.') && selector.startsWith(baseSelector)) {
            // Additional class on base selector
            const additionalClass = selector.substring(baseSelector.length);
            if (!baseNode.children.has(additionalClass)) {
                baseNode.children.set(additionalClass, {
                    selector: additionalClass,
                    declarations: [],
                    children: new Map()
                });
            }
            baseNode.children.get(additionalClass).declarations.push(...rule.declarations);
        }
    }
    formatSCSS(structure, depth = 0) {
        let result = '';
        const indent = this.getIndent(depth);
        // Sort children if requested
        const children = Array.from(structure.children.entries());
        if (this.options.sortProperties) {
            children.sort(([a], [b]) => a.localeCompare(b));
        }
        children.forEach(([selector, child]) => {
            if (child.declarations.length > 0 || child.children.size > 0) {
                // Format selector for SCSS nesting
                const formattedSelector = this.formatSelectorForNesting(selector, depth);
                result += `${indent}${formattedSelector} {\n`;
                // Add declarations first
                if (this.options.sortProperties) {
                    child.declarations.sort((a, b) => {
                        if (a.type === 'comment' || b.type === 'comment')
                            return 0;
                        if (!a.property || !b.property)
                            return 0;
                        return a.property.localeCompare(b.property);
                    });
                }
                child.declarations.forEach(decl => {
                    if (decl.type === 'comment') {
                        result += `${this.getIndent(depth + 1)}/* ${decl.value} */\n`;
                    }
                    else if (decl.property) {
                        const important = decl.important ? ' !important' : '';
                        result += `${this.getIndent(depth + 1)}${decl.property}: ${decl.value}${important};\n`;
                    }
                });
                // Add nested rules
                if (child.children.size > 0) {
                    if (child.declarations.length > 0)
                        result += '\n';
                    result += this.formatSCSS(child, depth + 1);
                }
                result += `${indent}}\n`;
                if (depth === 0)
                    result += '\n'; // Extra line between top-level rules
            }
        });
        return result;
    }
    formatSelectorForNesting(selector, depth) {
        if (depth === 0)
            return selector;
        // Handle pseudo-classes and pseudo-elements
        if (selector.startsWith(':') || selector.startsWith('::')) {
            return `&${selector}`;
        }
        // Handle additional classes
        if (selector.startsWith('.')) {
            return `&${selector}`;
        }
        // Handle ID selectors
        if (selector.startsWith('#')) {
            return `&${selector}`;
        }
        // Handle attribute selectors
        if (selector.includes('[')) {
            return `&${selector}`;
        }
        return selector;
    }
    getIndent(depth) {
        const unit = this.options.indentType === 'tabs' ? '\t' : ' '.repeat(this.options.indentSize);
        return unit.repeat(depth);
    }
}
exports.ImprovedCSSToSCSSConverter = ImprovedCSSToSCSSConverter;
//# sourceMappingURL=improved-converter.js.map