# Tasbih.ai — Test Credentials

## Invite-only gate is ON
Two codes from two **different** inviters are required (founder codes are exempt — they bypass the same-issuer check). After verify → user enters name/email/WhatsApp → MSG91 sends a 6-digit OTP → 90-day session.

## 30 Founder Invitation Codes (8-char alphanumeric, no 0/O/1/I)
All have `issued_by:"system"` and `founder:true` in MongoDB. Pair them as you like:

```
01. RR43CLBG    02. 3TLB2RK4    03. B8DZHT2P    04. QMPHQ59Y    05. CBU8LQG6
06. UFLHJW4J    07. EK48P89X    08. S4YNQFPK    09. X8PK3D9N    10. DDJT3RNY
11. 6ULEDDAT    12. WJ4BM7YH    13. FF26CT3U    14. 39UQR5SQ    15. 53Q7H6WC
16. RC8S3HSH    17. FB726CEW    18. TEBJGZ2A    19. ZGC325D2    20. UFGL76K6
21. KMLBR6H9    22. UB6ZPB68    23. K82UUQWV    24. M86P5US6    25. AF5WQ2RY
26. REE75BCT    27. 9A8Y2C57    28. R2EZ9W6Y    29. 649PJKUW    30. 7HDEAU36
```

Owner uses pair 1: **RR43CLBG + 3TLB2RK4**

## MSG91 OTP
- `MSG91_AUTH_KEY` is set in backend/.env
- `MSG91_OTP_TEMPLATE_ID` is **NOT YET SET** — owner must paste it after creating the OTP template in the MSG91 dashboard with `##OTP##` placeholder.
- Without the template ID, `/api/auth/otp/send` returns `500 OTP service not configured (MSG91_OTP_TEMPLATE_ID missing).`

## Guest path
`POST /api/auth/guest` still exists as a backend route but the Login UI no longer exposes it (invite gate is on). Can be invoked directly for backend testing only.
