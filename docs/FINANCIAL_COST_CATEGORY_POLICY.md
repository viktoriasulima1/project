# Financial cost-category policy

The canonical category union is language-independent and is never translated in storage, URLs, calculations, reports, or test IDs.

Order is fixed by `FINANCIAL_COST_CATEGORY_ORDER`:

1. `crop_protection`
2. `fertiliser`
3. `seed`
4. `labour`
5. `machinery`
6. `fuel`
7. `contractor`
8. `irrigation_utilities`
9. `field_expenses`
10. `allocated_overhead`
11. `other`

Presentation must not alphabetize localized labels. `categoryForSource` remains the only classification policy. Source type, cost category, attribution, and version state are separate canonical concepts. Unexpected runtime values remain visible through a localized safe fallback (`Other` for category, localized unknown labels for the other concepts); raw internal codes are not shown.

Partial pricing, direct/allocated reconciliation, reversed-record exclusion, effective-version selection, cent rounding, and Gross Margin inputs are unchanged.
