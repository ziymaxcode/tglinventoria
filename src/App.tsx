import { useState, useEffect, useRef } from "react";
import { User } from "firebase/auth";
import { initAuth, googleSignIn, logout } from "./lib/auth";
import { LayoutDashboard, Package, RefreshCw, Archive, Settings as SettingsIcon, LogOut, Search, Plus, List, ShoppingCart, Boxes, Tags, Menu, Loader2, MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const DEFAULT_PRODUCT_TABS = ["Sensors", "DevelopmentBoards", "Modules", "Components"];
const SPREADSHEET_ID_KEY = "IMS_SPREADSHEET_ID";

// A lazy import of main views
import DashboardView from "./components/DashboardView";
import InventoryView from "./components/InventoryView";
import SettingsView from "./components/SettingsView";
import SalesView from "./components/SalesView";
import GlobalCategoriesView from "./components/GlobalCategoriesView";
import GlobalLocationsView from "./components/GlobalLocationsView";

import { fetchConfig } from "./lib/api";

export default function App() {
  const [needsAuth, setNeedsAuth] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(true);

  const [activeTab, setActiveTab] = useState("Dashboard");
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [spreadsheetId, setSpreadsheetId] = useState<string>(localStorage.getItem(SPREADSHEET_ID_KEY) || "");
  const [dynamicTabs, setDynamicTabs] = useState<string[]>(DEFAULT_PRODUCT_TABS);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchPopover, setShowSearchPopover] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSearchPopover(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!searchQuery.trim() || !spreadsheetId || !token) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/search/${spreadsheetId}?q=${encodeURIComponent(searchQuery)}&tabs=${dynamicTabs.join(",")}`, {
           headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
           const data = await res.json();
           setSearchResults(data);
        } else {
           setSearchResults([]);
        }
      } catch (e) {
        console.error(e);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, spreadsheetId, dynamicTabs, token]);

  const renderNavItems = () => (
    <>
      <div className="px-3 py-2 text-[10px] uppercase font-bold text-slate-500 tracking-wider">Overview</div>
      <button
        onClick={() => { setActiveTab("Dashboard"); setIsMobileNavOpen(false); }}
        className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
          activeTab === "Dashboard" ? "bg-blue-600/10 text-blue-400" : "text-slate-300 hover:bg-slate-800 hover:text-white"
        }`}
      >
        <LayoutDashboard className="w-4 h-4" />
        Dashboard
      </button>
      <button
        onClick={() => { setActiveTab("Global Categories"); setIsMobileNavOpen(false); }}
        className={`w-full flex items-center gap-3 px-3 py-2 mt-1 text-sm font-medium rounded-md transition-colors ${
          activeTab === "Global Categories" ? "bg-blue-600/10 text-blue-400" : "text-slate-300 hover:bg-slate-800 hover:text-white"
        }`}
      >
        <Boxes className="w-4 h-4" />
        Global Categories
      </button>
      <button
        onClick={() => { setActiveTab("Storage Locations"); setIsMobileNavOpen(false); }}
        className={`w-full flex items-center gap-3 px-3 py-2 mt-1 text-sm font-medium rounded-md transition-colors ${
          activeTab === "Storage Locations" ? "bg-blue-600/10 text-blue-400" : "text-slate-300 hover:bg-slate-800 hover:text-white"
        }`}
      >
        <Tags className="w-4 h-4" />
        Storage Locations
      </button>
      <button
        onClick={() => { setActiveTab("Sales"); setIsMobileNavOpen(false); }}
        className={`w-full flex items-center gap-3 px-3 py-2 mt-1 text-sm font-medium rounded-md transition-colors ${
          activeTab === "Sales" ? "bg-blue-600/10 text-blue-400" : "text-slate-300 hover:bg-slate-800 hover:text-white"
        }`}
      >
        <ShoppingCart className="w-4 h-4" />
        Point of Sale
      </button>
      
      <div className="px-3 py-2 mt-4 text-[10px] uppercase font-bold text-slate-500 tracking-wider">Categories (Tabs)</div>
      {dynamicTabs.map((tab) => (
        <button
          key={tab}
          onClick={() => { setActiveTab(tab); setIsMobileNavOpen(false); }}
          className={`w-full flex items-center gap-3 px-3 py-2 mt-1 text-sm font-medium rounded-md transition-colors ${
            activeTab === tab ? "bg-blue-600/10 text-blue-400" : "text-slate-300 hover:bg-slate-800 hover:text-white"
          }`}
        >
          <List className="w-4 h-4" />
          {tab.replace(/([A-Z])/g, ' $1').trim()}
        </button>
      ))}

      <div className="px-3 py-2 mt-4 text-[10px] uppercase font-bold text-slate-500 tracking-wider">Settings</div>
      <button
         onClick={() => { setActiveTab("Settings"); setIsMobileNavOpen(false); }}
         className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
           activeTab === "Settings" ? "bg-blue-600/10 text-blue-400" : "text-slate-300 hover:bg-slate-800 hover:text-white"
         }`}
      >
        <SettingsIcon className="w-4 h-4" />
        Configuration
      </button>
    </>
  );

  const loadConfigData = async () => {
    if (user && spreadsheetId) {
      try {
        const config = await fetchConfig(spreadsheetId);
        if (config && config.productTabs) {
          const mergedTabs = Array.from(new Set([...DEFAULT_PRODUCT_TABS, ...config.productTabs]));
          setDynamicTabs(mergedTabs);
        }
      } catch(err) {
        console.warn("Could not load dynamic tabs from config.", err);
      }
    }
  };

  useEffect(() => {
    loadConfigData();
  }, [user, spreadsheetId]);

  useEffect(() => {
    const unsub = initAuth(
      (user, t) => {
        setUser(user);
        setToken(t);
        setNeedsAuth(false);
        setIsLoggingIn(false);
      },
      () => {
        setNeedsAuth(true);
        setIsLoggingIn(false);
      }
    );
    return () => unsub();
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setToken(result.accessToken);
        setUser(result.user);
        setNeedsAuth(false);
      }
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        console.error('Login failed:', err);
        toast.error("Failed to sign in. " + err.message);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSaveConfig = () => {
    let id = spreadsheetId.trim();
    if (id === "") {
      toast.error("Please provide a valid Google Spreadsheet ID.");
      return;
    }
    
    // Extract ID if a full URL was pasted
    const match = id.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      id = match[1];
      setSpreadsheetId(id);
    } else {
      if (id.includes('http')) {
         toast.error("Could not extract ID from URL. Please paste just the ID.");
         return;
      }
      setSpreadsheetId(id);
    }
    
    localStorage.setItem(SPREADSHEET_ID_KEY, id);
    toast.success("Spreadsheet ID saved!");
  };

  if (isLoggingIn && !needsAuth && !user) {
    return (
      <div className="flex items-center justify-center h-screen w-full bg-slate-50">
        <div className="animate-pulse flex flex-col items-center">
          <RefreshCw className="mr-2 h-8 w-8 animate-spin text-slate-800" />
          <p className="mt-4 text-slate-500 font-medium">Initializing system...</p>
        </div>
      </div>
    );
  }

  if (needsAuth || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="space-y-1 pb-8 text-center">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-blue-600 p-3">
                <Package className="h-8 w-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold tracking-tight">Inventoria System</CardTitle>
            <p className="text-sm text-muted-foreground pt-2">
              Sign in with your admin Google account to access your inventory database.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pb-8">
            <Button
              size="lg"
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="w-full text-md font-medium shadow"
            >
              <svg className="mr-2 h-5 w-5 bg-white rounded-full p-0.5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
                <path d="M1 1h22v22H1z" fill="none" />
              </svg>
              {isLoggingIn ? "Authenticating..." : "Sign in with Google"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Once Authed
  return (
    <div className="flex min-h-screen w-full bg-slate-50 font-sans print:bg-white">
      <Toaster position="bottom-right" className="print:hidden" />
      {/* Sidebar Navigation */}
      <aside className="w-60 border-r bg-slate-900 border-slate-800 flex-shrink-0 md:flex flex-col hidden print:hidden">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-white tracking-tight text-lg">Inventoria</span>
          </div>
        </div>
        
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {renderNavItems()}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center mb-4">
            <img src={user.photoURL || ""} alt="User" className="w-10 h-10 rounded-full border-2 border-slate-700" />
            <div className="ml-3 overflow-hidden">
              <p className="text-sm font-medium text-white truncate">{user.displayName}</p>
              <p className="text-xs text-slate-400 truncate">{user.email}</p>
            </div>
          </div>
          <Button variant="outline" className="w-full justify-center bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white" size="sm" onClick={() => logout()}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 print:m-0 print:p-0">
        {/* Top bar for mobile and quick actions */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between gap-4 px-4 sm:px-6 shadow-sm z-10 shrink-0 print:hidden relative">
           <div className="flex items-center text-slate-800 font-semibold text-lg md:hidden shrink-0">
            <Sheet open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen}>
              <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden mr-2" />}>
                <Menu className="w-5 h-5" />
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] p-0 flex flex-col bg-slate-900 border-r border-slate-800">
                <div className="p-6 border-b border-slate-800 flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
                    <Package className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-bold text-white tracking-tight text-lg">Inventoria</span>
                </div>
                <nav className="flex-1 overflow-y-auto p-3 space-y-1">
                  {renderNavItems()}
                </nav>
                <div className="p-4 border-t border-slate-800">
                  <div className="flex items-center mb-4">
                    <img src={user.photoURL || ""} alt="User" className="w-10 h-10 rounded-full border-2 border-slate-700" />
                    <div className="ml-3 overflow-hidden">
                      <p className="text-sm font-medium text-white truncate">{user.displayName}</p>
                      <p className="text-xs text-slate-400 truncate">{user.email}</p>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full justify-center bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white" size="sm" onClick={() => logout()}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
            <Package className="mr-2 w-5 h-5 text-blue-600 hidden md:block" />
            <span className="md:hidden">Inventoria</span>
           </div>

           <div className="flex-1 flex justify-end md:justify-start">
             <div className="relative w-full max-w-md" ref={searchContainerRef}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  placeholder="Search components or locations..." 
                  className="pl-10 h-9 bg-slate-50 border-slate-200 text-sm focus-visible:ring-blue-500 transition-all rounded-md w-full"
                  value={searchQuery}
                  onChange={(e) => {
                     setSearchQuery(e.target.value);
                     setShowSearchPopover(true);
                  }}
                  onFocus={() => {
                     if (searchQuery.trim()) setShowSearchPopover(true);
                  }}
                />
                
                {showSearchPopover && searchQuery.trim() && (
                  <div className="absolute top-[calc(100%+4px)] left-0 right-[-16px] sm:right-auto md:w-[600px] w-[calc(100vw-32px)] sm:w-full bg-white border border-slate-200 shadow-xl rounded-md z-[100] max-h-[80vh] overflow-y-auto flex flex-col">
                    {isSearching ? (
                       <div className="p-8 flex items-center justify-center flex-col gap-2 text-slate-500">
                          <Loader2 className="w-6 h-6 animate-spin" />
                          <span className="text-sm">Searching inventory...</span>
                       </div>
                    ) : searchResults.length === 0 ? (
                       <div className="p-8 text-center text-slate-500 text-sm">
                          No results found for "{searchQuery}".
                       </div>
                    ) : (
                       <div className="p-2 flex flex-col gap-1">
                          <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50 rounded-sm mb-1">
                             Found {searchResults.length} matching {searchResults.length === 1 ? 'item' : 'items'}
                          </div>
                          {searchResults.map((res: any, idx: number) => (
                             <div key={idx} className="p-3 hover:bg-slate-50 rounded-md transition-colors border border-transparent hover:border-slate-100 flex flex-col gap-2 cursor-pointer" onClick={() => { setShowSearchPopover(false); }}>
                               <div className="flex justify-between items-start">
                                  <div>
                                     <h4 className="text-sm font-semibold text-slate-900">{res.item_name || "Unknown Item"}</h4>
                                     <div className="text-xs text-slate-500 font-mono mt-0.5">{res.product_id || res.item_code}</div>
                                  </div>
                                  <div className="text-right">
                                     <div className="text-sm font-bold text-slate-900">{res.total_stock} <span className="text-xs font-normal text-slate-500">in stock</span></div>
                                  </div>
                               </div>
                               
                               {res.locations && res.locations.length > 0 && (
                                  <div className="flex flex-wrap gap-2 mt-1">
                                    {res.locations.map((loc: any, lidx: number) => (
                                       <div key={lidx} className="flex items-stretch bg-blue-50 text-blue-700 rounded overflow-hidden text-xs border border-blue-100">
                                          <div className="flex items-center gap-1 px-2 py-1 bg-blue-100/50">
                                            <MapPin className="w-3 h-3 text-blue-500" />
                                            <span className="font-medium whitespace-nowrap">{loc.name || loc.sheetName}</span>
                                          </div>
                                          <div className="px-2 py-1 font-semibold flex items-center bg-blue-50 border-l border-blue-100">
                                            {loc.stock} qty
                                          </div>
                                       </div>
                                    ))}
                                  </div>
                               )}
                             </div>
                          ))}
                       </div>
                    )}
                  </div>
                )}
             </div>
           </div>

           <div className="hidden lg:flex ml-auto items-center space-x-4 border-l pl-4 border-slate-200">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded text-[11px] font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>Google Sheets Connected
                </div>
              </div>
           </div>
        </header>

        {/* Content Scroll Area */}
        <div className="flex-1 overflow-auto p-6 flex flex-col">
          {activeTab === "Settings" || !spreadsheetId ? (
            <SettingsView 
              spreadsheetId={spreadsheetId} 
              setSpreadsheetId={setSpreadsheetId} 
              handleSaveConfig={handleSaveConfig} 
              onConfigSaved={loadConfigData}
            />
          ) : activeTab === "Dashboard" ? (
             <DashboardView spreadsheetId={spreadsheetId} dynamicTabs={dynamicTabs} />
          ) : activeTab === "Sales" ? (
             <SalesView spreadsheetId={spreadsheetId} />
          ) : activeTab === "Global Categories" ? (
             <GlobalCategoriesView spreadsheetId={spreadsheetId} dynamicTabs={dynamicTabs} />
          ) : activeTab === "Storage Locations" ? (
             <GlobalLocationsView spreadsheetId={spreadsheetId} dynamicTabs={dynamicTabs} />
          ) : (
             <InventoryView spreadsheetId={spreadsheetId} sheetName={activeTab} />
          )}
        </div>
      </main>
    </div>
  );
}
