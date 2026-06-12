/* global React */
const { useState: useStateD, useEffect: useEffectD } = React;
const SD = window.SCOUT;

function DeepDiveDrawer({ topic, open, onClose, location, onStart }) {
  const [tab, setTab] = useStateD("why");
  useEffectD(() => { if (open) setTab("why"); }, [open, topic && topic.id]);
  useEffectD(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const TABS = [["why", "Why this?"], ["plan", "Your plan"], ["advanced", "Advanced"]];
  const { RadarBars } = window.ScoutUI;

  function body() {
    if (!topic) return null;
    const s = topic.signals;
    const dims = SD.radar(topic);
    const high = topic.trust.score >= 0.87;
    const reasons = SD.whyReasons(topic, location.city);
    const steps = SD.planSteps(topic);
    const evRows = [
      ["GitHub activity", s.github_activity], ["GitHub growth", s.github_growth],
      ["Hugging Face", s.huggingface_activity], ["News / RSS", s.news_mentions],
      ["Job demand", s.job_demand], ["Community", s.community_activity]
    ];
    switch (tab) {
      case "why":
        return (
          <div>
            <ol className="reasons">
              {reasons.map((r, i) => (
                <li key={i}><span className="rn">{i + 1}</span><div><div className="rt">{r.t}</div><div className="rd">{r.d}</div></div></li>
              ))}
            </ol>
            <div className="next-cta">
              <div className="nc-l">Next</div>
              <p>Start small: build <b>{topic.project_ideas[0]}</b>, then publish it.</p>
              <button className="btn primary" onClick={() => { onClose(); if (onStart) onStart(); }}>Start step 1 →</button>
            </div>
          </div>
        );
      case "plan":
        return (
          <div>
            <div className="planlist">
              {steps.map((st) => (
                <div className="planstep" key={st.n}>
                  <span className="ps-n">{st.n}</span>
                  <div className="ps-body"><div className="ps-t">{st.t}</div><div className="ps-d">{st.d}</div></div>
                  <span className="ps-time">{st.time}</span>
                </div>
              ))}
            </div>
            <h4>Skills you'll show</h4>
            <div className="chip-list">{topic.skills.map(s2 => <span className="tag" key={s2}>{s2}</span>)}</div>
          </div>
        );
      case "advanced":
        return (
          <div>
            <h4>Why we recommend this</h4>
            {evRows.map(([n, v]) => (
              <div className="evline" key={n}><span className="en">{n}</span><span className="et"><i style={{ width: v + "%" }} /></span><span className="ev">{SD.evidence(v)}</span></div>
            ))}
            <h4>Signal radar</h4>
            <RadarBars dims={dims} />
            <h4>Trust</h4>
            <p><b style={{ color: high ? "var(--green-700)" : "var(--amber)" }}>{high ? "High confidence" : "Medium confidence"} · {Math.round(topic.trust.score * 100)}%</b><br />Cross-checked across {topic.sources.length} independent sources. Hype-risk index {Math.round(topic.trust.hype_risk * 100)}%.</p>
            <h4>Watch out for</h4>
            {topic.risks.map((r, i) => <div className="risk" key={i}><span className="ri">⚠</span><p>{r}</p></div>)}
            <details className="adv">
              <summary>Agent opportunities</summary>
              <div className="advbody amx">
                <div className="ax"><div className="axk">Agent category</div><div className="axv">Developer intelligence · {topic.short}</div></div>
                <div className="ax"><div className="axk">MCP surface</div><div className="axv">Expose {topic.short} signals as an MCP tool for agents to query.</div></div>
                <div className="ax"><div className="axk">Register in MatrixHub</div><div className="axv">Publish <span style={{ fontFamily: "var(--mono)", color: "var(--green-700)" }}>{SD.repoName(topic)}</span> as a discoverable agent.</div></div>
              </div>
            </details>
            <details className="adv">
              <summary>Raw data (JSON)</summary>
              <div className="advbody"><pre className="json">{JSON.stringify({ id: topic.id, composite_score: SD.composite(topic), radar: dims, signals: topic.signals, trust: topic.trust }, null, 2)}</pre></div>
            </details>
          </div>
        );
      default: return null;
    }
  }

  return (
    <React.Fragment>
      <div className={"scrim" + (open ? " open" : "")} onClick={onClose} />
      <aside className={"drawer" + (open ? " open" : "")} aria-hidden={!open}>
        {topic && <React.Fragment>
          <div className="dh">
            <button className="x" onClick={onClose} aria-label="Close">✕</button>
            <div className="ek">Why this topic</div>
            <h3>Why {topic.short}?</h3>
          </div>
          <div className="tabs">
            {TABS.map(([id, lab]) => <button key={id} className={"tab" + (tab === id ? " active" : "")} onClick={() => setTab(id)}>{lab}</button>)}
          </div>
          <div className="dbody"><div key={tab} className="tabpane">{body()}</div></div>
        </React.Fragment>}
      </aside>
    </React.Fragment>
  );
}

window.DeepDiveDrawer = DeepDiveDrawer;
