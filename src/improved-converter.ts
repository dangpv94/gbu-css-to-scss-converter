import * as csstree from 'css-tree';

export interface ConversionOptions {
  indentSize?: number;
  indentType?: 'spaces' | 'tabs';
  preserveComments?: boolean;
  sortProperties?: boolean;
}

interface ParsedRule {
  selector: string;
  declarations: Declaration[];
  specificity: number[];
}

interface Declaration {
  type: 'declaration' | 'comment';
  property?: string;
  value: string;
  important?: boolean;
}

interface NestedRule {
  selector: string;
  declarations: Declaration[];
  children: Map<string, NestedRule>;
}

export class ImprovedCSSToSCSSConverter {
  private options: Required<ConversionOptions>;

  constructor(options: ConversionOptions = {}) {
    this.options = {
      indentSize: options.indentSize || 2,
      indentType: options.indentType || 'spaces',
      preserveComments: options.preserveComments !== false,
      sortProperties: options.sortProperties || false,
    };
  }

  async convert(cssContent: string): Promise<string> {
    try {
      const ast = csstree.parse(cssContent);
      const rules = this.extractRules(ast);
      const nestedStructure = this.buildNestedStructure(rules);
      return this.formatSCSS(nestedStructure);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to convert CSS: ${errorMessage}`);
    }
  }

  private extractRules(ast: csstree.CssNode): ParsedRule[] {
    const rules: ParsedRule[] = [];
    
    csstree.walk(ast, (node: csstree.CssNode) => {
      if (node.type === 'Rule') {
        const rule = node as csstree.Rule;
        const selectorText = csstree.generate(rule.prelude);
        const declarations: Declaration[] = [];
        
        if (rule.block && rule.block.children) {
          rule.block.children.forEach((child: csstree.CssNode) => {
            if (child.type === 'Declaration') {
              const declaration = child as csstree.Declaration;
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
        selectorText.split(',').forEach((selector: string) => {
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

  private calculateSpecificity(selector: string): number[] {
    // Simple specificity calculation for sorting
    const ids = (selector.match(/#/g) || []).length;
    const classes = (selector.match(/\./g) || []).length;
    const elements = selector.split(/[\s>+~]/).filter(s => s && !s.match(/[#.:]/) && s !== '').length;
    return [ids, classes, elements];
  }

  private buildNestedStructure(rules: ParsedRule[]): NestedRule {
    const root: NestedRule = { selector: '', declarations: [], children: new Map() };
    
    // Group rules by their nesting potential
    const rulesByBase = this.groupRulesByBase(rules);
    
    // Build nested structure
    rulesByBase.forEach((groupRules, baseSelector) => {
      this.buildNestedGroup(baseSelector, groupRules, root);
    });
    
    return root;
  }

  private groupRulesByBase(rules: ParsedRule[]): Map<string, ParsedRule[]> {
    const groups = new Map<string, ParsedRule[]>();
    
    rules.forEach(rule => {
      const parts = this.parseSelector(rule.selector);
      const baseSelector = parts[0] || rule.selector;
      
      if (!groups.has(baseSelector)) {
        groups.set(baseSelector, []);
      }
      groups.get(baseSelector)!.push(rule);
    });
    
    return groups;
  }

  private parseSelector(selector: string): string[] {
    // Better selector parsing that handles complex cases
    const parts: string[] = [];
    let current = '';
    let inBrackets = 0;
    let inParens = 0;
    
    for (let i = 0; i < selector.length; i++) {
      const char = selector[i];
      
      if (char === '[') inBrackets++;
      else if (char === ']') inBrackets--;
      else if (char === '(') inParens++;
      else if (char === ')') inParens--;
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

  private buildNestedGroup(baseSelector: string, rules: ParsedRule[], root: NestedRule): void {
    if (!root.children.has(baseSelector)) {
      root.children.set(baseSelector, {
        selector: baseSelector,
        declarations: [],
        children: new Map()
      });
    }
    
    const baseNode = root.children.get(baseSelector)!;
    
    rules.forEach(rule => {
      const parts = this.parseSelector(rule.selector);
      
      if (parts.length === 1 && parts[0] === baseSelector) {
        // Direct rule for base selector
        baseNode.declarations.push(...rule.declarations);
      } else if (parts.length > 1 && parts[0] === baseSelector) {
        // Nested rule
        this.insertNestedRule(parts.slice(1), rule.declarations, baseNode);
      } else if (rule.selector.includes(baseSelector)) {
        // Complex selector that contains base selector
        this.handleComplexSelector(rule, baseNode, baseSelector);
      }
    });
  }

  private insertNestedRule(selectorParts: string[], declarations: Declaration[], parent: NestedRule): void {
    let current = parent;
    
    selectorParts.forEach((part, index) => {
      if (!current.children.has(part)) {
        current.children.set(part, {
          selector: part,
          declarations: [],
          children: new Map()
        });
      }
      
      current = current.children.get(part)!;
    });
    
    current.declarations.push(...declarations);
  }

  private handleComplexSelector(rule: ParsedRule, baseNode: NestedRule, baseSelector: string): void {
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
      baseNode.children.get(pseudoPart)!.declarations.push(...rule.declarations);
    } else if (selector.includes('.') && selector.startsWith(baseSelector)) {
      // Additional class on base selector
      const additionalClass = selector.substring(baseSelector.length);
      if (!baseNode.children.has(additionalClass)) {
        baseNode.children.set(additionalClass, {
          selector: additionalClass,
          declarations: [],
          children: new Map()
        });
      }
      baseNode.children.get(additionalClass)!.declarations.push(...rule.declarations);
    }
  }

  private formatSCSS(structure: NestedRule, depth: number = 0): string {
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
            if (a.type === 'comment' || b.type === 'comment') return 0;
            if (!a.property || !b.property) return 0;
            return a.property.localeCompare(b.property);
          });
        }
        
        child.declarations.forEach(decl => {
          if (decl.type === 'comment') {
            result += `${this.getIndent(depth + 1)}/* ${decl.value} */\n`;
          } else if (decl.property) {
            const important = decl.important ? ' !important' : '';
            result += `${this.getIndent(depth + 1)}${decl.property}: ${decl.value}${important};\n`;
          }
        });
        
        // Add nested rules
        if (child.children.size > 0) {
          if (child.declarations.length > 0) result += '\n';
          result += this.formatSCSS(child, depth + 1);
        }
        
        result += `${indent}}\n`;
        if (depth === 0) result += '\n'; // Extra line between top-level rules
      }
    });
    
    return result;
  }

  private formatSelectorForNesting(selector: string, depth: number): string {
    if (depth === 0) return selector;
    
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

  private getIndent(depth: number): string {
    const unit = this.options.indentType === 'tabs' ? '\t' : ' '.repeat(this.options.indentSize);
    return unit.repeat(depth);
  }
}