import * as csstree from 'css-tree';

export interface VariableEnhancedConversionOptions {
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
  enableVariableExtraction?: boolean;
  variablePrefix?: string;
  minOccurrences?: number;
  extractColors?: boolean;
  extractSizes?: boolean;
  extractFonts?: boolean;
  extractOthers?: boolean;
}

interface ParsedRule {
  selector: string;
  declarations: Declaration[];
  specificity: number[];
  bemInfo?: AdvancedBEMInfo;
  mediaQuery?: string;
  hash?: string;
}

interface AdvancedBEMInfo {
  block: string;
  elements: string[];
  modifier?: string;
  type: 'block' | 'element' | 'modifier' | 'element-modifier';
  level: number;
}

interface Declaration {
  type: 'declaration' | 'comment';
  property?: string;
  value: string;
  important?: boolean;
  originalValue?: string; // Store original before variable replacement
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

interface VariableCandidate {
  value: string;
  property: string;
  occurrences: number;
  contexts: string[]; // Where it's used
  category: 'color' | 'size' | 'font' | 'other';
  suggestedName: string;
}

interface ExtractedVariable {
  name: string;
  value: string;
  category: 'color' | 'size' | 'font' | 'other';
  occurrences: number;
}

export class VariableEnhancedCSSToSCSSConverter {
  private options: Required<VariableEnhancedConversionOptions>;
  private variableCandidates: Map<string, VariableCandidate> = new Map();
  private extractedVariables: Map<string, ExtractedVariable> = new Map();

  constructor(options: VariableEnhancedConversionOptions = {}) {
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
      enableVariableExtraction: options.enableVariableExtraction !== false,
      variablePrefix: options.variablePrefix || '$',
      minOccurrences: options.minOccurrences || 2,
      extractColors: options.extractColors !== false,
      extractSizes: options.extractSizes !== false,
      extractFonts: options.extractFonts !== false,
      extractOthers: options.extractOthers !== false,
    };
  }

  async convert(cssContent: string): Promise<string> {
    try {
      const ast = csstree.parse(cssContent);
      const rules = this.extractRules(ast);
      
      // Step 1: Analyze for variable candidates if enabled
      if (this.options.enableVariableExtraction) {
        this.analyzeVariableCandidates(rules);
        this.extractVariables();
        this.replaceValuesWithVariables(rules);
      }
      
      // Step 2: Detect and merge duplicates within same media query
      const deduplicatedRules = this.options.enableDuplicateDetection 
        ? this.detectAndMergeDuplicates(rules)
        : rules;
      
      // Step 3: Group by media queries
      const mediaGroups = this.options.enableMediaQueryGrouping
        ? this.groupByMediaQuery(deduplicatedRules)
        : [{ query: '', rules: deduplicatedRules }];
      
      // Step 4: Build nested structure for each media query group
      let result = '';
      
      // Add variables at the top if any were extracted
      if (this.options.enableVariableExtraction && this.extractedVariables.size > 0) {
        result += this.formatVariables();
        result += '\n';
      }
      
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

  private analyzeVariableCandidates(rules: ParsedRule[]): void {
    const valueOccurrences = new Map<string, { count: number; contexts: string[]; properties: Set<string> }>();
    
    rules.forEach(rule => {
      rule.declarations.forEach(decl => {
        if (decl.type === 'declaration' && decl.property && decl.value) {
          const category = this.categorizeValue(decl.property, decl.value);
          
          // Skip if category is disabled
          if (!this.shouldExtractCategory(category)) return;
          
          const key = `${decl.property}:${decl.value}`;
          
          if (!valueOccurrences.has(key)) {
            valueOccurrences.set(key, {
              count: 0,
              contexts: [],
              properties: new Set()
            });
          }
          
          const occurrence = valueOccurrences.get(key)!;
          occurrence.count++;
          occurrence.contexts.push(rule.selector);
          occurrence.properties.add(decl.property);
          
          // Create or update variable candidate
          if (!this.variableCandidates.has(key)) {
            this.variableCandidates.set(key, {
              value: decl.value,
              property: decl.property,
              occurrences: 0,
              contexts: [],
              category,
              suggestedName: this.generateVariableName(decl.property, decl.value, category)
            });
          }
          
          const candidate = this.variableCandidates.get(key)!;
          candidate.occurrences = occurrence.count;
          candidate.contexts = occurrence.contexts;
        }
      });
    });
  }

  private categorizeValue(property: string, value: string): 'color' | 'size' | 'font' | 'other' {
    // Color detection
    if (this.isColorProperty(property) || this.isColorValue(value)) {
      return 'color';
    }
    
    // Size detection
    if (this.isSizeProperty(property) || this.isSizeValue(value)) {
      return 'size';
    }
    
    // Font detection
    if (this.isFontProperty(property)) {
      return 'font';
    }
    
    return 'other';
  }

  private isColorProperty(property: string): boolean {
    const colorProperties = [
      'color', 'background-color', 'border-color', 'outline-color',
      'text-decoration-color', 'caret-color', 'column-rule-color',
      'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color'
    ];
    return colorProperties.includes(property);
  }

  private isColorValue(value: string): boolean {
    // Hex colors
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value)) return true;
    
    // RGB/RGBA
    if (/^rgba?\(/.test(value)) return true;
    
    // HSL/HSLA
    if (/^hsla?\(/.test(value)) return true;
    
    // Named colors (common ones)
    const namedColors = [
      'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'brown',
      'black', 'white', 'gray', 'grey', 'transparent', 'currentColor'
    ];
    return namedColors.includes(value.toLowerCase());
  }

  private isSizeProperty(property: string): boolean {
    const sizeProperties = [
      'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
      'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
      'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
      'border-width', 'border-radius', 'font-size', 'line-height', 'letter-spacing',
      'top', 'right', 'bottom', 'left', 'gap', 'column-gap', 'row-gap'
    ];
    return sizeProperties.includes(property);
  }

  private isSizeValue(value: string): boolean {
    // Check for size units
    return /^\d+(\.\d+)?(px|em|rem|%|vh|vw|vmin|vmax|pt|pc|in|cm|mm|ex|ch)$/.test(value);
  }

  private isFontProperty(property: string): boolean {
    const fontProperties = [
      'font-family', 'font-weight', 'font-style', 'font-variant',
      'font-stretch', 'font-size', 'line-height'
    ];
    return fontProperties.includes(property);
  }

  private shouldExtractCategory(category: 'color' | 'size' | 'font' | 'other'): boolean {
    switch (category) {
      case 'color': return this.options.extractColors;
      case 'size': return this.options.extractSizes;
      case 'font': return this.options.extractFonts;
      case 'other': return this.options.extractOthers;
      default: return false;
    }
  }

  private generateVariableName(property: string, value: string, category: 'color' | 'size' | 'font' | 'other'): string {
    const prefix = this.options.variablePrefix;
    
    // Clean value for naming
    let cleanValue = value
      .replace(/[^a-zA-Z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
    
    // Generate name based on category and context
    switch (category) {
      case 'color':
        if (value.startsWith('#')) {
          // For hex colors, try to give semantic names
          const colorName = this.getSemanticColorName(value);
          return `${prefix}color-${colorName || cleanValue}`;
        }
        if (value === 'inherit') {
          return `${prefix}color-inherit`;
        }
        if (value === 'transparent') {
          return `${prefix}color-transparent`;
        }
        return `${prefix}color-${cleanValue}`;
        
      case 'size':
        // Common size values
        if (value === 'inherit') {
          return `${prefix}size-inherit`;
        }
        if (value === 'auto') {
          return `${prefix}size-auto`;
        }
        if (value === '0') {
          return `${prefix}size-0`;
        }
        if (value === '100%') {
          return `${prefix}size-full`;
        }
        
        // Property-specific naming
        if (property.includes('font-size')) {
          return `${prefix}text-${cleanValue}`;
        }
        if (property.includes('padding')) {
          return `${prefix}p-${cleanValue}`;
        }
        if (property.includes('margin')) {
          return `${prefix}m-${cleanValue}`;
        }
        if (property.includes('border-radius')) {
          return `${prefix}rounded-${cleanValue}`;
        }
        if (property.includes('width') || property.includes('height')) {
          return `${prefix}size-${cleanValue}`;
        }
        
        return `${prefix}spacing-${cleanValue}`;
        
      case 'font':
        if (property === 'font-family') {
          return `${prefix}font-${cleanValue}`;
        }
        if (property === 'font-weight') {
          return `${prefix}font-${cleanValue}`;
        }
        if (property === 'font-size') {
          return `${prefix}text-${cleanValue}`;
        }
        return `${prefix}font-${cleanValue}`;
        
      default:
        // Common values
        if (value === 'none') {
          return `${prefix}${property.replace(/-/g, '-')}-none`;
        }
        if (value === 'inherit') {
          return `${prefix}${property.replace(/-/g, '-')}-inherit`;
        }
        if (value === 'auto') {
          return `${prefix}${property.replace(/-/g, '-')}-auto`;
        }
        
        return `${prefix}${property.replace(/-/g, '-')}-${cleanValue}`;
    }
  }

  private getSemanticColorName(hexColor: string): string | null {
    const colorMap: { [key: string]: string } = {
      '#000000': 'black',
      '#ffffff': 'white',
      '#ff0000': 'red',
      '#00ff00': 'green',
      '#0000ff': 'blue',
      '#ffff00': 'yellow',
      '#ff00ff': 'magenta',
      '#00ffff': 'cyan',
      '#808080': 'gray',
      '#c0c0c0': 'silver',
      '#800000': 'maroon',
      '#008000': 'dark-green',
      '#000080': 'navy',
      '#808000': 'olive',
      '#800080': 'purple',
      '#008080': 'teal',
      '#007bff': 'primary-blue',
      '#28a745': 'success-green',
      '#dc3545': 'danger-red',
      '#ffc107': 'warning-yellow',
      '#17a2b8': 'info-cyan',
      '#6c757d': 'secondary-gray',
      '#f8f9fa': 'light-gray',
      '#343a40': 'dark-gray'
    };
    
    return colorMap[hexColor.toLowerCase()] || null;
  }

  private extractVariables(): void {
    // Group candidates by value to avoid duplicates
    const valueGroups = new Map<string, VariableCandidate[]>();
    
    this.variableCandidates.forEach((candidate, key) => {
      if (candidate.occurrences >= this.options.minOccurrences) {
        const valueKey = `${candidate.category}:${candidate.value}`;
        if (!valueGroups.has(valueKey)) {
          valueGroups.set(valueKey, []);
        }
        valueGroups.get(valueKey)!.push(candidate);
      }
    });
    
    // Extract variables, preferring the most used candidate for each value
    valueGroups.forEach((candidates, valueKey) => {
      // Sort by occurrences (highest first) and take the most used one
      candidates.sort((a, b) => b.occurrences - a.occurrences);
      const bestCandidate = candidates[0];
      
      // Calculate total occurrences across all candidates with same value
      const totalOccurrences = candidates.reduce((sum, c) => sum + c.occurrences, 0);
      
      let variableName = bestCandidate.suggestedName;
      let counter = 1;
      
      // Ensure unique variable names
      while (Array.from(this.extractedVariables.values()).some(v => v.name === variableName)) {
        variableName = `${bestCandidate.suggestedName}-${counter}`;
        counter++;
      }
      
      // Use the key from the best candidate
      const bestKey = `${bestCandidate.property}:${bestCandidate.value}`;
      
      this.extractedVariables.set(bestKey, {
        name: variableName,
        value: bestCandidate.value,
        category: bestCandidate.category,
        occurrences: totalOccurrences
      });
      
      console.log(`🎨 Extracted variable: ${variableName} = ${bestCandidate.value} (${totalOccurrences} occurrences)`);
    });
  }

  private replaceValuesWithVariables(rules: ParsedRule[]): void {
    // Create a map of value -> variable name for faster lookup
    const valueToVariable = new Map<string, string>();
    
    this.extractedVariables.forEach(variable => {
      valueToVariable.set(variable.value, variable.name);
    });
    
    rules.forEach(rule => {
      rule.declarations.forEach(decl => {
        if (decl.type === 'declaration' && decl.property && decl.value) {
          // Skip keyframes-block special property
          if (decl.property === '@keyframes-block') return;
          
          // Check if this value has a corresponding variable
          const variableName = valueToVariable.get(decl.value);
          
          if (variableName) {
            // Verify this property-value combination should use variables
            const category = this.categorizeValue(decl.property, decl.value);
            if (this.shouldExtractCategory(category)) {
              decl.originalValue = decl.value;
              decl.value = variableName;
            }
          }
        }
      });
    });
  }

  private formatVariables(): string {
    let result = '// Variables\n';
    
    // Group variables by category
    const categories = new Map<string, ExtractedVariable[]>();
    
    this.extractedVariables.forEach(variable => {
      if (!categories.has(variable.category)) {
        categories.set(variable.category, []);
      }
      categories.get(variable.category)!.push(variable);
    });
    
    // Sort categories
    const sortedCategories = ['color', 'size', 'font', 'other'];
    
    sortedCategories.forEach(categoryName => {
      const variables = categories.get(categoryName);
      if (variables && variables.length > 0) {
        result += `\n// ${categoryName.charAt(0).toUpperCase() + categoryName.slice(1)} variables\n`;
        
        // Sort variables within category
        variables.sort((a, b) => a.name.localeCompare(b.name));
        
        variables.forEach(variable => {
          result += `${variable.name}: ${variable.value};\n`;
        });
      }
    });
    
    return result;
  }

  // Include all the existing methods from UltimateCSSToSCSSConverter
  private extractRules(ast: csstree.CssNode): ParsedRule[] {
    const rules: ParsedRule[] = [];
    let currentMediaQuery = '';
    
    csstree.walk(ast, (node: csstree.CssNode) => {
      if (node.type === 'Atrule') {
        const atrule = node as csstree.Atrule;
        
        // Handle media queries
        if (atrule.name === 'media' && atrule.prelude) {
          currentMediaQuery = csstree.generate(atrule.prelude);
          return;
        }
        
        // Handle keyframes (including webkit-keyframes) - skip walking into them to avoid orphaned rules
        if ((atrule.name === 'keyframes' || atrule.name === '-webkit-keyframes') && atrule.prelude && atrule.block) {
          const keyframeName = csstree.generate(atrule.prelude);
          const keyframeRule = `@${atrule.name} ${keyframeName}`;
          const declarations: Declaration[] = [];
          

          
          // Add the entire keyframes block as a special declaration
          declarations.push({
            type: 'declaration',
            property: '@keyframes-block',
            value: csstree.generate(atrule.block),
            important: false
          });
          
          rules.push({
            selector: keyframeRule,
            declarations,
            specificity: [0, 0, 0],
            mediaQuery: currentMediaQuery || undefined,
            hash: `keyframes-${atrule.name}-${keyframeName}`
          });
          
          // Skip walking into keyframes children to prevent orphaned rules
          return;
        }
        
        // Handle other at-rules (font-face, etc.)
        if (atrule.block) {
          const atRuleName = `@${atrule.name}${atrule.prelude ? ' ' + csstree.generate(atrule.prelude) : ''}`;
          const declarations: Declaration[] = [];
          
          atrule.block.children.forEach((child: csstree.CssNode) => {
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
          
          rules.push({
            selector: atRuleName,
            declarations,
            specificity: [0, 0, 0],
            mediaQuery: currentMediaQuery || undefined,
            hash: `atrule-${atrule.name}-${Date.now()}`
          });
        }
        return;
      }
      
      if (node.type === 'Rule') {
        const rule = node as csstree.Rule;
        const selectorText = csstree.generate(rule.prelude);
        const declarations: Declaration[] = [];
        const seenProperties = new Set<string>(); // Track duplicate properties
        
        if (rule.block && rule.block.children) {
          rule.block.children.forEach((child: csstree.CssNode) => {
            if (child.type === 'Declaration') {
              const declaration = child as csstree.Declaration;
              const propertyKey = `${declaration.property}:${declaration.important ? '!important' : ''}`;
              
              // Skip duplicate properties (keep the last one)
              if (seenProperties.has(propertyKey)) {
                // Remove previous declaration with same property
                const existingIndex = declarations.findIndex(d => 
                  d.type === 'declaration' && 
                  d.property === declaration.property && 
                  d.important === (declaration.important === true)
                );
                if (existingIndex !== -1) {
                  declarations.splice(existingIndex, 1);
                }
              }
              
              seenProperties.add(propertyKey);
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

    // Filter out orphaned keyframe rules (0%, 100%, from, to without parent @keyframes)
    const filteredRules = rules.filter(rule => {
      // Keep keyframes at-rules
      if (rule.selector.startsWith('@keyframes') || rule.selector.startsWith('@-webkit-keyframes')) {
        return true;
      }
      
      // Filter out orphaned keyframe selectors
      if (rule.selector.match(/^(0%|100%|\d+%|from|to)$/)) {
        return false;
      }
      
      return true;
    });

    return filteredRules;
  }

  // Copy all other methods from UltimateCSSToSCSSConverter
  private parseAdvancedBEM(selector: string): AdvancedBEMInfo | undefined {
    const cleanSelector = selector.replace(/:[^,\s]+/g, '').replace(/\[[^\]]+\]/g, '');
    const advancedBemRegex = /^\.([a-zA-Z0-9-]+)(?:__((?:[a-zA-Z0-9-]+(?:__)?)+))?(?:--([a-zA-Z0-9-]+))?$/;
    const match = cleanSelector.match(advancedBemRegex);
    
    if (!match) return undefined;
    
    const [, block, elementPart, modifier] = match;
    const elements = elementPart ? elementPart.split('__').filter(e => e.length > 0) : [];
    const level = elements.length;
    
    if (elements.length > 0 && modifier) {
      return { block, elements, modifier, type: 'element-modifier', level: level + 1 };
    } else if (elements.length > 0) {
      return { block, elements, type: 'element', level };
    } else if (modifier) {
      return { block, elements: [], modifier, type: 'modifier', level: 1 };
    } else {
      return { block, elements: [], type: 'block', level: 0 };
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
    // Copy implementation from UltimateCSSToSCSSConverter
    const mediaQueryGroups = new Map<string, Map<string, ParsedRule[]>>();
    
    rules.forEach(rule => {
      const mediaKey = rule.mediaQuery || 'default';
      
      if (!mediaQueryGroups.has(mediaKey)) {
        mediaQueryGroups.set(mediaKey, new Map());
      }
      
      const mediaGroup = mediaQueryGroups.get(mediaKey)!;
      const declHash = this.generateDeclarationHash(rule.declarations);
      
      if (!mediaGroup.has(declHash)) {
        mediaGroup.set(declHash, []);
      }
      
      mediaGroup.get(declHash)!.push(rule);
    });
    
    const mergedRules: ParsedRule[] = [];
    
    mediaQueryGroups.forEach((mediaGroup, mediaKey) => {
      mediaGroup.forEach((duplicateRules, declHash) => {
        if (duplicateRules.length > 1 && duplicateRules[0].selector !== '/* COMMENT */') {
          const firstDeclarations = duplicateRules[0].declarations;
          const allIdentical = duplicateRules.every(rule => 
            this.declarationsEqual(rule.declarations, firstDeclarations)
          );
          
          if (allIdentical) {
            const mergedSelectors = duplicateRules.map(r => r.selector).join(', ');
            const firstRule = duplicateRules[0];
            
            mergedRules.push({
              ...firstRule,
              selector: mergedSelectors,
              mediaQuery: mediaKey === 'default' ? undefined : mediaKey,
              hash: `merged-${declHash}`
            });
            
            console.log(`🔄 Merged ${duplicateRules.length} duplicate rules: ${mergedSelectors}`);
          } else {
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

  // Include all other methods from UltimateCSSToSCSSConverter...
  // (For brevity, I'll include the key methods. The full implementation would include all methods)

  private buildAdvancedBEMStructure(rules: ParsedRule[], root: NestedRule): NestedRule {
    // Implementation similar to UltimateCSSToSCSSConverter
    const bemBlocks = new Map<string, ParsedRule[]>();
    const nonBemRules: ParsedRule[] = [];
    const atRules: ParsedRule[] = [];
    
    rules.forEach(rule => {
      if (rule.selector === '/* COMMENT */') {
        root.declarations.push(...rule.declarations);
        return;
      }
      
      // Handle at-rules (keyframes, font-face, etc.) separately
      if (rule.selector.startsWith('@')) {
        atRules.push(rule);
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
    
    // Add at-rules directly to root without nesting
    atRules.forEach(rule => {
      const child: NestedRule = {
        selector: rule.selector,
        declarations: [...rule.declarations],
        children: new Map()
      };
      root.children.set(rule.selector, child);
    });
    
    bemBlocks.forEach((blockRules, blockName) => {
      this.buildAdvancedBEMBlock(blockName, blockRules, root);
    });
    
    if (nonBemRules.length > 0) {
      this.buildSmartNestedStructure(nonBemRules, root);
    }
    
    return root;
  }

  private buildAdvancedBEMBlock(blockName: string, rules: ParsedRule[], root: NestedRule): void {
    // Similar implementation to UltimateCSSToSCSSConverter
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

  // Add other necessary methods...
  private addBEMBlockRule(blockNode: NestedRule, rule: ParsedRule): void {
    const pseudoMatch = rule.selector.match(/(:+[^,\\s]+)/);
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
    
    const pseudoMatch = rule.selector.match(/(:+[^,\\s]+)/);
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
    
    const pseudoMatch = rule.selector.match(/(:+[^,\\s]+)/);
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
      
      // Handle at-rules separately - use full selector as pattern
      if (rule.selector.startsWith('@')) {
        const atRulePattern = rule.selector;
        if (!groups.has(atRulePattern)) {
          groups.set(atRulePattern, []);
        }
        groups.get(atRulePattern)!.push(rule);
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
    if (selector.includes(',')) {
      return selector;
    }
    
    const parts = selector.split(/[\s>+~]/);
    const firstPart = parts[0].trim();
    
    return firstPart.replace(/:[^,\s]+/g, '');
  }

  private buildSmartNestedGroup(basePattern: string, rules: ParsedRule[], root: NestedRule): void {
    if (basePattern === 'COMMENTS') {
      rules.forEach(rule => {
        root.declarations.push(...rule.declarations);
      });
      return;
    }
    
    // Handle at-rules directly without nesting
    if (basePattern.startsWith('@')) {
      rules.forEach(rule => {
        const child: NestedRule = {
          selector: rule.selector,
          declarations: [...rule.declarations],
          children: new Map()
        };
        root.children.set(rule.selector, child);
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
    
    if (selector.includes(',')) {
      baseNode.declarations.push(...rule.declarations);
      return;
    }
    
    if (selector === basePattern) {
      baseNode.declarations.push(...rule.declarations);
    } else if (selector.startsWith(basePattern)) {
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
      const parts = this.parseComplexSelector(selector, basePattern);
      this.insertComplexNestedRule(parts, rule.declarations, baseNode);
    }
  }

  private parseComplexSelector(selector: string, basePattern: string): string[] {
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
    
    if (depth === 0 && structure.declarations.length > 0) {
      structure.declarations.forEach(decl => {
        if (decl.type === 'comment') {
          result += `/* ${decl.value} */\n`;
        }
      });
      if (structure.declarations.length > 0) result += '\n';
    }
    
    const children = Array.from(structure.children.entries());
    if (this.options.sortProperties) {
      children.sort(([a], [b]) => {
        if (a.startsWith('&__') && b.startsWith('&--')) return -1;
        if (a.startsWith('&--') && b.startsWith('&__')) return 1;
        return a.localeCompare(b);
      });
    }
    
    children.forEach(([selector, child]) => {
      if (child.declarations.length > 0 || child.children.size > 0) {
        // Handle keyframes specially (including webkit-keyframes)
        if (selector.startsWith('@keyframes') || selector.startsWith('@-webkit-keyframes')) {
          result += `${indent}${selector} {\n`;
          
          child.declarations.forEach(decl => {
            if (decl.property === '@keyframes-block') {
              // Format keyframes block content properly
              const keyframeContent = decl.value
                .replace(/^\{|\}$/g, '') // Remove outer braces
                .trim();
              
              // Parse and format keyframe rules using regex to properly split
              const keyframeRules = keyframeContent.match(/(\d+%|from|to)\s*\{[^}]*\}/g);
              if (keyframeRules) {
                keyframeRules.forEach(rule => {
                  const formatted = this.formatKeyframeRule(rule, depth + 1);
                  result += formatted;
                });
              }
            }
          });
          
          result += `${indent}}\n\n`;
          return;
        }
        
        // Handle other at-rules (font-face, etc.)
        if (selector.startsWith('@')) {
          result += `${indent}${selector} {\n`;
          
          child.declarations.forEach(decl => {
            if (decl.type === 'comment') {
              result += `${this.getIndent(depth + 1)}/* ${decl.value} */\n`;
            } else if (decl.property && decl.property !== '@keyframes-block') {
              const important = decl.important ? ' !important' : '';
              result += `${this.getIndent(depth + 1)}${decl.property}: ${decl.value}${important};\n`;
            }
          });
          
          result += `${indent}}\n\n`;
          return;
        }
        
        // Handle regular CSS rules
        result += `${indent}${selector} {\n`;
        
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
        
        if (child.children.size > 0) {
          if (child.declarations.length > 0) result += '\n';
          result += this.formatSCSS(child, depth + 1);
        }
        
        result += `${indent}}\n`;
        if (depth === 0) result += '\n';
      }
    });
    
    return result;
  }

  private formatKeyframeRule(rule: string, depth: number): string {
    const indent = this.getIndent(depth);
    const match = rule.match(/^([\d%]+|from|to)\s*\{(.+)\}$/s);
    
    if (!match) return '';
    
    const [, keyframe, declarations] = match;
    let result = `${indent}${keyframe} {\n`;
    
    // Parse declarations
    const declPairs = declarations.split(';').filter(d => d.trim());
    const seenProps = new Set<string>();
    
    declPairs.forEach(decl => {
      const [prop, value] = decl.split(':').map(s => s.trim());
      if (prop && value && !seenProps.has(prop)) {
        seenProps.add(prop);
        result += `${this.getIndent(depth + 1)}${prop}: ${value};\n`;
      }
    });
    
    result += `${indent}}\n\n`;
    return result;
  }

  private getIndent(depth: number): string {
    const unit = this.options.indentType === 'tabs' ? '\t' : ' '.repeat(this.options.indentSize);
    return unit.repeat(depth);
  }
}