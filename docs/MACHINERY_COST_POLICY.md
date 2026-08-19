# Machinery and fuel cost policy

- An hourly operational machine rate is farmer-configured and is not described as tax depreciation.
- Rates are effective-dated versions. Activity completion freezes the selected version, actual hours, method, and totals.
- `included_in_hourly_rate` means separate fuel cost is exactly zero and fuel is not added again.
- `tracked_separately` uses actual litres when recorded; otherwise configured litres/hour may provide litres. A real fuel inventory price is still required.
- Missing machine or fuel price remains “Not recorded”. FarmOS does not estimate a market rate.
- Separate fuel records the linked fuel inventory item, litres, historical weighted-average price, and field/activity evidence.
- The server calculation is authoritative; an offline preview may show only the last-synchronized price.
