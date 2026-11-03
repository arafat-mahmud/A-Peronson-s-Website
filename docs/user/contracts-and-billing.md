# Contracts & billing

> **GarTexHub does not move money between trading partners.** It handles discovery, communication
> and contracts. Payments for orders happen outside the platform; you can attach proof of them to a
> contract.

## Contracts and the Legal Vault (`/contracts`)

1. A contract is created as a **draft** between a buyer and a factory (or buying house).
2. Before signing, the two sides must have completed at least one **video call** with each other.
3. Each party signs **its own side** — a buyer cannot sign for the factory or the other way round.
4. When both sides have signed, a **PDF** is generated, fingerprinted (hash) and stored in the
   **Legal Vault**, and can be locked. Both parties keep access to the contract and its audit history.

**Payment proof:** a party can attach proof of payment (for example a letter of credit) to a contract.
It is reviewed and marked *accepted* or *rejected*; signing without an accepted proof shows a warning.

**E-signature provider:** an external e-sign service is used only when the platform operator has
configured one. Without it, signatures are recorded inside GarTexHub. In the current release the
sign buttons in the Contract Vault are enabled for GarTexHub staff, who record signatures for the parties.

## Plans: Free and Premium

Limits per plan (from the live pricing configuration, `/pricing`):

| | Free | Premium |
| --- | --- | --- |
| Buyer requests | 3 | 50 |
| Products | 20 | 500 |
| Videos | 2 | 200 |
| Partner connections | 5 | 50 |
| Searches per day | 20 | 200 |
| Agent accounts | 3 | unlimited |
| Boosts, advanced filters/analytics, branding, assistant auto-reply settings | — | ✓ (varies by account type) |

Premium costs **US $1.99 for the first month, then $6.99 per month**, charged to your wallet.
In this release Premium is activated through GarTexHub support; **Settings → Subscription & Billing**
shows your plan and remaining days, and lets you cancel (you move to Free) at any time.

## Wallet and coupons

Your GarTexHub wallet (US dollars) pays for Premium, verification and boosts.

- New accounts receive a **$5 starting credit** (unless the operator has switched it off).
- Add credit by redeeming a **coupon code** on the Pricing page (`/pricing`).
- There is no card payment inside the app; contact GarTexHub support for other top-ups.

Every credit and charge is listed in the wallet history.

## Boosts

A boost raises the reach of your feed posts or your profile for a period. Open a post's **Boost**
button → Boost details, choose where (feed or profile), how long (7, 14 or 30 days) and the strength.
The price is shown before you confirm — **$9.99 per 7 days** — and is charged to your wallet. You
can have one active boost per placement and cancel it at any time.
