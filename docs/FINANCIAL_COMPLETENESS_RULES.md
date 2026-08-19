# Financial Completeness Rules

The centralized resolver checks product prices, applicable labour rates, applicable machinery rates, contractor cost, harvest yield, received revenue, an explicit overhead choice and compatible units.

Statuses:

- `insufficient_data`: a material cost source is unknown.
- `cost_tracking_active`: costs are usable but harvest is absent.
- `partial_profitability`: yield exists but revenue or compatible units are incomplete.
- `profitability_ready`: all evaluated categories are present.

Missing is never zero. Explicitly recorded zero is allowed. Gross margin requires complete recorded cost and received revenue. Break-even additionally requires `profitability_ready`, positive saleable yield and a compatible recorded or explicit expected price.

The UI reports percentage, missing categories and their impact. “Gross margin” is never labelled net profit.
