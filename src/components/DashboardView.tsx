import { useEffect, useState } from "react";
import { fetchSheetData } from "../lib/api";
import { Product } from "../types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Boxes, DollarSign, AlertTriangle, XCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from "recharts";

export default function DashboardView({ spreadsheetId, dynamicTabs }: { spreadsheetId: string, dynamicTabs: string[] }) {
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalStockValue: 0,
    lowStock: 0,
    outOfStock: 0,
    categoryCounts: [] as any[]
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      if (!spreadsheetId) return;
      try {
        setLoading(true);
        const tabs = dynamicTabs;
        let totalVal = 0;
        let totalItems = 0;
        let low = 0;
        let out = 0;
        const subcatMap: Record<string, number> = {};

        // Fetch all sheets simply by calling api
        let hasErrors = false;
        let missingTabs: string[] = [];

        for (const tab of tabs) {
          try {
            const data: Product[] = await fetchSheetData(spreadsheetId, tab);
            for (const item of data) {
              if (!item.product_id && !item.item_code) continue; // skip empty rows
              
              totalItems++;
              const stock = parseInt(item.stock || "0", 10);
              const price = parseFloat(item.selling_price || "0");
              
              if (!isNaN(stock) && !isNaN(price)) {
                totalVal += (stock * price);
              }
              
              if (stock === 0) out++;
              else if (stock < 10) low++; // Warn below 10

              const cat = tab;
              subcatMap[cat] = (subcatMap[cat] || 0) + 1;
            }
          } catch (tabErr: any) {
            console.warn(`Could not load tab ${tab}:`, tabErr);
            hasErrors = true;
            missingTabs.push(tab);
          }
        }

        if (missingTabs.length === tabs.length) {
          throw new Error("Could not find any of the required tabs in the spreadsheet. Please ensure tabs exist (e.g., Sensors, DevelopmentBoards, Modules, Components).");
        } else if (missingTabs.length > 0) {
          toast.warning(`Some tabs were missing or empty: ${missingTabs.join(", ")}`);
        }

        const catCounts = Object.keys(subcatMap).map(k => ({
          name: k,
          count: subcatMap[k]
        }));

        setStats({
          totalProducts: totalItems,
          totalStockValue: totalVal,
          lowStock: low,
          outOfStock: out,
          categoryCounts: catCounts
        });
      } catch (err: any) {
         toast.error("Failed to load dashboard data: " + err.message);
      } finally {
         setLoading(false);
      }
    }
    loadStats();
  }, [spreadsheetId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 animate-pulse">
        <RefreshCw className="h-10 w-10 animate-spin text-blue-500 mb-4" />
        <h2 className="text-xl font-medium text-slate-600">Aggregating Inventory Data...</h2>
      </div>
    );
  }

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

  return (
    <div className="flex flex-col space-y-6 flex-1 min-h-0 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 flex-none">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
             <div>
               <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Total Products</div>
               <div className="text-2xl font-bold tracking-tight">{stats.totalProducts}</div>
             </div>
             <Boxes className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-[10px] text-slate-400 font-medium mt-1">Unique items across all sheets</div>
        </div>
        
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Total Value (USD)</div>
              <div className="text-2xl font-bold tracking-tight text-emerald-600">
                ${stats.totalStockValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-[10px] text-slate-400 font-medium mt-1">Based on current selling price</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-100 shadow-sm ring-1 ring-amber-500/10">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs font-semibold text-amber-500 uppercase mb-1">Low Stock Alerts</div>
              <div className="text-2xl font-bold tracking-tight text-amber-600">{stats.lowStock}</div>
            </div>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-[10px] text-amber-400 font-medium mt-1">Items below threshold</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-red-100 shadow-sm ring-1 ring-red-500/10">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs font-semibold text-red-500 uppercase mb-1">Out of Stock</div>
              <div className="text-2xl font-bold tracking-tight text-red-600">{stats.outOfStock}</div>
            </div>
            <XCircle className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-[10px] text-red-400 font-medium mt-1">Requires immediate reorder</div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-[300px]">
        <div className="flex-1 bg-white border border-slate-200 rounded-xl p-4 flex flex-col shadow-sm">
          <h3 className="text-xs font-bold text-slate-800 mb-3">Items per Category</h3>
          <div className="flex-1 min-h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.categoryCounts} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                <RechartsTooltip cursor={{fill: '#F1F5F9'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '11px' }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {stats.categoryCounts.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className="w-full lg:w-72 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col shadow-lg text-white">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">System Status</h3>
          <div className="space-y-4 flex-1">
            <div className="space-y-1.5">
               <div className="flex justify-between text-[11px]">
                 <span>Database Connection</span>
                 <span className="text-green-400">Stable</span>
               </div>
               <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                 <div className="h-full bg-green-500" style={{ width: '100%' }}></div>
               </div>
            </div>
            
            <div className="bg-slate-800/50 p-3 rounded border border-slate-700 mt-4 space-y-3">
              <div className="text-[10px] text-slate-400">Recent Sync Events</div>
              <div className="flex items-center gap-3">
                 <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                 <div>
                   <div className="text-[11px] font-semibold">Processed {stats.totalProducts} Records</div>
                   <div className="text-[10px] text-slate-400">Just now</div>
                 </div>
              </div>
              <div className="flex items-center gap-3">
                 <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                 <div>
                   <div className="text-[11px] font-semibold">{stats.lowStock} Warnings Found</div>
                   <div className="text-[10px] text-slate-400">Just now</div>
                 </div>
              </div>
            </div>
            
            <div className="bg-slate-800/50 p-2 rounded border border-slate-700 mt-auto">
              <div className="text-[10px] text-slate-400">Active Controller</div>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <div className="text-[11px] font-mono">GAS_API_V4_STABLE</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
