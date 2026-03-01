# Security Policy

## Supported Versions
As an enterprise SaaS platform, we provide security patches strictly for our current production release line.

| Version | Supported          |
| ------- | ------------------ |
| v1.0.x  | :white_check_mark: |
| < v1.0  | :x:                |

## Reporting a Vulnerability

Security is a top priority for the Commerce Orchestration Platform. If you discover a security vulnerability within this project (such as potential NoSQL injections, tenant-isolation breaches, or credential leakage), please **do not open a public issue.**

Instead, please send an email directly to the core engineering security team at **security@yourdomain.com**. 

When reporting, please provide:
* A detailed description of the vulnerability.
* Steps to reproduce the issue.
* The potential impact on multi-tenant execution or credential safety.

All security reports are acknowledged within 24 hours. A member of the security team will verify the vulnerability and coordinate a mitigation and patch release timeline with you.

## Security Practices
To maintain safety:
- **Never commit `.env` files** or hardcoded API credentials.
- Ensure the `crypto` module AES-256-GCM functions properly parse `authTags`.
- Use strict GraphQL payload verification and Zod validation at the perimeter.
- Rely on automated scanning tools (e.g., `pnpm audit`) to vet upstream Open Source dependencies.
