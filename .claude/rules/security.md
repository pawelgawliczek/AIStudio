# Security Review Guidelines

When implementing features or reviewing code, always consider these security requirements.

## OWASP Top 10 Checks

Review all code changes for:
1. **Injection vulnerabilities** - SQL, XSS, command injection
2. **Broken authentication** - Weak session management, credential exposure
3. **Sensitive data exposure** - PII, credentials, API keys in logs/responses
4. **XML External Entities (XXE)** - Unsafe XML parsing
5. **Broken access control** - Missing authorization checks
6. **Security misconfiguration** - Default credentials, verbose errors
7. **Cross-Site Scripting (XSS)** - Unsanitized user input in output
8. **Insecure deserialization** - Untrusted data deserialization
9. **Using components with known vulnerabilities** - Outdated dependencies
10. **Insufficient logging & monitoring** - Missing audit trails

## Focus Areas

Pay special attention when changes involve:
- Authentication and authorization flows
- Payment processing or financial data
- Personally Identifiable Information (PII)
- Credentials and secrets management
- MCP tool permissions and access controls
- API endpoints (rate limiting, input validation)
- External service integrations
- Network communication (TLS, certificate validation)

## Security Requirements

### Input Validation
- Sanitize all user inputs before processing
- Use parameterized queries for database operations
- Validate file uploads (type, size, content)

### Authentication & Authorization
- Implement proper session management
- Use secure password hashing (bcrypt, argon2)
- Apply principle of least privilege
- Validate JWT tokens properly

### Data Protection
- Never log sensitive data (passwords, tokens, PII)
- Use HTTPS for all external communications
- Encrypt sensitive data at rest
- Implement proper error handling without information leakage

### API Security
- Implement rate limiting on all endpoints
- Validate request origins (CORS)
- Use proper HTTP methods and status codes
- Authenticate all API requests

### Secrets Management
- Never hardcode secrets in source code
- Use environment variables or secret managers
- Rotate credentials regularly
- Audit access to secrets

## When to Escalate

Flag for human review when:
- Changes affect authentication/authorization logic
- New external integrations are added
- Cryptographic operations are modified
- Access control rules are changed
- New API endpoints handle sensitive data
