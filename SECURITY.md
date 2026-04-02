# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| current | ✅ Yes    |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly.

**Email:** security@karnet.com.tr
**Response time:** 72 hours
**Critical patches:** Within 7 days

### What to include
- Description of the vulnerability
- Steps to reproduce
- Impact assessment
- Suggested fix (if any)

### What we commit to
- Acknowledge receipt within 72 hours
- Provide a timeline for the fix
- Credit the reporter (unless anonymity is requested)
- Issue a CVE if applicable

## Out of Scope

- Social engineering attacks
- Physical attacks
- Denial of Service (DoS/DDoS)
- Third-party services (Supabase, Vercel, PayTR)
- Issues in dependencies (report upstream)

## Security Measures

- AES-256-GCM encryption for sensitive data
- Row Level Security (RLS) on all tables
- Rate limiting on all API endpoints
- Audit logging for security events
- HSTS, CSP, and comprehensive security headers
- MFA support (TOTP)
