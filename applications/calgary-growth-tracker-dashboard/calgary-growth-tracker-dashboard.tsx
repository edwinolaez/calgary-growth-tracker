import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis,
  Legend,
  PieChart,
  Pie,
} from 'recharts';
import {
  AlertCircle,
  Building2,
  Compass,
  Home,
  RefreshCw,
  TrendingUp,
  Users,
} from 'lucide-react';

const connection = 'data_plane_fabric';
const COLORS = ['#0ea5e9', '#14b8a6', '#8b5cf6', '#f59e0b', '#ec4899'];
const QUADRANT_COLORS = {
  NE: '#0ea5e9',
  NW: '#14b8a6',
  SE: '#f59e0b',
  SW: '#8b5cf6',
  MAPPING_REQUIRED: '#ef4444',
};

const growthNodesQuery = `
SELECT TOP 5
    community_name,
    quadrant,
    resilience_score,
    new_business_licenses,
    forecast_housing_units,
    unemployment_rate_per
FROM {{ ref('calgary_quadrant_resilience', flow='calgary_economic_growth_tracker') }}
WHERE year = 2026
ORDER BY resilience_score DESC, new_business_licenses DESC
`;

const unemploymentHousingQuery = `
SELECT TOP 12
    community_name,
    quadrant,
    unemployment_rate_per,
    forecast_housing_units,
    resilience_score
FROM {{ ref('calgary_quadrant_resilience', flow='calgary_economic_growth_tracker') }}
WHERE year = 2026
ORDER BY unemployment_rate_per DESC, forecast_housing_units DESC
`;

const quadrantSummaryQuery = `
SELECT
    quadrant,
    COUNT(*) AS community_count,
    AVG(CAST(unemployment_rate_per AS FLOAT)) AS avg_unemployment_rate,
    AVG(CAST(forecast_housing_units AS FLOAT)) AS avg_housing_units,
    AVG(CAST(resilience_score AS FLOAT)) AS avg_resilience_score
FROM {{ ref('calgary_quadrant_resilience', flow='calgary_economic_growth_tracker') }}
WHERE year = 2026
GROUP BY quadrant
ORDER BY quadrant
`;

function formatNumber(value) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(Number(value || 0));
}

function formatPercent(value) {
  return `${formatNumber(value)}%`;
}

function quadrantColor(quadrant) {
  return QUADRANT_COLORS[quadrant] || QUADRANT_COLORS.MAPPING_REQUIRED;
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);
  const [unemploymentHousingRows, setUnemploymentHousingRows] = useState([]);
  const [quadrantRows, setQuadrantRows] = useState([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const growthResult = await window.ascend.runQuery(growthNodesQuery, { connection });
      const unemploymentHousingResult = await window.ascend.runQuery(unemploymentHousingQuery, { connection });
      const quadrantResult = await window.ascend.runQuery(quadrantSummaryQuery, { connection });

      setRows(growthResult.rows || []);
      setUnemploymentHousingRows(unemploymentHousingResult.rows || []);
      setQuadrantRows(quadrantResult.rows || []);
    } catch (err) {
      setError(err?.message || 'Failed to load growth node summary.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const topNode = useMemo(() => rows[0] || null, [rows]);
  const unemploymentLeader = useMemo(() => unemploymentHousingRows[0] || null, [unemploymentHousingRows]);
  const quadrantMix = useMemo(
    () => quadrantRows.map((row) => ({ ...row, fill: quadrantColor(row.quadrant) })),
    [quadrantRows],
  );

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-7xl p-6">
        <header className="mb-6 flex flex-col gap-4 rounded-xl bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-600">Open Calgary summary</p>
            <h1 className="mt-2 text-3xl font-semibold text-gray-900">Calgary Growth Nodes for 2026</h1>
            <p className="mt-2 text-sm text-gray-600">
              Business license momentum blended with unemployment baseline, housing forecast support, and a governed community-to-quadrant mapping sourced from official City of Calgary data.
            </p>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </header>

        {error ? (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            <AlertCircle className="mt-0.5" size={18} />
            <div>
              <p className="font-medium">Query error</p>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </div>
        ) : null}

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 text-sky-600">
              <TrendingUp size={18} />
              <span className="text-sm font-medium uppercase tracking-wide">Top node</span>
            </div>
            <h2 className="mt-4 text-2xl font-semibold text-gray-900">{topNode?.community_name || '—'}</h2>
            <p className="mt-2 text-sm text-gray-600">
              Quadrant: {topNode?.quadrant || '—'} · Resilience score: {formatNumber(topNode?.resilience_score)}
            </p>
          </div>
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 text-rose-600">
              <Users size={18} />
              <span className="text-sm font-medium uppercase tracking-wide">Highest unemployment in sample</span>
            </div>
            <h2 className="mt-4 text-2xl font-semibold text-gray-900">{unemploymentLeader?.community_name || '—'}</h2>
            <p className="mt-2 text-sm text-gray-600">
              Unemployment: {formatPercent(unemploymentLeader?.unemployment_rate_per)} · Quadrant: {unemploymentLeader?.quadrant || '—'}
            </p>
          </div>
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 text-amber-600">
              <Home size={18} />
              <span className="text-sm font-medium uppercase tracking-wide">Housing proxy</span>
            </div>
            <p className="mt-4 text-sm text-gray-600">
              Housing values are projected residential units by quadrant and year, shown here to explain where business growth may be outpacing housing support.
            </p>
          </div>
        </div>

        <div className="mb-6 grid gap-6 xl:grid-cols-2">
          <section className="rounded-xl bg-white p-6 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Top 5 growth nodes</h2>
              <p className="text-sm text-gray-500">Ranked by resilience score for 2026.</p>
            </div>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 24, left: 24, bottom: 8 }}>
                  <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
                  <XAxis type="number" stroke="#6b7280" fontSize={12} />
                  <YAxis dataKey="community_name" type="category" stroke="#6b7280" fontSize={12} width={180} />
                  <Tooltip formatter={(value) => formatNumber(value)} />
                  <Bar dataKey="resilience_score" name="Resilience score" radius={[0, 8, 8, 0]}>
                    {rows.map((row, index) => (
                      <Cell key={row.community_name} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-xl bg-white p-6 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Unemployment vs housing support</h2>
              <p className="text-sm text-gray-500">Communities with higher unemployment and stronger projected housing footprints stand out in the upper-right.</p>
            </div>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 8, right: 24, left: 12, bottom: 20 }}>
                  <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    dataKey="forecast_housing_units"
                    name="Forecast housing units"
                    stroke="#6b7280"
                    fontSize={12}
                  />
                  <YAxis
                    type="number"
                    dataKey="unemployment_rate_per"
                    name="Unemployment rate"
                    stroke="#6b7280"
                    fontSize={12}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <ZAxis type="number" dataKey="resilience_score" range={[80, 400]} />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    formatter={(value, name) => {
                      if (name === 'Unemployment rate') return formatPercent(value);
                      if (name === 'Forecast housing units') return formatNumber(value);
                      return formatNumber(value);
                    }}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.community_name || ''}
                  />
                  <Legend />
                  <Scatter name="Communities" data={unemploymentHousingRows} fill="#0ea5e9">
                    {unemploymentHousingRows.map((row) => (
                      <Cell key={row.community_name} fill={quadrantColor(row.quadrant)} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-xl bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-3 text-teal-600">
              <Compass size={18} />
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Quadrant mapping summary</h2>
                <p className="text-sm text-gray-500">Each slice shows how many 2026 community records map into each Calgary quadrant.</p>
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={quadrantMix}
                      dataKey="community_count"
                      nameKey="quadrant"
                      innerRadius={60}
                      outerRadius={105}
                      paddingAngle={2}
                    >
                      {quadrantMix.map((row) => (
                        <Cell key={row.quadrant} fill={row.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatNumber(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-medium">Quadrant</th>
                      <th className="px-4 py-3 font-medium">Communities</th>
                      <th className="px-4 py-3 font-medium">Avg unemployment</th>
                      <th className="px-4 py-3 font-medium">Avg housing</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {quadrantRows.map((row) => (
                      <tr key={row.quadrant}>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: quadrantColor(row.quadrant) }}
                            />
                            {row.quadrant}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{formatNumber(row.community_count)}</td>
                        <td className="px-4 py-3 text-slate-600">{formatPercent(row.avg_unemployment_rate)}</td>
                        <td className="px-4 py-3 text-slate-600">{formatNumber(row.avg_housing_units)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="rounded-xl bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-3 text-indigo-600">
              <Building2 size={18} />
              <div>
                <h2 className="text-lg font-semibold text-gray-900">How to read the model</h2>
                <p className="text-sm text-gray-500">These visuals separate the three planning signals requested.</p>
              </div>
            </div>
            <div className="space-y-4 text-sm text-gray-600">
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="font-medium text-gray-900">Unemployment</p>
                <p className="mt-1">Shown as a community-level 2021 census baseline, not a live year-by-year labour feed.</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="font-medium text-gray-900">Housing</p>
                <p className="mt-1">Shown as projected residential units from the suburban growth forecast, aggregated by quadrant for the 2026 view.</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="font-medium text-gray-900">Quadrant mapping</p>
                <p className="mt-1">Community names are mapped in-pipeline using the City of Calgary Community Boundaries dataset. Any missing governed match is labeled MAPPING_REQUIRED for remediation.</p>
              </div>
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-xl bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Public response and city plans</h2>
            <p className="text-sm text-gray-500">
              Public Calgary sources show the City is actively responding to housing pressure and broader economic growth.
            </p>
          </div>

          <div className="mb-6 grid gap-6 xl:grid-cols-2">
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-rose-700">Current status in the data</p>
                  <p className="text-sm text-rose-900">What the 2026 model is showing right now</p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-rose-700">Observed signal</span>
              </div>

              <div className="space-y-3">
                <div className="rounded-lg bg-white p-4 shadow-sm">
                  <p className="text-sm font-medium text-slate-900">Quadrant coverage gap</p>
                  <p className="mt-1 text-sm text-slate-600">
                    MAPPING_REQUIRED currently holds {formatNumber(quadrantRows.find((row) => row.quadrant === 'MAPPING_REQUIRED')?.community_count)} community records,
                    showing which communities still need governed remediation in the pipeline.
                  </p>
                </div>
                <div className="rounded-lg bg-white p-4 shadow-sm">
                  <p className="text-sm font-medium text-slate-900">Housing support is uneven</p>
                  <p className="mt-1 text-sm text-slate-600">
                    SE averages {formatNumber(quadrantRows.find((row) => row.quadrant === 'SE')?.avg_housing_units)} forecast units,
                    while SW averages {formatNumber(quadrantRows.find((row) => row.quadrant === 'SW')?.avg_housing_units)}.
                  </p>
                </div>
                <div className="rounded-lg bg-white p-4 shadow-sm">
                  <p className="text-sm font-medium text-slate-900">Unemployment pressure persists</p>
                  <p className="mt-1 text-sm text-slate-600">
                    NE shows average unemployment near {formatPercent(quadrantRows.find((row) => row.quadrant === 'NE')?.avg_unemployment_rate)},
                    while MAPPING_REQUIRED areas still average {formatPercent(quadrantRows.find((row) => row.quadrant === 'MAPPING_REQUIRED')?.avg_unemployment_rate)}.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Public response and plans</p>
                  <p className="text-sm text-emerald-900">What Calgary says it is doing about these pressures</p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-emerald-700">Planned response</span>
              </div>

              <div className="space-y-3">
                <div className="rounded-lg bg-white p-4 shadow-sm">
                  <p className="text-sm font-medium text-slate-900">Housing Strategy 2024–2030</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Calgary&apos;s public housing strategy outlines 98 actions aimed at increasing supply,
                    improving affordability, and expanding housing choice across communities.
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    Public justification: the City says one in five Calgary households cannot afford their housing,
                    population growth is pushing the city toward two million residents, and Calgary&apos;s affordability advantage is at risk.
                  </p>
                </div>
                <div className="rounded-lg bg-white p-4 shadow-sm">
                  <p className="text-sm font-medium text-slate-900">Implementation tools</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Public updates highlight rezoning for housing, below-market land sales,
                    secondary suite incentives, and housing capital funding.
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    Public justification: Calgary says these tools are needed to increase housing supply,
                    enable more housing choice in all communities, and leverage partnerships and funding from other levels of government.
                  </p>
                </div>
                <div className="rounded-lg bg-white p-4 shadow-sm">
                  <p className="text-sm font-medium text-slate-900">Economic development posture</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Calgary Economic Development emphasizes investment attraction, tech growth,
                    talent concentration, and business expansion to support citywide prosperity.
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    Public justification: Calgary Economic Development frames this around Calgary&apos;s high GDP per capita,
                    strong tech-worker concentration, head office presence, and more than $18.35B in investment since 2015.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Housing Strategy 2024–2030</p>
              <p className="mt-2 text-sm text-slate-600">
                Calgary&apos;s Home is Here strategy lays out 98 actions focused on increasing housing supply,
                expanding housing choice, supporting affordable housing providers, and addressing housing
                needs across the city.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Implementation actions already public</p>
              <p className="mt-2 text-sm text-slate-600">
                Public updates mention below-market land sales, rezoning for housing, secondary suite incentives,
                housing capital funding, and support for non-market and Indigenous-led housing programs.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Economic development efforts</p>
              <p className="mt-2 text-sm text-slate-600">
                Calgary Economic Development publicly highlights investment attraction, tech-sector growth,
                talent concentration, and business expansion as part of the city&apos;s broader economic strategy.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Federal housing support</p>
              <p className="mt-2 text-sm text-slate-600">
                CMHC publicly describes federal support through housing funding, housing finance,
                market research, and supply-focused programs that help make affordable housing delivery possible.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
            <div className="rounded-lg bg-sky-50 p-4">
              <p className="text-sm font-semibold text-sky-900">What this means for the dashboard</p>
              <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-sky-950">
                <li>High business activity with low housing support aligns most closely with public housing-supply actions.</li>
                <li>Citywide rezoning, land release, and housing incentives are the clearest public responses to the pressure shown here.</li>
                <li>Public economic-development messaging supports business growth, but not every neighbourhood-level employment gap is directly addressed in the same way.</li>
                <li>Federal support adds another layer through CMHC-backed funding, financing, research, and supply acceleration.</li>
              </ul>
            </div>

            <div className="rounded-lg bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">Method note</p>
              <p className="mt-2 text-sm text-amber-950">
                These plan summaries come from public City of Calgary and Calgary Economic Development pages.
                They provide policy context for the signals in this app, but they are not joined datasets inside the pipeline.
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Public reasoning available for justification</p>
            <p className="mt-2 text-sm text-slate-600">
              Yes. The public sources do not only list actions; they also explain why those actions are being taken.
              The housing pages explicitly cite affordability pressure, rapid population growth, and the risk of losing Calgary&apos;s affordability advantage.
              The housing data pages say the City monitors metrics and strategy progress to maintain a pulse on the market.
              Calgary Economic Development publicly justifies growth efforts through competitiveness signals such as GDP, talent concentration, and investment levels.
              CMHC publicly justifies federal support through affordable housing delivery, housing finance access, research, and national housing supply needs.
            </p>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-900">Federal support visual</p>
              <p className="mt-2 text-sm text-emerald-950">
                CMHC publicly presents four main federal support lanes relevant here: funding, financing,
                research, and supply acceleration.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {[
                  { label: 'Funding', color: 'bg-emerald-100 text-emerald-800' },
                  { label: 'Financing', color: 'bg-lime-100 text-lime-800' },
                  { label: 'Research', color: 'bg-teal-100 text-teal-800' },
                  { label: 'Supply', color: 'bg-green-100 text-green-800' },
                ].map((item) => (
                  <div key={item.label} className={`rounded-lg px-4 py-4 text-center text-sm font-medium ${item.color}`}>
                    {item.label}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">Federal support applies across quadrants</p>
              <p className="mt-2 text-sm text-slate-600">
                Federal housing support is not described publicly as a single-quadrant program.
                In this dashboard it is best represented as support that can reinforce housing delivery across all quadrants and unmapped communities.
              </p>
              <div className="mt-4 grid grid-cols-5 gap-2">
                {['NE', 'NW', 'SE', 'SW', 'MAPPING_REQUIRED'].map((quadrant) => (
                  <div key={quadrant} className="rounded-md bg-emerald-100 px-2 py-3 text-center text-xs font-medium text-emerald-800">
                    {quadrant}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-4">
              <p className="text-sm font-semibold text-slate-900">Plan / response visuals by quadrant</p>
              <p className="mt-1 text-sm text-slate-600">
                These visuals show that the public plans are described as citywide responses rather than targeted to only one quadrant.
              </p>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-lg border border-slate-200 p-4">
                <div className="mb-3">
                  <p className="text-sm font-medium text-slate-900">Plan coverage across quadrants</p>
                  <p className="text-sm text-slate-500">Each bar shows how many quadrants a public response applies to in this dashboard interpretation.</p>
                </div>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { plan: 'Housing strategy', coverage: 5, fill: '#0ea5e9' },
                        { plan: 'Rezoning', coverage: 5, fill: '#14b8a6' },
                        { plan: 'Land + funding', coverage: 5, fill: '#8b5cf6' },
                        { plan: 'Secondary suites', coverage: 5, fill: '#f59e0b' },
                        { plan: 'Economic development', coverage: 5, fill: '#ec4899' },
                        { plan: 'Federal support', coverage: 5, fill: '#22c55e' },
                      ]}
                      layout="vertical"
                      margin={{ top: 8, right: 24, left: 24, bottom: 8 }}
                    >
                      <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
                      <XAxis type="number" domain={[0, 5]} tickCount={6} stroke="#6b7280" fontSize={12} />
                      <YAxis dataKey="plan" type="category" stroke="#6b7280" fontSize={12} width={130} />
                      <Tooltip formatter={(value) => `${value} quadrants`} />
                      <Bar dataKey="coverage" radius={[0, 8, 8, 0]}>
                        {[
                          { plan: 'Housing strategy', coverage: 5, fill: '#0ea5e9' },
                          { plan: 'Rezoning', coverage: 5, fill: '#14b8a6' },
                          { plan: 'Land + funding', coverage: 5, fill: '#8b5cf6' },
                          { plan: 'Secondary suites', coverage: 5, fill: '#f59e0b' },
                          { plan: 'Economic development', coverage: 5, fill: '#ec4899' },
                          { plan: 'Federal support', coverage: 5, fill: '#22c55e' },
                        ].map((row) => (
                          <Cell key={row.plan} fill={row.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-4">
                <div className="mb-3">
                  <p className="text-sm font-medium text-slate-900">Quadrant applicability map</p>
                  <p className="text-sm text-slate-500">Green means the public description supports applying the plan to that quadrant.</p>
                </div>
                <div className="space-y-3">
                  {[
                    { plan: 'Housing strategy', justification: 'All communities' },
                    { plan: 'Rezoning', justification: 'Citywide tool' },
                    { plan: 'Land + funding', justification: 'Supply across communities' },
                    { plan: 'Secondary suites', justification: 'Broad housing tool' },
                    { plan: 'Economic development', justification: 'Citywide growth posture' },
                    { plan: 'Federal support', justification: 'National housing delivery support' },
                  ].map((item) => (
                    <div key={item.plan} className="rounded-lg bg-slate-50 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-900">{item.plan}</p>
                        <span className="text-xs text-slate-500">{item.justification}</span>
                      </div>
                      <div className="grid grid-cols-5 gap-2">
                        {['NE', 'NW', 'SE', 'SW', 'MAPPING_REQUIRED'].map((quadrant) => (
                          <div key={`${item.plan}-${quadrant}`} className="rounded-md bg-emerald-100 px-2 py-2 text-center text-xs font-medium text-emerald-800">
                            {quadrant}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
