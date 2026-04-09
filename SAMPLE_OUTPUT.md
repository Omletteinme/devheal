# 📝 DevHeal V2 Sample Output

## 1. Scanner Output (`devheal scan`)

![Sample Output](https://placeholder.com)
```
│
◇  🩺 DevHeal Scanner
│
◒  Scanning dev environment...
│
◆  Scan complete!
│
▲  1 warnings found.
│
◆  [WARNING] Missing .env.example
│      Found a .env file but no .env.example. This makes it hard for other developers to know what env variables are required.
│
◇  Found 1 fixable issues. Run 'devheal fix' to apply fixes.
│
└  Scan finished in 143ms
```

## 2. Auto-Fix Output (`devheal fix --dry-run`)

```
│
◇  🔧 DevHeal Fix Engine
│
◒  Scanning for fixable issues...
│
◆  Dependencies analyzed.
│
◆  [Dry Run] Would fix 'Missing .env.example' by: Creating `.env.example` from `.env`
│
└  Fixes applied successfully.
```

## 3. Targeted AI Doctor (`devheal doctor "Why is it throwing an undefined error?" --file src/index.ts`)

```
│
◇  🤖 DevHeal AI Doctor
│
◒  Reading src/index.ts...
│
◆  Read src/index.ts successfully.
│
◒  Asking AI to diagnose the issue...
│
◆  AI Analysis Complete.
│
●  Root Cause
│  The error occurs because `config` object is not loaded before being passed into the initial state.
│
●  Suggested Fix
│  Add `await loadConfig()` before calling the `init` function.
│
◆  Confidence Score: 95%
│
└  AI Analysis complete.
```
