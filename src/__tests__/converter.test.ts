import { CSSToSCSSConverter } from '../index';

describe('VariableEnhancedCSSToSCSSConverter', () => {
  let converter: CSSToSCSSConverter;

  beforeEach(() => {
    converter = new CSSToSCSSConverter();
  });

  test('should convert simple CSS to SCSS', async () => {
    const css = `
.nav {
  background: #333;
  padding: 10px;
}

.nav ul {
  list-style: none;
  margin: 0;
}

.nav ul li {
  display: inline-block;
}
    `.trim();

    const result = await converter.convert(css);
    
    expect(result).toContain('.nav {');
    expect(result).toContain('  & ul {');
    expect(result).toContain('  & ul li {');
    expect(result).toContain('    display: inline-block;');
  });

  test('should handle BEM methodology', async () => {
    const bemConverter = new CSSToSCSSConverter({ enableBEM: true });
    
    const css = `
.header {
  background: #333;
  padding: 20px;
}

.header__logo {
  font-size: 24px;
  color: white;
}

.header__logo:hover {
  color: #ccc;
}

.header--dark {
  background: #000;
}
    `.trim();

    const result = await bemConverter.convert(css);
    
    expect(result).toContain('.header {');
    expect(result).toContain('  &__logo {');
    expect(result).toContain('    &:hover {');
    expect(result).toContain('.header--dark {');
  });

  test('should extract variables from repeated values', async () => {
    const variableConverter = new CSSToSCSSConverter({ 
      enableVariableExtraction: true,
      minOccurrences: 2,
      enableBEM: false 
    });
    
    const css = `
.header {
  background-color: #007bff;
  padding: 20px;
  border-radius: 8px;
}

.nav {
  background-color: #007bff;
  padding: 20px;
  border-radius: 4px;
}

.button {
  background-color: #007bff;
  padding: 10px;
  border-radius: 4px;
}
    `.trim();

    const result = await variableConverter.convert(css);
    
    // Should have variables section
    expect(result).toContain('// Variables');
    expect(result).toContain('// Color variables');
    expect(result).toContain('$color-primary-blue: #007bff;');
    expect(result).toContain('$padding-20px: 20px;');
    expect(result).toContain('$border-4px: 4px;');
    
    // Should use variables in rules
    expect(result).toContain('background-color: $color-primary-blue;');
    expect(result).toContain('padding: $padding-20px;');
    expect(result).toContain('border-radius: $border-4px;');
  });

  test('should respect minimum occurrences for variable extraction', async () => {
    const variableConverter = new CSSToSCSSConverter({ 
      enableVariableExtraction: true,
      minOccurrences: 3,
      enableBEM: false 
    });
    
    const css = `
.header {
  background-color: #007bff;
  padding: 20px;
}

.nav {
  background-color: #007bff;
  padding: 15px;
}

.button {
  background-color: #28a745;
  padding: 10px;
}
    `.trim();

    const result = await variableConverter.convert(css);
    
    // Should not extract variables with less than 3 occurrences
    expect(result).not.toContain('$color-primary-blue');
    expect(result).not.toContain('$padding-20px');
    
    // Should keep original values
    expect(result).toContain('background-color: #007bff;');
    expect(result).toContain('padding: 20px;');
  });

  test('should detect and merge duplicate rules', async () => {
    const dedupeConverter = new CSSToSCSSConverter({ 
      enableDuplicateDetection: true,
      enableVariableExtraction: false,
      enableBEM: false 
    });
    
    const css = `
.btn {
  padding: 10px 20px;
  border: none;
  cursor: pointer;
}

.button {
  padding: 10px 20px;
  border: none;
  cursor: pointer;
}

.action {
  padding: 10px 20px;
  border: none;
  cursor: pointer;
}
    `.trim();

    const result = await dedupeConverter.convert(css);
    
    expect(result).toContain('.btn, .button, .action {');
    expect(result).toContain('  padding: 10px 20px;');
    expect(result).toContain('  border: none;');
    expect(result).toContain('  cursor: pointer;');
  });

  test('should handle advanced BEM with multi-level elements', async () => {
    const advancedBemConverter = new CSSToSCSSConverter({ 
      enableBEM: true, 
      enableAdvancedBEM: true 
    });
    
    const css = `
.card {
  border: 1px solid #ddd;
}

.card__header__title {
  font-size: 1.5rem;
  margin: 0;
}

.card__body__actions__button {
  padding: 8px 16px;
  border: none;
}

.card__body__actions__button:hover {
  opacity: 0.8;
}
    `.trim();

    const result = await advancedBemConverter.convert(css);
    
    expect(result).toContain('.card {');
    expect(result).toContain('  &__header {');
    expect(result).toContain('    &__title {');
    expect(result).toContain('  &__body {');
    expect(result).toContain('    &__actions {');
    expect(result).toContain('      &__button {');
    expect(result).toContain('        &:hover {');
  });
});