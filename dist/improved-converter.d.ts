export interface ConversionOptions {
    indentSize?: number;
    indentType?: 'spaces' | 'tabs';
    preserveComments?: boolean;
    sortProperties?: boolean;
}
export declare class ImprovedCSSToSCSSConverter {
    private options;
    constructor(options?: ConversionOptions);
    convert(cssContent: string): Promise<string>;
    private extractRules;
    private calculateSpecificity;
    private buildNestedStructure;
    private groupRulesByBase;
    private parseSelector;
    private buildNestedGroup;
    private insertNestedRule;
    private handleComplexSelector;
    private formatSCSS;
    private formatSelectorForNesting;
    private getIndent;
}
//# sourceMappingURL=improved-converter.d.ts.map