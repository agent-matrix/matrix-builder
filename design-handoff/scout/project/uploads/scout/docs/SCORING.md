# Methodology

Scout ranks topics using multiple public signals:

- GitHub developer activity and repository growth.
- Committers/location activity inspired by `committers.top` presets.
- Hugging Face models, datasets, and Spaces activity.
- News/RSS mentions and trend momentum.
- Jobs and skills demand.
- Community activity such as events, meetups, and local initiatives.

Scout avoids using private or invasive personal data. The public version focuses on **topics**, **locations**, and **aggregated developer opportunities**.

## Score layers

### Trend score

```text
trend_score =
  0.30 * github_activity
+ 0.20 * github_growth
+ 0.20 * huggingface_activity
+ 0.10 * news_mentions
+ 0.10 * job_demand
+ 0.10 * community_activity
```

### Actionability score

```text
actionability_score =
  0.25 * career_value
+ 0.20 * project_potential
+ 0.15 * local_relevance
+ 0.15 * learning_accessibility
+ 0.15 * durability
+ 0.10 * ecosystem_fit
```

### Matrix value score

```text
matrix_value_score =
  0.25 * agent_build_potential
+ 0.20 * reusable_tool_potential
+ 0.15 * mcp_server_potential
+ 0.15 * enterprise_relevance
+ 0.10 * governance_importance
+ 0.10 * dataset_potential
+ 0.05 * community_growth
```
