"use client";

import { useEffect, useRef, useState } from "react";
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from "react-simple-maps";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { MapPin, Server } from "lucide-react";
import type { DashboardAgent } from "@ezmon/shared";

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// Numeric to Alpha2 mapping from AgentLocationMap
const NUMERIC_TO_ALPHA2: Record<string, string> = {
  "4": "AF", "8": "AL", "12": "DZ", "16": "AS", "20": "AD", "24": "AO", "28": "AG", "31": "AZ",
  "32": "AR", "36": "AU", "40": "AT", "44": "BS", "48": "BH", "50": "BD", "51": "AM", "52": "BB",
  "56": "BE", "60": "BM", "64": "BT", "68": "BO", "70": "BA", "72": "BW", "76": "BR", "84": "BZ",
  "86": "IO", "90": "SB", "96": "BN", "100": "BG", "104": "MM", "108": "BI", "112": "BY", "116": "KH",
  "120": "CM", "124": "CA", "132": "CV", "140": "CF", "144": "LK", "148": "TD", "152": "CL", "156": "CN",
  "158": "TW", "162": "CX", "166": "CC", "170": "CO", "174": "KM", "178": "CG", "180": "CD", "184": "CK",
  "188": "CR", "191": "HR", "192": "CU", "196": "CY", "203": "CZ", "204": "BJ", "208": "DK", "212": "DM",
  "214": "DO", "218": "EC", "818": "EG", "222": "SV", "226": "GQ", "231": "ET", "232": "ER", "233": "EE",
  "234": "FO", "238": "FK", "239": "GS", "242": "FJ", "246": "FI", "250": "FR", "258": "PF", "262": "DJ",
  "266": "GA", "270": "GM", "275": "PS", "276": "DE", "288": "GH", "292": "GI", "296": "KI", "300": "GR",
  "304": "GL", "308": "GD", "316": "GU", "320": "GT", "324": "GN", "328": "GY", "332": "HT", "340": "HN",
  "344": "HK", "348": "HU", "356": "IN", "360": "ID", "364": "IR", "368": "IQ", "372": "IE", "376": "IL",
  "380": "IT", "384": "CI", "388": "JM", "392": "JP", "398": "KZ", "400": "JO", "404": "KE", "408": "KP",
  "410": "KR", "414": "KW", "417": "KG", "418": "LA", "422": "LB", "426": "LS", "428": "LV", "430": "LR",
  "434": "LY", "438": "LI", "440": "LT", "442": "LU", "446": "MO", "450": "MG", "454": "MW", "458": "MY",
  "462": "MV", "466": "ML", "470": "MT", "474": "MQ", "478": "MR", "480": "MU", "484": "MX", "492": "MC",
  "496": "MN", "498": "MD", "504": "MA", "508": "MZ", "516": "NA", "520": "NR", "524": "NP", "528": "NL",
  "533": "AW", "540": "NC", "548": "VU", "554": "NZ", "558": "NI", "562": "NE", "566": "NG", "570": "NU",
  "578": "NO", "579": "", "580": "MP", "583": "FM", "584": "MH", "585": "PW", "586": "PK", "591": "PA",
  "598": "PG", "600": "PY", "604": "PE", "608": "PH", "616": "PL", "620": "PT", "624": "GW", "626": "TL",
  "630": "PR", "634": "QA", "638": "RE", "642": "RO", "643": "RU", "646": "RW", "659": "KN", "662": "LC",
  "666": "PM", "670": "VC", "678": "ST", "682": "SA", "686": "SN", "690": "SC", "694": "SL", "703": "SK",
  "704": "VN", "706": "SO", "710": "ZA", "716": "ZW", "724": "ES", "729": "SD", "740": "SR", "744": "SJ",
  "748": "SZ", "752": "SE", "756": "CH", "760": "SY", "762": "TJ", "764": "TH", "768": "TG", "772": "TK",
  "776": "TO", "780": "TT", "784": "AE", "788": "TN", "792": "TR", "795": "TM", "796": "TC", "798": "TV",
  "800": "UG", "804": "UA", "807": "MK", "826": "GB", "831": "GG", "832": "JE", "833": "IM",
  "834": "TZ", "840": "US", "850": "VI", "854": "BF", "858": "UY", "860": "UZ", "862": "VE", "876": "WF",
  "882": "WS", "887": "YE", "894": "ZM", "512": "OM", "068": "BO", "260": "TF", "688": "RS", "499": "ME",
  "352": "IS", "010": "AQ", "728": "SS", "732": "EH", "535": "BQ", "531": "CW", "534": "SX", "652": "BL",
  "663": "MF", "705": "SI", "032": "AR", "268": "SZ"
};

let _displayNames: Intl.DisplayNames | null = null;
function getDisplayNames(): Intl.DisplayNames {
  if (!_displayNames) {
    _displayNames = new Intl.DisplayNames(["en"], { type: "region" });
  }
  return _displayNames;
}

function getCountryName(numericId: string | undefined | null): string {
  if (!numericId || numericId === "undefined") return "";
  const normalized = String(parseInt(numericId, 10));
  const alpha2 = NUMERIC_TO_ALPHA2[numericId] || NUMERIC_TO_ALPHA2[normalized];
  if (!alpha2) return `Unknown (${normalized})`;
  try {
    const name = getDisplayNames().of(alpha2);
    return name || alpha2;
  } catch {
    return alpha2;
  }
}

interface TooltipState {
  name: string;
  agents: DashboardAgent[];
  x: number;
  y: number;
  containerW: number;
}

export function GlobalAgentMap({ agents }: { agents: DashboardAgent[] }) {
  const [mounted, setMounted] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [hoveredGeo, setHoveredGeo] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<[number, number]>([0, 20]);
  const isDragging = useRef(false);

  // Group agents by country alpha-2 code
  const agentsByCountryCode = agents.reduce((acc, agent) => {
    if (agent.country) {
      if (!acc[agent.country]) acc[agent.country] = [];
      acc[agent.country].push(agent);
    }
    return acc;
  }, {} as Record<string, DashboardAgent[]>);

  const MIN_ZOOM = 1;
  const MAX_ZOOM = 12;

  function handleZoomIn() { setZoom((z) => Math.min(z * 1.8, MAX_ZOOM)); }
  function handleZoomOut() { setZoom((z) => Math.max(z / 1.8, MIN_ZOOM)); }
  function handleReset() { setZoom(1); setCenter([0, 20]); }

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;

  return (
    <Card className="flex flex-col h-full border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-display flex items-center gap-2">
          <MapPin className="w-5 h-5 text-primary" />
          Global Agent Distribution
        </CardTitle>
        <CardDescription>Real-time geographic locations of your monitoring fleet.</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 p-0 relative">
        <div
          ref={mapRef}
          className="w-full h-full min-h-[420px] bg-background/50 overflow-hidden relative select-none"
          onMouseLeave={() => setTooltip(null)}
        >
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{ scale: 140 }}
            width={800}
            height={400}
            style={{ width: "100%", height: "100%" }}
          >
            <ZoomableGroup
              zoom={zoom}
              center={center}
              onMoveEnd={({ zoom: z, coordinates }) => {
                setZoom(z);
                setCenter(coordinates as [number, number]);
              }}
              onMoveStart={() => {
                isDragging.current = true;
                setTooltip(null);
              }}
              filterZoomEvent={(evt: any) => evt.type !== "dblclick"}
              translateExtent={[[-200, -100], [1000, 500]]}
            >
              <Geographies geography={geoUrl}>
                {({ geographies }) =>
                  geographies.map((geo) => {
                    const numId = geo.id as string;
                    const normalizedNumId = String(parseInt(numId, 10));
                    const alpha2 = NUMERIC_TO_ALPHA2[numId] || NUMERIC_TO_ALPHA2[normalizedNumId];
                    
                    const countryAgents = alpha2 ? agentsByCountryCode[alpha2] : undefined;
                    const hasAgents = !!(countryAgents && countryAgents.length > 0);
                    const isHovered = hoveredGeo === numId;

                    let fillColor = "#1e293b"; // Default map color
                    if (hasAgents) {
                      fillColor = isHovered ? "#34d399" : "#10b981"; // Emerald for active countries
                    } else if (isHovered) {
                      fillColor = "#334155";
                    }

                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={fillColor}
                        stroke="#334155"
                        strokeWidth={0.5}
                        style={{
                          default: { outline: "none" },
                          hover: { outline: "none", cursor: hasAgents ? "pointer" : "default" },
                          pressed: { outline: "none" },
                        }}
                        onMouseEnter={(evt) => {
                          setHoveredGeo(numId);
                          const name = getCountryName(numId);
                          if (!name) return;
                          
                          const rect = mapRef.current?.getBoundingClientRect();
                          if (rect) {
                            setTooltip({
                              name,
                              agents: countryAgents || [],
                              x: evt.clientX - rect.left,
                              y: evt.clientY - rect.top,
                              containerW: rect.width,
                            });
                          }
                        }}
                        onMouseMove={(evt) => {
                          const rect = mapRef.current?.getBoundingClientRect();
                          if (rect) {
                            setTooltip((prev) =>
                              prev ? { ...prev, x: evt.clientX - rect.left, y: evt.clientY - rect.top } : prev
                            );
                          }
                        }}
                        onMouseLeave={() => {
                          setHoveredGeo(null);
                          setTooltip(null);
                        }}
                      />
                    );
                  })
                }
              </Geographies>

              {/* Draw dots for agents with exact coordinates */}
              {agents.filter(a => a.lat !== null && a.lon !== null).map(agent => {
                const isOnline = agent.derivedStatus === "online";
                return (
                  <Marker key={agent.id} coordinates={[agent.lon!, agent.lat!]}>
                    <circle r={isOnline ? 3 : 2} fill={isOnline ? "#0ea5e9" : "#ef4444"} stroke="#0f172a" strokeWidth={1} />
                  </Marker>
                );
              })}
            </ZoomableGroup>
          </ComposableMap>

          {/* Zoom Controls */}
          <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-1.5">
            <button
              onClick={handleZoomIn}
              className="w-8 h-8 rounded-lg bg-background/90 border border-border text-foreground hover:bg-muted transition-colors flex items-center justify-center shadow-lg text-sm font-bold"
            >+</button>
            <button
              onClick={handleZoomOut}
              className="w-8 h-8 rounded-lg bg-background/90 border border-border text-foreground hover:bg-muted transition-colors flex items-center justify-center shadow-lg text-sm font-bold"
            >−</button>
            <button
              onClick={handleReset}
              className="w-8 h-8 rounded-lg bg-background/90 border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center justify-center shadow-lg"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
              </svg>
            </button>
          </div>

          {/* Hover Tooltip */}
          {tooltip && tooltip.agents.length > 0 && (
            <div
              className="pointer-events-none absolute z-20 w-64 bg-popover/95 text-foreground rounded-lg border border-border shadow-xl backdrop-blur-sm overflow-hidden"
              style={{
                left: Math.min(tooltip.x + 14, tooltip.containerW - 270),
                top: Math.max(10, tooltip.y < 150 ? tooltip.y + 20 : tooltip.y - 120),
              }}
            >
              <div className="px-3 py-2 bg-muted/50 border-b border-border flex justify-between items-center">
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <MapPin size={12} className="text-emerald-500" />
                  {tooltip.name}
                </div>
                <div className="text-[10px] text-muted-foreground font-mono bg-background px-1.5 py-0.5 rounded border border-border">
                  {tooltip.agents.length} agent{tooltip.agents.length > 1 ? 's' : ''}
                </div>
              </div>
              <div className="max-h-48 overflow-y-auto p-2 space-y-1.5">
                {tooltip.agents.map(agent => {
                  const isOnline = agent.derivedStatus === "online";
                  return (
                    <div key={agent.id} className="flex items-center justify-between bg-background p-1.5 rounded border border-border">
                      <div className="flex items-center gap-2 truncate">
                        <Server size={12} className={isOnline ? "text-primary" : "text-muted-foreground"} />
                        <span className="text-xs truncate font-medium">{agent.name}</span>
                      </div>
                      <span className={`w-2 h-2 rounded-full shrink-0 ${isOnline ? 'bg-emerald-500' : 'bg-destructive'}`} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {tooltip && tooltip.agents.length === 0 && (
            <div
              className="pointer-events-none absolute z-20 px-3 py-1.5 bg-popover/95 text-foreground text-xs font-medium rounded-lg border border-border shadow-xl backdrop-blur-sm"
              style={{
                left: Math.min(tooltip.x + 14, tooltip.containerW - 120),
                top: tooltip.y < 40 ? tooltip.y + 20 : tooltip.y - 30,
              }}
            >
              {tooltip.name}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
