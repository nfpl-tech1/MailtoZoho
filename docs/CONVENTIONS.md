<!-- STATUS: ACTIVE -->
<!-- Last Updated: 2026-06-15 -->

# Conventions — eSanchit Email Automation

## File Naming

| Layer | Pattern | Example |
|-------|---------|---------|
| Route | `{feature}.routes.js` or `{feature}/index.js` | `cron.routes.js`, `irn-drn-tracker/index.js` |
| Controller | `{concern}.controller.js` | `email.controller.js`, `zoho.controller.js` |
| Service | `{concern}.service.js` | `emailProcessor.service.js`, `config.service.js` |
| Utility | `{what-it-parses}.js` | `htmlTableParser.js`, `textFileParser.js` |
| Test | `{feature-name}.test.js` | `irn-drn-parser.test.js` |
| Index (re-export) | `index.js` | Used in every feature folder |

**Convention:** kebab-case for folder names (`irn-drn-tracker`, `record-query`, `email-notification`). camelCase for file names where the name is a compound word (`emailProcessor`, `htmlTableParser`). Suffixes (`.service.js`, `.controller.js`, `.routes.js`) are mandatory for non-index files.

## Variable and Function Naming

| Context | Convention | Example |
|---------|-----------|---------|
| Local variables | camelCase | `parsedData`, `jobRecordId`, `beNumber` |
| Constants (module-level) | UPPER_SNAKE_CASE | `PENDING_RECORDS_KEY`, `MAX_PENDING_RECORDS` |
| Config keys | UPPER_SNAKE_CASE | `ZOHO_PUSH_ENABLED`, `EMAIL_SUBJECT_KEYWORDS` |
| Class names | PascalCase | `EmailProcessor`, `ConfigService`, `ZohoService` |
| Factory functions | `get{Name}Service()` | `getConfigService()`, `getCronJobService()` |
| Controller handlers | camelCase verbs | `processEmails`, `healthCheck`, `getConfig` |
| Boolean config values | `{FEATURE}_ENABLED` | `ZOHO_PUSH_ENABLED`, `RECORD_QUERY_PUSH_ENABLED` |

## Zoho Field Naming

Zoho Creator fields use specific casing that must be matched exactly:

| Field | Convention | Examples |
|-------|-----------|---------|
| Standard fields | PascalCase with underscores | `Job_No`, `DRN_no`, `BE_No` |
| Subform name | PascalCase with underscores | `Query_fields`, `SubForm` |
| Subform fields | PascalCase with underscores | `Query_date`, `Document_name`, `Document_type` |
| Lookup fields | Same as standard | `Job_No` (stores record ID when writing, shows display value when reading) |

## Module Exports

### Singleton Services

Services that manage state (config cache, auth tokens, DB connections) use the singleton pattern:

```javascript
// RIGHT — singleton factory
let instance = null;
module.exports = {
    ServiceClass,
    getServiceName: () => {
        if (!instance) instance = new ServiceClass();
        return instance;
    }
};
```

```javascript
// WRONG — consumers create their own instance
const service = new ServiceClass();  // each caller gets different state
```

### Feature Re-exports

Every feature folder has an `index.js` that re-exports its public API:

```javascript
// RIGHT — services/irn-drn-tracker/index.js
const EmailProcessor = require('./emailProcessor.service');
module.exports = { EmailProcessor };
```

## Controller Pattern

Every controller handler follows this structure:

```javascript
// RIGHT
const processEmails = async (req, res, next) => {
    try {
        const configService = getConfigService();
        await configService.ensureLoaded();

        // Read config, validate input, call services
        const result = await someService.process(params);

        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
};
```

```javascript
// WRONG — missing try/catch, missing next(error)
const processEmails = async (req, res) => {
    const result = await someService.process();
    res.json(result);
};
```

## API Response Format

All API endpoints return JSON with this base structure:

```javascript
// Success
{ success: true, message: "...", data: { ... } }

// Error (from errorHandler middleware)
{ success: false, message: "...", stack: "..." /* dev only */ }
```

## Config Key Registration

Every new configurable key must be registered in `getConfigurableKeys()`:

```javascript
// RIGHT — full metadata
{
    key: 'NEW_FEATURE_ENABLED',
    label: 'Enable New Feature',
    type: 'boolean',
    category: 'New Feature',
    default: 'false',
    description: 'Toggle the new feature on or off'
}
```

```javascript
// WRONG — reading process.env directly
const enabled = process.env.NEW_FEATURE_ENABLED === 'true';
```

## References

- [Node.js Style Guide](https://github.com/felixge/node-style-guide) — Community convention for naming
- [Express.js Best Practices](https://expressjs.com/en/advanced/best-practice-performance.html) — Error handling patterns
- [Zoho Creator API Field Names](https://www.zoho.com/creator/help/api/v2/add-records.html) — Field naming conventions
