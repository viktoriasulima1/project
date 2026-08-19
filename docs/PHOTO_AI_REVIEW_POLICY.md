# Photo assistance review policy

Photo assistance is opt-in per selected photo. Before requesting it, the farmer sees what is sent, metadata/GPS exclusion, provider/retention/training policy and must check explicit consent. Upload never triggers analysis.

The structured contract contains candidates, numeric confidence, visible features, alternatives, limitations, cannot-determine, next scouting action, disclaimer and provider/model/version. Treatment, pesticides, guaranteed diagnosis, legal advice and arbitrary database IDs are invalid. Normal CI uses the deterministic provider. Accepted output can only become `suspected_cause`; reject and keep-unknown remain available. There is no Confirm diagnosis action.

`npm run test:vision:contract` is non-blocking and refuses execution unless `VISION_CONTRACT_TEST=true` and a synthetic image reference are supplied. It performs no DB mutation.
# Integrated review

Only a finalized farm-owned photo can be requested after explicit consent. The deterministic path persists bounded context checksum, provider/model/schema, candidates and farmer action. Suspected remains unconfirmed; consultation creates a scouting WorkOrder with `treatmentAuthorized=false`. No pesticide recommendation is accepted. A genuinely resized/compressed metadata-stripped external derivative is still pending and no live vision contract has been run.
