# Migration Scope

This document defines the strict boundaries of the Minimum Viable Product (MVP) and outlines the future direction of the Commerce Data Orchestrator.

## MVP Scope

The MVP is strictly limited to migrating core commerce data from **commercetools** to **Shopify**.

### Supported Platforms
- **Source**: commercetools
- **Target**: Shopify

### Supported Entities
The MVP will solely focus on migrating the following 4 entities:
1. **Categories**
2. **Products** (including Variants, Prices, and Inventory)
3. **Customers**
4. **Orders**

## Future Scope (Post-MVP)

The platform is designed to accommodate future expansions without requiring immediate architectural abstractions. Post-MVP capabilities will include:

### Additional Platforms
- **BigCommerce**
- **Other Commerce Platforms** (e.g., Magento, WooCommerce)
- **Generic Data Sources** (CSV/JSON, FTP, SFTP)
- **CRM Systems** (e.g., HubSpot, Salesforce)

### Additional Migration Directions
- Bidirectional syncing
- Multi-target syndication (e.g., PIM to multiple commerce engines)

> [!IMPORTANT]
> Do not build abstractions (like generic workflow engines, transformation engines, or plugin systems) for Future Scope capabilities until a real use case is being implemented. Stick to the MVP boundaries.
