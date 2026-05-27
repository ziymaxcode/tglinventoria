import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { google } from "googleapis";

export const apiRouter = express.Router();

apiRouter.use(express.json());

// Middleware to extract token
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.status(401).json({ error: "Missing token" });
  
  req.token = token;
  next();
};

const getSheetsClient = (token: string) => {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: token });
  return google.sheets({ version: 'v4', auth: oauth2Client });
};

// Convert Sheet rows array format to JSON array of objects based on header row
function rowsToObjects(rows: any[]) {
  if (!rows || rows.length === 0) return [];
  const headers = rows[0];
  const data = rows.slice(1);
  return data.map((row: any[], rowIndex: number) => {
    const obj: any = { _rowIndex: rowIndex + 2 }; // +2 because 1-indexed and row 1 is header
    headers.forEach((header: string, index: number) => {
      obj[header] = row[index] || "";
    });
    return obj;
  });
}

const parseConfigResponse = (rows: any[]) => {
  if (!rows || rows.length < 2) return { categories: [], subcategories: [], locations: [], productTabs: [] };
  const categories: string[] = [];
  const subcategories: string[] = [];
  const locations: string[] = [];
  const productTabs: string[] = [];
  
  // Skip header row [0]
  for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[0]) categories.push(row[0]);
      if (row[1]) subcategories.push(row[1]);
      if (row[2]) locations.push(row[2]);
      if (row[3]) productTabs.push(row[3]);
  }
  return { categories, subcategories, locations, productTabs };
};

// --- API Routes ---

// Get Config
apiRouter.get("/config/:spreadsheetId", authenticateToken, async (req: any, res) => {
  try {
    const { spreadsheetId } = req.params;
    const sheets = getSheetsClient(req.token);
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "AppConfig",
    });
    
    const config = parseConfigResponse(response.data.values);
    res.json(config);
  } catch (error: any) {
    const msg = error.message || "";
    if (msg.includes("Unable to parse range") || msg.includes("cannot be parsed")) {
       // Sheet doesn't exist yet, return empty
       return res.json({ categories: [], subcategories: [], locations: [] });
    }
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Save config
apiRouter.post("/config/:spreadsheetId", authenticateToken, async (req: any, res) => {
  try {
    const { spreadsheetId } = req.params;
    const categories = req.body.categories || [];
    const subcategories = req.body.subcategories || [];
    const locations = req.body.locations || [];
    const productTabs = req.body.productTabs || [];
    const sheets = getSheetsClient(req.token);

    // Create sheet if doesn't exist (we can try to append/update, but let's check first)
    try {
      await sheets.spreadsheets.values.get({ spreadsheetId, range: "AppConfig!A1" });
    } catch (e: any) {
      const msg = e.message || "";
      if (msg.includes("Unable to parse range") || msg.includes("cannot be parsed")) {
         // Need to add sheet
         try {
           await sheets.spreadsheets.batchUpdate({
             spreadsheetId,
             requestBody: {
               requests: [{ addSheet: { properties: { title: "AppConfig" } } }]
             }
           });
         } catch (addErr: any) {
           console.warn("Failed to add sheet, might already exist:", addErr.message);
         }
      } else {
         throw e;
      }
    }

    // Convert arrays to columns: col A = category, col B = subcategory, col C = location, col D = productTabs
    const maxRows = Math.max(categories.length, subcategories.length, locations.length, productTabs.length);
    const rows = [["Category", "Subcategory", "Location", "ProductTabs"]];
    for (let i = 0; i < maxRows; i++) {
      rows.push([
         categories[i] || "",
         subcategories[i] || "",
         locations[i] || "",
         productTabs[i] || ""
      ]);
    }

    // Clear existing first
    try {
      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: "AppConfig!A:D"
      });
    } catch (clearErr: any) {
       console.warn("Clear failed, ignoring:", clearErr.message);
    }

    // Write new values
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "AppConfig!A1",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: rows }
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Get all data from a specific sheet tab
apiRouter.get("/inventory/:spreadsheetId/:sheetName", authenticateToken, async (req: any, res) => {
  try {
    const { spreadsheetId, sheetName } = req.params;
    const sheets = getSheetsClient(req.token);
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}`, // Get all cells in the sheet
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return res.json([]);
    }
    
    const items = rowsToObjects(rows);
    res.json(items);
  } catch (error: any) {
    console.error(error);
    const msg = error.message || "";
    if (msg.includes("Unable to parse range") || msg.includes("cannot be parsed") || msg.includes("cannot find sheet")) {
      // Sheet doesn't exist yet, return empty array.
      return res.json([]);
    }
    res.status(500).json({ error: error.message });
  }
});

// Global Search across multiple tabs
apiRouter.get("/search/:spreadsheetId", authenticateToken, async (req: any, res) => {
  try {
    const { spreadsheetId } = req.params;
    const { q, tabs } = req.query; // q is search query, tabs is comma separated
    
    if (!q || typeof q !== 'string' || q.trim() === '') {
      return res.json([]);
    }

    if (!tabs || typeof tabs !== 'string') {
      return res.json([]);
    }

    const sheetNames = tabs.split(",").filter((t: string) => t.trim() !== "");
    const sheets = getSheetsClient(req.token);

    // Get actual sheets to avoid querying non-existent ones
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const actualSheetNames = spreadsheet.data.sheets?.map(s => s.properties?.title).filter(Boolean) as string[] || [];
    const validSheetNames = sheetNames.filter((name: string) => actualSheetNames.includes(name));

    if (validSheetNames.length === 0) {
      return res.json([]);
    }
    
    // Batch get all valid tabs
    const response = await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: validSheetNames.map(name => `'${name}'`),
    });

    const valueRanges = response.data.valueRanges || [];
    
    let allItems: any[] = [];
    valueRanges.forEach((rangeObj, index) => {
       const rows = rangeObj.values;
       if (!rows || rows.length === 0) return;
       const items = rowsToObjects(rows);
       
       // Inject sheetName / category into each item
       const sheetName = validSheetNames[index];
       items.forEach((item: any) => {
          item._sheetName = sheetName;
          allItems.push(item);
       });
    });

    const query = q.toLowerCase();
    
    const matchedItems = allItems.filter((item) => {
      const name = (item["Item Name"] || item.item_name || "").toLowerCase();
      const code = (item["Item Code"] || item.item_code || "").toLowerCase();
      const pid = (item["Product ID"] || item.product_id || "").toLowerCase();
      const loc = (item["Location"] || item.location || "").toLowerCase();
      
      // Initials of name
      const initials = name.split(/\s+/).map((w: string) => w[0]).join("");

      return name.includes(query) || 
             code.includes(query) || 
             pid.includes(query) || 
             loc.includes(query) ||
             initials.includes(query);
    });

    // Aggregate by product_id or item_name
    const aggregatedMap: Record<string, any> = {};

    matchedItems.forEach(item => {
       const prodId = item["Product ID"] || item.product_id;
       const itemName = item["Item Name"] || item.item_name;
       const itemCode = item["Item Code"] || item.item_code;
       const itemStock = item["Stock"] || item.stock;
       const itemLocation = item["Location"] || item.location;

       const key = prodId || itemName || "unknown";
       if (!aggregatedMap[key]) {
          aggregatedMap[key] = {
             product_id: prodId,
             item_code: itemCode,
             item_name: itemName,
             total_stock: 0,
             locations: [] as any[],
          };
       }
       
       const stock = parseInt(itemStock || "0", 10);
       if (!isNaN(stock)) {
          aggregatedMap[key].total_stock += stock;
       }
       
       // push location and stock specific to this location
       if (itemLocation) {
          aggregatedMap[key].locations.push({
             name: itemLocation,
             stock: isNaN(stock) ? 0 : stock,
             sheetName: item._sheetName
          });
       }
    });

    res.json(Object.values(aggregatedMap));

  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Append a new item
apiRouter.post("/inventory/:spreadsheetId/:sheetName", authenticateToken, async (req: any, res) => {
  try {
    const { spreadsheetId, sheetName } = req.params;
    const data = req.body; // Array of values corresponding to columns
    const sheets = getSheetsClient(req.token);

    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:A`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [data]
        }
      });
    } catch (e: any) {
      const msg = e.message || "";
      if (msg.includes("Unable to parse range") || msg.includes("cannot be parsed") || msg.includes("cannot find sheet")) {
        // Need to add sheet
        try {
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
              requests: [{ addSheet: { properties: { title: sheetName } } }]
            }
          });
          // If it's the SalesHistory sheet, we should probably add headers.
          if (sheetName === "SalesHistory") {
             await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `${sheetName}!A1`,
                valueInputOption: "USER_ENTERED",
                requestBody: { values: [["Date", "Receipt ID", "Items", "Total", "Payment Method", "Cashier", "Customer"]] },
             });
          } else if (sheetName !== "AppConfig") {
             await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `${sheetName}!A1`,
                valueInputOption: "USER_ENTERED",
                requestBody: { values: [['product_id', 'item_code', 'item_name', 'description', 'stock', 'selling_price', 'category', 'supplier', 'image', 'specs', 'subcategory', 'purchase_price', 'tax', 'location']] },
             });
          }
          // Retry append
          await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `${sheetName}!A:A`,
            valueInputOption: "USER_ENTERED",
            requestBody: {
              values: [data]
            }
          });
        } catch (addErr: any) {
          throw new Error(`Failed to create sheet ${sheetName}: ${addErr.message}`);
        }
      } else {
         throw e;
      }
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Update a specific row
apiRouter.put("/inventory/:spreadsheetId/:sheetName/:rowIndex", authenticateToken, async (req: any, res) => {
  try {
    const { spreadsheetId, sheetName, rowIndex } = req.params;
    const data = req.body; // Array of values
    const sheets = getSheetsClient(req.token);

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      // Assuming A to AA range is enough for columns
      range: `${sheetName}!A${rowIndex}:AA${rowIndex}`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [data]
      }
    });
    res.json({ success: true });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

apiRouter.delete("/inventory/:spreadsheetId/:sheetName/:rowIndex", authenticateToken, async (req: any, res) => {
  try {
    const { spreadsheetId, sheetName, rowIndex } = req.params;
    const sheets = getSheetsClient(req.token);

    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet = spreadsheet.data.sheets?.find(s => s.properties?.title === sheetName);
    if (!sheet || sheet.properties?.sheetId === undefined) {
       return res.status(404).json({ error: "Sheet not found" });
    }
    const sheetId = sheet.properties.sheetId;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: "ROWS",
                startIndex: parseInt(rowIndex) - 1,
                endIndex: parseInt(rowIndex)
              }
            }
          }
        ]
      }
    });
    res.json({ success: true });
  } catch (error: any) {
    console.error("Delete error:", error);
    res.status(500).json({ error: error.message });
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use("/api", apiRouter);

  // --- Vite Middleware for Development ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // Since Express 4.x
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

// Only start the server if we are not being imported (e.g. by Vercel serverless)
if (process.env.NODE_ENV === "development" || !process.env.VERCEL) {
  startServer();
}

export default apiRouter;
