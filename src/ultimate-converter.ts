import * as csstree from 'css-tree';

export interface UltimateConversionOptions {
  indentSize?: number;
  indentType?: 'spaces' | 'tabs';
  preserveComments?: boolean;
  sortProperties?: boolean;
  enableBEM?: boolean;
  enableSmartNesting?: boolean;
  maxNestingDepth?: number;
  enableDuplicateDetection?: boolean;
  enableAdvancedBEM?: boolean;
  enableMediaQueryGrouping?: boolean;
}

interface ParsedRule {
  selector: string;
  declarations: Declaration[];
  specificity: number[];
  bemInfo?: AdvancedBEMInfo;
  mediaQuery?: string;
  hash?: string; // For duplicate detection
}

interface AdvancedBEMInfo {
  block: string;
  elements: string[]; // Support multiple levels: ['element', 'subelement']
  modifier?: string;
  type: 'block' | 'element' | 'modifier' | 'element-modifier';
  level: number; // BEM nesting level
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
  bemInfo?: AdvancedBEMInfo;
  mediaQuery?: string;
  duplicateCount?: number;
}

interface MediaQueryGroup {
  query: string;
  rules: ParsedRule[];
}

export class UltimateCSSToSCSSConverter {
  private options: Required<UltimateConversionOptions>;

  constructor(options: UltimateConversionOptions = {}) {
    this.options = {
      indentSize: options.indentSize || 2,
      indentType: options.indentType || 'spaces',
      preserveComments: options.preserveComments !== false,
      sortProperties: options.sortProperties || false,
      enableBEM: options.enableBEM !== false,
      enableSmartNesting: options.enableSmartNesting !== false,
      maxNestingDepth: options.maxNestingDepth || 5,
      enableDuplicateDetection: options.enableDuplicateDetection !== false,
      enableAdvancedBEM: options.enableAdvancedBEM !== false,
      enableMediaQueryGrouping: options.enableMediaQueryGrouping !== false,
    };
  }

  async convert(cssContent: string): Promise<string> {
    try {
      const ast = csstree.parse(cssContent);
      const rules = this.extractRules(ast);
      
      // Step 1: Detect and merge duplicates within same media query
      const deduplicatedRules = this.options.enableDuplicateDetection 
        ? this.detectAndMergeDuplicates(rules)
        : rules;
      
      // Step 2: Group by media queries
      const mediaGroups = this.options.enableMediaQueryGrouping
        ? this.groupByMediaQuery(deduplicatedRules)
        : [{ query: '', rules: deduplicatedRules }];
      
      // Step 3: Build nested structure for each media query group
      let result = '';
      mediaGroups.forEach(group => {
        const nestedStructure = this.buildAdvancedNestedStructure(group.rules);
        const formattedCSS = this.formatSCSS(nestedStructure);
        
        if (group.query) {
          result += `@media ${group.query} {\n`;
          result += this.indentContent(formattedCSS, 1);
          result += '}\n\n';
        } else {
          result += formattedCSS;
        }
      });
      
      return result.trim() + '\n';
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to convert CSS: ${errorMessage}`);
    }
  }

  private extractRules(ast: csstree.CssNode): ParsedRule[] {
    const rules: ParsedRule[] = [];
    let currentMediaQuery = '';
    
    csstree.walk(ast, (node: csstree.CssNode) => {
      if (node.type === 'Atrule' && node.name === 'media' && node.prelude) {
        currentMediaQuery = csstree.generate(node.prelude);
        return;
      }
      
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
          const bemInfo = this.options.enableBEM ? this.parseAdvancedBEM(trimmedSelector) : undefined;
          const hash = this.generateRuleHash(trimmedSelector, declarations);
          
          rules.push({
            selector: trimmedSelector,
            declarations: [...declarations],
            specificity: this.calculateSpecificity(trimmedSelector),
            bemInfo,
            mediaQuery: currentMediaQuery || undefined,
            hash
          });
        });
      }
      
      if (node.type === 'Comment' && this.options.preserveComments) {
        const commentNode = node as csstree.Comment;
        rules.push({
          selector: '/* COMMENT */',
          declarations: [{ type: 'comment', value: commentNode.value }],
          specificity: [0, 0, 0],
          mediaQuery: currentMediaQuery || undefined,
          hash: `comment-${Date.now()}`
        });
      }
    });

    return rules;
  }

  private parseAdvancedBEM(selector: string): AdvancedBEMInfo | undefined {
    // Remove pseudo-classes and other non-BEM parts for analysis
    const cleanSelector = selector.replace(/:[^,\s]+/g, '').replace(/\[[^\]]+\]/g, '');
    
    // Advanced BEM pattern: .block__element__subelement__subsubelement--modifier
    const advancedBemRegex = /^\.([a-zA-Z0-9-]+)(?:__((?:[a-zA-Z0-9-]+(?:__)?)+))?(?:--([a-zA-Z0-9-]+))?$/;
    const match = cleanSelector.match(advancedBemRegex);
    
    if (!match) return undefined;
    
    const [, block, elementPart, modifier] = match;
    
    // Parse nested elements
    const elements = elementPart ? elementPart.split('__').filter(e => e.length > 0) : [];
    const level = elements.length;
    
    if (elements.length > 0 && modifier) {
      return { 
        block, 
        elements, 
        modifier, 
        type: 'element-modifier',
        level: level + 1
      };
    } else if (elements.length > 0) {
      return { 
        block, 
        elements, 
        type: 'element',
        level
      };
    } else if (modifier) {
      return { 
        block, 
        elements: [],
        modifier, 
        type: 'modifier',
        level: 1
      };
    } else {
      return { 
        block, 
        elements: [],
        type: 'block',
        level: 0
      };
    }
  }

  private generateRuleHash(selector: string, declarations: Declaration[]): string {
    const declString = declarations
      .filter(d => d.type === 'declaration')
      .map(d => `${d.property}:${d.value}${d.important ? '!important' : ''}`)
      .sort()
      .join(';');
    
    return `${selector}|${declString}`;
  }

  private detectAndMergeDuplicates(rules: ParsedRule[]): ParsedRule[] {
    const mediaQueryGroups = new Map<string, Map<string, ParsedRule[]>>();
    
    // Group rules by media query and then by declaration hash
    rules.forEach(rule => {
      const mediaKey = rule.mediaQuery || 'default';
      
      if (!mediaQueryGroups.has(mediaKey)) {
        mediaQueryGroups.set(mediaKey, new Map());
      }
      
      const mediaGroup = mediaQueryGroups.get(mediaKey)!;
      
      // Create hash based only on declarations, not selector
      const declHash = this.generateDeclarationHash(rule.declarations);
      
      if (!mediaGroup.has(declHash)) {
        mediaGroup.set(declHash, []);
      }
      
      mediaGroup.get(declHash)!.push(rule);
    });
    
    const mergedRules: ParsedRule[] = [];
    
    // Merge duplicates within each media query group
    mediaQueryGroups.forEach((mediaGroup, mediaKey) => {
      mediaGroup.forEach((duplicateRules, declHash) => {
        if (duplicateRules.length > 1 && duplicateRules[0].selector !== '/* COMMENT */') {
          // Check if declarations are actually identical
          const firstDeclarations = duplicateRules[0].declarations;
          const allIdentical = duplicateRules.every(rule => 
            this.declarationsEqual(rule.declarations, firstDeclarations)
          );
          
          if (allIdentical) {
            // Merge selectors for duplicate rules
            const mergedSelectors = duplicateRules.map(r => r.selector).join(', ');
            const firstRule = duplicateRules[0];
            
            mergedRules.push({
              ...firstRule,
              selector: mergedSelectors,
              mediaQuery: mediaKey === 'default' ? undefined : mediaKey,
              hash: `merged-${declHash}`
            });
            
            // Log duplicate detection
            console.log(`🔄 Merged ${duplicateRules.length} duplicate rules: ${mergedSelectors}`);
          } else {
            // Not identical, keep separate
            duplicateRules.forEach(rule => {
              mergedRules.push({
                ...rule,
                mediaQuery: mediaKey === 'default' ? undefined : mediaKey
              });
            });
          }
        } else {
          duplicateRules.forEach(rule => {
            mergedRules.push({
              ...rule,
              mediaQuery: mediaKey === 'default' ? undefined : mediaKey
            });
          });
        }
      });
    });
    
    return mergedRules;
  }

  private generateDeclarationHash(declarations: Declaration[]): string {
    return declarations
      .filter(d => d.type === 'declaration')
      .map(d => `${d.property}:${d.value}${d.important ? '!important' : ''}`)
      .sort()
      .join(';');
  }

  private declarationsEqual(decls1: Declaration[], decls2: Declaration[]): boolean {
    if (decls1.length !== decls2.length) return false;
    
    const hash1 = this.generateDeclarationHash(decls1);
    const hash2 = this.generateDeclarationHash(decls2);
    
    return hash1 === hash2;
  }

  private groupByMediaQuery(rules: ParsedRule[]): MediaQueryGroup[] {
    const groups = new Map<string, ParsedRule[]>();
    
    rules.forEach(rule => {
      const key = rule.mediaQuery || '';
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(rule);
    });
    
    return Array.from(groups.entries()).map(([query, rules]) => ({
      query,
      rules
    }));
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
      return this.buildAdvancedBEMStructure(rules, root);
    } else if (this.options.enableSmartNesting) {
      return this.buildSmartNestedStructure(rules, root);
    } else {
      return this.buildBasicNestedStructure(rules, root);
    }
  }

  private buildAdvancedBEMStructure(rules: ParsedRule[], root: NestedRule): NestedRule {
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
    
    // Build advanced BEM nested structure
    bemBlocks.forEach((blockRules, blockName) => {
      this.buildAdvancedBEMBlock(blockName, blockRules, root);
    });
    
    // Handle non-BEM rules with smart nesting
    if (nonBemRules.length > 0) {
      this.buildSmartNestedStructure(nonBemRules, root);
    }
    
    return root;
  }

  private buildAdvancedBEMBlock(blockName: string, rules: ParsedRule[], root: NestedRule): void {
    const blockSelector = `.${blockName}`;
    
    if (!root.children.has(blockSelector)) {
      root.children.set(blockSelector, {
        selector: blockSelector,
        declarations: [],
        children: new Map(),
        bemInfo: { block: blockName, elements: [], type: 'block', level: 0 }
      });
    }
    
    const blockNode = root.children.get(blockSelector)!;
    
    rules.forEach(rule => {
      if (!rule.bemInfo) return;
      
      switch (rule.bemInfo.type) {
        case 'block':
          this.addBEMBlockRule(blockNode, rule);
          break;
          
        case 'element':
          this.addAdvancedBEMElement(blockNode, rule);
          break;
          
        case 'modifier':
          this.addBEMModifier(blockNode, rule);
          break;
          
        case 'element-modifier':
          this.addAdvancedBEMElementModifier(blockNode, rule);
          break;
      }
    });
  }

  private addBEMBlockRule(blockNode: NestedRule, rule: ParsedRule): void {
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
  }

  private addAdvancedBEMElement(blockNode: NestedRule, rule: ParsedRule): void {
    if (!rule.bemInfo?.elements || rule.bemInfo.elements.length === 0) return;
    
    let currentNode = blockNode;
    
    // Build nested structure for multi-level elements
    rule.bemInfo.elements.forEach((element, index) => {
      const elementSelector = `&__${element}`;
      
      if (!currentNode.children.has(elementSelector)) {
        currentNode.children.set(elementSelector, {
          selector: elementSelector,
          declarations: [],
          children: new Map(),
          bemInfo: {
            block: rule.bemInfo!.block,
            elements: rule.bemInfo!.elements.slice(0, index + 1),
            type: 'element',
            level: index + 1
          }
        });
      }
      
      currentNode = currentNode.children.get(elementSelector)!;
    });
    
    // Add declarations to the final element
    const pseudoMatch = rule.selector.match(/(:+[^,\s]+)/);
    if (pseudoMatch) {
      const pseudoSelector = `&${pseudoMatch[0]}`;
      if (!currentNode.children.has(pseudoSelector)) {
        currentNode.children.set(pseudoSelector, {
          selector: pseudoSelector,
          declarations: [],
          children: new Map()
        });
      }
      currentNode.children.get(pseudoSelector)!.declarations.push(...rule.declarations);
    } else {
      currentNode.declarations.push(...rule.declarations);
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

  private addAdvancedBEMElementModifier(blockNode: NestedRule, rule: ParsedRule): void {
    if (!rule.bemInfo?.elements || !rule.bemInfo?.modifier) return;
    
    let currentNode = blockNode;
    
    // Navigate to the deepest element
    rule.bemInfo.elements.forEach((element, index) => {
      const elementSelector = `&__${element}`;
      
      if (!currentNode.children.has(elementSelector)) {
        currentNode.children.set(elementSelector, {
          selector: elementSelector,
          declarations: [],
          children: new Map(),
          bemInfo: {
            block: rule.bemInfo!.block,
            elements: rule.bemInfo!.elements.slice(0, index + 1),
            type: 'element',
            level: index + 1
          }
        });
      }
      
      currentNode = currentNode.children.get(elementSelector)!;
    });
    
    // Add modifier to the final element
    const modifierSelector = `&--${rule.bemInfo.modifier}`;
    
    if (!currentNode.children.has(modifierSelector)) {
      currentNode.children.set(modifierSelector, {
        selector: modifierSelector,
        declarations: [],
        children: new Map(),
        bemInfo: rule.bemInfo
      });
    }
    
    const modifierNode = currentNode.children.get(modifierSelector)!;
    
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
    // Handle merged selectors
    if (selector.includes(',')) {
      return selector; // Use full merged selector as pattern
    }
    
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
    
    // Handle merged selectors (comma-separated)
    if (selector.includes(',')) {
      // For merged selectors, just add declarations to base node
      baseNode.declarations.push(...rule.declarations);
      return;
    }
    
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

  private indentContent(content: string, level: number): string {
    const indent = this.getIndent(level);
    return content
      .split('\n')
      .map(line => line.trim() ? indent + line : line)
      .join('\n');
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