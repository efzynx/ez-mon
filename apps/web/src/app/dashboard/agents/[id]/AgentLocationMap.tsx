"use client";

import { useEffect, useRef, useState } from "react";
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from "react-simple-maps";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { MapPin } from "lucide-react";

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// Complete ISO 3166-1 numeric → alpha-2 mapping
// Allows using Intl.DisplayNames which covers ALL countries natively
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

// Intl.DisplayNames gives native, localized country name from alpha-2
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
  x: number;
  y: number;
  containerW: number;
}

export function AgentLocationMap({
  lat,
  lon,
  country,
  city,
}: {
  lat?: number | null;
  lon?: number | null;
  country?: string | null;
  city?: string | null;
}) {
  const [mounted, setMounted] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [hoveredGeo, setHoveredGeo] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<[number, number]>([0, 20]);
  const isDragging = useRef(false);

  const MIN_ZOOM = 1;
  const MAX_ZOOM = 12;

  function handleZoomIn() {
    setZoom((z) => Math.min(z * 1.8, MAX_ZOOM));
  }
  function handleZoomOut() {
    setZoom((z) => Math.max(z / 1.8, MIN_ZOOM));
  }
  function handleReset() {
    setZoom(1);
    setCenter([0, 20]);
  }

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const hasLocation = lat !== null && lat !== undefined && lon !== null && lon !== undefined;

  return (
    <Card className="mt-8 animate-fade-in border-primary/20 shadow-lg shadow-primary/5">
      <CardHeader className="pb-4 border-b border-border/50 bg-muted/20">
        <CardTitle className="text-lg font-display font-bold text-foreground flex items-center gap-2">
          <MapPin className="w-5 h-5 text-emerald-500" />
          Agent Location
          {(city || country) && (
            <span className="text-xs font-mono text-muted-foreground ml-2 px-2 py-1 bg-background rounded-md border border-border">
              {city && `${city}, `}{country}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div
          ref={mapRef}
          className="w-full h-[400px] bg-background/50 overflow-hidden relative select-none"
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
              filterZoomEvent={(evt: any) => {
                return evt.type !== "dblclick";
              }}
              translateExtent={[[-200, -100], [1000, 500]]}
            >
              <Geographies geography={geoUrl}>
                {({ geographies }) =>
                  geographies.map((geo) => {
                    const numId = geo.id as string;
                    const isHovered = hoveredGeo === numId;

                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={isHovered ? "#334155" : "#1e293b"}
                        stroke="#334155"
                        strokeWidth={0.5}
                        style={{
                          default: { outline: "none" },
                          hover: { fill: "#475569", outline: "none", cursor: "default" },
                          pressed: { outline: "none" },
                        }}
                        onMouseEnter={(evt) => {
                          setHoveredGeo(numId);
                          const name = getCountryName(numId);
                          if (!name) return; // skip tooltip for undefined/unnamed territories
                          const rect = mapRef.current?.getBoundingClientRect();
                          if (rect) {
                            setTooltip({
                              name,
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

              {hasLocation && (
                <Marker coordinates={[lon!, lat!]}>
                  <g
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    transform="translate(-12, -24)"
                  >
                    <circle cx="12" cy="10" r="3" fill="#10b981" />
                    <path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z" />
                  </g>
                  <circle r={14} fill="#10b981" fillOpacity={0.2} className="animate-ping" />
                </Marker>
              )}
            </ZoomableGroup>
          </ComposableMap>

          {/* Zoom Controls */}
          <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-1.5">
            <button
              onClick={handleZoomIn}
              className="w-8 h-8 rounded-lg bg-background/90 border border-border text-foreground hover:bg-muted transition-colors flex items-center justify-center shadow-lg text-sm font-bold"
              title="Zoom in"
            >+</button>
            <button
              onClick={handleZoomOut}
              className="w-8 h-8 rounded-lg bg-background/90 border border-border text-foreground hover:bg-muted transition-colors flex items-center justify-center shadow-lg text-sm font-bold"
              title="Zoom out"
            >−</button>
            <button
              onClick={handleReset}
              className="w-8 h-8 rounded-lg bg-background/90 border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center justify-center shadow-lg"
              title="Reset view"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </button>
          </div>

          {/* Zoom level badge */}
          <div className="absolute bottom-4 left-4 z-10 px-2 py-1 bg-background/80 border border-border rounded-md text-[10px] font-mono text-muted-foreground">
            {zoom.toFixed(1)}×
          </div>

          {/* Hover Tooltip — smart positioning: above cursor normally, below when near top */}
          {tooltip && (
            <div
              className="pointer-events-none absolute z-20 px-3 py-1.5 bg-popover/95 text-foreground text-xs font-medium rounded-lg border border-border shadow-xl backdrop-blur-sm flex items-center gap-2 whitespace-nowrap"
              style={{
                left: Math.min(tooltip.x + 14, tooltip.containerW - 160),
                top: tooltip.y < 80
                  ? tooltip.y + 20        // below cursor when near top
                  : tooltip.y - 40,       // above cursor normally
              }}
            >
              <MapPin className="w-3 h-3 text-emerald-500" />
              {tooltip.name}
            </div>
          )}

          {!hasLocation && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-[1px]">
              <div className="px-4 py-2 bg-muted/80 text-muted-foreground text-sm font-medium rounded-lg border border-border flex items-center gap-2 shadow-xl">
                <MapPin className="w-4 h-4" />
                Location Data Unavailable
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
