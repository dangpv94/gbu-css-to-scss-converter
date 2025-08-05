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
export declare class UltimateCSSToSCSSConverter {
    private options;
    constructor(options?: UltimateConversionOptions);
    convert(cssContent: string): Promise<string>;
    private extractRules;
    private parseAdvancedBEM;
    private generateRuleHash;
    private detectAndMergeDuplicates;
    private generateDeclarationHash;
    private declarationsEqual;
    private groupByMediaQuery;
    private calculateSpecificity;
    private buildAdvancedNestedStructure;
    private buildAdvancedBEMStructure;
    private buildAdvancedBEMBlock;
    private addBEMBlockRule;
    private addAdvancedBEMElement;
    private addBEMModifier;
    private addAdvancedBEMElementModifier;
    private buildSmartNestedStructure;
    private groupRulesByPattern;
    private extractBasePattern;
    private buildSmartNestedGroup;
    private insertSmartNestedRule;
    private parseComplexSelector;
    private insertComplexNestedRule;
    private buildBasicNestedStructure;
    private indentContent;
    private formatSCSS;
    private getIndent;
}
//# sourceMappingURL=ultimate-converter.d.ts.map