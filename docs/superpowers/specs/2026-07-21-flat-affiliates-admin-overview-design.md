# Design: Flat-Affiliates + Admin-Übersicht

**Datum:** 2026-07-21
**Status:** Approved

## Ziel

Zwei Probleme lösen:

1. Es gibt Affiliates mit Pauschal-Deals (fixer Betrag für z.B. einen Promo-Post, unabhängig von Conversions). Für diese macht weder ein Login noch das Stats-Dashboard Sinn — der Affiliate-Code dient nur dem internen Tracking.
2. Admins haben keine Übersicht über alle Affiliates und deren Performance. Es fehlt ein Admin-Tab mit tabellarischen Stats.

## Entscheidungen

- Neuer `commissionType` **`flat`** (Pauschal-Deal). Der bestehende Typ `fixed` (fixer Betrag pro Conversion) bleibt unverändert erhalten.
- Flat-Affiliates werden **ohne User-Account** direkt vom Admin angelegt (kein Invite, keine E-Mail, kein Login). Dafür wird `userId` optional. Eine spätere Verknüpfung mit einem User bleibt möglich.
- Neuer Admin-Tab **`/admin/affiliates`** zeigt **alle** Affiliates (percentage, fixed, flat) mit Stats; dort findet auch die Anlage/Verwaltung der Flat-Affiliates statt. Der Invite-Flow für Login-Affiliates bleibt auf `/admin/users`.

## 1. Schema (`packages/backend/convex/schema.ts`)

Änderungen an `affiliate_profiles`:

```typescript
affiliate_profiles: defineTable({
    userId: v.optional(v.id("users")),          // war: v.id("users")
    name: v.optional(v.string()),               // NEU: Anzeigename für Profile ohne User
    affiliateCode: v.string(),
    commissionType: v.union(
        v.literal("percentage"),
        v.literal("fixed"),
        v.literal("flat"),                      // NEU: Pauschal-Deal
    ),
    commissionAmount: v.number(),
    isActive: v.boolean(),
}).index("by_user", ["userId"]),
```

- Bei `flat` speichert `commissionAmount` den gezahlten Deal-Betrag (nur zur Info in der Admin-Übersicht; fließt in keine Provisionsberechnung).
- Bei verknüpften Profilen (mit `userId`) kommt der Anzeigename weiterhin aus der `users`-Tabelle; `name` wird nur für Standalone-Profile genutzt.
- Alle Änderungen sind additiv/aufweichend — bestehende Daten bleiben gültig, keine Migration nötig.

## 2. Backend (`packages/backend/convex/affiliate_profiles/`)

### Mutations (alle admin-only)

- **`createStandalone`**: legt ein Profil ohne User an. Args: `name`, `affiliateCode`, `commissionAmount`, `isActive` (Typ ist implizit `flat`). Validierung: `affiliateCode` muss eindeutig sein gegenüber allen bestehenden `affiliate_profiles` UND allen offenen `user_invites` (gleiche Prüfung wie beim Invite-Flow).
- **`updateProfile`**: bearbeitet ein bestehendes Profil (Name, Code inkl. Uniqueness-Check, Betrag, Typ, `isActive`).
- **`removeStandalone`**: löscht ein Standalone-Profil (nur wenn `userId` nicht gesetzt ist; verknüpfte Profile werden über `isActive` deaktiviert statt gelöscht).

### Queries

- **`getAllWithStats`** (admin-only): Args `{ start, end, environment }`. Liefert alle Profile mit:
  - Name (aus User oder `name`-Feld), E-Mail (falls User verknüpft), Code, Typ, Betrag, `isActive`
  - Stats aus `affiliate_referral` im Zeitraum/Environment: Referred, Converted, Conversion-Rate, Cancel-Rate, Refund-Rate, Earned
  - Bei `flat`: Earned = `null` (UI zeigt „—" und stattdessen den Deal-Betrag)
- Die Stats-Berechnung wird aus `getMyStats` in eine gemeinsame Helper-Funktion extrahiert (z.B. `computeStatsForProfile`), damit Affiliate-Dashboard und Admin-Tabelle identisch rechnen. `getMyStats`/`getMyProfile` behalten ihre Signatur.

## 3. Frontend (`apps/web`)

### Neue Seite `/admin/affiliates` (admin-only)

- Sidebar-Eintrag „Affiliates" in `src/components/admin/AdminSidebar.tsx` (Gruppe der Admin-only-Tabs).
- Tabelle mit Spalten: Name, Code, Typ, Betrag, Aktiv, Referred, Converted, Conv-Rate, Cancel-Rate, Refund-Rate, Earned.
- Filter oberhalb der Tabelle: DateRangePicker (Default: letzte 30 Tage) + Production/Sandbox-Toggle — gleiche Komponenten/Verhalten wie im bestehenden Affiliate-Dashboard (`/admin/affiliate`).
- Button „Flat-Affiliate anlegen" öffnet einen Dialog: Name, Code, Betrag (aktiv per Default).
- Zeilen-Aktionen: Bearbeiten (Dialog, nutzt `updateProfile`), Deaktivieren/Aktivieren; Löschen nur bei Standalone-Profilen.

### Bestehende Seiten

- **`/admin/users`**: Invite-Formular bietet als `commissionType` nur noch `percentage` und `fixed` an (flat braucht keinen Login und läuft über den neuen Tab).
- **`/admin/affiliate`** (Affiliate-Dashboard): Edge Case — falls ein flat-Profil doch mit einem User verknüpft ist, zeigt das Dashboard nur den Promo-Code, keine Stats.

## 4. Fehlerbehandlung

- Code-Kollision bei `createStandalone`/`updateProfile`: Mutation wirft Fehler, UI zeigt Toast (Sonner, wie bestehend).
- `getAllWithStats` und die neuen Mutations prüfen die Admin-Rolle serverseitig (wie bestehende admin-only Endpoints).

## 5. Verifikation

- Kein bestehendes Test-Setup im Projekt — Verifikation manuell:
  - Flat-Affiliate anlegen → erscheint in Tabelle, Code-Kollision wird abgewiesen
  - Referrals via Track-API auf den flat-Code → Stats erscheinen nur in der Admin-Tabelle
  - Bestehende percentage/fixed-Affiliates: Dashboard-Zahlen == Admin-Tabellen-Zahlen (gleicher Zeitraum/Environment)
  - Invite-Flow auf `/admin/users` funktioniert unverändert

## Addendum (2026-07-21): Business-Spalten in der Admin-Tabelle

Auf User-Wunsch ergänzt: Die Admin-Tabelle zeigt zusätzlich, was das Business am Affiliate verdient — berechnet über dieselben Referrals wie Earned (`hasConverted = true`):

- **Umsatz**: Summe `price` (voller Verkaufspreis)
- **Proceeds**: Summe `price × takehomePercentage` (nach Store-Abzug)
- **Netto**: Proceeds − Earned; bei `flat`: Proceeds − Deal-Betrag (kann negativ sein → rot dargestellt)

Diese Felder liefert nur `getAllWithStats` (Admin). `getMyStats` filtert sie explizit heraus, damit Affiliates keine Business-Zahlen sehen.
