import * as csstree from 'css-tree';

export interface AdvancedConversionOptions {
  indentSize?: number;
  indentType?: 'spaces' | 'tabs';
  preserveComments?: boolean;
  sortProperties?: boolean;
  enableBEM?: boolean;
  enableSmartNesting?: boolean;
  maxNestingDepth?: number;
}

interface ParsedRule {
  selector: string;
  declarations: Declaration[];
  specificity: number[];
  bemInfo?: BEMInfo;
}

interface BEMInfo {
  block: string;
  element?: string;
  modifier?: string;
  type: 'block' | 'element' | 'modifier' | 'element-modifier';
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
  bemInfo?: BEMInfo;
}

export class AdvancedCSSToSCSSConverter {
  private options: Required<AdvancedConversionOptions>;

  constructor(options: AdvancedConversionOptions = {}) {
    this.options = {
      indentSize: options.indentSize || 2,
      indentType: options.indentType || 'spaces',
      preserveComments: options.preserveComments !== false,
      sortProperties: options.sortProperties || false,
      enableBEM: options.enableBEM !== false,
      enableSmartNesting: options.enableSmartNesting !== false,
      maxNestingDepth: options.maxNestingDepth || 5,
    };
  }

  async convert(cssContent: string): Promise<string> {
    try {
      const ast = csstree.parse(cssContent);
      const rules = this.extractRules(ast);
      const nestedStructure = this.buildAdvancedNestedStructure(rules);
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
          const bemInfo = this.options.enableBEM ? this.parseBEM(trimmedSelector) : undefined;
          
          rules.push({
            selector: trimmedSelector,
            declarations: [...declarations],
            specificity: this.calculateSpecificity(trimmedSelector),
            bemInfo
          });
        });
      }
      
      if (node.type === 'Comment' && this.options.preserveComments) {
        const commentNode = node as csstree.Comment;
        rules.push({
          selector: '/* COMMENT */',
          declarations: [{ type: 'comment', value: commentNode.value }],
          specificity: [0, 0, 0]
        });
      }
    });

    return rules;
  }

  private parseBEM(selector: string): BEMInfo | undefined {
    // Remove pseudo-classes and other non-BEM parts for analysis
    const cleanSelector = selector.replace(/:[^,\s]+/g, '').replace(/\[[^\]]+\]/g, '');
    
    // BEM pattern: .block__element--modifier
    const bemRegex = /^\.([a-zA-Z0-9-]+)(?:__([a-zA-Z0-9-]+))?(?:--([a-zA-Z0-9-]+))?$/;
    const match = cleanSelector.match(bemRegex);
    
    if (!match) return undefined;
    
    const [, block, element, modifier] = match;
    
    if (element && modifier) {
      return { block, element, modifier, type: 'element-modifier' };
    } else if (element) {
      return { block, element, type: 'element' };
    } else if (modifier) {
      return { block, modifier, type: 'modifier' };
    } else {
      return { block, type: 'block' };
    }
  }

  private calculateSpecificity(selector: string): number[] {
    const ids = (selector.match(/#/g) || []).length;
    const classes = (selector.match(/\./g) || []).length;
    const elements = selector.split(/[\s>+~]/).filter(s => s && !s.match(/[#.:]/) && s !== '').length;
    return [ids, classes, elements];
  }

  private buildAdvancedNestedStructure(rules: ParsedRule[]): NestedRule {
    const root: NestedRule = { selector: '', declarations: [], children: new Map() };
    
    if (this.options.enableBEM) {
      return this.buildBEMStructure(rules, root);
    } else if (this.options.enableSmartNesting) {
      return this.buildSmartNestedStructure(rules, root);
    } else {
      return this.buildBasicNestedStructure(rules, root);
    }
  }

  private buildBEMStructure(rules: ParsedRule[], root: NestedRule): NestedRule {
    // Group rules by BEM blocks
    const bemBlocks = new Map<string, ParsedRule[]>();
    const nonBemRules: ParsedRule[] = [];
    
    rules.forEach(rule => {
      if (rule.selector === '/* COMMENT */') {
        root.declarations.push(...rule.declarations);
        return;
      }
      
      if (rule.bemInfo) {
        const blockName = rule.bemInfo.block;
        if (!bemBlocks.has(blockName)) {
          bemBlocks.set(blockName, []);
        }
        bemBlocks.get(blockName)!.push(rule);
      } else {
        nonBemRules.push(rule);
      }
    });
    
    // Build BEM nested structure
    bemBlocks.forEach((blockRules, blockName) => {
      this.buildBEMBlock(blockName, blockRules, root);
    });
    
    // Handle non-BEM rules with smart nesting
    if (nonBemRules.length > 0) {
      this.buildSmartNestedStructure(nonBemRules, root);
    }
    
    return root;
  }

  private buildBEMBlock(blockName: string, rules: ParsedRule[], root: NestedRule): void {
    const blockSelector = `.${blockName}`;
    
    if (!root.children.has(blockSelector)) {
      root.children.set(blockSelector, {
        selector: blockSelector,
        declarations: [],
        children: new Map(),
        bemInfo: { block: blockName, type: 'block' }
      });
    }
    
    const blockNode = root.children.get(blockSelector)!;
    
    rules.forEach(rule => {
      if (!rule.bemInfo) return;
      
      switch (rule.bemInfo.type) {
        case 'block':
          // Check if this rule has pseudo-classes
          const pseudoMatch = rule.selector.match(/(:+[^,\s]+)/);
          if (pseudoMatch) {
            const pseudoSelector = `&${pseudoMatch[0]}`;
            if (!blockNode.children.has(pseudoSelector)) {
              blockNode.children.set(pseudoSelector, {
                selector: pseudoSelector,
                declarations: [],
                children: new Map()
              });
            }
            blockNode.children.get(pseudoSelector)!.declarations.push(...rule.declarations);
          } else {
            blockNode.declarations.push(...rule.declarations);
          }
          break;
          
        case 'element':
          this.addBEMElement(blockNode, rule);
          break;
          
        case 'modifier':
          this.addBEMModifier(blockNode, rule);
          break;
          
        case 'element-modifier':
          this.addBEMElementModifier(blockNode, rule);
          break;
      }
    });
  }

  private addBEMElement(blockNode: NestedRule, rule: ParsedRule): void {
    if (!rule.bemInfo?.element) return;
    
    const elementSelector = `&__${rule.bemInfo.element}`;
    
    if (!blockNode.children.has(elementSelector)) {
      blockNode.children.set(elementSelector, {
        selector: elementSelector,
        declarations: [],
        children: new Map(),
        bemInfo: rule.bemInfo
      });
    }
    
    const elementNode = blockNode.children.get(elementSelector)!;
    
    // Check if this rule has pseudo-classes
    const pseudoMatch = rule.selector.match(/(:+[^,\s]+)/);
    if (pseudoMatch) {
      const pseudoSelector = `&${pseudoMatch[0]}`;
      if (!elementNode.children.has(pseudoSelector)) {
        elementNode.children.set(pseudoSelector, {
          selector: pseudoSelector,
          declarations: [],
          children: new Map()
        });
      }
      elementNode.children.get(pseudoSelector)!.declarations.push(...rule.declarations);
    } else {
      elementNode.declarations.push(...rule.declarations);
    }
  }

  private addBEMModifier(blockNode: NestedRule, rule: ParsedRule): void {
    if (!rule.bemInfo?.modifier) return;
    
    const modifierSelector = `&--${rule.bemInfo.modifier}`;
    
    if (!blockNode.children.has(modifierSelector)) {
      blockNode.children.set(modifierSelector, {
        selector: modifierSelector,
        declarations: [],
        children: new Map(),
        bemInfo: rule.bemInfo
      });
    }
    
    const modifierNode = blockNode.children.get(modifierSelector)!;
    
    // Check if this rule has pseudo-classes
    const pseudoMatch = rule.selector.match(/(:+[^,\s]+)/);
    if (pseudoMatch) {
      const pseudoSelector = `&${pseudoMatch[0]}`;
      if (!modifierNode.children.has(pseudoSelector)) {
        modifierNode.children.set(pseudoSelector, {
          selector: pseudoSelector,
          declarations: [],
          children: new Map()
        });
      }
      modifierNode.children.get(pseudoSelector)!.declarations.push(...rule.declarations);
    } else {
      modifierNode.declarations.push(...rule.declarations);
    }
  }

  private addBEMElementModifier(blockNode: NestedRule, rule: ParsedRule): void {
    if (!rule.bemInfo?.element || !rule.bemInfo?.modifier) return;
    
    const elementSelector = `&__${rule.bemInfo.element}`;
    const modifierSelector = `&--${rule.bemInfo.modifier}`;
    
    // Ensure element exists
    if (!blockNode.children.has(elementSelector)) {
      blockNode.children.set(elementSelector, {
        selector: elementSelector,
        declarations: [],
        children: new Map(),
        bemInfo: { block: rule.bemInfo.block, element: rule.bemInfo.element, type: 'element' }
      });
    }
    
    const elementNode = blockNode.children.get(elementSelector)!;
    
    // Add modifier to element
    if (!elementNode.children.has(modifierSelector)) {
      elementNode.children.set(modifierSelector, {
        selector: modifierSelector,
        declarations: [],
        children: new Map(),
        bemInfo: rule.bemInfo
      });
    }
    
    const modifierNode = elementNode.children.get(modifierSelector)!;
    
    // Check if this rule has pseudo-classes
    const pseudoMatch = rule.selector.match(/(:+[^,\s]+)/);
    if (pseudoMatch) {
      const pseudoSelector = `&${pseudoMatch[0]}`;
      if (!modifierNode.children.has(pseudoSelector)) {
        modifierNode.children.set(pseudoSelector, {
          selector: pseudoSelector,
          declarations: [],
          children: new Map()
        });
      }
      modifierNode.children.get(pseudoSelector)!.declarations.push(...rule.declarations);
    } else {
      modifierNode.declarations.push(...rule.declarations);
    }
  }

  private handlePseudoClasses(originalSelector: string, parentNode: NestedRule, declarations: Declaration[]): void {
    const pseudoMatch = originalSelector.match(/(:+[^,\s]+)/g);
    if (!pseudoMatch) return;
    
    pseudoMatch.forEach(pseudo => {
      const pseudoSelector = `&${pseudo}`;
      if (!parentNode.children.has(pseudoSelector)) {
        parentNode.children.set(pseudoSelector, {
          selector: pseudoSelector,
          declarations: [],
          children: new Map()
        });
      }
      // Note: declarations are already added to parent, pseudo-classes are handled separately
    });
  }

  private buildSmartNestedStructure(rules: ParsedRule[], root: NestedRule): NestedRule {
    // Group rules by their base selector for smart nesting
    const ruleGroups = this.groupRulesByPattern(rules);
    
    ruleGroups.forEach((groupRules, basePattern) => {
      this.buildSmartNestedGroup(basePattern, groupRules, root);
    });
    
    return root;
  }

  private groupRulesByPattern(rules: ParsedRule[]): Map<string, ParsedRule[]> {
    const groups = new Map<string, ParsedRule[]>();
    
    rules.forEach(rule => {
      if (rule.selector === '/* COMMENT */') {
        if (!groups.has('COMMENTS')) {
          groups.set('COMMENTS', []);
        }
        groups.get('COMMENTS')!.push(rule);
        return;
      }
      
      const basePattern = this.extractBasePattern(rule.selector);
      
      if (!groups.has(basePattern)) {
        groups.set(basePattern, []);
      }
      groups.get(basePattern)!.push(rule);
    });
    
    return groups;
  }

  private extractBasePattern(selector: string): string {
    // Extract the base class/id/element from complex selectors
    const parts = selector.split(/[\s>+~]/);
    const firstPart = parts[0].trim();
    
    // Remove pseudo-classes for grouping
    return firstPart.replace(/:[^,\s]+/g, '');
  }

  private buildSmartNestedGroup(basePattern: string, rules: ParsedRule[], root: NestedRule): void {
    if (basePattern === 'COMMENTS') {
      rules.forEach(rule => {
        root.declarations.push(...rule.declarations);
      });
      return;
    }
    
    if (!root.children.has(basePattern)) {
      root.children.set(basePattern, {
        selector: basePattern,
        declarations: [],
        children: new Map()
      });
    }
    
    const baseNode = root.children.get(basePattern)!;
    
    rules.forEach(rule => {
      this.insertSmartNestedRule(rule, baseNode, basePattern);
    });
  }

  private insertSmartNestedRule(rule: ParsedRule, baseNode: NestedRule, basePattern: string): void {
    const selector = rule.selector;
    
    if (selector === basePattern) {
      // Direct rule for base selector
      baseNode.declarations.push(...rule.declarations);
    } else if (selector.startsWith(basePattern)) {
      // Nested rule (pseudo-class, modifier, etc.)
      const nestedPart = selector.substring(basePattern.length);
      const nestedSelector = `&${nestedPart}`;
      
      if (!baseNode.children.has(nestedSelector)) {
        baseNode.children.set(nestedSelector, {
          selector: nestedSelector,
          declarations: [],
          children: new Map()
        });
      }
      
      baseNode.children.get(nestedSelector)!.declarations.push(...rule.declarations);
    } else {
      // Complex descendant selector
      const parts = this.parseComplexSelector(selector, basePattern);
      this.insertComplexNestedRule(parts, rule.declarations, baseNode);
    }
  }

  private parseComplexSelector(selector: string, basePattern: string): string[] {
    // Parse complex selectors like ".nav ul li a"
    const parts = selector.split(/\s+/).filter(p => p.length > 0);
    const baseIndex = parts.findIndex(part => part.includes(basePattern.replace(/[.#]/, '')));
    
    if (baseIndex >= 0) {
      return parts.slice(baseIndex + 1);
    }
    
    return parts;
  }

  private insertComplexNestedRule(selectorParts: string[], declarations: Declaration[], parent: NestedRule): void {
    let current = parent;
    
    selectorParts.forEach((part) => {
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

  private buildBasicNestedStructure(rules: ParsedRule[], root: NestedRule): NestedRule {
    // Fallback to basic nesting for non-BEM, non-smart cases
    rules.forEach(rule => {
      if (rule.selector === '/* COMMENT */') {
        root.declarations.push(...rule.declarations);
        return;
      }
      
      const parts = rule.selector.split(/\s+/).filter(p => p.length > 0);
      this.insertComplexNestedRule(parts, rule.declarations, root);
    });
    
    return root;
  }

  private formatSCSS(structure: NestedRule, depth: number = 0): string {
    let result = '';
    const indent = this.getIndent(depth);
    
    // Handle root declarations (comments)
    if (depth === 0 && structure.declarations.length > 0) {
      structure.declarations.forEach(decl => {
        if (decl.type === 'comment') {
          result += `/* ${decl.value} */\n`;
        }
      });
      if (structure.declarations.length > 0) result += '\n';
    }
    
    // Sort children if requested
    const children = Array.from(structure.children.entries());
    if (this.options.sortProperties) {
      children.sort(([a], [b]) => {
        // Sort BEM elements and modifiers logically
        if (a.startsWith('&__') && b.startsWith('&--')) return -1;
        if (a.startsWith('&--') && b.startsWith('&__')) return 1;
        return a.localeCompare(b);
      });
    }
    
    children.forEach(([selector, child]) => {
      if (child.declarations.length > 0 || child.children.size > 0) {
        result += `${indent}${selector} {\n`;
        
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

  private getIndent(depth: number): string {
    const unit = this.options.indentType === 'tabs' ? '\t' : ' '.repeat(this.options.indentSize);
    return unit.repeat(depth);
  }
}