# Trust model

Scout recommendations must be explainable and auditable.

Every deep-dive topic should include:

- source list,
- collection time,
- data window,
- confidence score,
- freshness score,
- hype-risk score,
- source agreement,
- raw JSON links.

Trust score is based on:

```text
source_diversity + freshness + source_agreement + data_completeness - hype_risk
```

The public site should show simple trust labels:

- High confidence
- Medium confidence
- Low confidence
- Experimental
- Insufficient data
