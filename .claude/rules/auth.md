# Authentication rules (ADR-0009)

- Request handling uses `Depends(get_tenant_db)`; it opens a tenant session from the token's agency.
- `get_system_db` / `system_session()` are for login, token lookup, the operator CLI and workers only.
- Guard administration endpoints with `require_manager`; add a test that an advisor gets 403.
- Never log or return passwords, password hashes or raw tokens. Never put tokens in URLs.
- Error messages for login must stay generic (no "unknown user" vs "wrong password").
- New services that change who can log in (deactivate, reset, role change) must revoke sessions
  (`revoke_user_sessions`) and have a test for it.
- Passwords are only ever read from a hidden prompt or request body, never from command-line arguments.
