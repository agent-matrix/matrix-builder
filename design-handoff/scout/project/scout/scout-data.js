/* Scout — embedded signal dataset (mirrors the live Rome/global datasets) */
window.SCOUT = (function () {
  const TOPICS = [
    {
      id: "ai-agents",
      name: "AI Agents & Agentic Workflows",
      short: "AI Agents",
      summary: "Systems that plan, use tools, call APIs, collaborate, and complete multi-step tasks.",
      why_follow: "Agent systems are becoming the practical interface for automation, enterprise workflows, coding, research, and multi-agent orchestration.",
      signals: { github_activity: 96, github_growth: 94, huggingface_activity: 92, news_mentions: 88, job_demand: 85, community_activity: 84, local_relevance: 82, project_potential: 96, career_value: 95, learning_accessibility: 78, durability: 90, ecosystem_fit: 99 },
      study_plan: ["Tool calling", "Agent orchestration", "Memory & retrieval", "Evaluation", "Governance & safety"],
      project_ideas: ["Local trend scout agent", "Agent workflow dashboard", "Agent evaluator MCP server"],
      skills: ["Python", "FastAPI", "LangGraph", "MCP", "RAG", "Docker"],
      risks: ["Frameworks change quickly", "Production reliability requires evaluation", "Autonomy needs governance"],
      sources: [{ name: "GitHub", type: "developer activity" }, { name: "Hugging Face", type: "ai builder activity" }, { name: "News / RSS", type: "market signal" }, { name: "Jobs", type: "hiring signal" }, { name: "Community", type: "discussion" }],
      trust: { score: 0.91, label: "High confidence", hype_risk: 0.22 }
    },
    {
      id: "rag",
      name: "Retrieval-Augmented Generation",
      short: "RAG Systems",
      summary: "Applications that connect LLMs to private, local, or domain-specific knowledge.",
      why_follow: "RAG remains one of the most practical ways to build useful AI applications with enterprise and local data.",
      signals: { github_activity: 93, github_growth: 86, huggingface_activity: 88, news_mentions: 75, job_demand: 88, community_activity: 76, local_relevance: 86, project_potential: 94, career_value: 92, learning_accessibility: 82, durability: 92, ecosystem_fit: 91 },
      study_plan: ["Embeddings", "Chunking", "Vector search", "Reranking", "Evaluation"],
      project_ideas: ["Local PDF assistant", "RAG evaluation dashboard", "Enterprise knowledge assistant"],
      skills: ["Python", "Vector databases", "Embeddings", "LangChain", "LlamaIndex"],
      risks: ["Poor evaluation can hide hallucinations", "Data privacy must be handled carefully"],
      sources: [{ name: "GitHub", type: "developer activity" }, { name: "Hugging Face", type: "ai builder activity" }, { name: "Jobs", type: "hiring signal" }],
      trust: { score: 0.89, label: "High confidence", hype_risk: 0.18 }
    },
    {
      id: "llm-evaluation",
      name: "LLM & Agent Evaluation",
      short: "LLM Evaluation",
      summary: "Testing, tracing, scoring, and observing LLM and agent behaviour.",
      why_follow: "As AI systems move from demos to production, teams need reliable evaluation, observability, and regression testing.",
      signals: { github_activity: 86, github_growth: 90, huggingface_activity: 80, news_mentions: 78, job_demand: 81, community_activity: 72, local_relevance: 78, project_potential: 92, career_value: 90, learning_accessibility: 75, durability: 94, ecosystem_fit: 96 },
      study_plan: ["Golden datasets", "Prompt regression tests", "Traces", "LLM-as-judge", "Human review"],
      project_ideas: ["Agent quality dashboard", "RAG evaluation suite", "Prompt regression tool"],
      skills: ["Evaluation", "Observability", "Python", "Dashboards", "OpenTelemetry"],
      risks: ["LLM-as-judge can be biased", "Metrics can mislead without human checks"],
      sources: [{ name: "GitHub", type: "developer activity" }, { name: "Hugging Face", type: "ai builder activity" }, { name: "News / RSS", type: "market signal" }],
      trust: { score: 0.86, label: "High confidence", hype_risk: 0.20 }
    },
    {
      id: "ai-governance",
      name: "AI Governance & Policy Automation",
      short: "AI Governance",
      summary: "Policies, controls, risk checks, and compliance workflows for AI systems.",
      why_follow: "Enterprise AI adoption requires safety, auditability, policy enforcement, and regulatory readiness.",
      signals: { github_activity: 72, github_growth: 75, huggingface_activity: 65, news_mentions: 90, job_demand: 84, community_activity: 70, local_relevance: 88, project_potential: 82, career_value: 86, learning_accessibility: 72, durability: 94, ecosystem_fit: 97 },
      study_plan: ["AI risk taxonomy", "Policy checks", "Audit trails", "Human approval", "EU AI Act basics"],
      project_ideas: ["AI policy checker", "Guardian policy pack", "Compliance dashboard"],
      skills: ["Governance", "Risk management", "Python", "Policy engines"],
      risks: ["Regulation changes over time", "Legal interpretation needs expert review"],
      sources: [{ name: "News / RSS", type: "market signal" }, { name: "Jobs", type: "hiring signal" }, { name: "Community", type: "discussion" }],
      trust: { score: 0.82, label: "Medium confidence", hype_risk: 0.28 }
    },
    {
      id: "cybersecurity-automation",
      name: "Cybersecurity Automation",
      short: "Security Automation",
      summary: "AI-assisted detection, triage, incident response, and secure software workflows.",
      why_follow: "Security demand is durable and AI-assisted automation is becoming important across every organisation.",
      signals: { github_activity: 84, github_growth: 74, huggingface_activity: 68, news_mentions: 82, job_demand: 94, community_activity: 79, local_relevance: 84, project_potential: 85, career_value: 96, learning_accessibility: 68, durability: 96, ecosystem_fit: 86 },
      study_plan: ["Threat modeling", "Log analysis", "Detection rules", "Incident response", "Secure automation"],
      project_ideas: ["Phishing analysis assistant", "Security log summarizer", "Vulnerability triage bot"],
      skills: ["Security", "Python", "SIEM", "Detection engineering"],
      risks: ["Security tooling must be used ethically", "Avoid offensive misuse"],
      sources: [{ name: "GitHub", type: "developer activity" }, { name: "Jobs", type: "hiring signal" }, { name: "News / RSS", type: "market signal" }],
      trust: { score: 0.87, label: "High confidence", hype_risk: 0.15 }
    },
    {
      id: "cloud-native-ai",
      name: "Cloud-Native AI Applications",
      short: "Cloud-Native AI",
      summary: "Deploying AI apps using containers, serverless, observability, and scalable cloud infrastructure.",
      why_follow: "AI products need production infrastructure, deployment, monitoring, and cost control to reach real users.",
      signals: { github_activity: 82, github_growth: 70, huggingface_activity: 72, news_mentions: 70, job_demand: 90, community_activity: 76, local_relevance: 80, project_potential: 86, career_value: 92, learning_accessibility: 76, durability: 94, ecosystem_fit: 88 },
      study_plan: ["Docker", "FastAPI", "Kubernetes basics", "CI/CD", "Observability"],
      project_ideas: ["Deployable RAG API", "AI app observability stack", "Cost-aware model router"],
      skills: ["Docker", "Kubernetes", "FastAPI", "CI/CD", "Cloud"],
      risks: ["Infra cost can grow quickly", "Requires ops discipline"],
      sources: [{ name: "GitHub", type: "developer activity" }, { name: "Jobs", type: "hiring signal" }, { name: "Hugging Face", type: "ai builder activity" }],
      trust: { score: 0.84, label: "Medium confidence", hype_risk: 0.14 }
    }
  ];

  const LOCATIONS = [
    { country: "Italy", cities: ["Rome", "Milan", "Turin"] },
    { country: "Germany", cities: ["Berlin", "Munich"] },
    { country: "Spain", cities: ["Madrid", "Barcelona"] },
    { country: "United States", cities: ["San Francisco", "New York", "Austin"] },
    { country: "United Kingdom", cities: ["London", "Manchester"] },
    { country: "India", cities: ["Bengaluru", "Mumbai"] }
  ];

  const GOALS = [
    { id: "build_portfolio", label: "Build portfolio", weight: "project_potential", verb: "publish" },
    { id: "career", label: "Advance career", weight: "career_value", verb: "land roles in" },
    { id: "create_agents", label: "Create agents", weight: "ecosystem_fit", verb: "ship agents for" },
    { id: "startup", label: "Launch a startup", weight: "durability", verb: "build a product on" }
  ];

  const PROFILES = ["Developer", "ML Engineer", "Student", "Founder", "Data Scientist"];

  /* ----- derivations ----- */
  function composite(t) {
    const s = t.signals;
    const v = 0.18 * s.github_activity + 0.12 * s.github_growth + 0.12 * s.huggingface_activity +
      0.10 * s.news_mentions + 0.12 * s.job_demand + 0.08 * s.community_activity +
      0.14 * s.project_potential + 0.14 * s.ecosystem_fit;
    return Math.round(v);
  }
  function radar(t) {
    const s = t.signals;
    return {
      "Global momentum": Math.round((s.github_activity + s.github_growth + s.huggingface_activity + s.news_mentions) / 4),
      "Local relevance": s.local_relevance,
      "Career value": Math.round((s.career_value + s.job_demand) / 2),
      "Project potential": s.project_potential,
      "Trust": Math.round(t.trust.score * 100)
    };
  }
  function difficulty(t) {
    const a = t.signals.learning_accessibility;
    if (a >= 80) return "Easy";
    if (a >= 73) return "Medium";
    return "Hard";
  }
  function evidence(v) {
    if (v >= 90) return "Very strong";
    if (v >= 80) return "Strong";
    if (v >= 70) return "Growing";
    if (v >= 55) return "Active";
    return "Emerging";
  }
  function action(t) {
    const c = composite(t);
    if (c >= 90) return "Study now · Build now";
    if (c >= 84) return "Study now · Build soon";
    return "Watch · Learn";
  }
  function actionShort(t) {
    const c = composite(t);
    if (c >= 84) return "Study now";
    return "Watch";
  }
  /* ---- plain-language "help me grow" copy ---- */
  function verdict(t, profile, city) {
    const c = composite(t);
    const who = (profile || "developer").toLowerCase();
    if (c >= 90) return "It's the fastest-growing skill for a " + who + " near you right now.";
    if (c >= 84) return "It's one of the best skills to grow into as a " + who + " right now.";
    return "A solid skill to start learning now.";
  }
  function studyWeeks(t) {
    const a = t.signals.learning_accessibility;
    if (a >= 80) return "~3 weeks";
    if (a >= 73) return "~5 weeks";
    return "~8 weeks";
  }
  function effort(t) {
    return { learn: studyWeeks(t), build: "a weekend", show: "1 evening" };
  }
  function payoff(t) {
    return { learn: "a skill that's in demand", build: "proof you can actually do it", show: "so people can find you" };
  }
  function whyRank(t) {
    const s = t.signals;
    if (s.job_demand >= 90) return "Lots of jobs ask for it";
    if (s.github_growth >= 88) return "Growing fast right now";
    if (s.career_value >= 92) return "High pay-off for your career";
    if (s.local_relevance >= 84) return "In demand near you";
    return "Strong, steady demand";
  }
  /* three plain reasons for the "Why this?" drawer */
  function whyReasons(t, city) {
    const s = t.signals;
    return [
      { icon: "💼", t: "Companies are hiring for it", d: "Job demand is " + evidence(s.job_demand).toLowerCase() + (city ? ", including near " + city + "." : ".") },
      { icon: "📈", t: "It's active and growing", d: "GitHub and Hugging Face activity is " + evidence(Math.round((s.github_activity + s.github_growth) / 2)).toLowerCase() + " right now." },
      { icon: "🛠️", t: "You can build something fast", d: "You can ship " + t.project_ideas[0].toLowerCase() + " in a weekend and show it off." }
    ];
  }
  function planSteps(t) {
    return [
      { n: 1, t: "Learn the basics", d: t.study_plan.slice(0, 2).join(" · "), time: "30–60 min/day" },
      { n: 2, t: "Build a small demo", d: t.project_ideas[0], time: "2–4 hours" },
      { n: 3, t: "Publish & explain it", d: "Put it on GitHub + write a short post", time: "30 min" }
    ];
  }
  function repoName(t) {
    return t.id.replace(/[^a-z0-9-]/g, "") + "-" + (t.project_ideas[0] || "lab").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }
  return { TOPICS, LOCATIONS, GOALS, PROFILES, composite, radar, difficulty, evidence, action, actionShort, verdict, effort, payoff, whyRank, whyReasons, planSteps, repoName };
})();
