# Canonical Data Models

To facilitate a clean migration, all data is transformed into a Universal Canonical Contract in transit. This prevents an N x M mapping problem and enforces a strict, typed schema.

## Supported Entities

The canonical contract covers 4 entities. It is a single unversioned shape (no `_version`, no downcast adapters).

### 1. CanonicalCategory
- `key`: Unique identifier (String)
- `name`: Localized name map (`Record<string, string>`)
- `slug`: Localized slug map (`Record<string, string>`)
- `parentId`: Optional reference to parent category key
- `metadata`: Platform-agnostic custom attributes

### 2. CanonicalProduct
- `key`: Unique identifier (String)
- `name`: Localized name map (`Record<string, string>`)
- `description`: Localized description map
- `categories`: Array of Category keys
- `masterVariant`: The primary `CanonicalVariant`
- `variants`: Array of additional `CanonicalVariant` objects

### 3. CanonicalCustomer
- `key`: Unique identifier (String)
- `email`: Primary email
- `firstName`: String
- `lastName`: String
- `addresses`: Array of canonical addresses

### 4. CanonicalOrder
- `key`: Unique identifier (String)
- `customerId`: Reference to customer key
- `lineItems`: Array of ordered items and quantities
- `totalAmount`: Canonical Money format
- `currencyCode`: ISO 4217 currency string

## Canonical Standards
- **Money**: Always represented as an integer (cents). Never float.
- **Locales**: Always represented as a `Record<string, string>` map, never bare strings.

---

> **Future Scope**: Additional entities (e.g., Inventory, Promotions, Reviews) and specialized fields required by other platforms (BigCommerce, CSV, etc.) will be added to the Canonical Models *only* when those platforms are implemented.
