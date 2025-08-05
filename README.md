# GBU CSS to SCSS Converter

Một package Node.js mạnh mẽ để chuyển đổi file CSS sang SCSS với proper nesting và format đẹp.

[![npm version](https://badge.fury.io/js/gbu-css-to-scss-converter.svg)](https://badge.fury.io/js/gbu-css-to-scss-converter)
[![GitHub](https://img.shields.io/github/license/dangpv94/gbu-css-to-scss-converter)](https://github.com/dangpv94/gbu-css-to-scss-converter/blob/main/LICENSE)

## ✨ Tính năng

- 🔄 Chuyển đổi CSS sang SCSS với nesting tự động
- 🎨 Format code đẹp với indentation tùy chỉnh
- 📝 Hỗ trợ giữ lại hoặc xóa comments
- 🔤 Sắp xếp properties theo alphabet (tùy chọn)
- 📁 Chuyển đổi hàng loạt nhiều file
- 🎯 Xử lý selector phức tạp, pseudo-classes, pseudo-elements
- ⚡ CLI interface dễ sử dụng
- 🏗️ **BEM Methodology Support** - Tự động nhận diện và nest BEM patterns
- 🧠 **Smart Nesting** - Thuật toán thông minh để tạo nested structure tối ưu
- 🎛️ **Advanced Options** - Kiểm soát độ sâu nesting và các pattern khác nhau
- 🔍 **Duplicate Detection** - Phát hiện và gom CSS trùng lặp trong cùng breakpoint
- 🏢 **Multi-level BEM** - Hỗ trợ BEM cấp 2, 3,... như `.block__element__subelement`
- 📱 **Media Query Grouping** - Tự động group và xử lý riêng biệt từng breakpoint
- 🎨 **Variable Extraction** - Tự động tạo SCSS variables từ các giá trị lặp lại
- 🏷️ **Smart Variable Naming** - Tạo tên variable thông minh dựa trên context và category
- 🎯 **Category-based Variables** - Phân loại variables theo colors, sizes, fonts, others

## 📦 Cài đặt

### Global installation (khuyến nghị)

```bash
npm install -g gbu-css-to-scss-converter
```

### Local installation

```bash
npm install gbu-css-to-scss-converter
```

### Từ GitHub

```bash
npm install -g https://github.com/dangpv94/gbu-css-to-scss-converter.git
```

## 🚀 Sử dụng

### CLI Commands

#### Chuyển đổi một file

```bash
css2scss input.css
```

Với options:

```bash
css2scss input.css -o output.scss -i 4 -t spaces --sort --bem
```

Với BEM support:

```bash
css2scss bem-styles.css --bem --smart-nesting
```

#### Chuyển đổi hàng loạt

```bash
css2scss batch ./css-folder -o ./scss-folder
```

### Options

#### Cơ bản

- `-o, --output <path>`: Đường dẫn file output
- `-i, --indent-size <number>`: Kích thước indentation (mặc định: 2)
- `-t, --indent-type <type>`: Loại indentation: 'spaces' hoặc 'tabs' (mặc định: spaces)
- `--no-comments`: Xóa comments khỏi output
- `-s, --sort`: Sắp xếp CSS properties theo alphabet

#### Nâng cao

- `--bem`: Bật BEM methodology support (mặc định: true)
- `--no-bem`: Tắt BEM methodology support
- `--smart-nesting`: Bật smart nesting (mặc định: true)
- `--no-smart-nesting`: Tắt smart nesting
- `--max-depth <number>`: Giới hạn độ sâu nesting (mặc định: 5)
- `--dedupe`: Bật duplicate detection và merging (mặc định: true)
- `--no-dedupe`: Tắt duplicate detection
- `--advanced-bem`: Bật advanced BEM với multi-level elements (mặc định: true)
- `--no-advanced-bem`: Tắt advanced BEM
- `--media-grouping`: Bật media query grouping (mặc định: true)
- `--no-media-grouping`: Tắt media query grouping
- `--variables`: Bật variable extraction (mặc định: true)
- `--no-variables`: Tắt variable extraction
- `--var-prefix <prefix>`: Variable prefix (mặc định: $)
- `--min-occurrences <number>`: Số lần xuất hiện tối thiểu để tạo variable (mặc định: 2)
- `--extract-colors`: Extract color variables (mặc định: true)
- `--no-extract-colors`: Tắt color variable extraction
- `--extract-sizes`: Extract size variables (mặc định: true)
- `--no-extract-sizes`: Tắt size variable extraction
- `--extract-fonts`: Extract font variables (mặc định: true)
- `--no-extract-fonts`: Tắt font variable extraction

### Sử dụng trong code

```typescript
import { CSSToSCSSConverter } from "css-to-scss-converter";

const converter = new CSSToSCSSConverter({
  indentSize: 2,
  indentType: "spaces",
  preserveComments: true,
  sortProperties: false,
  enableBEM: true,
  enableSmartNesting: true,
  maxNestingDepth: 5,
  enableDuplicateDetection: true,
  enableAdvancedBEM: true,
  enableMediaQueryGrouping: true,
  enableVariableExtraction: true,
  variablePrefix: "$",
  minOccurrences: 2,
  extractColors: true,
  extractSizes: true,
  extractFonts: true,
  extractOthers: true,
});

const scssContent = await converter.convert(cssContent);
```

## 📝 Ví dụ

### Traditional CSS Nesting

#### Input CSS:

```css
.container {
  width: 100%;
  padding: 20px;
}

.container .header {
  background: #f8f9fa;
  padding: 15px 0;
}

.container .header h1 {
  font-size: 2rem;
  color: #333;
}

.container .header h1:hover {
  color: #007bff;
}
```

#### Output SCSS:

```scss
.container {
  width: 100%;
  padding: 20px;

  .header {
    background: #f8f9fa;
    padding: 15px 0;

    h1 {
      font-size: 2rem;
      color: #333;

      &:hover {
        color: #007bff;
      }
    }
  }
}
```

### BEM Methodology Support

#### Input CSS:

```css
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

.header__nav-item {
  color: white;
  text-decoration: none;
}

.header--dark {
  background: #000;
}

.header__logo--large {
  font-size: 32px;
}
```

#### Output SCSS:

```scss
.header {
  background: #333;
  padding: 20px;

  &__logo {
    font-size: 24px;
    color: white;

    &:hover {
      color: #ccc;
    }
  }

  &__nav-item {
    color: white;
    text-decoration: none;
  }

  &__logo--large {
    font-size: 32px;
  }
}

.header--dark {
  background: #000;
}
```

### Advanced BEM với Multi-level Elements

#### Input CSS:

```css
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

.card__body__actions__button--primary {
  background: #007bff;
  color: white;
}
```

#### Output SCSS:

```scss
.card {
  border: 1px solid #ddd;

  &__header {
    &__title {
      font-size: 1.5rem;
      margin: 0;
    }
  }

  &__body {
    &__actions {
      &__button {
        padding: 8px 16px;
        border: none;

        &:hover {
          opacity: 0.8;
        }
      }

      &__button--primary {
        background: #007bff;
        color: white;
      }
    }
  }
}
```

### Duplicate Detection & Merging

#### Input CSS:

```css
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

.different {
  margin: 5px;
  color: red;
}
```

#### Output SCSS:

```scss
.btn,
.button,
.action {
  padding: 10px 20px;
  border: none;
  cursor: pointer;
}

.different {
  margin: 5px;
  color: red;
}
```

### Media Query Grouping

#### Input CSS:

```css
.responsive {
  width: 100%;
  padding: 20px;
}

@media (max-width: 768px) {
  .responsive {
    padding: 10px;
  }

  .mobile-only {
    display: block;
  }
}

@media (min-width: 1200px) {
  .responsive {
    max-width: 1200px;
    margin: 0 auto;
  }
}
```

#### Output SCSS:

```scss
.responsive {
  width: 100%;
  padding: 20px;
}

@media (max-width: 768px) {
  .responsive {
    padding: 10px;
  }

  .mobile-only {
    display: block;
  }
}

@media (min-width: 1200px) {
  .responsive {
    max-width: 1200px;
    margin: 0 auto;
  }
}
```

## 🛠️ Development

```bash
# Cài đặt dependencies
npm install

# Build project
npm run build

# Test với file example
npm run start example.css

# Development mode
npm run dev
```

## 📄 License

MIT License

## 🧪

Testing

Chạy tests:

```bash
npm test
```

Build project:

```bash
npm run build
```

Demo nhanh:

```bash
npm run demo
```

## 📁 Cấu trúc project

```
css-to-scss-converter/
├── src/
│   ├── index.ts              # Main export
│   ├── improved-converter.ts # Core converter logic
│   ├── cli.ts               # Command line interface
│   └── __tests__/           # Test files
├── dist/                    # Compiled JavaScript
├── example.css             # Example CSS file
├── simple.css              # Simple test file
└── README.md               # Documentation
```

## 🔧 API Reference

### CSSToSCSSConverter

```typescript
interface UltimateConversionOptions {
  indentSize?: number; // Kích thước indentation (mặc định: 2)
  indentType?: "spaces" | "tabs"; // Loại indentation (mặc định: 'spaces')
  preserveComments?: boolean; // Giữ lại comments (mặc định: true)
  sortProperties?: boolean; // Sắp xếp properties (mặc định: false)
  enableBEM?: boolean; // Bật BEM support (mặc định: true)
  enableSmartNesting?: boolean; // Bật smart nesting (mặc định: true)
  maxNestingDepth?: number; // Giới hạn độ sâu nesting (mặc định: 5)
  enableDuplicateDetection?: boolean; // Bật duplicate detection (mặc định: true)
  enableAdvancedBEM?: boolean; // Bật advanced BEM (mặc định: true)
  enableMediaQueryGrouping?: boolean; // Bật media query grouping (mặc định: true)
}

class CSSToSCSSConverter {
  constructor(options?: UltimateConversionOptions);
  async convert(cssContent: string): Promise<string>;
}
```

## 🚀 Tính năng nâng cao

- ✅ **Advanced BEM**: Multi-level BEM như `.block__element__subelement--modifier`
- ✅ **Duplicate Detection**: Tự động phát hiện và merge CSS trùng lặp
- ✅ **Media Query Aware**: Xử lý riêng biệt cho từng breakpoint
- ✅ **Smart Nesting**: Thuật toán thông minh cho nested structure
- ✅ **Complex Selectors**: Xử lý selector phức tạp, pseudo-classes, pseudo-elements
- ✅ **Flexible Options**: Kiểm soát chi tiết quá trình conversion
- ✅ **Beautiful Formatting**: Code output đẹp và dễ đọc
- ✅ **CLI Interface**: Command line với nhiều options
- ✅ **Batch Processing**: Xử lý hàng loạt nhiều file
- ✅ **TypeScript Support**: Full TypeScript support
- ✅ **Test Coverage**: Comprehensive test suite

## 🤝 Contributing

1. Fork repository
2. Tạo feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Tạo Pull Request

## 📋 TODO

- [ ] Hỗ trợ @media queries nesting
- [ ] Xử lý @keyframes
- [ ] Hỗ trợ CSS variables
- [ ] Plugin system
- [ ] Web interface
- [ ] VS Code extension

### V

ariable Extraction

#### Input CSS:

```css
.header {
  background-color: #007bff;
  padding: 20px;
  border-radius: 8px;
  font-family: "Arial", sans-serif;
}

.nav {
  background-color: #007bff;
  padding: 20px;
  border-radius: 4px;
}

.button {
  background-color: #007bff;
  color: #ffffff;
  padding: 10px 20px;
  border-radius: 4px;
  font-family: "Arial", sans-serif;
}

.card {
  background-color: #ffffff;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 20px;
}
```

#### Output SCSS:

```scss
// Variables

// Color variables
$color-primary-blue: #007bff;

// Size variables
$border-4px: 4px;
$border-8px: 8px;
$padding-20px: 20px;

// Font variables
$font-family-arial-sans-serif: "Arial", sans-serif;

.header {
  background-color: $color-primary-blue;
  padding: $padding-20px;
  border-radius: $border-8px;
  font-family: $font-family-arial-sans-serif;
}

.nav {
  background-color: $color-primary-blue;
  padding: $padding-20px;
  border-radius: $border-4px;
}

.button {
  background-color: $color-primary-blue;
  color: #ffffff;
  padding: 10px 20px;
  border-radius: $border-4px;
  font-family: $font-family-arial-sans-serif;
}

.card {
  background-color: #ffffff;
  border: 1px solid #dee2e6;
  border-radius: $border-8px;
  padding: $padding-20px;
}
```

#

# 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- **GitHub Repository**: https://github.com/dangpv94/gbu-css-to-scss-converter
- **NPM Package**: https://www.npmjs.com/package/gbu-css-to-scss-converter
- **Issues**: https://github.com/dangpv94/gbu-css-to-scss-converter/issues

## 👨‍💻 Author

**dangpv94**

- GitHub: [@dangpv94](https://github.com/dangpv94)

---

⭐ Nếu project này hữu ích, hãy cho một star trên GitHub!
