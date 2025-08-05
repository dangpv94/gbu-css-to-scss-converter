# Hướng dẫn tạo GitHub Repository

## Bước 1: Tạo Repository trên GitHub

1. Đi tới https://github.com/dangpv94
2. Click "New repository" 
3. Repository name: `gbu-css-to-scss-converter`
4. Description: `Convert CSS files to SCSS with proper nesting and beautiful formatting`
5. Chọn "Public"
6. **KHÔNG** check "Add a README file" (vì chúng ta đã có)
7. **KHÔNG** check "Add .gitignore" (vì chúng ta đã có)
8. **KHÔNG** check "Choose a license" (vì chúng ta đã có)
9. Click "Create repository"

## Bước 2: Push code lên GitHub

Sau khi tạo repository, chạy lệnh:

```bash
git push -u origin main
```

## Bước 3: Publish lên NPM (tùy chọn)

Nếu muốn publish lên NPM:

```bash
# Login vào NPM
npm login

# Publish package
npm publish
```

## Repository URL
https://github.com/dangpv94/gbu-css-to-scss-converter

## NPM Package URL (sau khi publish)
https://www.npmjs.com/package/gbu-css-to-scss-converter