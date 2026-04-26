# Installer portal authentication

HeatWise separates **three channels** on installer-touching routes (e.g. `submit-verified-install`):

1. **Installer portal** — automation / partner apps.
2. **Ops token** — `x-heatwise-ops-token` matching `HEATWISE_OPS_TOKEN` (break-glass, integrations).
3. **Admin session** — NextAuth session with email in `HEATWISE_ADMIN_EMAILS`.

## Per-installer credentials (preferred)

Config (server):

```bash
export HEATWISE_INSTALLER_PORTAL_KEYS_JSON='{"<InstallerProfile.id>":"<long-random-secret>", ...}'
```

Request headers:

| Header | Value |
|--------|--------|
| `x-heatwise-installer-id` | `InstallerProfile.id` |
| `x-heatwise-installer-token` | Secret from JSON map for that id |

**Guarantees:** Token proves possession of the installer’s secret; for `submit-verified-install` the handler **rejects** mismatched `installJobId` ↔ authenticated installer.

Response audit headers:

- `x-heatwise-auth-channel`: `installer_portal` | `ops_token` | `admin_session`
- `x-heatwise-installer-portal-kind`: `per_installer` | `legacy_shared`
- `x-heatwise-installer-id` when `per_installer`

## Legacy shared portal

```bash
export HEATWISE_INSTALLER_PORTAL_TOKEN='shared-dev-secret'
```

Header: `x-heatwise-installer-token` only.

Optional `x-heatwise-installer-id` is logged as **`x-heatwise-installer-id-claim-unverified`** — it is **not** cryptographically bound.

## Compatibility

Existing mobile clients using only the shared token continue to work. Migrate to `HEATWISE_INSTALLER_PORTAL_KEYS_JSON` per installer for production-like attribution.
