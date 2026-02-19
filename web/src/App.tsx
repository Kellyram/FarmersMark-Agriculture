import {FormEvent, useMemo, useState} from "react";
import {analyzeDocument, getReports} from "./api";
import {Report} from "./types";

const FRAMEWORK_OPTIONS = ["iso27001", "nist", "soc2", "hipaa"];

export function App() {
  const [userId, setUserId] = useState("user-demo-001");
  const [policyId, setPolicyId] = useState("");
  const [policyText, setPolicyText] = useState("");
  const [frameworks, setFrameworks] = useState<string[]>(["iso27001", "nist"]);
  const [analysis, setAnalysis] = useState("");
  const [reports, setReports] = useState<Report[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [error, setError] = useState("");

  const frameworkSummary = useMemo(() => frameworks.join(", ") || "None selected", [frameworks]);

  function toggleFramework(value: string) {
    setFrameworks((prev) =>
      prev.includes(value) ? prev.filter((f) => f !== value) : [...prev, value],
    );
  }

  async function handleAnalyze(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (!policyText.trim()) {
      setError("Policy text is required.");
      return;
    }
    if (!frameworks.length) {
      setError("Select at least one framework.");
      return;
    }

    setIsAnalyzing(true);
    try {
      const response = await analyzeDocument({
        userId,
        policyId: policyId || undefined,
        policyText,
        frameworks,
      });

      if (!response.success) {
        throw new Error(response.error || "Analysis failed.");
      }

      setAnalysis(response.analysis || "");
      await loadReports();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function loadReports() {
    setIsLoadingReports(true);
    setError("");

    try {
      const response = await getReports(userId);
      if (!response.success) {
        throw new Error(response.error || "Could not load reports.");
      }
      setReports(response.reports || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setIsLoadingReports(false);
    }
  }

  return (
    <div className="page">
      <header className="hero">
        <div className="hero-grid" aria-hidden="true" />
        <p className="eyebrow">FarmersMark</p>
        <h1>Compliance RAG Console</h1>
        <p className="subhead">
          Analyze policy text against framework chunks from Firestore with Vertex-powered retrieval and generation.
        </p>
      </header>

      <main className="layout">
        <section className="panel input-panel">
          <h2>Run Analysis</h2>
          <form onSubmit={handleAnalyze} className="form">
            <label>
              User ID
              <input value={userId} onChange={(e) => setUserId(e.target.value)} required />
            </label>

            <label>
              Policy ID (optional)
              <input value={policyId} onChange={(e) => setPolicyId(e.target.value)} />
            </label>

            <fieldset>
              <legend>Frameworks</legend>
              <div className="pill-row">
                {FRAMEWORK_OPTIONS.map((name) => {
                  const selected = frameworks.includes(name);
                  return (
                    <button
                      key={name}
                      type="button"
                      className={selected ? "pill active" : "pill"}
                      onClick={() => toggleFramework(name)}
                    >
                      {name.toUpperCase()}
                    </button>
                  );
                })}
              </div>
              <small>Selected: {frameworkSummary}</small>
            </fieldset>

            <label>
              Policy Text
              <textarea
                value={policyText}
                onChange={(e) => setPolicyText(e.target.value)}
                rows={14}
                placeholder="Paste policy content here for analysis..."
                required
              />
            </label>

            <div className="actions">
              <button className="primary" type="submit" disabled={isAnalyzing}>
                {isAnalyzing ? "Analyzing..." : "Analyze Policy"}
              </button>
              <button className="secondary" type="button" onClick={loadReports} disabled={isLoadingReports}>
                {isLoadingReports ? "Loading..." : "Refresh Reports"}
              </button>
            </div>
          </form>

          {error && <p className="error">{error}</p>}
        </section>

        <section className="panel results-panel">
          <h2>Latest Analysis</h2>
          <pre>{analysis || "No analysis yet."}</pre>
        </section>

        <section className="panel reports-panel">
          <h2>Recent Reports</h2>
          {reports.length === 0 ? (
            <p className="muted">No reports loaded.</p>
          ) : (
            <ul className="report-list">
              {reports.map((report) => (
                <li key={report.id} className="report-item">
                  <div>
                    <strong>{report.id}</strong>
                    <p>{report.frameworks?.join(", ") || "No frameworks"}</p>
                  </div>
                  <button
                    type="button"
                    className="linkish"
                    onClick={() => setAnalysis(report.analysis || "")}
                  >
                    View
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}