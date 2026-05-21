# Resend Domain Setup — mail.tasbih.ai

**Domain registered with Resend ✓** (`id: ae3c7fd6-d890-4690-a47c-9013cb18213a`, region `us-east-1`)
Status: `not_started` — pending DNS verification

---

## 📋 DNS records to add at your DNS provider (Cloudflare / Namecheap / Route53 / etc.)

You are creating these on the **`tasbih.ai`** zone so that the **subdomain `mail.tasbih.ai`** is set up for sending. **Important:** if your DNS provider auto-appends the root domain to the "name" field, paste **only the part before `.tasbih.ai`** — examples below show both forms.

### Record 1 · DKIM (TXT)
| Field    | Value |
|----------|---|
| **Type** | `TXT` |
| **Name** | `resend._domainkey.mail`  &nbsp;&nbsp;*(or full: `resend._domainkey.mail.tasbih.ai`)* |
| **Value** | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDfyC7Wm8tFwWL4Rw/IzU2ZEkJ4/J6A4wqo6cSqs5CJw+p/h3bt4lPMaG9H+iLWFYCERYYYP/w6HfbkDxX+QZlhuw/IAT59A2xxZlVwMS8GTKghSDWC4zmvnywQZHyzAYZyJ0NyO4ciX/RYkSi6V5ePjiLSwaHQfx44NmcV2QCr/QIDAQAB` |
| **TTL**  | Auto / 3600 |

### Record 2 · SPF — Bounce-handling MX
| Field    | Value |
|----------|---|
| **Type** | `MX` |
| **Name** | `send.mail`  &nbsp;&nbsp;*(or full: `send.mail.tasbih.ai`)* |
| **Value** / Target | `feedback-smtp.us-east-1.amazonses.com` |
| **Priority** | `10` |
| **TTL**  | Auto / 3600 |

### Record 3 · SPF — TXT
| Field    | Value |
|----------|---|
| **Type** | `TXT` |
| **Name** | `send.mail`  &nbsp;&nbsp;*(or full: `send.mail.tasbih.ai`)* |
| **Value** | `v=spf1 include:amazonses.com ~all` |
| **TTL**  | Auto / 3600 |

---

## After you add the 3 records

1. Wait 5–30 minutes for DNS to propagate (most providers are quick).
2. Tell me, and I'll trigger Resend to verify them automatically.
3. Once verified, update `RESEND_FROM` in `/app/backend/.env` from
   `Tasbih.ai <onboarding@resend.dev>` → e.g. `Tasbih.ai <noor@mail.tasbih.ai>`
4. Restart backend. Done.

---

## Manual verify (if you want to skip me)

```bash
curl -X POST "https://api.resend.com/domains/ae3c7fd6-d890-4690-a47c-9013cb18213a/verify" \
  -H "Authorization: Bearer re_JC7E1rh8_2yRSjc3TzAfcvuva36STkJTo"
```

## DNS checker

```bash
dig +short TXT resend._domainkey.mail.tasbih.ai
dig +short MX send.mail.tasbih.ai
dig +short TXT send.mail.tasbih.ai
```

All three should return values matching the records above.
