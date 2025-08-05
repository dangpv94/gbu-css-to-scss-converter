export interface AdvancedConversionOptions {
    indentSize?: number;
    indentType?: 'spaces' | 'tabs';
    preserveComments?: boolean;
    sortProperties?: boolean;
    enableBEM?: boolean;
    enableSmartNesting?: boolean;
    maxNestingDepth?: number;
}
export declare class AdvancedCSSToSCSSConverter {
    private options;
    constructor(options?: AdvancedConversionOptions);
    convert(cssContent: string): Promise<string>;
    private extractRules;
    private parseBEM;
    private calculateSpecificity;
    private buildAdvancedNestedStructure;
    private buildBEMStructure;
    private buildBEMBlock;
    private addBEMElement;
    private addBEMModifier;
    private addBEMElementModifier;
    private handlePseudoClasses;
    private buildSmartNestedStructure;
    private groupRulesByPattern;
    private extractBasePattern;
    private buildSmartNestedGroup;
    private insertSmartNestedRule;
    private parseComplexSelector;
    private insertComplexNestedRule;
    private buildBasicNestedStructure;
    private formatSCSS;
    private getIndent;
}
//# sourceMappingURL=advanced-converter.d.ts.map