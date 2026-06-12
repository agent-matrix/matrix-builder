/* global React, ReactDOM */
const { useState: uS, useEffect: uE } = React;
const SA = window.SCOUT;
const UI = window.ScoutUI;
const Drawer = window.DeepDiveDrawer;
const Landing = window.ScoutLanding;

const SCAN_LINES = [
  "Reading developer signals…",
  "GitHub · Hugging Face",
  "Jobs · news · community",
  "Matching to your goal",
  "Building your report"
];

function ranked(goal) {
  const w = (SA.GOALS.find(g => g.id === goal) || SA.GOALS[0]).weight;
  return [...SA.TOPICS].sort((a, b) => (SA.composite(b) * 0.6 + b.signals[w] * 0.4) - (SA.composite(a) * 0.6 + a.signals[w] * 0.4));
}

function ToolHeader() {
  return (
    <header className="tool-header">
      <div className="tool-header__in">
        <a className="tool-header__back" href="index.html">← <span>All tools</span></a>
        <div className="tool-header__title"><span className="gl">◇</span> Scout</div>
        <div className="tool-header__user"><span className="live"><span className="dot" />LIVE</span><span className="avatar">RM</span></div>
      </div>
    </header>
  );
}

function App() {
  const [phase, setPhase] = uS("hero");
  const [country, setCountry] = uS("Italy");
  const [city, setCity] = uS("Rome");
  const [goal, setGoal] = uS("build_portfolio");
  const [profile, setProfile] = uS("Developer");
  const [scanIdx, setScanIdx] = uS(0);
  const [active, setActive] = uS(null);
  const [open, setOpen] = uS(false);
  const [mode, setMode] = uS("simple");
  const [allLocal, setAllLocal] = uS(false);
  const [allGlobal, setAllGlobal] = uS(false);
  const [barOpen, setBarOpen] = uS(true);
  const [animSafe, setAnimSafe] = uS(false);

  // after entrance animations finish, lock content visible regardless of animation-clock state
  uE(() => { setAnimSafe(false); const t = setTimeout(() => setAnimSafe(true), 1700); return () => clearTimeout(t); }, [phase, mode]);

  const goalObj = SA.GOALS.find(g => g.id === goal) || SA.GOALS[0];
  const topics = ranked(goal);
  const top = topics[0];
  const topDims = top ? SA.radar(top) : {};
  const bestCareer = [...SA.TOPICS].sort((a, b) => b.signals.career_value - a.signals.career_value)[0];
  const globalTopics = [...SA.TOPICS].sort((a, b) => SA.radar(b)["Global momentum"] - SA.radar(a)["Global momentum"]);
  const advanced = mode === "advanced";

  const repo = top ? SA.repoName(top) : "";
  const hfName = top ? top.short + " Scout Demo" : "";
  const blogTitle = top ? "How I built a local " + top.short.toLowerCase() + " scout for technology trends" : "";

  // persist mode preference
  uE(() => { try { const m = localStorage.getItem("scout-mode"); if (m) setMode(m); } catch (e) {} }, []);
  uE(() => { try { localStorage.setItem("scout-mode", mode); } catch (e) {} }, [mode]);

  function generate() { setPhase("scanning"); setScanIdx(0); setBarOpen(true); window.scrollTo({ top: 0, behavior: "smooth" }); }
  uE(() => {
    if (phase !== "scanning") return;
    if (scanIdx >= SCAN_LINES.length) { const t = setTimeout(() => setPhase("report"), 340); return () => clearTimeout(t); }
    const t = setTimeout(() => setScanIdx(i => i + 1), scanIdx === 0 ? 360 : 300);
    return () => clearTimeout(t);
  }, [phase, scanIdx]);

  function inspect(t) { setActive(t); setOpen(true); }
  function scrollTo(id) { const el = document.getElementById(id); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 72, behavior: "smooth" }); }
  const location = { country, city };

  return (
    <div className={"app" + (animSafe ? " anim-safe" : "")}>
      {/* landing */}
      {phase === "hero" && (
        <Landing
          profile={profile} setProfile={setProfile}
          city={city} country={country}
          setLocation={(c, co) => { setCity(c); setCountry(co); }}
          goal={goal} setGoal={setGoal}
          onGenerate={generate}
        />
      )}

      {/* scanning */}
      {phase === "scanning" && (
        <React.Fragment>
          <ToolHeader />
          <div className="wrap">
            <section className="darkpanel scout-hero">
              <UI.Constellation />
              <div style={{ position: "relative" }}>
                <div className="eyebrow"><span className="dot" />Your next move</div>
                <h1>Building <span className="em">your plan</span>…</h1>
                <div className="scanning">
                  <div className="scan-ring"><UI.ScoreRing value={Math.min(100, Math.round((scanIdx / SCAN_LINES.length) * 100))} size={92} stroke={6} dark={true} /></div>
                  <div className="scan-log">{SCAN_LINES[Math.min(scanIdx, SCAN_LINES.length - 1)]}</div>
                  <div className="scan-sub">{city}, {country} · {goalObj.label} · {profile}</div>
                </div>
              </div>
            </section>
          </div>
        </React.Fragment>
      )}

      {/* report */}
      {phase === "report" && (
        <React.Fragment>
          <ToolHeader />
          <main className="report wrap" id="report">
            <div className="report-head reveal">
              <div>
                <div className="meta">Scout Report</div>
                <h2>{city}, {country}</h2>
              </div>
              <div className="head-actions">
                <div className="mode-seg">
                  <button className={mode === "simple" ? "active" : ""} onClick={() => setMode("simple")}>Simple</button>
                  <button className={mode === "advanced" ? "active" : ""} onClick={() => setMode("advanced")}>Advanced</button>
                </div>
                <button className="btn small" onClick={() => window.print()}>Save as PDF</button>
                <button className="btn small ghosticon" onClick={() => setPhase("hero")} title="New report">↺</button>
              </div>
            </div>

            {/* the answer */}
            <article className="darkpanel move reveal">
              <div className="move-main">
                <div className="verdict">
                  <span className="vbadge"><span className="d" />Your fastest way to grow</span>
                  <h3 className="vhead">Learn <span className="em">{top.short}</span>.</h3>
                  <p className="vsub">{SA.verdict(top, profile, city)}</p>
                </div>
                <div className="move-rows">
                  <div className="move-row"><span className="ml"><span className="step-n">1</span>Learn it</span><span className="mv">{top.short}<span className="mv-pay">→ {SA.payoff(top).learn}</span></span><span className="eff">{SA.effort(top).learn}</span></div>
                  <div className="move-row"><span className="ml"><span className="step-n">2</span>Build it</span><span className="mv">{top.project_ideas[0]}<span className="mv-pay">→ {SA.payoff(top).build}</span></span><span className="eff">{SA.effort(top).build}</span></div>
                  <div className="move-row"><span className="ml"><span className="step-n">3</span>Show it</span><span className="mv">Put it on GitHub + Hugging Face<span className="mv-pay">→ {SA.payoff(top).show}</span></span><span className="eff">{SA.effort(top).show}</span></div>
                </div>
                <div className="gain">You'll gain a real project for your portfolio <b>and</b> a skill people are hiring for.</div>
                <div className="move-foot">
                  <span className="conf high on-dark"><span className="d" />High confidence</span>
                  <div className="ctarow">
                    <button className="btn primary small on-dark" onClick={() => scrollTo("visibility")}>Start step 1 →</button>
                    <button className="btn small on-dark" onClick={() => inspect(top)}>Why this?</button>
                  </div>
                </div>
              </div>
              {advanced && <div className="move-radar"><UI.RadarPolygon dims={topDims} dark={true} size={200} /></div>}
            </article>

            {/* Advanced-only: supporting insight strip */}
            {advanced && (
              <div className="strip reveal" style={{ marginTop: 24 }}>
                <div className="kpi"><span className="kpi__icon">◎</span><div className="kpi__body"><div className="kpi__label">Topic to study</div><div className="kpi__value">{top.short}</div><div className="kpi__note">{SA.action(top)}</div></div></div>
                <div className="kpi"><span className="kpi__icon">◇</span><div className="kpi__body"><div className="kpi__label">Project to build</div><div className="kpi__value" style={{ fontSize: "1.02rem" }}>{top.project_ideas[0]}</div><div className="kpi__note">{top.short}</div></div></div>
                <div className="kpi"><span className="kpi__icon">▣</span><div className="kpi__body"><div className="kpi__label">Best career value</div><div className="kpi__value" style={{ fontSize: "1.02rem" }}>{bestCareer.short}</div><div className="kpi__note">Career value {bestCareer.signals.career_value}</div></div></div>
                <div className="kpi"><span className="kpi__icon">⬡</span><div className="kpi__body"><div className="kpi__label">Hype risk</div><div className="kpi__value" style={{ fontSize: "1.02rem" }}>{Math.round(top.trust.hype_risk * 100)}%</div><div className="kpi__note">durable focus</div></div></div>
              </div>
            )}

            {/* what to learn */}
            <section className="section">
              <div className="section-head"><h3>What to learn</h3></div>
              <div className="opgrid">{(allLocal ? topics : topics.slice(0, 3)).map((t, i) => <UI.OpportunityCard key={t.id} topic={t} rank={i + 1} onInspect={inspect} advanced={advanced} />)}</div>
              {topics.length > 3 && <div className="showall"><button className="btn small" onClick={() => setAllLocal(v => !v)}>{allLocal ? "Show less" : "Show all " + topics.length}</button></div>}
            </section>

            {/* trending globally — Advanced only */}
            {advanced && (
              <section className="section">
                <div className="section-head"><h3>Trending globally</h3></div>
                <div className="opgrid">{(allGlobal ? globalTopics : globalTopics.slice(0, 3)).map((t, i) => <UI.OpportunityCard key={t.id} topic={t} rank={i + 1} onInspect={inspect} advanced={advanced} />)}</div>
                {globalTopics.length > 3 && <div className="showall"><button className="btn small" onClick={() => setAllGlobal(v => !v)}>{allGlobal ? "Show less" : "Show all " + globalTopics.length}</button></div>}
              </section>
            )}

            {/* publish your project — numbered checklist */}
            <section className="section" id="visibility">
              <div className="section-head"><h3>Publish your project</h3></div>
              <article className="card vis reveal">
                <div className="vis-list checklist">
                  <div className="vrow"><span className="ck-n">1</span><div className="ck-body"><span className="vk">Create this repo</span><div className="copyrow"><code>{repo}</code><UI.CopyButton text={repo} /></div></div></div>
                  <div className="vrow"><span className="ck-n">2</span><div className="ck-body"><span className="vk">Build this demo</span><div className="copyrow"><code>{hfName}</code><UI.CopyButton text={hfName} /></div></div></div>
                  <div className="vrow"><span className="ck-n">3</span><div className="ck-body"><span className="vk">Write this post</span><div className="copyrow"><code>{blogTitle}</code><UI.CopyButton text={blogTitle} /></div></div></div>
                </div>
              </article>
            </section>
          </main>

          <footer className="foot">
            <div className="wrap row">
              <div className="brand"><UI.Mark size={24} /> Scout</div>
              <div className="links"><a href="#">API</a><a href="#">Methodology</a><a href="#">Trust</a><a href="https://www.matrixhub.io" target="_blank" rel="noreferrer">Agent-Matrix</a></div>
              <div className="copy">Public developer layer of Matrix Scout · ruslanmv.com</div>
            </div>
          </footer>
        </React.Fragment>
      )}

      {phase === "report" && barOpen && <UI.NextBar project={top.project_ideas[0]} onView={() => scrollTo("visibility")} onClose={() => setBarOpen(false)} />}

      <Drawer topic={active} open={open} onClose={() => setOpen(false)} location={location} onStart={() => scrollTo("visibility")} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
