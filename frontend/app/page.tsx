"use client";

import { FormEvent, useMemo, useState } from "react";

type Change = { description: string };
type Result = {
  fix_status: "fix_proposed" | "needs_context"; summary: string; error_type: string | null; explanation: string; corrected_code: string;
  changes: Change[]; confidence: "low" | "medium" | "high" | null;
  validation_status: "static_pass" | "static_fail" | "not_checked";
  validation_details: string; remaining_issues: string[]; follow_up_questions: string[]; model: string;
};

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

function DiffView({ before, after }: { before: string; after: string }) {
  const oldLines = before.split("\n");
  const newLines = after.split("\n");
  const compact = oldLines.length * newLines.length > 250_000;
  const rows: Array<{ oldLine?: string; newLine?: string; oldNo?: number; newNo?: number; kind: "same" | "removed" | "added" | "modified" }> = [];
  if (!compact) {
    const width = newLines.length + 1;
    const lcs = Array.from({ length: oldLines.length + 1 }, () => new Uint16Array(width));
    for (let i = oldLines.length - 1; i >= 0; i--) for (let j = newLines.length - 1; j >= 0; j--)
      lcs[i][j] = oldLines[i] === newLines[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    let i = 0; let j = 0;
    while (i < oldLines.length || j < newLines.length) {
      if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) { rows.push({ oldLine: oldLines[i], newLine: newLines[j], oldNo: i + 1, newNo: j + 1, kind: "same" }); i++; j++; }
      else if (i < oldLines.length && (j >= newLines.length || lcs[i + 1][j] >= lcs[i][j + 1])) { rows.push({ oldLine: oldLines[i], oldNo: i + 1, kind: "removed" }); i++; }
      else { rows.push({ newLine: newLines[j], newNo: j + 1, kind: "added" }); j++; }
    }
  } else {
    const count = Math.max(oldLines.length, newLines.length);
    for (let i = 0; i < count; i++) rows.push({ oldLine: oldLines[i], newLine: newLines[i], oldNo: i < oldLines.length ? i + 1 : undefined, newNo: i < newLines.length ? i + 1 : undefined, kind: oldLines[i] === newLines[i] ? "same" : oldLines[i] === undefined ? "added" : newLines[i] === undefined ? "removed" : "modified" });
  }
  return <div className="diff" aria-label="Line by line code comparison">{compact && <div className="diff-notice">Large file: showing a compact positional comparison.</div>}{rows.map((row, index) => <div className="diffrow" key={index}>
    <span className={`diffline ${row.kind === "removed" || row.kind === "modified" ? "removed" : row.kind === "same" ? "same" : "blank"}`}><b>{row.oldNo ?? ""}</b><code>{row.oldLine ?? " "}</code></span>
    <span className={`diffline ${row.kind === "added" || row.kind === "modified" ? "added" : row.kind === "same" ? "same" : "blank"}`}><b>{row.newNo ?? ""}</b><code>{row.newLine ?? " "}</code></span>
  </div>)}</div>;
}

export default function Home() {
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("Python");
  const [errorMessage, setErrorMessage] = useState("");
  const [expected, setExpected] = useState("");
  const [context, setContext] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"fixed" | "diff">("fixed");
  const [copied, setCopied] = useState(false);
  const lineCount = useMemo(() => Math.max(1, code.split("\n").length), [code]);

  async function analyze(event?: FormEvent) {
    event?.preventDefault();
    if (busy) return;
    if (!code.trim()) { setError("Add the code you want to debug first."); return; }
    setBusy(true); setError(""); setResult(null);
    try {
      const response = await fetch(`${apiBase}/api/debug`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language: language.toLowerCase(), error_message: errorMessage, expected_behavior: expected, context }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || "Debug request failed. Please try again.");
      setResult(payload as Result); setTab("fixed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The debugging service could not be reached.");
    } finally { setBusy(false); }
  }

  async function copyCode() {
    if (!result) return;
    try { await navigator.clipboard.writeText(result.corrected_code); setCopied(true); window.setTimeout(() => setCopied(false), 1600); }
    catch { setError("Clipboard access failed. Select and copy the code instead."); }
  }

  const validationLabel = result?.validation_status === "static_pass" ? "Syntax passed" : result?.validation_status === "static_fail" ? "Syntax issue" : "Not checked";

  return <main className="shell">
    <header className="topbar">
      <a className="brand" href="#" aria-label="Trivu home"><span className="brandmark">t<span>.</span></span><span>trivu</span></a>
      <div className="top-context"><span className="live-dot" /> Debug workspace <span className="slash">/</span> New session</div>
      <div className="top-right"><span className="provider"><i /> NVIDIA API · server-side</span><span className="avatar">DV</span></div>
    </header>

    <div className="workspace">
      <section className="left-pane">
        <div className="page-intro"><div className="eyebrow"><span className="eyebrow-rule" /> CODE INTELLIGENCE</div><h1>Find the bug.<br /><em>Understand the fix.</em></h1><p>Share your code and the error you hit. Get a focused diagnosis and a correction you can review.</p></div>
        <form onSubmit={analyze}>
          <div className="section-heading"><div><span className="step">01</span><h2>Source code</h2></div><div className="language-select"><label htmlFor="language">LANGUAGE</label><select id="language" value={language} onChange={(e) => setLanguage(e.target.value)}><option>Python</option><option>JavaScript</option><option>TypeScript</option><option>Java</option><option>C++</option><option>Go</option><option>Rust</option><option>Other</option></select><span className="chevron">⌄</span></div></div>
          <div className="editor-wrap"><div className="editor-meta"><span><span className="file-icon">▧</span> scratch.{language === "Python" ? "py" : language === "TypeScript" ? "ts" : language === "JavaScript" ? "js" : "txt"}</span><span>{code.length.toLocaleString()} / 30,000</span></div>
            <div className="code-input"><div className="gutter" aria-hidden="true">{Array.from({ length: lineCount }, (_, i) => <span key={i}>{String(i + 1).padStart(2, "0")}</span>)}</div><textarea aria-label="Source code" spellCheck={false} maxLength={30000} value={code} onChange={(e) => setCode(e.target.value)} placeholder={'def calculate_total(items):\n    # Paste your code here\n    return sum(items)'} /></div>
            <div className="editor-foot"><span><i className="status-dot" /> Ready for analysis</span><button type="button" className="text-button" onClick={() => { setCode(""); setResult(null); }}>Clear editor</button></div>
          </div>

          <div className="context-grid">
            <div className="field-block"><label htmlFor="error-context"><span className="step small">02</span> ERROR MESSAGE <span className="optional">OPTIONAL</span></label><textarea id="error-context" rows={4} maxLength={4000} value={errorMessage} onChange={(e) => setErrorMessage(e.target.value)} placeholder={'Paste traceback or compiler output…'} /></div>
            <div className="field-block"><label htmlFor="expected-context"><span className="step small">03</span> EXPECTED BEHAVIOR <span className="optional">OPTIONAL</span></label><textarea id="expected-context" rows={4} maxLength={4000} value={expected} onChange={(e) => setExpected(e.target.value)} placeholder="What should this code do?" /></div>
          </div>
          <div className="field-block supporting-context"><label htmlFor="supporting-context">ENVIRONMENT / ADDITIONAL CONTEXT <span className="optional">OPTIONAL · 4,000 CHARACTERS</span></label><textarea id="supporting-context" rows={2} maxLength={4000} value={context} onChange={(e) => setContext(e.target.value)} placeholder="Relevant framework or runtime versions, command used, or recent changes…" /></div>
          {error && <div className="error-banner" role="alert"><span>!</span><div><strong>Couldn’t complete analysis</strong><p>{error}</p></div><button type="button" onClick={() => setError("")} aria-label="Dismiss error">×</button></div>}
          <div className="action-row"><button className="debug-button" type="submit" disabled={busy}>{busy ? <><span className="spinner" /> Analyzing code…</> : <>Analyze code <span>↗</span></>}</button><span className="privacy-note"><span>⌑</span> Code is sent to NVIDIA through the backend</span></div>
        </form>
      </section>

      <section className="right-pane" aria-live="polite">
        {!result && !busy && <div className="empty-state"><div className="empty-orbit"><span className="orbit-center">⌘</span><i className="orbit-dot d1" /><i className="orbit-dot d2" /><i className="orbit-dot d3" /></div><div className="eyebrow">YOUR ANALYSIS</div><h2>{error ? "Ready when you are." : "A clearer path to green."}</h2><p>{error ? "Review the service message, then retry your analysis." : "Your diagnosis, corrected code, and validation details will appear here."}</p><div className="empty-checks"><span><b>01</b> Root cause</span><span><b>02</b> Targeted correction</span><span><b>03</b> Syntax validation</span></div><div className="external-note"><span>ⓘ</span><p>Code is sent to NVIDIA for inference. Never include credentials or secrets in your submission.</p></div></div>}
        {busy && <div className="loading-state"><div className="loading-mark"><i /><i /><i /></div><div className="eyebrow">WORKING THROUGH IT</div><h2>Tracing the issue</h2><p>Reviewing your code and error context. This can take a few seconds.</p><div className="loading-track"><span /></div></div>}
        {result && <div className="result-state">
          <div className={`result-kicker ${result.fix_status === "needs_context" ? "needs-context" : ""}`}><span><i className="live-dot" /> {result.fix_status === "fix_proposed" ? "FIX PROPOSED" : "MORE CONTEXT NEEDED"}</span><span className="model-tag">{result.model}</span></div>
          <div className="diagnosis"><div className="diagnosis-title"><span className="diagnosis-icon">⌁</span><div><div className="eyebrow">LIKELY ROOT CAUSE {result.error_type && <span className="type-tag">{result.error_type}</span>}</div><h2>{result.summary}</h2></div></div><p>{result.explanation}</p></div>
          {result.changes.length > 0 && <div className="changes"><div className="mini-heading">WHAT CHANGED <span>{String(result.changes.length).padStart(2, "0")}</span></div>{result.changes.map((change, i) => <div className="change-item" key={i}><span className="change-check">✓</span>{change.description}</div>)}</div>}
          {result.follow_up_questions.length > 0 && <div className="remaining"><strong>To narrow this down</strong>{result.follow_up_questions.map((question, i) => <p key={i}>• {question}</p>)}</div>}
          {result.fix_status === "needs_context" && <div className="context-notice">No correction was inferred. The code below remains your submitted code.</div>}
          <div className="result-divider" />
          <div className="code-result-head"><div className="result-tabs"><button type="button" className={tab === "fixed" ? "active" : ""} onClick={() => setTab("fixed")}>{result.fix_status === "fix_proposed" ? "Proposed fix" : "Submitted code"}</button><button type="button" className={tab === "diff" ? "active" : ""} onClick={() => setTab("diff")}>Compare <span className="diff-badge">±</span></button></div><button type="button" className="copy-button" onClick={copyCode}>▢ {copied ? "Copied" : "Copy code"}</button></div>
          <div className="result-code">{tab === "fixed" ? <pre><code>{result.corrected_code}</code></pre> : <DiffView before={code} after={result.corrected_code} />}</div>
          <div className={`validation ${result.validation_status}`}><span className="validation-icon">{result.validation_status === "static_pass" ? "✓" : result.validation_status === "static_fail" ? "!" : "–"}</span><div><strong>{validationLabel}</strong><p>{result.validation_details}</p></div><span className="validation-kind">STATIC ONLY</span></div>
          {result.remaining_issues.length > 0 && <div className="remaining"><strong>Still to check</strong>{result.remaining_issues.map((issue, i) => <p key={i}>• {issue}</p>)}</div>}
          <button type="button" className="retry-button" disabled={busy} onClick={() => analyze()}>↻ Regenerate analysis</button>
        </div>}
        <div className="right-footer"><span>TRIVU <span className="footer-sep">/</span> DEBUGGING WORKSPACE</span><span>MODEL SUGGESTIONS ARE NOT EXECUTION RESULTS</span></div>
      </section>
    </div>
  </main>;
}
