#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'fs';
import { join, basename } from 'path';
import { CSSToSCSSConverter, ConversionOptions } from './index';

const program = new Command();

program
  .name('css2scss')
  .description('Convert CSS files to SCSS with proper nesting and beautiful formatting')
  .version('1.0.0');

program
  .argument('<input>', 'Input CSS file path')
  .option('-o, --output <path>', 'Output SCSS file path')
  .option('-i, --indent-size <number>', 'Indentation size (default: 2)', '2')
  .option('-t, --indent-type <type>', 'Indentation type: spaces or tabs (default: spaces)', 'spaces')
  .option('--no-comments', 'Remove comments from output')
  .option('-s, --sort', 'Sort CSS properties alphabetically')
  .option('--bem', 'Enable BEM methodology support (default: true)')
  .option('--no-bem', 'Disable BEM methodology support')
  .option('--smart-nesting', 'Enable smart nesting (default: true)')
  .option('--no-smart-nesting', 'Disable smart nesting')
  .option('--max-depth <number>', 'Maximum nesting depth (default: 5)', '5')
  .option('--dedupe', 'Enable duplicate detection and merging (default: true)')
  .option('--no-dedupe', 'Disable duplicate detection')
  .option('--advanced-bem', 'Enable advanced BEM with multi-level elements (default: true)')
  .option('--no-advanced-bem', 'Disable advanced BEM')
  .option('--media-grouping', 'Enable media query grouping (default: true)')
  .option('--no-media-grouping', 'Disable media query grouping')
  .option('--variables', 'Enable variable extraction (default: true)')
  .option('--no-variables', 'Disable variable extraction')
  .option('--var-prefix <prefix>', 'Variable prefix (default: $)', '$')
  .option('--min-occurrences <number>', 'Minimum occurrences for variable extraction (default: 2)', '2')
  .option('--extract-colors', 'Extract color variables (default: true)')
  .option('--no-extract-colors', 'Disable color variable extraction')
  .option('--extract-sizes', 'Extract size variables (default: true)')
  .option('--no-extract-sizes', 'Disable size variable extraction')
  .option('--extract-fonts', 'Extract font variables (default: true)')
  .option('--no-extract-fonts', 'Disable font variable extraction')
  .action(async (input: string, options: any) => {
    try {
      // Validate input file
      if (!existsSync(input)) {
        console.error(`Error: Input file '${input}' does not exist.`);
        process.exit(1);
      }

      // Read CSS content
      const cssContent = readFileSync(input, 'utf-8');
      
      // Setup conversion options
      const conversionOptions: ConversionOptions = {
        indentSize: parseInt(options.indentSize),
        indentType: options.indentType as 'spaces' | 'tabs',
        preserveComments: options.comments !== false,
        sortProperties: options.sort || false,
        enableBEM: options.bem !== false && options.noBem !== true,
        enableSmartNesting: options.smartNesting !== false && options.noSmartNesting !== true,
        maxNestingDepth: parseInt(options.maxDepth),
        enableDuplicateDetection: options.dedupe !== false && options.noDedupe !== true,
        enableAdvancedBEM: options.advancedBem !== false && options.noAdvancedBem !== true,
        enableMediaQueryGrouping: options.mediaGrouping !== false && options.noMediaGrouping !== true,
        enableVariableExtraction: options.variables !== false && options.noVariables !== true,
        variablePrefix: options.varPrefix,
        minOccurrences: parseInt(options.minOccurrences),
        extractColors: options.extractColors !== false && options.noExtractColors !== true,
        extractSizes: options.extractSizes !== false && options.noExtractSizes !== true,
        extractFonts: options.extractFonts !== false && options.noExtractFonts !== true,
        extractOthers: true,
      };

      // Convert CSS to SCSS
      const converter = new CSSToSCSSConverter(conversionOptions);
      const scssContent = await converter.convert(cssContent);

      // Determine output path
      const outputPath = options.output || input.replace(/\.css$/, '.scss');
      
      // Write SCSS content
      writeFileSync(outputPath, scssContent);
      
      console.log(`✅ Successfully converted '${input}' to '${outputPath}'`);
      console.log(`📊 Conversion options used:`);
      console.log(`   - Indent: ${conversionOptions.indentSize} ${conversionOptions.indentType}`);
      console.log(`   - Comments: ${conversionOptions.preserveComments ? 'preserved' : 'removed'}`);
      console.log(`   - Sort properties: ${conversionOptions.sortProperties ? 'yes' : 'no'}`);
      console.log(`   - BEM support: ${conversionOptions.enableBEM ? 'enabled' : 'disabled'}`);
      console.log(`   - Smart nesting: ${conversionOptions.enableSmartNesting ? 'enabled' : 'disabled'}`);
      console.log(`   - Max nesting depth: ${conversionOptions.maxNestingDepth}`);
      console.log(`   - Duplicate detection: ${conversionOptions.enableDuplicateDetection ? 'enabled' : 'disabled'}`);
      console.log(`   - Advanced BEM: ${conversionOptions.enableAdvancedBEM ? 'enabled' : 'disabled'}`);
      console.log(`   - Media query grouping: ${conversionOptions.enableMediaQueryGrouping ? 'enabled' : 'disabled'}`);
      console.log(`   - Variable extraction: ${conversionOptions.enableVariableExtraction ? 'enabled' : 'disabled'}`);
      if (conversionOptions.enableVariableExtraction) {
        console.log(`   - Variable prefix: ${conversionOptions.variablePrefix}`);
        console.log(`   - Min occurrences: ${conversionOptions.minOccurrences}`);
        console.log(`   - Extract colors: ${conversionOptions.extractColors ? 'yes' : 'no'}`);
        console.log(`   - Extract sizes: ${conversionOptions.extractSizes ? 'yes' : 'no'}`);
        console.log(`   - Extract fonts: ${conversionOptions.extractFonts ? 'yes' : 'no'}`);
      }
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Error: ${errorMessage}`);
      process.exit(1);
    }
  });

program
  .command('batch')
  .description('Convert multiple CSS files in a directory')
  .argument('<directory>', 'Directory containing CSS files')
  .option('-o, --output <path>', 'Output directory (default: same as input)')
  .option('-i, --indent-size <number>', 'Indentation size (default: 2)', '2')
  .option('-t, --indent-type <type>', 'Indentation type: spaces or tabs (default: spaces)', 'spaces')
  .option('--no-comments', 'Remove comments from output')
  .option('-s, --sort', 'Sort CSS properties alphabetically')
  .option('--bem', 'Enable BEM methodology support (default: true)')
  .option('--no-bem', 'Disable BEM methodology support')
  .option('--smart-nesting', 'Enable smart nesting (default: true)')
  .option('--no-smart-nesting', 'Disable smart nesting')
  .option('--max-depth <number>', 'Maximum nesting depth (default: 5)', '5')
  .option('--dedupe', 'Enable duplicate detection and merging (default: true)')
  .option('--no-dedupe', 'Disable duplicate detection')
  .option('--advanced-bem', 'Enable advanced BEM with multi-level elements (default: true)')
  .option('--no-advanced-bem', 'Disable advanced BEM')
  .option('--media-grouping', 'Enable media query grouping (default: true)')
  .option('--no-media-grouping', 'Disable media query grouping')
  .option('--variables', 'Enable variable extraction (default: true)')
  .option('--no-variables', 'Disable variable extraction')
  .option('--var-prefix <prefix>', 'Variable prefix (default: $)', '$')
  .option('--min-occurrences <number>', 'Minimum occurrences for variable extraction (default: 2)', '2')
  .option('--extract-colors', 'Extract color variables (default: true)')
  .option('--no-extract-colors', 'Disable color variable extraction')
  .option('--extract-sizes', 'Extract size variables (default: true)')
  .option('--no-extract-sizes', 'Disable size variable extraction')
  .option('--extract-fonts', 'Extract font variables (default: true)')
  .option('--no-extract-fonts', 'Disable font variable extraction')
  .action(async (directory: string, options: any) => {
    try {
      if (!existsSync(directory)) {
        console.error(`Error: Directory '${directory}' does not exist.`);
        process.exit(1);
      }

      const files = readdirSync(directory)
        .filter((file: string) => file.endsWith('.css'))
        .map((file: string) => join(directory, file));

      if (files.length === 0) {
        console.log('No CSS files found in the directory.');
        return;
      }

      const outputDir = options.output || directory;
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }

      const conversionOptions: ConversionOptions = {
        indentSize: parseInt(options.indentSize),
        indentType: options.indentType as 'spaces' | 'tabs',
        preserveComments: options.comments !== false,
        sortProperties: options.sort || false,
        enableBEM: options.bem !== false && options.noBem !== true,
        enableSmartNesting: options.smartNesting !== false && options.noSmartNesting !== true,
        maxNestingDepth: parseInt(options.maxDepth),
        enableDuplicateDetection: options.dedupe !== false && options.noDedupe !== true,
        enableAdvancedBEM: options.advancedBem !== false && options.noAdvancedBem !== true,
        enableMediaQueryGrouping: options.mediaGrouping !== false && options.noMediaGrouping !== true,
        enableVariableExtraction: options.variables !== false && options.noVariables !== true,
        variablePrefix: options.varPrefix,
        minOccurrences: parseInt(options.minOccurrences),
        extractColors: options.extractColors !== false && options.noExtractColors !== true,
        extractSizes: options.extractSizes !== false && options.noExtractSizes !== true,
        extractFonts: options.extractFonts !== false && options.noExtractFonts !== true,
        extractOthers: true,
      };

      const converter = new CSSToSCSSConverter(conversionOptions);
      let successCount = 0;

      for (const file of files) {
        try {
          const cssContent = readFileSync(file, 'utf-8');
          const scssContent = await converter.convert(cssContent);
          const outputFile = join(outputDir, basename(file).replace('.css', '.scss'));
          
          writeFileSync(outputFile, scssContent);
          console.log(`✅ Converted: ${basename(file)} → ${basename(outputFile)}`);
          successCount++;
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`❌ Failed to convert ${file}: ${errorMessage}`);
        }
      }

      console.log(`\n🎉 Batch conversion completed: ${successCount}/${files.length} files converted successfully.`);
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Error: ${errorMessage}`);
      process.exit(1);
    }
  });

program.parse();