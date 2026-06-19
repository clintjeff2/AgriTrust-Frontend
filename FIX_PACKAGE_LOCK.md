# Fix package-lock.json Issue

## Problem

The `package-lock.json` is out of sync with `package.json` because `fast-check@^3.22.0` was added to `package.json` but the lock file wasn't updated.

## Error Message

```
npm ci can only install packages when your package.json and package-lock.json are in sync.
Missing: fast-check@3.23.2 from lock file
Missing: pure-rand@6.1.0 from lock file
```

## Solution

You need to update the `package-lock.json` file by running:

```bash
npm install
```

This will:
1. Read the `package.json`
2. Resolve all dependencies (including fast-check)
3. Update the `package-lock.json` with the correct versions
4. Install all packages in `node_modules/`

## Steps to Fix

### Option 1: Using PowerShell (Recommended)

If you get a script execution error, enable PowerShell scripts first:

```powershell
# Run PowerShell as Administrator
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Then run in your project directory
cd AgriTrust-Frontend
npm install
```

### Option 2: Using Command Prompt

```cmd
cd AgriTrust-Frontend
npm install
```

### Option 3: Using Git Bash

```bash
cd AgriTrust-Frontend
npm install
```

### Option 4: Using WSL (Windows Subsystem for Linux)

```bash
cd /mnt/c/Users/USER/OneDrive/Music/ap\ 1/AgriTrust-Frontend
npm install
```

## After Running npm install

Once `npm install` completes successfully:

1. **Verify the lock file was updated**:
   ```bash
   git status
   ```
   You should see `package-lock.json` as modified.

2. **Commit the updated lock file**:
   ```bash
   git add package-lock.json
   git commit -m "fix: Update package-lock.json to include fast-check dependency"
   git push
   ```

3. **Run tests**:
   ```bash
   npm test
   ```

## What npm install Will Do

When you run `npm install`, it will:

1. ✅ Add fast-check@^3.22.0 to package-lock.json
2. ✅ Add pure-rand@6.1.0 (dependency of fast-check)
3. ✅ Install fast-check in node_modules/
4. ✅ Update package-lock.json with all dependency resolutions
5. ✅ Ensure all packages are in sync

## Verification

After running `npm install`, verify it worked:

```bash
# Check if fast-check is installed
npm list fast-check

# Should output:
# agritrust-frontend@0.1.0
# └── fast-check@3.23.2
```

## Then Run Tests

```bash
# Run all tests
npm test

# Or run specific tests
npm test arithmetic.property.test.ts
```

## Alternative: Manual Lock File Update

If you absolutely cannot run npm commands, you can manually add fast-check to package-lock.json, but **this is NOT recommended** as it's error-prone.

The proper way is to run `npm install`.

## CI/CD Fix

For CI/CD pipelines (like GitHub Actions), the updated `package-lock.json` needs to be committed to the repository. The CI will then use:

```bash
npm ci  # Uses exact versions from package-lock.json
```

This is why the lock file must be in sync.

## Summary

**Required Action**: Run `npm install` in your local environment to update `package-lock.json`.

**Then**: Commit and push the updated `package-lock.json`.

**Result**: CI/CD will pass and tests will run successfully.
